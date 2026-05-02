/* NIM Chat app controller */

const STORAGE_KEY = "nim_chat_v6";
const SESSION_KEY = "nim_session_v1";
const DEFAULT_API_BASE = "https://nim-proxy.jookkk4.workers.dev";
const DEFAULT_MODEL = "qwen/qwen3-coder-480b-a35b-instruct";
const CONTEXT_LIMIT = 50000;
const MAX_ATTACH_BYTES = 1024 * 1024;

const MODEL_LABELS = {
  "qwen/qwen3-coder-480b-a35b-instruct": "Qwen3 Coder 480B",
  "meta/llama-3.1-405b-instruct": "Llama 3.1 405B",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1": "Nemotron Ultra 253B",
  "mistralai/mistral-large-2-instruct": "Mistral Large 2",
};

const BASE_SYSTEM_PROMPT = "You are NIM Chat, a precise engineering assistant. Be direct, complete, and careful. When code is useful, provide working code and explain the tradeoffs briefly.";
const PROJECT_PROMPT = `${BASE_SYSTEM_PROMPT}

When creating a full project, output complete files using this exact format:

**path/to/file.ext**
\`\`\`language
file contents
\`\`\`

Include package files, README, configuration, source, and tests when appropriate.`;

const ARTIFACT_PROMPT = `When the user asks for a UI, document, runnable HTML, component, chart, long code file, or full project artifact, provide a concise chat answer and then include one or more artifacts. Use this format:

<artifact type="html|code|markdown|project" title="Short title" language="optional">
artifact content here
</artifact>

HTML artifacts must be complete standalone HTML documents when previewable.`;

let state = {
  apiBase: DEFAULT_API_BASE,
  token: "",
  role: "",
  expiresAt: 0,
  model: DEFAULT_MODEL,
  allowedModels: Object.keys(MODEL_LABELS),
  systemPrompt: BASE_SYSTEM_PROMPT,
  conversations: {},
  activeId: "",
  projects: {},
  activeProjectId: "",
  agents: [],
  activeAgentId: "",
  canCustomize: false,
  generating: false,
  abortController: null,
  projectMode: false,
  attachments: [],
  currentFiles: [],
};

let autoScroll = true;
let pendingDeleteId = "";

window.addEventListener("DOMContentLoaded", init);

function init() {
  configureMarkdown();
  loadLocalState();
  loadSession();
  bindEvents();
  exposeAppApi();

  if (window.NIMArtifacts) window.NIMArtifacts.init({ getState: () => state, toast, renderMarkdown, escHtml });
  if (window.NIMAdmin) window.NIMAdmin.init(window.NIMApp);

  if (hasValidSession()) showApp();
  else showGate();
}

function configureMarkdown() {
  if (!window.marked) return;
  marked.setOptions({ breaks: true, gfm: true, mangle: false, headerIds: false });
}

function bindEvents() {
  on("gateBtn", "click", authenticate);
  on("gatePassword", "keydown", (event) => {
    if (event.key === "Enter") authenticate();
  });
  on("gateProxy", "keydown", (event) => {
    if (event.key === "Enter") authenticate();
  });

  on("newChatBtn", "click", () => newChat());
  on("sidebarNewChatBtn", "click", () => newChat());
  on("tempChatBtn", "click", () => newTempChat());
  on("sidebarToggle", "click", toggleSidebar);
  on("searchBtn", "click", openSearch);
  on("navSearchBtn", "click", openSearch);
  on("navChatsBtn", "click", focusChats);
  on("navProjectsBtn", "click", openProjects);
  on("navAgentsBtn", "click", openAgents);
  on("navArtifactsBtn", "click", openArtifactsLibrary);
  on("navCustomizeBtn", "click", openSettings);
  on("signOutBtn", "click", logout);
  on("modelSelect", "change", (event) => {
    if (state.role !== "admin") return;
    state.model = event.target.value || state.model;
    updateModelBadge();
    toast("Admin model selected for this session");
  });

  on("settingsBtn", "click", openSettings);
  on("settingsClose", "click", closeSettings);
  on("saveSettingsBtn", "click", saveSettings);
  on("clearDataBtn", "click", clearAllData);
  on("settingsModal", "click", (event) => {
    if (event.target === $("settingsModal")) closeSettings();
  });
  on("projectsClose", "click", closeProjects);
  on("saveProjectBtn", "click", saveProjectFromModal);
  on("deleteProjectBtn", "click", deleteActiveProject);
  on("clearProjectBtn", "click", clearActiveProject);
  on("projectsModal", "click", (event) => {
    if (event.target === $("projectsModal")) closeProjects();
  });
  on("agentsClose", "click", closeAgents);
  on("saveAgentBtn", "click", saveAgentFromModal);
  on("deleteAgentBtn", "click", deleteActiveAgent);
  on("clearAgentBtn", "click", clearActiveAgent);
  on("agentsModal", "click", (event) => {
    if (event.target === $("agentsModal")) closeAgents();
  });

  on("deleteCancelBtn", "click", closeDeleteModal);
  on("deleteConfirmBtn", "click", confirmDelete);
  on("stopBtn", "click", stopGeneration);
  on("projectModeBtn", "click", toggleProjectMode);

  on("attachBtn", "click", () => $("fileInput")?.click());
  on("fileInput", "change", (event) => handleFiles(event.target.files));
  on("downloadAllBtn", "click", downloadZip);
  on("closeFilePanelBtn", "click", closeFilePanel);
  on("filePreviewClose", "click", closeFilePreview);
  on("previewDlBtn", "click", downloadPreviewedFile);
  on("filePreviewModal", "click", (event) => {
    if (event.target === $("filePreviewModal")) closeFilePreview();
  });

  const messagesContainer = $("messagesContainer");
  if (messagesContainer) {
    messagesContainer.addEventListener("scroll", () => {
      autoScroll = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 96;
    });
  }

  on("sendBtn", "click", sendMessage);
  const input = $("messageInput");
  if (input) {
    input.addEventListener("input", () => {
      autoResize(input);
      updateSendButton();
      updateContextRing();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!$("sendBtn").disabled) sendMessage();
      }
    });
  }

  document.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      const target = $("messageInput");
      target.value = button.dataset.msg || "";
      autoResize(target);
      updateSendButton();
      updateContextRing();
      target.focus();
    });
  });

  on("searchOverlay", "click", (event) => {
    if (event.target === $("searchOverlay")) closeSearch();
  });
  on("searchInput", "input", renderSearchResults);

  document.addEventListener("keydown", handleShortcuts);
}

