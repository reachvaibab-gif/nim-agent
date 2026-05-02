/* ── app.js v4 — NIM Chat ────────────────────────────────────
   Features: streaming (smart scroll), markdown, conversations,
   delete/temp chats, project mode (file tree + ZIP download)
──────────────────────────────────────────────────────────── */

function getNimEndpoint() {
  return state.proxyUrl || 'https://integrate.api.nvidia.com/v1/chat/completions';
}

// ── STATE ──────────────────────────────────────────────────
let state = {
  apiKey: '',
  model: 'qwen/qwen3-coder-480b-a35b-instruct',
  systemPrompt: 'You are a helpful, accurate, and thoughtful AI assistant.',
  proxyUrl: '',
  conversations: {},
  activeId: null,
  generating: false,
  abortController: null,
  projectMode: false,
  currentFiles: [],
};

let autoScroll = true;

let pendingDeleteId = null;

// ── STORAGE ────────────────────────────────────────────────
function save() {
  // Exclude temporary chats from persistence
  const savedConvs = {};
  for (const [id, conv] of Object.entries(state.conversations)) {
    if (!conv.temp) savedConvs[id] = conv;
  }
  localStorage.setItem('nim_v3', JSON.stringify({
    apiKey: state.apiKey,
    model: state.model,
    systemPrompt: state.systemPrompt,
    proxyUrl: state.proxyUrl,
    conversations: savedConvs,
    activeId: state.conversations[state.activeId]?.temp ? null : state.activeId,
  }));
}

function load() {
  try {
    const raw = localStorage.getItem('nim_v3');
    if (!raw) return false;
    const data = JSON.parse(raw);
    Object.assign(state, data);
    return !!state.apiKey;
  } catch { return false; }
}

// ── INIT ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const hasKey = load();

  marked.setOptions({ breaks: true, gfm: true });

  // Onboarding
  document.getElementById('startBtn').addEventListener('click', onboardingSubmit);
  document.getElementById('apiKeyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') onboardingSubmit();
  });

  // Sidebar
  document.getElementById('newChatBtn').addEventListener('click', () => newChat());
  document.getElementById('tempChatBtn').addEventListener('click', () => newTempChat());
  document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('clearDataBtn').addEventListener('click', clearAllData);
  document.getElementById('settingsModal').addEventListener('click', e => {
    if (e.target === document.getElementById('settingsModal')) closeSettings();
  });

  // Delete confirm
  document.getElementById('deleteCancelBtn').addEventListener('click', () => {
    pendingDeleteId = null;
    document.getElementById('deleteModal').classList.add('hidden');
  });
  document.getElementById('deleteConfirmBtn').addEventListener('click', confirmDelete);

  // Stop
  document.getElementById('stopBtn').addEventListener('click', stopGeneration);

  // Project mode toggle
  document.getElementById('projectModeBtn').addEventListener('click', toggleProjectMode);

  // File panel buttons
  document.getElementById('downloadAllBtn').addEventListener('click', downloadZip);
  document.getElementById('closeFilePanelBtn').addEventListener('click', () => {
    document.getElementById('filePanel').classList.add('hidden');
    document.getElementById('app').classList.remove('has-files');
  });
  document.getElementById('filePreviewClose').addEventListener('click', closeFilePreview);
  document.getElementById('filePreviewModal').addEventListener('click', e => {
    if (e.target === document.getElementById('filePreviewModal')) closeFilePreview();
  });

  // Smart scroll: stop auto-scrolling when user scrolls up
  document.getElementById('messagesContainer').addEventListener('scroll', () => {
    const c = document.getElementById('messagesContainer');
    autoScroll = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
  });

  // Send
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  const input = document.getElementById('messageInput');
  input.addEventListener('input', () => { autoResize(input); updateSendBtn(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!document.getElementById('sendBtn').disabled) sendMessage();
    }
  });

  // Suggestion chips
  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.msg;
      autoResize(input);
      updateSendBtn();
      input.focus();
    });
  });

  if (hasKey) {
    showApp();
  }
});

