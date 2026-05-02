/**
 * NIM Chat Worker
 *
 * Required bindings:
 * - NIM_KV: Workers KV namespace
 * - NIM_API_KEY: Secret NVIDIA NIM API key
 * - USER_PASSWORD or USER_PASSWORD_HASH: normal gate password or SHA-256 hex
 * - ADMIN_PASSWORD or ADMIN_PASSWORD_HASH: admin gate password or SHA-256 hex
 *
 * Optional bindings:
 * - NIM_API_BASE_URL: defaults to NVIDIA NIM chat completions endpoint
 * - SESSION_TTL_SECONDS: defaults to 86400
 * - ALLOWED_ORIGIN: comma-separated origins or *; defaults to *
 */

const DEFAULT_NIM_API = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_SESSION_TTL = 86400;
const CHAT_TTL = 86400 * 30;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        message: error?.message || String(error),
        stack: error?.stack,
      }));
      return json(request, env, { error: "Internal server error" }, 500);
    }
  },
};

async function route(request, env, ctx) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const url = new URL(request.url);
  const path = normalizePath(url.pathname);

  if (path === "/api/auth" && request.method === "POST") return handleAuth(request, env);
  if (path === "/api/proxy" && request.method === "POST") return handleProxy(request, env);
  if (path === "/api/chat/save" && request.method === "POST") return handleChatSave(request, env, false);

  if (path === "/api/sessions" && request.method === "GET") return handleSessions(request, env);
  if (path.startsWith("/api/sessions/") && request.method === "DELETE") {
    return handleDeleteSession(request, env, decodeURIComponent(path.slice("/api/sessions/".length)));
  }

  if (path === "/api/chats" && request.method === "GET") return handleChats(request, env, false);
  if (path === "/api/admin-chats" && request.method === "GET") return handleChats(request, env, true);
  if (path === "/api/admin-chats" && request.method === "POST") return handleChatSave(request, env, true);

  if (path === "/api/block" && (request.method === "POST" || request.method === "DELETE")) return handleBlock(request, env);
  if (path === "/api/blocklist" && request.method === "GET") return handleBlocklist(request, env);
  if (path === "/api/config" && request.method === "GET") return handleConfigGet(request, env);
  if (path === "/api/config" && request.method === "POST") return handleConfigSet(request, env);

  return json(request, env, { error: "Not found" }, 404);
}

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

async function handleAuth(request, env) {
  assertBinding(env.NIM_KV, "NIM_KV");

  const body = await readJson(request);
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) return json(request, env, { error: "Password required" }, 400);

  const client = clientInfo(request);
  const blocks = await getBlocklists(env);
  const blockMatch = matchBlock(client, blocks);
  if (blockMatch) return json(request, env, { error: "Access denied", reason: blockMatch }, 403);

  const role = await resolveRole(password, env);
  if (!role) return json(request, env, { error: "Invalid password" }, 401);

  const config = await getConfig(env);
  if (config.maintenance && role !== "admin") {
    return json(request, env, { error: "Site under maintenance" }, 503);
  }

  const ttl = sessionTtl(env);
  const token = await randomToken();
  const now = Date.now();
  const session = {
    token,
    role,
    ip: client.ip,
    userAgent: client.userAgent,
    browser: client.browser,
    os: client.os,
    device: client.device,
    country: client.country,
    city: client.city,
    colo: client.colo,
    createdAt: now,
    lastSeen: now,
    expiresAt: now + ttl * 1000,
    chatCount: 0,
    revoked: false,
  };

  await env.NIM_KV.put(sessionKey(token), JSON.stringify(session), { expirationTtl: ttl });
  return json(request, env, { token, role, expiresAt: session.expiresAt });
}

async function handleProxy(request, env) {
  assertBinding(env.NIM_KV, "NIM_KV");
  if (!env.NIM_API_KEY) return json(request, env, { error: "NIM_API_KEY secret is not configured" }, 500);

  const session = await requireSession(request, env);
  if (!session) return json(request, env, { error: "Unauthorized" }, 401);

  const upstream = await fetch(env.NIM_API_BASE_URL || DEFAULT_NIM_API, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("Content-Type") || "application/json",
      "Authorization": `Bearer ${env.NIM_API_KEY}`,
      "Accept": "text/event-stream",
      "Cache-Control": "no-cache",
    },
    body: request.body,
  });

  const headers = new Headers(corsHeaders(request, env));
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "text/event-stream; charset=utf-8");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("X-Accel-Buffering", "no");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