function on(id, type, handler) {
  const element = $(id);
  if (element) element.addEventListener(type, handler);
}

function $(id) {
  return document.getElementById(id);
}

function exposeAppApi() {
  window.NIMApp = {
    state,
    api,
    authHeaders,
    saveLocalState,
    saveRemoteConversation,
    renderMarkdown,
    escHtml,
    toast,
    modelLabel,
    createChatMessage,
    sendStandalonePrompt,
    sendAdminOnlyPrompt,
    getActiveConversation: () => state.conversations[state.activeId],
    getActiveProject: () => state.projects[state.activeProjectId],
    getActiveAgent: () => state.agents.find((agent) => agent.id === state.activeAgentId),
    renderFilePanel,
    parseGeneratedFiles,
    showApp,
    showGate,
    logout,
    openProjects,
    openAgents,
    openArtifactsLibrary,
  };
}

function loadLocalState() {
  const data = safeParse(localStorage.getItem(STORAGE_KEY), {});
  state.apiBase = savedApiBase(data.apiBase || localStorage.getItem("nim_worker_url"));
  state.model = data.model || DEFAULT_MODEL;
  state.systemPrompt = data.systemPrompt || BASE_SYSTEM_PROMPT;
  state.conversations = data.conversations || {};
  state.activeId = data.activeId || "";
  state.projects = data.projects || {};
  state.activeProjectId = state.projects[data.activeProjectId] ? data.activeProjectId : "";
  state.activeAgentId = data.activeAgentId || "";
  state.projectMode = Boolean(data.projectMode);
}

function loadSession() {
  const session = safeParse(sessionStorage.getItem(SESSION_KEY), null) || safeParse(localStorage.getItem(SESSION_KEY), null);
  if (!session) return;
  state.token = session.token || "";
  state.role = session.role || "";
  state.expiresAt = Number(session.expiresAt) || 0;
}

function saveLocalState() {
  const conversations = {};
  for (const [id, conversation] of Object.entries(state.conversations)) {
    if (!conversation.temp) conversations[id] = conversation;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    apiBase: state.apiBase,
    model: state.model,
    systemPrompt: state.systemPrompt,
    conversations,
    activeId: state.conversations[state.activeId]?.temp ? "" : state.activeId,
    projects: state.projects,
    activeProjectId: state.activeProjectId,
    activeAgentId: state.activeAgentId,
    projectMode: state.projectMode,
  }));
  if (state.apiBase) localStorage.setItem("nim_worker_url", state.apiBase);
}

function saveSession() {
  const payload = JSON.stringify({ token: state.token, role: state.role, expiresAt: state.expiresAt });
  localStorage.setItem(SESSION_KEY, payload);
  sessionStorage.setItem(SESSION_KEY, payload);
}