// ── ONBOARDING ─────────────────────────────────────────────
function onboardingSubmit() {
  const key = document.getElementById('apiKeyInput').value.trim();
  const proxyEl = document.getElementById('proxyUrlInput');
  const proxy = proxyEl ? proxyEl.value.trim() : '';

  if (!key.startsWith('nvapi-')) {
    flashError('apiKeyInput', 'Key must start with nvapi-');
    return;
  }
  if (proxyEl && !proxy) {
    flashError('proxyUrlInput', 'Required — see proxy setup instructions');
    return;
  }
  state.apiKey = key;
  state.model = document.getElementById('modelSelect').value;
  state.proxyUrl = proxy;
  save();
  showApp();
}

function flashError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  const orig = el.placeholder;
  el.style.borderColor = '#e53e3e';
  el.placeholder = msg;
  setTimeout(() => { el.style.borderColor = ''; el.placeholder = orig; }, 2500);
}

function showApp() {
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateModelBadge();
  renderSidebar();
  if (state.activeId && state.conversations[state.activeId]) {
    renderMessages();
  } else {
    newChat();
  }
  document.getElementById('messageInput').focus();
}

// ── CONVERSATIONS ──────────────────────────────────────────
function newChat() {
  const id = `c_${Date.now()}`;
  state.conversations[id] = { title: 'New chat', messages: [], temp: false };
  state.activeId = id;
  save();
  renderSidebar();
  renderMessages();
  document.getElementById('messageInput').focus();
}

function newTempChat() {
  const id = `t_${Date.now()}`;
  state.conversations[id] = { title: '⚡ Temporary', messages: [], temp: true };
  state.activeId = id;
  renderSidebar();
  renderMessages();
  updateTempBadge();
  document.getElementById('messageInput').focus();
}

function selectConversation(id) {
  state.activeId = id;
  save();
  renderSidebar();
  renderMessages();
  updateTempBadge();
}

function deleteConversation(id, e) {
  e.stopPropagation();
  pendingDeleteId = id;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  const wasActive = pendingDeleteId === state.activeId;
  delete state.conversations[pendingDeleteId];
  pendingDeleteId = null;
  document.getElementById('deleteModal').classList.add('hidden');

  if (wasActive) {
    const ids = Object.keys(state.conversations);
    state.activeId = ids.length ? ids[ids.length - 1] : null;
    if (!state.activeId) newChat(); else renderMessages();
  }
  save();
  renderSidebar();
}

// ── SIDEBAR RENDER ─────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('conversationList');
  const all = Object.entries(state.conversations).reverse();

  if (all.length === 0) {
    list.innerHTML = `<div style="padding:12px 10px;font-size:12px;color:var(--faint)">No conversations yet</div>`;
    return;
  }

  // Group by: temporary, today, yesterday, older
  const temp = all.filter(([, c]) => c.temp);
  const saved = all.filter(([, c]) => !c.temp);

  const now = Date.now();
  const today = saved.filter(([id]) => now - idTs(id) < 86400000);
  const yesterday = saved.filter(([id]) => {
    const age = now - idTs(id);
    return age >= 86400000 && age < 172800000;
  });
  const older = saved.filter(([id]) => now - idTs(id) >= 172800000);

  let html = '';
  if (temp.length) {
    html += group('Temporary', temp);
  }
  if (today.length) html += group('Today', today);
  if (yesterday.length) html += group('Yesterday', yesterday);
  if (older.length) html += group('Older', older);

  list.innerHTML = html;
}

function idTs(id) {
  const n = parseInt(id.split('_')[1]);
  return isNaN(n) ? 0 : n;
}

