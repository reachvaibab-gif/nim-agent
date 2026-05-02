/* admin.js — NIM Chat admin panel */

(function () {
  let _app = null;
  let _activeTab = "sessions";
  let _selectedSession = null;
  let _selectedChat = null;
  let _adminChatMessages = [];

  function init(appRef) {
    _app = appRef;
    const fab = document.getElementById("adminFab");
    if (fab) fab.addEventListener("click", openPanel);
    const closeBtn = document.getElementById("adminClose");
    if (closeBtn) closeBtn.addEventListener("click", closePanel);
    document.querySelectorAll(".admin-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
  }

  function openPanel() {
    document.getElementById("adminPanel")?.classList.remove("hidden");
    switchTab(_activeTab);
  }

  function closePanel() {
    document.getElementById("adminPanel")?.classList.add("hidden");
  }

  function switchTab(tab) {
    _activeTab = tab;
    document
      .querySelectorAll(".admin-tab")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.tab === tab),
      );
    const body = document.getElementById("adminBody");
    if (!body) return;
    body.innerHTML = loadingHtml();
    switch (tab) {
      case "sessions":
        renderSessions(body);
        break;
      case "chats":
        renderChats(body);
        break;
      case "blocklist":
        renderBlocklist(body);
        break;
      case "adminchat":
        renderAdminChat(body);
        break;
      case "config":
        renderConfig(body);
        break;
      default:
        body.innerHTML = `<p class="empty-admin">Unknown tab</p>`;
    }
  }

  // ── SESSIONS ──────────────────────────────────────────
  async function renderSessions(body) {
    try {
      const { sessions } = await adminGet("/api/sessions");
      body.innerHTML = `
        <div class="admin-toolbar">
          <div><h3>Sessions (${sessions.length})</h3><p>All authenticated sessions in the last 24h.</p></div>
          <button class="art-btn" onclick="window.NIMAdmin._refreshSessions()">Refresh</button>
        </div>
        <div class="admin-grid">
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>Role</th><th>IP</th><th>Country</th><th>Browser</th><th>OS</th><th>Device</th><th>Last seen</th><th>Chats</th><th></th></tr></thead>
              <tbody id="adminSessionsBody">${sessions.map(sessionRow).join("")}</tbody>
            </table>
          </div>
          <div class="admin-detail" id="adminSessionDetail"><p style="color:var(--muted);font-size:12px">Click a session to inspect.</p></div>
        </div>`;
    } catch (e) {
      body.innerHTML = errorHtml(e);
    }
  }

  function sessionRow(s) {
    const ago = relAgo(s.lastSeen);
    return `<tr onclick="window.NIMAdmin._selectSession('${escAttr(s.token)}')">
      <td><span class="role-dot ${s.role}"></span>${escHtml(s.role)}</td>
      <td style="font-family:var(--mono);font-size:11px">${escHtml(s.ip)}</td>
      <td>${escHtml(s.country)} ${escHtml(s.city || "")}</td>
      <td>${escHtml(s.browser || "?")}</td>
      <td>${escHtml(s.os || "?")}</td>
      <td>${escHtml(s.device || "?")}</td>
      <td>${escHtml(ago)}</td>
      <td>${s.chatCount || 0}</td>
      <td class="admin-actions">
        <button onclick="event.stopPropagation();window.NIMAdmin._revokeSession('${escAttr(s.token)}')">Revoke</button>
      </td>
    </tr>`;
  }

  function selectSession(token) {
    const detail = document.getElementById("adminSessionDetail");
    if (!detail) return;
    adminGet("/api/sessions")
      .then(({ sessions }) => {
        const s = sessions.find((x) => x.token === token);
        if (!s) return;
        _selectedSession = s;
        detail.innerHTML = `
        <div class="detail-head"><strong>${escHtml(s.role === "admin" ? "Admin" : "User")}</strong></div>
        <dl class="detail-list">
          <dt>Token</dt><dd><code>${escHtml(s.token.slice(0, 16))}…</code></dd>
          <dt>IP</dt><dd><code>${escHtml(s.ip)}</code></dd>
          <dt>Country</dt><dd>${escHtml(s.country)} ${escHtml(s.city || "")}</dd>
          <dt>Browser</dt><dd>${escHtml(s.browser || "?")} on ${escHtml(s.os || "?")}</dd>
          <dt>Device</dt><dd>${escHtml(s.device || "?")}</dd>
          <dt>User-Agent</dt><dd class="ua">${escHtml((s.userAgent || "").slice(0, 160))}</dd>
          <dt>First seen</dt><dd>${fmtDate(s.createdAt)}</dd>
          <dt>Last seen</dt><dd>${fmtDate(s.lastSeen)}</dd>
          <dt>Expires</dt><dd>${fmtDate(s.expiresAt)}</dd>
          <dt>Chats</dt><dd>${s.chatCount || 0}</dd>
        </dl>
        <div class="detail-actions">
          <button class="art-btn" onclick="window.NIMAdmin._blockIp('${escAttr(s.ip)}')">Block IP</button>
          <button class="art-btn" onclick="window.NIMAdmin._blockUa('${escAttr((s.userAgent || "").slice(0, 80))}')">Block UA</button>
          <button class="art-btn" onclick="window.NIMAdmin._blockBrowser('${escAttr(s.browser || "")}')">Block Browser</button>
          <button class="btn-ghost-danger" onclick="window.NIMAdmin._revokeSession('${escAttr(s.token)}')">Revoke session</button>
        </div>`;
      })
      .catch(() => {
        detail.innerHTML = errorHtml(new Error("Could not load session"));
      });
  }

  async function revokeSession(token) {
    if (!confirm("Revoke this session?")) return;
    await adminFetch(`/api/sessions/${encodeURIComponent(token)}`, {
      method: "DELETE",
    });
    _app?.toast("Session revoked");
    switchTab("sessions");
  }

  // ── CHATS ──────────────────────────────────────────────
  async function renderChats(body) {
    try {
      const [{ chats }, { chats: adminChats }] = await Promise.all([
        adminGet("/api/chats"),
        adminGet("/api/admin-chats"),
      ]);
      const all = [
        ...chats.map((c) => ({ ...c, _kind: "user" })),
        ...adminChats.map((c) => ({ ...c, _kind: "admin" })),
      ].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

      body.innerHTML = `
        <div class="admin-toolbar">
          <div><h3>All chats (${all.length})</h3><p>Saved conversation records.</p></div>
          <button class="art-btn" onclick="window.NIMAdmin._refreshChats()">Refresh</button>
        </div>
        <div class="chat-review">
          <div class="chat-review-list" id="chatList">${all.map(chatListItem).join("") || emptyHtml("No chats recorded yet.")}</div>
          <div class="chat-review-body" id="chatBody"><p style="color:var(--muted);font-size:12px">Select a chat to read.</p></div>
        </div>`;
    } catch (e) {
      body.innerHTML = errorHtml(e);
    }
  }

  function chatListItem(c) {
    const role = c._kind === "admin" ? "admin" : "user";
    return `<button onclick="window.NIMAdmin._selectChat('${escAttr(c.key)}')">
      <span><span class="chat-kind ${role}">${role}</span>${escHtml(c.title || "Untitled")}</span>
      <span>${escHtml(c.ip || "?")} · ${escHtml(relAgo(c.savedAt))}</span>
    </button>`;
  }

  async function selectChat(key) {
    const chatBody = document.getElementById("chatBody");
    if (!chatBody) return;
    chatBody.innerHTML = loadingHtml();
    try {
      const prefix = key.startsWith("adminchats/")
        ? "/api/admin-chats"
        : "/api/chats";
      const { chats } = await adminGet(`${prefix}?limit=250`);
      const chat = chats.find((c) => c.key === key);
      if (!chat) {
        chatBody.innerHTML = errorHtml(new Error("Not found"));
        return;
      }
      const messages = Array.isArray(chat.messages) ? chat.messages : [];
      chatBody.innerHTML = `
        <div class="chat-review-meta">
          <strong>${escHtml(chat.title || "Untitled")}</strong>
          <p>IP: ${escHtml(chat.ip || "?")} · Country: ${escHtml(chat.country || "?")} · Browser: ${escHtml(chat.browser || "?")} · ${escHtml(chat.model || "?")} · ${fmtDate(chat.savedAt)}</p>
        </div>
        <div class="admin-chat-transcript">
          ${messages.map((m) => `<article><strong>${escHtml(m.role)}</strong><div style="margin-top:4px;font-size:13px;white-space:pre-wrap;color:var(--text)">${escHtml((m.content || "").slice(0, 6000))}</div></article>`).join("") || emptyHtml("No messages.")}
        </div>`;
    } catch (e) {
      chatBody.innerHTML = errorHtml(e);
    }
  }

  // ── BLOCKLIST ─────────────────────────────────────────
  async function renderBlocklist(body) {
    try {
      const { ips, userAgents, browsers } = await adminGet("/api/blocklist");
      body.innerHTML = `
        <div class="admin-toolbar"><div><h3>Blocklist</h3><p>Block by IP, User-Agent substring, or browser name.</p></div></div>
        <div class="block-form">
          <select id="blockType">
            <option value="ips">IP</option>
            <option value="userAgents">User-Agent</option>
            <option value="browsers">Browser</option>
          </select>
          <input id="blockValue" placeholder="Enter value to block…" />
          <button class="btn-primary compact" onclick="window.NIMAdmin._addBlock()">Block</button>
        </div>
        <div class="block-cols">
          <div class="block-col"><h4>Blocked IPs (${ips.length})</h4>${blockItems(ips, "ips")}</div>
          <div class="block-col"><h4>Blocked User-Agents (${userAgents.length})</h4>${blockItems(userAgents, "userAgents")}</div>
          <div class="block-col"><h4>Blocked Browsers (${browsers.length})</h4>${blockItems(browsers, "browsers")}</div>
        </div>`;
    } catch (e) {
      body.innerHTML = errorHtml(e);
    }
  }

  function blockItems(list, type) {
    if (!list.length)
      return `<p style="color:var(--faint);font-size:12px">None</p>`;
    return list
      .map(
        (v) =>
          `<div class="block-item"><span>${escHtml(v)}</span><button onclick="window.NIMAdmin._removeBlock('${escAttr(type)}','${escAttr(v)}')">Unblock</button></div>`,
      )
      .join("");
  }

  async function addBlock() {
    const type = document.getElementById("blockType")?.value;
    const value = document.getElementById("blockValue")?.value.trim();
    if (!type || !value) return;
    await adminFetch("/api/block", {
      method: "POST",
      body: JSON.stringify({ type, value }),
    });
    _app?.toast(`Blocked: ${value}`);
    switchTab("blocklist");
  }

  async function removeBlock(type, value) {
    await adminFetch("/api/block", {
      method: "DELETE",
      body: JSON.stringify({ type, value }),
    });
    _app?.toast(`Unblocked: ${value}`);
    switchTab("blocklist");
  }

  // ── ADMIN CHAT ────────────────────────────────────────
  function renderAdminChat(body) {
    body.innerHTML = `
      <div class="admin-toolbar"><div><h3>Admin Private Chat</h3><p>Only visible to admin sessions. Not stored under user chat logs.</p></div></div>
      <div class="admin-private-chat" id="adminChatMessages">${
        _adminChatMessages
          .map(
            (m) =>
              `<article><strong>${escHtml(m.role)}</strong><div style="margin-top:4px;font-size:13px;white-space:pre-wrap">${escHtml(m.content)}</div></article>`,
          )
          .join("") ||
        `<p style="color:var(--muted)">Start a private admin conversation.</p>`
      }</div>
      <div class="admin-chat-input">
        <textarea id="adminChatInput" rows="3" placeholder="Ask something private…" style="resize:vertical"></textarea>
        <button class="btn-primary" id="adminChatSend" onclick="window.NIMAdmin._sendAdminChat()">Send</button>
      </div>`;
    document
      .getElementById("adminChatInput")
      ?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendAdminChat();
        }
      });
  }

  async function sendAdminChat() {
    const input = document.getElementById("adminChatInput");
    const text = input?.value.trim();
    if (!text) return;
    if (input) input.value = "";
    _adminChatMessages.push({ role: "user", content: text });
    refreshAdminChatDisplay();
    try {
      const reply = await _app?.sendAdminOnlyPrompt(_adminChatMessages);
      if (reply) _adminChatMessages.push({ role: "assistant", content: reply });
    } catch (e) {
      _adminChatMessages.push({
        role: "assistant",
        content: `Error: ${e.message}`,
      });
    }
    refreshAdminChatDisplay();
  }

  function refreshAdminChatDisplay() {
    const div = document.getElementById("adminChatMessages");
    if (!div) return;
    div.innerHTML =
      _adminChatMessages
        .map(
          (m) =>
            `<article><strong>${escHtml(m.role)}</strong><div style="margin-top:4px;font-size:13px;white-space:pre-wrap">${escHtml(m.content)}</div></article>`,
        )
        .join("") || `<p style="color:var(--muted)">No messages.</p>`;
    div.scrollTop = div.scrollHeight;
  }

  // ── CONFIG ────────────────────────────────────────────
  async function renderConfig(body) {
    try {
      const cfg = await adminGet("/api/config");
      body.innerHTML = `
        <div class="admin-toolbar"><div><h3>Configuration</h3><p>Server-side settings. Changes take effect immediately.</p></div></div>
        <div class="config-grid">
          <div class="config-facts">
            <div><span>Worker</span><strong>${escHtml(location.origin)}</strong></div>
            <div><span>NIM API Key</span><strong>${cfg.hasNimApiKey ? "✓ Configured" : "✗ Missing"}</strong></div>
            <div><span>User password</span><strong>${cfg.hasUserPassword ? "✓ Set" : "✗ Not set"}</strong></div>
            <div><span>Admin password</span><strong>${cfg.hasAdminPassword ? "✓ Set" : "✗ Not set"}</strong></div>
            <div><span>Session TTL</span><strong>${cfg.sessionTtlSeconds}s</strong></div>
            <div><span>CORS origin</span><strong>${escHtml(cfg.allowedOrigin || "*")}</strong></div>
          </div>

          <label class="toggle-row">
            <input type="checkbox" id="cfgMaintenance" ${cfg.maintenance ? "checked" : ""}/>
            <span>Maintenance mode (blocks non-admin logins)</span>
          </label>
          <button class="art-btn" style="width:max-content" onclick="window.NIMAdmin._setMaintenance()">Save maintenance</button>

          <div class="password-config">
            <label>Change user password</label>
            <input type="password" id="cfgUserPw" placeholder="New password (leave blank to keep)"/>
            <label style="margin-top:10px">Change admin password</label>
            <input type="password" id="cfgAdminPw" placeholder="New password (leave blank to keep)"/>
            <button class="btn-primary compact" style="margin-top:10px;width:max-content" onclick="window.NIMAdmin._changePasswords()">Update passwords</button>
          </div>

          <div class="form-group">
            <label>Base system prompt</label>
            <textarea id="cfgBasePrompt" rows="4">${escHtml(cfg.baseSystemPrompt || "")}</textarea>
          </div>
          <div class="form-group">
            <label>Admin chat system prompt</label>
            <textarea id="cfgAdminPrompt" rows="4">${escHtml(cfg.adminSystemPrompt || "")}</textarea>
          </div>
          <button class="art-btn" style="width:max-content" onclick="window.NIMAdmin._savePrompts()">Save prompts</button>
        </div>`;
    } catch (e) {
      body.innerHTML = errorHtml(e);
    }
  }

  async function setMaintenance() {
    const checked = document.getElementById("cfgMaintenance")?.checked;
    await adminFetch("/api/config", {
      method: "POST",
      body: JSON.stringify({ maintenance: Boolean(checked) }),
    });
    _app?.toast(checked ? "Maintenance mode ON" : "Maintenance mode OFF");
  }

  async function changePasswords() {
    const userPw = document.getElementById("cfgUserPw")?.value;
    const adminPw = document.getElementById("cfgAdminPw")?.value;
    if (!userPw && !adminPw) {
      _app?.toast("Enter at least one password", "error");
      return;
    }
    const payload = {};
    if (userPw) payload.userPassword = userPw;
    if (adminPw) payload.adminPassword = adminPw;
    await adminFetch("/api/config", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    _app?.toast("Passwords updated. Re-login required.");
  }

  async function savePrompts() {
    const base = document.getElementById("cfgBasePrompt")?.value;
    const admin = document.getElementById("cfgAdminPrompt")?.value;
    await adminFetch("/api/config", {
      method: "POST",
      body: JSON.stringify({
        baseSystemPrompt: base,
        adminSystemPrompt: admin,
      }),
    });
    _app?.toast("Prompts saved");
  }

  // ── HELPERS ───────────────────────────────────────────
  async function adminGet(path) {
    const r = await adminFetch(path);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || `HTTP ${r.status}`);
    }
    return r.json();
  }

  function adminFetch(path, options = {}) {
    const base = _app?.state?.apiBase || "";
    const headers = new Headers(options.headers || {});
    headers.set("X-Session", _app?.state?.token || "");
    headers.set("Content-Type", "application/json");
    return fetch(`${base}${path}`, { ...options, headers });
  }

  async function blockIp(ip) {
    await adminFetch("/api/block", {
      method: "POST",
      body: JSON.stringify({ type: "ips", value: ip }),
    });
    _app?.toast(`Blocked IP: ${ip}`);
    switchTab("sessions");
  }
  async function blockUa(ua) {
    await adminFetch("/api/block", {
      method: "POST",
      body: JSON.stringify({ type: "userAgents", value: ua }),
    });
    _app?.toast("UA blocked");
    switchTab("sessions");
  }
  async function blockBrowser(br) {
    await adminFetch("/api/block", {
      method: "POST",
      body: JSON.stringify({ type: "browsers", value: br.toLowerCase() }),
    });
    _app?.toast(`Blocked browser: ${br}`);
    switchTab("sessions");
  }

  function loadingHtml() {
    return `<div class="admin-loading">Loading…</div>`;
  }
  function errorHtml(e) {
    return `<div class="admin-error">Error: ${escHtml(e?.message || String(e))}</div>`;
  }
  function emptyHtml(m) {
    return `<div class="empty-admin">${escHtml(m)}</div>`;
  }

  function relAgo(ts) {
    if (!ts) return "—";
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString();
  }

  function escHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(v) {
    return escHtml(v).replace(/'/g, "&#039;");
  }

  window.NIMAdmin = {
    init,
    _refreshSessions() {
      renderSessions(document.getElementById("adminBody"));
    },
    _refreshChats() {
      renderChats(document.getElementById("adminBody"));
    },
    _selectSession: selectSession,
    _selectChat: selectChat,
    _revokeSession: revokeSession,
    _addBlock: addBlock,
    _removeBlock: removeBlock,
    _blockIp: blockIp,
    _blockUa: blockUa,
    _blockBrowser: blockBrowser,
    _sendAdminChat: sendAdminChat,
    _setMaintenance: setMaintenance,
    _changePasswords: changePasswords,
    _savePrompts: savePrompts,
  };
})();