function clearSession() {
  state.token = "";
  state.role = "";
  state.expiresAt = 0;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function hasValidSession() {
  return Boolean(state.token && state.expiresAt && Date.now() < state.expiresAt);
}

async function authenticate() {
  const password = $("gatePassword")?.value || "";
  const proxy = $("gateProxy")?.value.trim() || state.apiBase || "";
  const button = $("gateBtn");
  hideGateError();

  if (!password) return showGateError("Enter the access password.");
  state.apiBase = normalizeApiBase(proxy);
  saveLocalState();

  setBusy(button, true, "Checking...");
  try {
    const response = await api("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }, false);
    if (!response.ok) throw await responseError(response);

    const data = await response.json();
    state.token = data.token;
    state.role = data.role;
    state.expiresAt = data.expiresAt;
    saveSession();
    $("gatePassword").value = "";
    showApp();
  } catch (error) {
    showGateError(error.message || "Could not authenticate. Check the password and Worker URL.");
  } finally {
    setBusy(button, false, "Continue");
  }
}

function showGate() {
  $("gate")?.classList.remove("hidden");
  $("app")?.classList.add("hidden");
  $("adminFab")?.classList.add("hidden");
  $("gateProxy") && ($("gateProxy").value = state.apiBase);
  setTimeout(() => $("gatePassword")?.focus(), 50);
}

function showApp() {
  $("gate")?.classList.add("hidden");
  $("app")?.classList.remove("hidden");
  document.body.classList.toggle("admin-session", state.role === "admin");
  $("adminFab")?.classList.toggle("hidden", state.role !== "admin");
  applyRoleUi();

  updateModelBadge();
  updateTempBadge();
  updateProjectButton();
  updateActiveProjectPill();
  updateActiveAgentPill();
  renderSidebar();
  if (state.activeId && state.conversations[state.activeId]) renderMessages();
  else newChat();
  updateContextRing();
  loadBootstrap().catch((error) => toast(error.message || "Could not sync config", "error"));
  $("messageInput")?.focus();
}

async function loadBootstrap() {
  const response = await api("/api/bootstrap");
  if (!response.ok) throw await responseError(response);
  const data = await response.json();
  state.role = data.role || state.role;
  state.canCustomize = Boolean(data.canCustomize);
  state.allowedModels = Array.isArray(data.allowedModels) && data.allowedModels.length ? data.allowedModels : state.allowedModels;
  state.model = data.defaultModel || state.model;
  state.agents = Array.isArray(data.agents) ? data.agents : [];
  if (state.activeAgentId && !state.agents.some((agent) => agent.id === state.activeAgentId)) state.activeAgentId = "";
  applyRoleUi();
  updateModelBadge();
  updateModelControls();
  updateActiveAgentPill();
  saveLocalState();
}

function applyRoleUi() {
  const admin = state.role === "admin";
  document.body.classList.toggle("admin-session", admin);
  $("settingsBtn")?.classList.toggle("hidden", !admin);
  $("navCustomizeBtn")?.classList.toggle("hidden", !admin);
  $("modelSelect")?.classList.toggle("hidden", !admin);
}

async function logout() {
  api("/api/logout", { method: "POST" }).catch(() => {});
  clearSession();
  state.generating = false;
  state.abortController?.abort();
  $("adminPanel")?.classList.add("hidden");
  $("settingsModal")?.classList.add("hidden");
  $("projectsModal")?.classList.add("hidden");
  showGate();
}

function showGateError(message) {
  const error = $("gateError");
  if (!error) return;
  error.textContent = message;
  error.classList.remove("hidden");
}

function hideGateError() {
  $("gateError")?.classList.add("hidden");
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = label;
}

function normalizeApiBase(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  return text;
}

function savedApiBase(value) {
  const normalized = normalizeApiBase(value);
  const pageOrigin = normalizeApiBase(location.origin);
  if (!normalized || normalized === pageOrigin) return DEFAULT_API_BASE;
  return normalized;
}

function api(path, options = {}, includeSession = true) {
  const base = state.apiBase || "";
  const url = base ? `${base}${path}` : path;
  const headers = new Headers(options.headers || {});
  if (includeSession && state.token) headers.set("X-Session", state.token);
  return fetch(url, { ...options, headers });
}

function authHeaders(extra = {}) {
  return { ...extra, "X-Session": state.token };
}

async function responseError(response) {
  const data = await response.json().catch(() => ({}));
  return new Error(data.error || data.message || `HTTP ${response.status}`);
}

function newChat() {
  const id = `c_${Date.now()}`;
  state.conversations[id] = {
    id,
    title: "New chat",
    messages: [],
    temp: false,
    projectId: state.activeProjectId || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.activeId = id;
  state.attachments = [];
  saveLocalState();
  renderSidebar();
  renderMessages();
  renderAttachments();
  updateActiveProjectPill();
  closeFilePanel();
  $("messageInput")?.focus();
}

function newTempChat() {
  const id = `t_${Date.now()}`;
  state.conversations[id] = {
    id,
    title: "Temporary chat",
    messages: [],
    temp: true,
    projectId: state.activeProjectId || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.activeId = id;
  state.attachments = [];
  renderSidebar();
  renderMessages();
  renderAttachments();
  updateTempBadge();
  updateActiveProjectPill();
  $("messageInput")?.focus();
}

function selectConversation(id) {
  if (!state.conversations[id]) return;
  state.activeId = id;
  const projectId = state.conversations[id].projectId || "";
  state.activeProjectId = projectId && state.projects[projectId] ? projectId : "";
  state.attachments = [];
  saveLocalState();
  renderSidebar();
  renderMessages();
  renderAttachments();
  updateActiveProjectPill();
  updateContextRing();
}

function deleteConversation(id, event) {
  event?.stopPropagation();
  pendingDeleteId = id;
  $("deleteModal")?.classList.remove("hidden");
}

function closeDeleteModal() {
  pendingDeleteId = "";
  $("deleteModal")?.classList.add("hidden");
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  const wasActive = pendingDeleteId === state.activeId;
  delete state.conversations[pendingDeleteId];
  closeDeleteModal();
  if (wasActive) {
    const ids = Object.keys(state.conversations);
    state.activeId = ids[ids.length - 1] || "";
    if (!state.activeId) newChat();
    else renderMessages();
  }
  saveLocalState();
  renderSidebar();
}

function renderSidebar() {
  const list = $("conversationList");
  if (!list) return;
  const entries = Object.entries(state.conversations)
    .sort(([, a], [, b]) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

  if (!entries.length) {
    list.innerHTML = `<div class="sidebar-empty">No conversations yet</div>`;
    return;
  }

  const groups = groupConversations(entries);
  list.innerHTML = Object.entries(groups).map(([label, items]) => {
    if (!items.length) return "";
    return `<div class="conv-group-label">${label}</div>${items.map(([id, conversation]) => conversationRow(id, conversation)).join("")}`;
  }).join("");
}

function groupConversations(entries) {
  const now = Date.now();
  const groups = { Pinned: [], Today: [], Yesterday: [], Older: [] };
  for (const item of entries) {
    const [, conversation] = item;
    if (conversation.temp) groups.Pinned.push(item);
    else {
      const age = now - (conversation.updatedAt || conversation.createdAt || now);
      if (age < 86400000) groups.Today.push(item);
      else if (age < 172800000) groups.Yesterday.push(item);
      else groups.Older.push(item);
    }
  }
  return groups;
}

function conversationRow(id, conversation) {
  const active = id === state.activeId ? "active" : "";
  const icon = conversation.temp ? "bolt" : "chat";
  return `
    <button class="conv-item ${active}" data-id="${escHtml(id)}" onclick="selectConversation('${escAttr(id)}')">
      <span class="conv-icon ${icon}">${conversation.temp ? "!" : "#"}</span>
      <span class="conv-item-text">${escHtml(conversation.title || "Untitled")}</span>
      <span class="conv-age">${relativeTime(conversation.updatedAt || conversation.createdAt)}</span>
      <span class="conv-delete" onclick="deleteConversation('${escAttr(id)}',event)" title="Delete">x</span>
    </button>`;
}

function renderMessages() {
  const container = $("messages");
  if (!container) return;
  const conversation = state.conversations[state.activeId];
  updateTempBadge();
  updateContextRing();

  if (!conversation || !conversation.messages.length) {
    container.innerHTML = emptyStateHtml();
    bindSuggestionChips();
    return;
  }

  container.innerHTML = conversation.messages.map((message, index) => buildMessageHtml(message, index)).join("");
  highlightCode(container);
  scrollToBottom(true);
}

function emptyStateHtml() {
  return `
    <div class="empty-state" id="emptyState">
      <div class="empty-logo">
        <svg width="48" height="48" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#76b900"/><path d="M10 28L20 12L30 28H10Z" fill="white"/></svg>
      </div>
      <h2>How can I help?</h2>
      <p id="emptyModel">${escHtml(modelLabel(state.model))}</p>
      <div class="chips">
        <button class="chip" data-msg="Write a complete REST API in Node.js with Express and JWT auth">Build a REST API</button>
        <button class="chip" data-msg="Create a polished HTML dashboard artifact with charts and filters">Create an artifact</button>
        <button class="chip" data-msg="Create a full React project with routing, auth, tests, and README">Full project</button>
        <button class="chip" data-msg="Debug this code and explain what's wrong: ">Debug my code</button>
      </div>
    </div>`;
}

function bindSuggestionChips() {
  document.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $("messageInput");
      input.value = button.dataset.msg || "";
      autoResize(input);
      updateSendButton();
      updateContextRing();
      input.focus();
    });
  });
}

function buildMessageHtml(message, index) {
  if (message.role === "user") {
    return `
      <article class="message user" id="msg_${index}">
        <div class="msg-avatar user-avatar">U</div>
        <div class="msg-content">${renderUserContent(message.content)}</div>
      </article>`;
  }

  const artifacts = window.NIMArtifacts ? window.NIMArtifacts.extract(message.content) : [];
  const artifactButtons = artifacts.length ? `
    <div class="msg-artifacts">
      ${artifacts.map((artifact, artifactIndex) => `
        <button class="artifact-chip" onclick="openArtifactFromMessage(${index},${artifactIndex})">
          <span>${escHtml(artifact.type.toUpperCase())}</span>${escHtml(artifact.title)}
        </button>`).join("")}
    </div>` : "";

  return `
    <article class="message assistant" id="msg_${index}">
      <div class="msg-avatar nim-avatar">
        <svg width="16" height="16" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="8" fill="#76b900"/><path d="M10 28L20 12L30 28H10Z" fill="white"/></svg>
      </div>
      <div class="msg-shell">
        <div class="msg-meta">${message.thoughtTime ? `Thought for ${escHtml(message.thoughtTime)}` : ""}</div>
        <div class="msg-content">${renderMarkdown(stripArtifactBlocks(message.content))}</div>
        ${artifactButtons}
      </div>
    </article>`;
}

function renderUserContent(content) {
  return escHtml(content).replace(/\n/g, "<br>");
}

function renderMarkdown(text) {
  if (!window.marked) return renderUserContent(text);
  const html = marked.parse(text || "");
  return hardenHtml(html)
    .replace(/<pre><code class="language-([^"]+)">/g, (_, lang) => {
      return `<pre><div class="code-header"><span class="code-lang">${escHtml(lang)}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><code class="language-${escAttr(lang)}">`;
    })
    .replace(/<pre><code>/g, `<pre><div class="code-header"><span class="code-lang">code</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><code>`);
}

function hardenHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/href=["']javascript:[^"']*["']/gi, "href=\"#\"");
}

function stripArtifactBlocks(text) {
  return String(text || "").replace(/<artifact\b[^>]*>[\s\S]*?<\/artifact>/gi, "\n\n");
}

async function sendMessage() {
  if (state.generating) return;
  if (!hasValidSession()) {
    clearSession();
    showGate();
    return;
  }

  const input = $("messageInput");
  const rawText = input.value.trim();
  if (!rawText && !state.attachments.length) return;

  const text = buildUserMessage(rawText);
  input.value = "";
  autoResize(input);
  updateSendButton();

  const conversation = ensureActiveConversation();
  const userMessage = createChatMessage("user", text);
  conversation.messages.push(userMessage);
  conversation.updatedAt = Date.now();

  if (conversation.title === "New chat" || conversation.title === "Temporary chat") {
    conversation.title = titleFromMessage(rawText || state.attachments[0]?.name || "Attached files");
  }

  state.attachments = [];
  renderAttachments();
  renderSidebar();
  appendMessage(userMessage, conversation.messages.length - 1);

  const assistantIndex = conversation.messages.length;
  const assistantMessage = createChatMessage("assistant", "");
  conversation.messages.push(assistantMessage);
  const assistantEl = appendMessage(assistantMessage, assistantIndex);
  assistantEl.querySelector(".msg-content")?.classList.add("typing-cursor");

  state.generating = true;
  state.abortController = new AbortController();
  $("stopBtn")?.classList.remove("hidden");
  updateSendButton();
  autoScroll = true;
  scrollToBottom(true);

  const started = performance.now();
  try {
    const response = await api("/api/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: state.abortController.signal,
      body: JSON.stringify({
        model: state.model,
        messages: buildMessages(conversation.messages.slice(0, -1)),
        projectMode: state.projectMode,
        projectContext: activeProjectPrompt(),
        agentId: state.activeAgentId || "",
        stream: true,
        max_tokens: state.projectMode ? 16384 : 8192,
        temperature: 0.55,
      }),
    });

    if (!response.ok) throw await responseError(response);
    await streamResponse(response, assistantEl, conversation, assistantIndex);
    assistantMessage.thoughtTime = `${Math.max(0.4, (performance.now() - started) / 1000).toFixed(1)}s`;
  } catch (error) {
    if (error.name !== "AbortError") {
      assistantMessage.content = `Error: ${error.message || "Generation failed"}`;
      assistantEl.querySelector(".msg-content").textContent = assistantMessage.content;
      toast(assistantMessage.content, "error");
      if (/Unauthorized/i.test(error.message)) {
        clearSession();
        showGate();
      }
    }
  } finally {
    finishGeneration(assistantEl);
    conversation.updatedAt = Date.now();
    renderMessages();
    if (!conversation.temp) {
      saveLocalState();
      saveRemoteConversation(conversation).catch(() => {});
    }
    const latest = conversation.messages[conversation.messages.length - 1]?.content || "";
    const files = parseGeneratedFiles(latest);
    if (files.length) renderFilePanel(files);
    if (window.NIMArtifacts) window.NIMArtifacts.autoOpen(latest);
  }
}

function ensureActiveConversation() {
  if (!state.activeId || !state.conversations[state.activeId]) newChat();
  return state.conversations[state.activeId];
}

function createChatMessage(role, content) {
  return { role, content, createdAt: Date.now() };
}

function buildUserMessage(text) {
  if (!state.attachments.length) return text;
  const attachmentText = state.attachments.map((file) => {
    const body = file.content ? `\n\n\`\`\`${file.language || ""}\n${file.content}\n\`\`\`` : "";
    return `Attached file: ${file.name} (${formatBytes(file.size)}, ${file.type || "unknown"})${body}`;
  }).join("\n\n");
  return `${text || "Use the attached files."}\n\n${attachmentText}`;
}