function group(label, items) {
  return `<div class="conv-group-label">${label}</div>` +
    items.map(([id, conv]) => {
      const active = id === state.activeId ? 'active' : '';
      return `
        <div class="conv-item ${active}" onclick="selectConversation('${id}')">
          ${conv.temp ? `<div class="conv-temp-dot"></div>` : ''}
          <span class="conv-item-text">${escHtml(conv.title)}</span>
          <button class="conv-delete" onclick="deleteConversation('${id}',event)" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>`;
    }).join('');
}

// ── RENDER MESSAGES ────────────────────────────────────────
function renderMessages() {
  const container = document.getElementById('messages');
  const emptyState = document.getElementById('emptyState');
  const conv = state.conversations[state.activeId];
  updateTempBadge();

  if (!conv || conv.messages.length === 0) {
    container.innerHTML = '';
    container.appendChild(emptyState);
    emptyState.classList.remove('hidden');
    document.getElementById('emptyModelName').textContent = modelLabel(state.model);
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = conv.messages.map((m, i) => buildMsgHTML(m, i)).join('');
  container.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
  scrollToBottom();
}

function buildMsgHTML(msg, i) {
  if (msg.role === 'user') {
    return `<div class="message user" id="msg_${i}">
      <div class="msg-avatar">U</div>
      <div class="msg-content">${escHtml(msg.content)}</div>
    </div>`;
  }
  return `<div class="message assistant" id="msg_${i}">
    <div class="msg-avatar">
      <svg width="16" height="16" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#76b900"/>
        <path d="M10 28L20 12L30 28H10Z" fill="white"/>
      </svg>
    </div>
    <div class="msg-content">${renderMarkdown(msg.content)}</div>
  </div>`;
}

function renderMarkdown(text) {
  let html = marked.parse(text || '');
  html = html.replace(/<pre><code class="language-(\w+)">/g, (_, lang) =>
    `<pre><div class="code-header"><span class="code-lang">${escHtml(lang)}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><code class="language-${escHtml(lang)}">`
  );
  html = html.replace(/<pre><code(?! class)>/g,
    `<pre><div class="code-header"><span class="code-lang">code</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><code>`
  );
  return html;
}

// ── SEND MESSAGE ───────────────────────────────────────────
async function sendMessage() {
  if (state.generating) return;
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  autoResize(input);
  updateSendBtn();
  document.getElementById('emptyState').classList.add('hidden');

  const conv = state.conversations[state.activeId];
  conv.messages.push({ role: 'user', content: text });

  if (conv.messages.length === 1 && conv.title === 'New chat') {
    conv.title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
    renderSidebar();
  }

  appendMsgDOM({ role: 'user', content: text }, conv.messages.length - 1);

  const assistantIdx = conv.messages.length;
  conv.messages.push({ role: 'assistant', content: '' });
  const assistantEl = appendMsgDOM({ role: 'assistant', content: '' }, assistantIdx);
  assistantEl.querySelector('.msg-content').classList.add('typing-cursor');

  autoScroll = true;
  scrollToBottom(true);

  state.generating = true;
  state.abortController = new AbortController();
  document.getElementById('stopBtn').classList.remove('hidden');
  document.getElementById('sendBtn').disabled = true;

  try {
    const response = await fetch(getNimEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.apiKey}`,
      },
      signal: state.abortController.signal,
      body: JSON.stringify({
        model: state.model,
        messages: buildMessages(conv.messages.slice(0, -1)),
        stream: true,
        max_tokens: state.projectMode ? 16384 : 4096,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || err?.message || `HTTP ${response.status}`);
    }

    await streamResponse(response, assistantEl, conv, assistantIdx);

  } catch (err) {
    if (err.name !== 'AbortError') {
      const isCors = err.message.toLowerCase().includes('fetch') ||
                     err.message.toLowerCase().includes('failed') ||
                     err.message.toLowerCase().includes('network');
      const msg = isCors
        ? '⚠️ CORS / Network Error\n\nCheck your Proxy URL in Settings.'
        : `⚠️ Error: ${err.message}`;
      conv.messages[assistantIdx].content = msg;
      assistantEl.querySelector('.msg-content').textContent = msg;
    }
  } finally {
    finishGeneration(assistantEl);
    if (!conv.temp) save();
    // After stream ends, parse project files if in project mode
    if (state.projectMode) {
      const lastMsg = conv.messages[conv.messages.length - 1];
      if (lastMsg?.role === 'assistant') parseAndShowFiles(lastMsg.content);
    }
  }
}

const PROJECT_PROMPT = `You are an expert software engineer. When creating a project, output EVERY file using this exact format — no exceptions:

**path/to/filename.ext**
\`\`\`language
file contents here
\`\`\`

Include package.json, README.md, config files, and all source files. Write complete, production-ready code.`;

function buildMessages(msgs) {
  const out = [];
  const sys = state.projectMode ? PROJECT_PROMPT : state.systemPrompt;
  if (sys) out.push({ role: 'system', content: sys });
  out.push(...msgs.map(m => ({ role: m.role, content: m.content })));
  return out;
}

async function streamResponse(response, el, conv, idx) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const contentEl = el.querySelector('.msg-content');
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          conv.messages[idx].content = full;
          contentEl.innerHTML = renderMarkdown(full);
          contentEl.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
          scrollToBottom(); // respects autoScroll flag
        }
      } catch { /* ignore */ }
    }
  }
}