async function handleChatSave(request, env, adminOnly) {
  assertBinding(env.NIM_KV, "NIM_KV");
  const session = await requireSession(request, env, adminOnly);
  if (!session) return json(request, env, { error: adminOnly ? "Admin only" : "Unauthorized" }, adminOnly ? 403 : 401);

  const body = await readJson(request);
  const messages = Array.isArray(body.messages) ? body.messages.slice(-80).map(normalizeMessage).filter(Boolean) : [];
  if (!messages.length) return json(request, env, { ok: true });

  const now = Date.now();
  const conversationId = cleanId(body.conversationId) || String(now);
  const title = stringLimit(body.title || firstUserMessage(messages) || "Conversation", 90);
  const prefix = adminOnly ? "adminchats" : "chats";
  const key = `${prefix}/${session.token}/${conversationId}`;
  const record = {
    key,
    conversationId,
    title,
    role: session.role,
    sessionToken: session.token,
    ip: session.ip,
    userAgent: session.userAgent,
    browser: session.browser,
    os: session.os,
    country: session.country,
    city: session.city,
    model: stringLimit(body.model || "", 120),
    messages,
    savedAt: now,
    messageCount: messages.length,
  };

  await env.NIM_KV.put(key, JSON.stringify(record), { expirationTtl: CHAT_TTL });
  session.chatCount = (session.chatCount || 0) + 1;
  session.lastSeen = now;
  session.expiresAt = now + sessionTtl(env) * 1000;
  await env.NIM_KV.put(sessionKey(session.token), JSON.stringify(session), { expirationTtl: sessionTtl(env) });
  return json(request, env, { ok: true, key, savedAt: now });
}

async function handleSessions(request, env) {
  const admin = await requireSession(request, env, true);
  if (!admin) return json(request, env, { error: "Admin only" }, 403);

  const sessions = await listJson(env, "sessions/");
  return json(request, env, {
    sessions: sessions
      .filter((session) => session && !session.revoked)
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)),
  });
}

async function handleDeleteSession(request, env, token) {
  const admin = await requireSession(request, env, true);
  if (!admin) return json(request, env, { error: "Admin only" }, 403);
  if (!token) return json(request, env, { error: "Session token required" }, 400);

  await env.NIM_KV.delete(sessionKey(token));
  return json(request, env, { ok: true });
}

async function handleChats(request, env, adminChats) {
  const admin = await requireSession(request, env, true);
  if (!admin) return json(request, env, { error: "Admin only" }, 403);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 100, 250));
  const prefix = adminChats ? "adminchats/" : "chats/";
  const chats = await listJson(env, prefix);
  return json(request, env, {
    chats: chats
      .filter(Boolean)
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
      .slice(0, limit),
  });
}

async function handleBlock(request, env) {
  const admin = await requireSession(request, env, true);
  if (!admin) return json(request, env, { error: "Admin only" }, 403);

  const body = await readJson(request);
  const type = normalizeBlockType(body.type);
  const value = String(body.value || "").trim();
  if (!type || !value) return json(request, env, { error: "type and value required" }, 400);

  const key = blockKey(type);
  const list = await getJson(env, key, []);
  const normalized = type === "ips" ? value : value.toLowerCase();

  if (request.method === "DELETE") {
    const next = list.filter((item) => item !== normalized);
    await env.NIM_KV.put(key, JSON.stringify(next));
    return json(request, env, { ok: true, [type]: next });
  }

  if (!list.includes(normalized)) list.push(normalized);
  await env.NIM_KV.put(key, JSON.stringify(list));
  return json(request, env, { ok: true, [type]: list });
}

async function handleBlocklist(request, env) {
  const admin = await requireSession(request, env, true);
  if (!admin) return json(request, env, { error: "Admin only" }, 403);
  return json(request, env, await getBlocklists(env));
}

async function handleConfigGet(request, env) {
  const admin = await requireSession(request, env, true);
  if (!admin) return json(request, env, { error: "Admin only" }, 403);
  const config = await getConfig(env);
  return json(request, env, {
    maintenance: config.maintenance,
    sessionTtlSeconds: sessionTtl(env),
    nimApiBaseUrl: env.NIM_API_BASE_URL || DEFAULT_NIM_API,
    allowedOrigin: env.ALLOWED_ORIGIN || "*",
    hasNimApiKey: Boolean(env.NIM_API_KEY),
    hasUserPassword: Boolean(env.USER_PASSWORD || env.USER_PASSWORD_HASH || await env.NIM_KV.get("config/userHash")),
    hasAdminPassword: Boolean(env.ADMIN_PASSWORD || env.ADMIN_PASSWORD_HASH || await env.NIM_KV.get("config/adminHash")),
  });
}

async function handleConfigSet(request, env) {
  const admin = await requireSession(request, env, true);
  if (!admin) return json(request, env, { error: "Admin only" }, 403);

  const body = await readJson(request);
  if (typeof body.maintenance === "boolean") {
    await env.NIM_KV.put("config/maintenance", body.maintenance ? "true" : "false");
  }
  if (typeof body.userPassword === "string" && body.userPassword) {
    await env.NIM_KV.put("config/userHash", await sha256(body.userPassword));
  }
  if (typeof body.adminPassword === "string" && body.adminPassword) {
    await env.NIM_KV.put("config/adminHash", await sha256(body.adminPassword));
  }
  return json(request, env, { ok: true });
}