function buildMessages(messages) {
  const packed = [];
  let budget = CONTEXT_LIMIT - estimateTokens(activeProjectPrompt()) - estimateTokens($("messageInput")?.value || "") - 1200;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const cost = estimateTokens(message.content) + 8;
    if (cost > budget && packed.length > 6) break;
    packed.unshift({ role: message.role, content: message.content });
    budget -= cost;
  }

  if (packed.length < messages.length) {
    packed.unshift({
      role: "user",
      content: `${messages.length - packed.length} older messages were omitted to preserve useful context. Continue using the visible recent conversation and ask for missing details if needed.`,
    });
  }
  return packed;
}

async function streamResponse(response, element, conversation, index) {
  const reader = response.body?.getReader();
  if (!reader) {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    conversation.messages[index].content = content;
    element.querySelector(".msg-content").innerHTML = renderMarkdown(stripArtifactBlocks(content));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  const contentEl = element.querySelector(".msg-content");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content || parsed?.choices?.[0]?.text || "";
        if (!delta) continue;
        full += delta;
        conversation.messages[index].content = full;
        contentEl.innerHTML = renderMarkdown(stripArtifactBlocks(full));
        highlightCode(contentEl);
        scrollToBottom();
      } catch {
        // Some providers emit heartbeat or non-JSON lines.
      }
    }
  }
}

function finishGeneration(element) {
  state.generating = false;
  state.abortController = null;
  element?.querySelector(".msg-content")?.classList.remove("typing-cursor");
  $("stopBtn")?.classList.add("hidden");
  updateSendButton();
  updateContextRing();
}

function stopGeneration() {
  if (state.abortController) state.abortController.abort();
}

function appendMessage(message, index) {
  const container = $("messages");
  if (!container) return null;
  if ($("emptyState")) container.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildMessageHtml(message, index);
  const element = wrapper.firstElementChild;
  container.appendChild(element);
  highlightCode(element);
  scrollToBottom();
  return element;
}

function highlightCode(root = document) {
  if (!window.hljs) return;
  root.querySelectorAll("pre code").forEach((element) => {
    if (!element.dataset.highlighted) hljs.highlightElement(element);
  });
}

async function saveRemoteConversation(conversation) {
  if (!state.token || conversation.temp) return;
  const response = await api("/api/chat/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId: conversation.id,
      title: conversation.title,
      model: state.model,
      messages: conversation.messages,
    }),
  });
  if (!response.ok) throw await responseError(response);
}

async function sendStandalonePrompt(messages, options = {}) {
  const response = await api("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      model: options.model || state.model,
      messages,
      stream: false,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.55,
    }),
  });
  if (!response.ok) throw await responseError(response);
  const data = await response.json().catch(() => ({}));
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
}

async function sendAdminOnlyPrompt(messages, options = {}) {
  const response = await api("/api/admin-chat/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      model: options.model || state.model,
      messages,
      stream: false,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.45,
    }),
  });
  if (!response.ok) throw await responseError(response);
  const data = await response.json().catch(() => ({}));
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
}

function updateSendButton() {
  const input = $("messageInput");
  const hasText = Boolean(input?.value.trim());
  const hasFiles = state.attachments.length > 0;
  const button = $("sendBtn");
  if (button) button.disabled = state.generating || (!hasText && !hasFiles);
}

function autoResize(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
}

function scrollToBottom(force = false) {
  if (!force && !autoScroll) return;
  const container = $("messagesContainer");
  if (container) container.scrollTop = container.scrollHeight;
}

function toggleSidebar() {
  $("sidebar")?.classList.toggle("collapsed");
}

function toggleProjectMode() {
  state.projectMode = !state.projectMode;
  updateProjectButton();
  updateContextRing();
  saveLocalState();
  toast(state.projectMode ? "Project mode enabled" : "Project mode disabled");
}

function updateProjectButton() {
  $("projectModeBtn")?.classList.toggle("active", state.projectMode);
  updateActiveProjectPill();
}

function activeProjectPrompt() {
  const project = state.projects[state.activeProjectId];
  if (!project) return "";
  const parts = [
    `Active project: ${project.name || "Untitled project"}`,
    project.instructions ? `Project instructions:\n${project.instructions}` : "",
    project.context ? `Project files and reference context:\n${project.context}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : "";
}

function updateActiveProjectPill() {
  const pill = $("activeProjectPill");
  if (!pill) return;
  const project = state.projects[state.activeProjectId];
  pill.classList.toggle("hidden", !project);
  if (project) {
    pill.innerHTML = `<span>Project</span><strong>${escHtml(project.name || "Untitled")}</strong>`;
  }
}

function activeAgent() {
  return state.agents.find((agent) => agent.id === state.activeAgentId) || null;
}

function updateActiveAgentPill() {
  const pill = $("activeAgentPill");
  if (!pill) return;
  const agent = activeAgent();
  pill.classList.toggle("hidden", !agent);
  if (agent) {
    pill.innerHTML = `<span>Agent</span><strong>${escHtml(agent.name || "Untitled")}</strong>`;
  }
}

function updateTempBadge() {
  const conversation = state.conversations[state.activeId];
  $("tempPill")?.classList.toggle("hidden", !conversation?.temp);
}

function updateModelBadge() {
  const label = modelLabel(state.model);
  if ($("modelBadge")) $("modelBadge").textContent = label;
  if ($("emptyModel")) $("emptyModel").textContent = label;
  updateModelControls();
}

function updateModelControls() {
  const select = $("modelSelect");
  if (select) {
    select.innerHTML = state.allowedModels.map((model) => `<option value="${escAttr(model)}">${escHtml(modelLabel(model))}</option>`).join("");
    select.value = state.model;
  }
  const agentModel = $("agentModelInput");
  if (agentModel) {
    agentModel.innerHTML = `<option value="">Use global default</option>${state.allowedModels.map((model) => `<option value="${escAttr(model)}">${escHtml(modelLabel(model))}</option>`).join("")}`;
  }
}

function updateContextRing() {
  const conversation = state.conversations[state.activeId];
  const text = [
    state.systemPrompt,
    activeProjectPrompt(),
    activeAgent()?.description || "",
    $("messageInput")?.value || "",
    ...(conversation?.messages || []).map((message) => message.content),
    ...state.attachments.map((file) => file.content || file.name),
  ].join("\n");
  const tokens = estimateTokens(text);
  const pct = Math.min(100, Math.round((tokens / CONTEXT_LIMIT) * 100));
  const bar = $("ctxBar");
  if (bar) {
    const circumference = 100;
    bar.style.strokeDasharray = `${pct} ${circumference - pct}`;
  }
  const ring = $("ctxRingWrap");
  if (ring) {
    ring.title = `${tokens.toLocaleString()} / ${CONTEXT_LIMIT.toLocaleString()} estimated tokens`;
    ring.dataset.pct = String(pct);
  }
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

async function handleFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const accepted = [];
  for (const file of files.slice(0, 20)) {
    if (file.size > MAX_ATTACH_BYTES) {
      toast(`${file.name} is larger than 1 MB and was skipped`, "error");
      continue;
    }
    const attachment = {
      id: `f_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      language: languageFromName(file.name),
      content: "",
    };
    if (file.type.startsWith("image/")) {
      attachment.content = `[Image attachment: ${file.name}]`;
    } else {
      attachment.content = await file.text();
    }
    accepted.push(attachment);
  }
  state.attachments.push(...accepted);
  if ($("fileInput")) $("fileInput").value = "";
  renderAttachments();
  updateSendButton();
  updateContextRing();
}