function finishGeneration(el) {
  state.generating = false;
  state.abortController = null;
  el.querySelector('.msg-content').classList.remove('typing-cursor');
  document.getElementById('stopBtn').classList.add('hidden');
  updateSendBtn();
}

function stopGeneration() {
  if (state.abortController) state.abortController.abort();
}

// ── DOM HELPERS ────────────────────────────────────────────
function appendMsgDOM(msg, idx) {
  const messages = document.getElementById('messages');
  const div = document.createElement('div');
  div.innerHTML = buildMsgHTML(msg, idx);
  const el = div.firstElementChild;
  messages.appendChild(el);
  if (msg.role === 'assistant') {
    el.querySelectorAll('pre code').forEach(e => hljs.highlightElement(e));
  }
  return el;
}

function scrollToBottom(force = false) {
  if (!force && !autoScroll) return;
  const c = document.getElementById('messagesContainer');
  c.scrollTop = c.scrollHeight;
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function updateSendBtn() {
  const val = document.getElementById('messageInput').value.trim();
  document.getElementById('sendBtn').disabled = !val || state.generating;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ── PROJECT MODE ───────────────────────────────────────────
function toggleProjectMode() {
  state.projectMode = !state.projectMode;
  const btn = document.getElementById('projectModeBtn');
  btn.classList.toggle('active', state.projectMode);
  btn.title = state.projectMode ? 'Project mode ON — click to disable' : 'Project mode — generate full codebases';
  if (!state.projectMode) {
    document.getElementById('filePanel').classList.add('hidden');
    document.getElementById('app').classList.remove('has-files');
  }
}

function parseFiles(text) {
  const files = [];
  const seen = new Set();
  // Match **path/file.ext** followed by a code block
  const re = /\*\*([^\*\n]+\.[A-Za-z0-9_]+)\*\*\s*\n```(?:[\w+-]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const path = m[1].trim().replace(/^\/+/, '');
    if (!seen.has(path)) { seen.add(path); files.push({ path, content: m[2] }); }
  }
  return files;
}

function parseAndShowFiles(text) {
  const files = parseFiles(text);
  if (!files.length) return;
  state.currentFiles = files;
  renderFilePanel(files);
  document.getElementById('filePanel').classList.remove('hidden');
  document.getElementById('app').classList.add('has-files');
}

function renderFilePanel(files) {
  document.getElementById('fileCount').textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
  const list = document.getElementById('fileList');
  list.innerHTML = files.map((f, i) => {
    const parts = f.path.split('/');
    const name = parts.pop();
    const dir = parts.join('/');
    const ext = name.split('.').pop();
    return `<div class="file-item" onclick="previewFile(${i})">
      <div class="file-item-icon">${fileIcon(ext)}</div>
      <div class="file-item-info">
        <div class="file-item-name">${escHtml(name)}</div>
        ${dir ? `<div class="file-item-dir">${escHtml(dir)}</div>` : ''}
      </div>
      <button class="file-dl-btn" onclick="downloadFile(${i},event)" title="Download">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
    </div>`;
  }).join('');
}

function fileIcon(ext) {
  const icons = { js:'JS', ts:'TS', py:'PY', html:'HTML', css:'CSS',
    json:'{}', md:'MD', sh:'SH', yml:'YML', yaml:'YML', go:'GO',
    rs:'RS', java:'JV', cpp:'C++', c:'C', rb:'RB', php:'PHP' };
  return icons[ext.toLowerCase()] || ext.slice(0,3).toUpperCase();
}

function previewFile(i) {
  const f = state.currentFiles[i];
  document.getElementById('previewFilename').textContent = f.path;
  const code = document.getElementById('previewCode');
  code.textContent = f.content;
  code.className = '';
  hljs.highlightElement(code);
  document.getElementById('previewDownloadBtn').onclick = () => downloadFile(i, null);
  document.getElementById('filePreviewModal').classList.remove('hidden');
}

function closeFilePreview() {
  document.getElementById('filePreviewModal').classList.add('hidden');
}

function downloadFile(i, e) {
  if (e) e.stopPropagation();
  const f = state.currentFiles[i];
  const blob = new Blob([f.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = f.path.split('/').pop(); a.click();
  URL.revokeObjectURL(url);
}

async function downloadZip() {
  if (!window.JSZip) { alert('JSZip not loaded yet, try again in a moment.'); return; }
  const zip = new JSZip();
  for (const f of state.currentFiles) zip.file(f.path, f.content);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'project.zip'; a.click();
  URL.revokeObjectURL(url);
}

function updateTempBadge() {
  const conv = state.conversations[state.activeId];
  const badge = document.getElementById('tempBadge');
  if (conv?.temp) badge.classList.remove('hidden');
  else badge.classList.add('hidden');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function copyCode(btn) {
  const code = btn.closest('pre').querySelector('code');
  navigator.clipboard.writeText(code.innerText).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 1800);
  });
}

function modelLabel(m) {
  return {
    'qwen/qwen3-coder-480b-a35b-instruct': 'Qwen3 Coder 480B',
    'meta/llama-3.1-405b-instruct': 'Llama 3.1 405B',
    'nvidia/llama-3.1-nemotron-ultra-253b-v1': 'Nemotron Ultra 253B',
    'mistralai/mistral-large-2-instruct': 'Mistral Large 2',
  }[m] || m;
}

function updateModelBadge() {
  document.getElementById('modelBadge').textContent = modelLabel(state.model);
  document.getElementById('emptyModelName').textContent = modelLabel(state.model);
}

// ── SETTINGS ───────────────────────────────────────────────
function openSettings() {
  document.getElementById('settingsApiKey').value = state.apiKey;
  document.getElementById('settingsProxyUrl').value = state.proxyUrl;
  document.getElementById('settingsModel').value = state.model;
  document.getElementById('settingsSystemPrompt').value = state.systemPrompt;
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
  const k = document.getElementById('settingsApiKey').value.trim();
  if (k) state.apiKey = k;
  const p = document.getElementById('settingsProxyUrl').value.trim();
  if (p) state.proxyUrl = p;
  state.model = document.getElementById('settingsModel').value;
  state.systemPrompt = document.getElementById('settingsSystemPrompt').value;
  save();
  updateModelBadge();
  closeSettings();
}

function clearAllData() {
  if (!confirm('Delete all conversations and settings?')) return;
  localStorage.removeItem('nim_v3');
  location.reload();
}