async function requireSession(request, env, adminOnly = false) {
  const token = request.headers.get("X-Session") || "";
  if (!token) return null;

  const raw = await env.NIM_KV.get(sessionKey(token));
  if (!raw) return null;

  const session = safeParse(raw, null);
  if (!session || session.revoked) return null;
  if (adminOnly && session.role !== "admin") return null;

  const client = clientInfo(request);
  const blocks = await getBlocklists(env);
  if (matchBlock(client, blocks)) return null;

  const now = Date.now();
  session.lastSeen = now;
  session.expiresAt = now + sessionTtl(env) * 1000;
  await env.NIM_KV.put(sessionKey(token), JSON.stringify(session), { expirationTtl: sessionTtl(env) });
  return session;
}

async function resolveRole(password, env) {
  const attemptHash = await sha256(password);
  const adminHash = await configuredHash(env.ADMIN_PASSWORD, env.ADMIN_PASSWORD_HASH, env, "config/adminHash");
  const userHash = await configuredHash(env.USER_PASSWORD, env.USER_PASSWORD_HASH, env, "config/userHash");

  if (adminHash && safeEqualHex(attemptHash, adminHash)) return "admin";
  if (userHash && safeEqualHex(attemptHash, userHash)) return "user";
  return null;
}

async function configuredHash(plain, hash, env, kvKey) {
  if (typeof hash === "string" && isSha256(hash)) return hash.toLowerCase();
  if (typeof plain === "string" && plain) return sha256(plain);
  const kvHash = await env.NIM_KV.get(kvKey);
  return isSha256(kvHash) ? kvHash.toLowerCase() : "";
}

function safeEqualHex(left, right) {
  if (!isSha256(left) || !isSha256(right)) return false;
  const a = hexToBytes(left.toLowerCase());
  const b = hexToBytes(right.toLowerCase());
  let diff = a.length ^ b.length;
  for (let i = 0; i < 32; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function hexToBytes(hex) {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

async function getConfig(env) {
  return {
    maintenance: (await env.NIM_KV.get("config/maintenance")) === "true",
  };
}

async function getBlocklists(env) {
  const [ips, userAgents, browsers] = await Promise.all([
    getJson(env, blockKey("ips"), []),
    getJson(env, blockKey("userAgents"), []),
    getJson(env, blockKey("browsers"), []),
  ]);
  return { ips, userAgents, browsers };
}

function matchBlock(client, blocks) {
  if (blocks.ips.includes(client.ip)) return "ip";
  const ua = client.userAgent.toLowerCase();
  if (blocks.userAgents.some((item) => item && ua.includes(item))) return "user-agent";
  if (blocks.browsers.includes(client.browser.toLowerCase())) return "browser";
  return "";
}

function normalizeBlockType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "ip" || t === "ips") return "ips";
  if (t === "ua" || t === "useragent" || t === "user-agent" || t === "useragents") return "userAgents";
  if (t === "browser" || t === "browsers") return "browsers";
  return "";
}

function blockKey(type) {
  return `blocklist/${type}`;
}

function sessionKey(token) {
  return `sessions/${token}`;
}

function cleanId(id) {
  return String(id || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 96);
}

function normalizeMessage(message) {
  const role = String(message?.role || "");
  if (!["system", "user", "assistant"].includes(role)) return null;
  return { role, content: stringLimit(message.content || "", 200000) };
}

function firstUserMessage(messages) {
  return messages.find((message) => message.role === "user")?.content;
}

function stringLimit(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max) : text;
}

async function listJson(env, prefix) {
  const output = [];
  let cursor;
  do {
    const page = await env.NIM_KV.list({ prefix, cursor, limit: 1000 });
    const values = await Promise.all(page.keys.map((key) => env.NIM_KV.get(key.name)));
    for (const raw of values) {
      const parsed = safeParse(raw, null);
      if (parsed) output.push(parsed);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return output;
}

async function getJson(env, key, fallback) {
  return safeParse(await env.NIM_KV.get(key), fallback);
}

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function clientInfo(request) {
  const ua = request.headers.get("User-Agent") || "unknown";
  const cf = request.cf || {};
  return {
    ip: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown",
    userAgent: ua,
    browser: browserName(ua),
    os: osName(ua),
    device: deviceName(ua),
    country: request.headers.get("CF-IPCountry") || cf.country || "XX",
    city: cf.city || "",
    colo: cf.colo || "",
  };
}

function browserName(ua) {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/curl\//i.test(ua)) return "curl";
  return "Unknown";
}

function osName(ua) {
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function deviceName(ua) {
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobile|iPhone|Android/i.test(ua)) return "Mobile";
  return "Desktop";
}

function sessionTtl(env) {
  const ttl = Number(env.SESSION_TTL_SECONDS);
  return Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : DEFAULT_SESSION_TTL;
}

function assertBinding(binding, name) {
  if (!binding) throw new Error(`${name} binding is not configured`);
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...Object.fromEntries(corsHeaders(request, env)), ...JSON_HEADERS },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = String(env.ALLOWED_ORIGIN || "*");
  const allowed = configured.split(",").map((item) => item.trim()).filter(Boolean);
  const allowOrigin = allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : allowed[0] || "null");
  return new Headers({
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session",
    "Access-Control-Expose-Headers": "Content-Type",
    "Vary": "Origin",
  });
}

async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