function renderAttachments() {
  const bar = $("attachmentsBar");
  if (!bar) return;
  bar.classList.toggle("hidden", !state.attachments.length);
  bar.innerHTML = state.attachments.map((file) => `
    <div class="attachment-pill">
      <span class="file-item-icon">${escHtml(languageFromName(file.name).toUpperCase() || "FILE")}</span>
      <span>${escHtml(file.name)}</span>
      <small>${formatBytes(file.size)}</small>
      <button onclick="removeAttachment('${escAttr(file.id)}')" title="Remove">x</button>
    </div>`).join("");
}

function removeAttachment(id) {
  state.attachments = state.attachments.filter((file) => file.id !== id);
  renderAttachments();
  updateSendButton();
  updateContextRing();
}

function parseGeneratedFiles(text) {
  if (window.NIMArtifacts) return window.NIMArtifacts.extractFiles(text);
  return [];
}

function renderFilePanel(files) {
  state.currentFiles = files || [];
  const panel = $("filePanel");
  const app = $("app");
  if (!panel || !state.currentFiles.length) return;
  $("fileCount").textContent = `${state.currentFiles.length} file${state.currentFiles.length === 1 ? "" : "s"}`;
  $("fileList").innerHTML = state.currentFiles.map((file, index) => {
    const parts = file.path.split("/");
    const name = parts.pop();
    const dir = parts.join("/");
    return `
      <button class="file-item" onclick="previewFile(${index})">
        <span class="file-item-icon">${escHtml(languageFromName(name).toUpperCase() || "FILE")}</span>
        <span class="file-item-info">
          <span class="file-item-name">${escHtml(name)}</span>
          ${dir ? `<span class="file-item-dir">${escHtml(dir)}</span>` : ""}
        </span>
        <span class="file-dl-btn" onclick="downloadFile(${index},event)">down</span>
      </button>`;
  }).join("");
  panel.classList.remove("hidden");
  app?.classList.add("has-files");
}

function closeFilePanel() {
  $("filePanel")?.classList.add("hidden");
  $("app")?.classList.remove("has-files");
}

let previewIndex = -1;

function previewFile(index) {
  const file = state.currentFiles[index];
  if (!file) return;
  previewIndex = index;
  $("previewFilename").textContent = file.path;
  const code = $("previewCode");
  code.textContent = file.content;
  code.className = `language-${languageFromName(file.path)}`;
  $("filePreviewModal")?.classList.remove("hidden");
  highlightCode($("filePreviewModal"));
}

function closeFilePreview() {
  $("filePreviewModal")?.classList.add("hidden");
  previewIndex = -1;
}

function downloadPreviewedFile() {
  if (previewIndex >= 0) downloadFile(previewIndex);
}

function downloadFile(index, event) {
  event?.stopPropagation();
  const file = state.currentFiles[index];
  if (!file) return;
  downloadBlob(file.content, file.path.split("/").pop(), "text/plain");
}

async function downloadZip() {
  if (!state.currentFiles.length) return;
  if (!window.JSZip) {
    toast("ZIP library has not loaded yet", "error");
    return;
  }
  const zip = new JSZip();
  for (const file of state.currentFiles) zip.file(file.path, file.content);
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, "nim-project.zip");
}

function downloadBlob(content, filename, type = "application/octet-stream") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function focusChats() {
  closeSearch();
  closeSettings();
  closeProjects();
  document.querySelectorAll(".nav-row").forEach((button) => button.classList.remove("active"));
  $("navChatsBtn")?.classList.add("active");
  $("messageInput")?.focus();
}

function openProjects() {
  renderProjects();
  $("projectsModal")?.classList.remove("hidden");
  document.querySelectorAll(".nav-row").forEach((button) => button.classList.remove("active"));
  $("navProjectsBtn")?.classList.add("active");
  setTimeout(() => $("projectNameInput")?.focus(), 20);
}

function closeProjects() {
  $("projectsModal")?.classList.add("hidden");
  $("navProjectsBtn")?.classList.remove("active");
  $("navChatsBtn")?.classList.add("active");
}

function openAgents() {
  renderAgents();
  $("agentsModal")?.classList.remove("hidden");
  document.querySelectorAll(".nav-row").forEach((button) => button.classList.remove("active"));
  $("navAgentsBtn")?.classList.add("active");
}

function closeAgents() {
  $("agentsModal")?.classList.add("hidden");
  $("navAgentsBtn")?.classList.remove("active");
  $("navChatsBtn")?.classList.add("active");
}

