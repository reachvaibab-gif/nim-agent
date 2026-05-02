/* Admin panel for NIM Chat */

(function () {
  let app = null;
  let tab = "sessions";
  let cache = {
    sessions: [],
    chats: [],
    adminChats: [],
    blocklist: { ips: [], userAgents: [], browsers: [] },
    config: null,
  };

  let adminMessages = [];

  function init(appApi) {
    app = appApi;
    adminMessages = safeParse(localStorage.getItem("nim_admin_private_chat"), []);

    bind("adminFab", "click", open);
    bind("adminClose", "click", close);
    document.querySelectorAll(".admin-tab").forEach((button) => {
      button.addEventListener("click", () => {
        tab = button.dataset.tab;
        document.querySelectorAll(".admin-tab").forEach((item) => item.classList.toggle("active", item === button));
        render();
      });
    });
  }

  function bind(id, event, handler) {
    const element = document.getElementById(id);
    if (element) element.addEventListener(event, handler);
  }

  function open() {
    if (!app?.state || app.state.role !== "admin") return;
    document.getElementById("adminPanel")?.classList.remove("hidden");
    render();
  }

  function close() {
    document.getElementById("adminPanel")?.classList.add("hidden");
  }

  async function render() {
    const body = document.getElementById("adminBody");
    if (!body) return;
    body.innerHTML = `<div class="admin-loading">Loading ${escapeHtml(tab)}...</div>`;

    try {
      if (tab === "sessions") await renderSessions(body);
      if (tab === "chats") await renderChats(body);
      if (tab === "blocklist") await renderBlocklist(body);
      if (tab === "adminchat") await renderAdminChat(body);
      if (tab === "config") await renderConfig(body);
    } catch (error) {
      body.innerHTML = `<div class="admin-error">${escapeHtml(error.message || "Admin request failed")}</div>`;
    }
  }

  async function renderSessions(body) {
    const data = await fetchJson("/api/sessions");
    cache.sessions = data.sessions || [];
    const active = cache.sessions.filter((session) => Date.now() < (session.expiresAt || 0)).length;

    body.innerHTML = `
      <div class="admin-toolbar">
        <div>
          <h3>Active Sessions</h3>
          <p>${active} active, ${cache.sessions.length} total session records</p>
        </div>
        <button class="art-btn" onclick="NIMAdmin.refresh()">Refresh</button>
      </div>
      <div class="admin-grid">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>User</th><th>IP Address</th><th>Location</th><th>Browser</th><th>Last Active</th><th>Actions</th></tr></thead>
            <tbody>
              ${cache.sessions.map((session, index) => `
                <tr onclick="NIMAdmin.showSession(${index})">
                  <td><span class="role-dot ${session.role}"></span>${escapeHtml(session.role)}</td>
                  <td>${escapeHtml(session.ip)}</td>
                  <td>${escapeHtml(locationText(session))}</td>
                  <td>${escapeHtml(session.browser || "Unknown")} / ${escapeHtml(session.os || "Unknown")}</td>
                  <td>${formatDate(session.lastSeen)}</td>
                  <td class="admin-actions" onclick="event.stopPropagation()">
                    <button onclick="NIMAdmin.block('ip','${escapeAttr(session.ip)}')">Block IP</button>
                    <button onclick="NIMAdmin.revoke('${escapeAttr(session.token)}')">Revoke</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
        <aside class="admin-detail" id="adminDetail">
          <h4>Session Details</h4>
          <p>Select a session to inspect IP, browser, user-agent, and controls.</p>
        </aside>
      </div>`;
  }

  function showSession(index) {
    const session = cache.sessions[index];
    const detail = document.getElementById("adminDetail");
    if (!session || !detail) return;
    detail.innerHTML = `
      <div class="detail-head">
        <h4>${escapeHtml(session.role)} session</h4>
        <button class="icon-btn" onclick="document.getElementById('adminDetail').innerHTML=''">x</button>
      </div>
      <dl class="detail-list">
        <dt>IP Address</dt><dd>${escapeHtml(session.ip)}</dd>
        <dt>Browser</dt><dd>${escapeHtml(session.browser || "Unknown")}</dd>
        <dt>OS / Device</dt><dd>${escapeHtml(session.os || "Unknown")} / ${escapeHtml(session.device || "Unknown")}</dd>
        <dt>Location</dt><dd>${escapeHtml(locationText(session))}</dd>
        <dt>First Seen</dt><dd>${formatDate(session.createdAt)}</dd>
        <dt>Last Active</dt><dd>${formatDate(session.lastSeen)}</dd>
        <dt>Expires</dt><dd>${formatDate(session.expiresAt)}</dd>
        <dt>Chats Saved</dt><dd>${Number(session.chatCount || 0)}</dd>
        <dt>Session ID</dt><dd><code>${escapeHtml(session.token)}</code></dd>
        <dt>User Agent</dt><dd class="ua">${escapeHtml(session.userAgent || "")}</dd>
      </dl>
      <div class="detail-actions">
        <button class="btn-danger" onclick="NIMAdmin.block('ip','${escapeAttr(session.ip)}')">Block IP</button>
        <button class="btn-ghost" onclick="NIMAdmin.block('browser','${escapeAttr(session.browser || "")}')">Block Browser</button>
        <button class="btn-ghost" onclick="NIMAdmin.block('userAgent','${escapeAttr(session.userAgent || "")}')">Block User-Agent</button>
        <button class="btn-ghost-danger" onclick="NIMAdmin.revoke('${escapeAttr(session.token)}')">Revoke Session</button>
      </div>`;
  }

  async function renderChats(body) {
    const [normal, adminPrivate] = await Promise.all([
      fetchJson("/api/chats"),
      fetchJson("/api/admin-chats"),
    ]);
    cache.chats = normal.chats || [];
    cache.adminChats = adminPrivate.chats || [];

    body.innerHTML = `
      <div class="admin-toolbar">
        <div>
          <h3>User Chats and Admin Chats</h3>
          <p>${cache.chats.length} saved user chats, ${cache.adminChats.length} admin-only chat records</p>
        </div>
        <button class="art-btn" onclick="NIMAdmin.refresh()">Refresh</button>
      </div>
      <div class="chat-review">
        <div class="chat-review-list">
          ${[...cache.chats.map((chat) => ({ ...chat, private: false })), ...cache.adminChats.map((chat) => ({ ...chat, private: true }))]
            .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
            .map((chat, index) => `
              <button onclick="NIMAdmin.showChat(${index})">
                <strong><span class="chat-kind ${chat.private ? "admin" : "user"}">${chat.private ? "Admin only" : "User"}</span>${escapeHtml(chat.title || "Untitled")}</strong>
                <span>${escapeHtml(chat.ip || "unknown")} - ${formatDate(chat.savedAt)}</span>
              </button>`).join("") || `<div class="empty-admin">No saved chats yet.</div>`}
        </div>
        <div class="chat-review-body" id="chatReviewBody">
          <div class="empty-admin">Select a chat to inspect messages and artifacts.</div>
        </div>
      </div>`;
  }

  function showChat(index) {
    const all = [...cache.chats.map((chat) => ({ ...chat, private: false })), ...cache.adminChats.map((chat) => ({ ...chat, private: true }))]
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    const chat = all[index];
    const body = document.getElementById("chatReviewBody");
    if (!chat || !body) return;

    body.innerHTML = `
      <div class="chat-review-meta">
        <h4>${escapeHtml(chat.title || "Untitled")}</h4>
        <p>${escapeHtml(chat.ip || "unknown")} - ${escapeHtml(chat.browser || "Unknown")} - ${formatDate(chat.savedAt)}</p>
      </div>
      <div class="admin-chat-transcript">
        ${(chat.messages || []).map((message) => `
          <article class="${escapeHtml(message.role)}">
            <strong>${escapeHtml(message.role)}</strong>
            <div>${message.role === "assistant" ? app.renderMarkdown(stripArtifacts(message.content)) : escapeHtml(message.content).replace(/\n/g, "<br>")}</div>
          </article>`).join("")}
      </div>`;
  }

  async function renderBlocklist(body) {
    cache.blocklist = await fetchJson("/api/blocklist");
    body.innerHTML = `
      <div class="admin-toolbar">
        <div>
          <h3>Blocklist</h3>
          <p>Block exact IPs, browser families, or user-agent substrings.</p>
        </div>
      </div>
      <form class="block-form" onsubmit="NIMAdmin.addBlock(event)">
        <select id="blockType">
          <option value="ip">IP address</option>
          <option value="browser">Browser family</option>
          <option value="userAgent">User-agent contains</option>
        </select>
        <input id="blockValue" placeholder="Value to block"/>
        <button class="btn-primary">Add block</button>
      </form>
      <div class="block-cols">
        ${blockColumn("IP Addresses", "ip", cache.blocklist.ips)}
        ${blockColumn("Browsers", "browser", cache.blocklist.browsers)}
        ${blockColumn("User Agents", "userAgent", cache.blocklist.userAgents)}
      </div>`;
  }

  function blockColumn(title, type, values = []) {
    return `
      <section class="block-col">
        <h4>${escapeHtml(title)}</h4>
        ${values.length ? values.map((value) => `
          <div class="block-item">
            <span>${escapeHtml(value)}</span>
            <button onclick="NIMAdmin.unblock('${escapeAttr(type)}','${escapeAttr(value)}')">Remove</button>
          </div>`).join("") : `<div class="empty-admin">No blocks</div>`}
      </section>`;
  }

  async function renderAdminChat(body) {
    body.innerHTML = `
      <div class="admin-toolbar">
        <div>
          <h3>Private Admin Chat</h3>
          <p>Hidden from normal users and saved only through admin-only endpoints.</p>
        </div>
        <button class="art-btn" onclick="NIMAdmin.clearAdminChat()">Clear</button>
      </div>
      <div class="admin-private-chat" id="adminPrivateTranscript">
        ${renderAdminTranscript()}
      </div>
      <div class="admin-chat-input">
        <textarea id="adminChatInput" rows="2" placeholder="Ask a private admin question..."></textarea>
        <button class="btn-primary" onclick="NIMAdmin.sendAdminChat()">Send</button>
      </div>`;
  }

  function renderAdminTranscript() {
    if (!adminMessages.length) return `<div class="empty-admin">No private admin messages yet.</div>`;
    return adminMessages.map((message) => `
      <article class="${escapeHtml(message.role)}">
        <strong>${escapeHtml(message.role)}</strong>
        <div>${message.role === "assistant" ? app.renderMarkdown(stripArtifacts(message.content)) : escapeHtml(message.content).replace(/\n/g, "<br>")}</div>
      </article>`).join("");
  }

  async function renderConfig(body) {
    cache.config = await fetchJson("/api/config");
    body.innerHTML = `
      <div class="admin-toolbar">
        <div>
          <h3>Configuration</h3>
          <p>Secrets stay in Cloudflare. Password changes write hashes to KV.</p>
        </div>
      </div>
      <div class="config-grid">
        <label class="toggle-row">
          <input type="checkbox" id="maintenanceToggle" ${cache.config.maintenance ? "checked" : ""}/>
          <span>Maintenance mode</span>
        </label>
        <div class="config-facts">
          <div><span>NIM API key</span><strong>${cache.config.hasNimApiKey ? "Configured" : "Missing"}</strong></div>
          <div><span>Session TTL</span><strong>${Math.round(cache.config.sessionTtlSeconds / 3600)}h</strong></div>
          <div><span>Allowed origin</span><strong>${escapeHtml(cache.config.allowedOrigin || "*")}</strong></div>
          <div><span>NIM endpoint</span><strong>${escapeHtml(cache.config.nimApiBaseUrl || "")}</strong></div>
        </div>
        <div class="password-config">
          <label>Default model</label>
          <select id="defaultModelInput">
            ${(cache.config.allowedModels || []).map((model) => `<option value="${escapeAttr(model)}" ${model === cache.config.defaultModel ? "selected" : ""}>${escapeHtml(model)}</option>`).join("")}
          </select>
          <label>Allowed models</label>
          <textarea id="allowedModelsInput" rows="4" placeholder="One model id per line">${escapeHtml((cache.config.allowedModels || []).join("\n"))}</textarea>
          <label>NIM API base URL</label>
          <input id="nimApiBaseUrlInput" value="${escapeAttr(cache.config.nimApiBaseUrl || "")}" placeholder="https://integrate.api.nvidia.com/v1/chat/completions"/>
          <label>Normal chat system prompt</label>
          <textarea id="baseSystemPrompt" rows="6" placeholder="Server-side prompt for normal chats">${escapeHtml(cache.config.baseSystemPrompt || "")}</textarea>
          <label>New normal password</label>
          <input type="password" id="newUserPassword" placeholder="Leave blank to keep current"/>
          <label>New admin password</label>
          <input type="password" id="newAdminPassword" placeholder="Leave blank to keep current"/>
          <label>Admin-only system prompt</label>
          <textarea id="adminSystemPrompt" rows="6" placeholder="Private instructions only used by Admin Chat">${escapeHtml(cache.config.adminSystemPrompt || "")}</textarea>
          <button class="btn-primary" onclick="NIMAdmin.saveConfig()">Save config</button>
        </div>
      </div>`;
  }

  async function addBlock(event) {
    event.preventDefault();
    const type = document.getElementById("blockType").value;
    const value = document.getElementById("blockValue").value.trim();
    if (!value) return;
    await block(type, value, false);
    document.getElementById("blockValue").value = "";
    await render();
  }

  async function block(type, value, rerender = true) {
    if (!value) return;
    await fetchJson("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value }),
    });
    app.toast?.("Block added");
    if (rerender) await render();
  }

  async function unblock(type, value) {
    await fetchJson("/api/block", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value }),
    });
    app.toast?.("Block removed");
    await render();
  }

  async function revoke(token) {
    if (!token) return;
    await fetchJson(`/api/sessions/${encodeURIComponent(token)}`, { method: "DELETE" });
    app.toast?.("Session revoked");
    await render();
  }

  async function saveConfig() {
    const payload = {
      maintenance: document.getElementById("maintenanceToggle").checked,
      adminSystemPrompt: document.getElementById("adminSystemPrompt")?.value || "",
      baseSystemPrompt: document.getElementById("baseSystemPrompt")?.value || "",
      defaultModel: document.getElementById("defaultModelInput")?.value || "",
      allowedModels: (document.getElementById("allowedModelsInput")?.value || "").split(/\n+/).map((item) => item.trim()).filter(Boolean),
      nimApiBaseUrl: document.getElementById("nimApiBaseUrlInput")?.value || "",
    };
    const userPassword = document.getElementById("newUserPassword").value;
    const adminPassword = document.getElementById("newAdminPassword").value;
    if (userPassword) payload.userPassword = userPassword;
    if (adminPassword) payload.adminPassword = adminPassword;
    await fetchJson("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    app.toast?.("Config saved");
    await render();
  }

  async function sendAdminChat() {
    const input = document.getElementById("adminChatInput");
    const text = input?.value.trim();
    if (!text) return;
    input.value = "";
    adminMessages.push({ role: "user", content: text, createdAt: Date.now() });
    syncAdminChat();
    document.getElementById("adminPrivateTranscript").innerHTML = renderAdminTranscript();

    try {
      const response = await app.sendAdminOnlyPrompt([
        ...adminMessages.map((message) => ({ role: message.role, content: message.content })),
      ], { maxTokens: 4096 });
      adminMessages.push({ role: "assistant", content: response, createdAt: Date.now() });
      syncAdminChat();
      await saveAdminChatRemote();
      document.getElementById("adminPrivateTranscript").innerHTML = renderAdminTranscript();
      if (window.NIMArtifacts) window.NIMArtifacts.autoOpen(response);
    } catch (error) {
      adminMessages.push({ role: "assistant", content: `Error: ${error.message}`, createdAt: Date.now() });
      syncAdminChat();
      document.getElementById("adminPrivateTranscript").innerHTML = renderAdminTranscript();
    }
  }

  function syncAdminChat() {
    localStorage.setItem("nim_admin_private_chat", JSON.stringify(adminMessages));
  }

  async function saveAdminChatRemote() {
    await fetchJson("/api/admin-chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: "admin-private",
        title: "Private admin chat",
        model: app.state.model,
        messages: adminMessages,
      }),
    });
  }

  function clearAdminChat() {
    adminMessages = [];
    syncAdminChat();
    render();
  }

  async function fetchJson(path, options = {}) {
    const response = await app.api(path, options, true);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  function refresh() {
    render();
  }

  function locationText(session) {
    return [session.city, session.country].filter(Boolean).join(", ") || session.country || "Unknown";
  }

  function formatDate(timestamp) {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function stripArtifacts(text) {
    return String(text || "").replace(/<artifact\b[^>]*>[\s\S]*?<\/artifact>/gi, "\n\n");
  }

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  window.NIMAdmin = {
    init,
    open,
    close,
    refresh,
    showSession,
    showChat,
    block,
    unblock,
    revoke,
    addBlock,
    saveConfig,
    sendAdminChat,
    clearAdminChat,
  };
})();