function renderAgents() {
  const list = $("agentsList");
  if (!list) return;
  updateModelControls();
  const admin = state.role === "admin";
  const agents = [...state.agents].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  list.innerHTML = `
    ${admin ? `<button class="project-new" onclick="createAgentDraft()">+ New agent</button>` : ""}
    ${agents.length ? agents.map((agent) => `
      <button class="project-row ${agent.id === state.activeAgentId ? "active" : ""}" onclick="selectAgent('${escAttr(agent.id)}')">
        <strong>${escHtml(agent.name || "Untitled agent")}</strong>
        <span>${agent.adminOnly ? "Admin only" : "Available"}${agent.schedule ? ` · ${escHtml(agent.schedule)}` : ""}</span>
      </button>`).join("") : `<div class="empty-admin">No agents yet.</div>`}`;
  const agent = activeAgent();
  $("agentNameInput").value = agent?.name || "";
  $("agentDescriptionInput").value = agent?.description || "";
  $("agentModelInput").value = agent?.model || "";
  $("agentInstructionsInput").value = agent?.instructions || "";
  $("agentScheduleInput").value = agent?.schedule || "";
  $("agentAdminOnlyInput").checked = Boolean(agent?.adminOnly);
  ["agentNameInput", "agentDescriptionInput", "agentModelInput", "agentInstructionsInput", "agentScheduleInput", "agentAdminOnlyInput", "saveAgentBtn", "deleteAgentBtn"].forEach((id) => {
    const element = $(id);
    if (element) element.disabled = !admin;
  });
}

function createAgentDraft() {
  if (state.role !== "admin") return;
  const id = `agent_${Date.now()}`;
  state.agents.unshift({
    id,
    name: "New agent",
    description: "",
    instructions: "",
    model: "",
    schedule: "",
    enabled: true,
    adminOnly: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  state.activeAgentId = id;
  renderAgents();
  updateActiveAgentPill();
}

function selectAgent(id) {
  if (!state.agents.some((agent) => agent.id === id)) return;
  state.activeAgentId = id;
  saveLocalState();
  renderAgents();
  updateActiveAgentPill();
  updateContextRing();
}

async function saveAgentFromModal() {
  if (state.role !== "admin") return toast("Admin only", "error");
  if (!state.activeAgentId) createAgentDraft();
  const existing = activeAgent();
  const payload = {
    id: state.activeAgentId,
    name: ($("agentNameInput")?.value || "").trim() || "Untitled agent",
    description: ($("agentDescriptionInput")?.value || "").trim(),
    model: $("agentModelInput")?.value || "",
    instructions: ($("agentInstructionsInput")?.value || "").trim(),
    schedule: ($("agentScheduleInput")?.value || "").trim(),
    adminOnly: Boolean($("agentAdminOnlyInput")?.checked),
    enabled: true,
    createdAt: existing?.createdAt,
  };
  if (!payload.instructions) return toast("Agent instructions are required", "error");
  const response = await api("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await responseError(response);
  const data = await response.json();
  state.agents = [data.agent, ...state.agents.filter((agent) => agent.id !== data.agent.id)];
  state.activeAgentId = data.agent.id;
  saveLocalState();
  renderAgents();
  updateActiveAgentPill();
  toast("Agent saved");
}

async function deleteActiveAgent() {
  if (state.role !== "admin" || !state.activeAgentId) return;
  const id = state.activeAgentId;
  const response = await api(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw await responseError(response);
  state.agents = state.agents.filter((agent) => agent.id !== id);
  state.activeAgentId = "";
  saveLocalState();
  renderAgents();
  updateActiveAgentPill();
  toast("Agent deleted");
}

function clearActiveAgent() {
  state.activeAgentId = "";
  saveLocalState();
  renderAgents();
  updateActiveAgentPill();
  updateContextRing();
  toast("No active agent");
}

function renderProjects() {
  const list = $("projectsList");
  if (!list) return;
  const entries = Object.entries(state.projects)
    .sort(([, a], [, b]) => (b.updatedAt || 0) - (a.updatedAt || 0));

  list.innerHTML = `
    <button class="project-new" onclick="createProjectDraft()">+ New project</button>
    ${entries.length ? entries.map(([id, project]) => `
      <button class="project-row ${id === state.activeProjectId ? "active" : ""}" onclick="selectProject('${escAttr(id)}')">
        <strong>${escHtml(project.name || "Untitled")}</strong>
        <span>${project.instructions ? "Instructions" : "No instructions"} · ${relativeTime(project.updatedAt || project.createdAt)}</span>
      </button>`).join("") : `<div class="empty-admin">No projects yet.</div>`}`;

  const project = state.projects[state.activeProjectId];
  $("projectNameInput").value = project?.name || "";
  $("projectInstructionsInput").value = project?.instructions || "";
  $("projectContextInput").value = project?.context || "";
  $("deleteProjectBtn").disabled = !project;
}

function createProjectDraft() {
  const id = `p_${Date.now()}`;
  state.projects[id] = {
    id,
    name: "New project",
    instructions: "",
    context: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.activeProjectId = id;
  saveLocalState();
  renderProjects();
  updateActiveProjectPill();
}

function selectProject(id) {
  if (!state.projects[id]) return;
  state.activeProjectId = id;
  const conversation = state.conversations[state.activeId];
  if (conversation) conversation.projectId = id;
  saveLocalState();
  renderProjects();
  updateActiveProjectPill();
  updateContextRing();
}

function saveProjectFromModal() {
  if (!state.activeProjectId || !state.projects[state.activeProjectId]) createProjectDraft();
  const project = state.projects[state.activeProjectId];
  project.name = ($("projectNameInput")?.value || "").trim() || "Untitled project";
  project.instructions = ($("projectInstructionsInput")?.value || "").trim();
  project.context = ($("projectContextInput")?.value || "").trim();
  project.updatedAt = Date.now();
  const conversation = state.conversations[state.activeId];
  if (conversation) conversation.projectId = project.id;
  saveLocalState();
  renderProjects();
  updateActiveProjectPill();
  updateContextRing();
  toast("Project saved");
}

function deleteActiveProject() {
  const id = state.activeProjectId;
  if (!id || !state.projects[id]) return;
  if (!confirm("Delete this project? Chats stay, but project context is removed.")) return;
  delete state.projects[id];
  state.activeProjectId = "";
  for (const conversation of Object.values(state.conversations)) {
    if (conversation.projectId === id) conversation.projectId = "";
  }
  saveLocalState();
  renderProjects();
  updateActiveProjectPill();
  updateContextRing();
}

function clearActiveProject() {
  state.activeProjectId = "";
  const conversation = state.conversations[state.activeId];
  if (conversation) conversation.projectId = "";
  saveLocalState();
  renderProjects();
  updateActiveProjectPill();
  updateContextRing();
  toast("No active project");
}

function openArtifactsLibrary() {
  const artifacts = [];
  for (const conversation of Object.values(state.conversations)) {
    for (const message of conversation.messages || []) {
      if (message.role !== "assistant" || !window.NIMArtifacts) continue;
      for (const artifact of window.NIMArtifacts.extract(message.content)) {
        artifacts.push({ ...artifact, sourceTitle: conversation.title, sourceUpdatedAt: conversation.updatedAt || conversation.createdAt });
      }
    }
  }
  artifacts.sort((a, b) => (b.sourceUpdatedAt || 0) - (a.sourceUpdatedAt || 0));
  if (!artifacts.length || !window.NIMArtifacts) {
    toast("No artifacts yet");
    return;
  }
  if (window.NIMArtifacts.openLibrary) window.NIMArtifacts.openLibrary(artifacts);
  else window.NIMArtifacts.open(artifacts[0]);
  document.querySelectorAll(".nav-row").forEach((button) => button.classList.remove("active"));
  $("navArtifactsBtn")?.classList.add("active");
}

function openSettings() {
  if (state.role !== "admin") {
    toast("Settings are admin only", "error");
    return;
  }
  $("setProxy").value = state.apiBase;
  $("settingsModal")?.classList.remove("hidden");
}

function closeSettings() {
  $("settingsModal")?.classList.add("hidden");
}

function saveSettings() {
  state.apiBase = normalizeApiBase($("setProxy").value);
  saveLocalState();
  updateContextRing();
  closeSettings();
  toast("Settings saved");
}

function clearAllData() {
  if (!confirm("Delete local conversations, settings, and session?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

function openSearch() {
  $("searchOverlay")?.classList.remove("hidden");
  $("searchInput").value = "";
  renderSearchResults();
  setTimeout(() => $("searchInput")?.focus(), 20);
}

function closeSearch() {
  $("searchOverlay")?.classList.add("hidden");
}

function renderSearchResults() {
  const query = ($("searchInput")?.value || "").toLowerCase();
  const results = Object.entries(state.conversations)
    .filter(([, conversation]) => {
      if (!query) return true;
      return conversation.title.toLowerCase().includes(query) ||
        conversation.messages.some((message) => message.content.toLowerCase().includes(query));
    })
    .sort(([, a], [, b]) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 30);

  $("searchResults").innerHTML = results.length ? results.map(([id, conversation]) => `
    <button class="search-result" onclick="selectConversation('${escAttr(id)}');closeSearch();">
      <span>${escHtml(conversation.title)}</span>
      <small>${conversation.messages.length} messages - ${relativeTime(conversation.updatedAt || conversation.createdAt)}</small>
    </button>`).join("") : `<div class="empty-admin">No matches</div>`;
}

function handleShortcuts(event) {
  const mod = event.metaKey || event.ctrlKey;
  if (mod && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
  if (mod && event.key.toLowerCase() === "n") {
    event.preventDefault();
    newChat();
  }
  if (event.key === "Escape") {
    closeSearch();
    closeSettings();
    closeProjects();
    closeAgents();
    $("adminPanel")?.classList.add("hidden");
  }
  if (event.key === "/" && document.activeElement === document.body) {
    event.preventDefault();
    $("messageInput")?.focus();
  }
}

function openArtifactFromMessage(messageIndex, artifactIndex) {
  const conversation = state.conversations[state.activeId];
  const message = conversation?.messages?.[messageIndex];
  if (!message || !window.NIMArtifacts) return;
  const artifact = window.NIMArtifacts.extract(message.content)[artifactIndex];
  if (artifact) window.NIMArtifacts.open(artifact);
}

function copyCode(button) {
  const code = button.closest("pre")?.querySelector("code");
  if (!code) return;
  navigator.clipboard.writeText(code.innerText).then(() => {
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = "Copy"; }, 1400);
  });
}

function modelLabel(model) {
  return MODEL_LABELS[model] || model;
}

function titleFromMessage(message) {
  const text = String(message || "").replace(/\s+/g, " ").trim() || "New chat";
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function relativeTime(timestamp) {
  if (!timestamp) return "";
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function languageFromName(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  const map = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
    sh: "bash",
    yml: "yaml",
    yaml: "yaml",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    rb: "ruby",
    php: "php",
    swift: "swift",
  };
  return map[ext] || ext.slice(0, 6);
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function toast(message, type = "info") {
  const container = $("toastContainer");
  if (!container) return;
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => item.classList.add("show"), 10);
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 220);
  }, 3400);
}

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escAttr(value) {
  return escHtml(value).replace(/`/g, "&#096;");
}

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function togglePwEye() {
  const input = $("gatePassword");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}

function toggleSetup() {
  $("setupFields")?.classList.toggle("hidden");
  const toggle = $("setupToggle");
  if (toggle) toggle.textContent = $("setupFields")?.classList.contains("hidden") ? "Connection settings" : "Hide connection settings";
}

window.selectConversation = selectConversation;
window.deleteConversation = deleteConversation;
window.closeSearch = closeSearch;
window.removeAttachment = removeAttachment;
window.previewFile = previewFile;
window.downloadFile = downloadFile;
window.openArtifactFromMessage = openArtifactFromMessage;
window.copyCode = copyCode;
window.createProjectDraft = createProjectDraft;
window.selectProject = selectProject;
window.createAgentDraft = createAgentDraft;
window.selectAgent = selectAgent;
window.togglePwEye = togglePwEye;
window.toggleSetup = toggleSetup;
