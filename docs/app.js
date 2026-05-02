/* ── app.js — NIM Chat ───────────────────────────────────────
   Full state management, streaming API, markdown rendering,
   conversation history (localStorage), auto-resize textarea.
──────────────────────────────────────────────────────────── */

const NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

// ── STATE ──────────────────────────────────────────────────
let state = {
  apiKey: '',
  model: 'qwen/qwen3-coder-480b-a35b-instruct',
  systemPrompt: 'You are a helpful, accurate, and thoughtful AI assistant.',
  conversations: {},   // id → { title, messages: [] }
  activeId: null,
  generating: false,
  abortController: null,
};

// ── STORAGE ────────────────────────────────────────────────
function save() {
  localStorage.setItem('nim_state', JSON.stringify({
    apiKey: state.apiKey,
    model: state.model,
    systemPrompt: state.systemPrompt,
    conversations: state.conversations,
    activeId: state.activeId,
  }));
}

function load() {
  try {
    const raw = localStorage.getItem('nim_state');
    if (!raw) return false;
    const data = JSON.parse(raw);
    Object.assign(state, data);
    return !!state.apiKey;
  } catch { return false; }
}

// ── INIT ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const hasKey = load();

  // Configure marked
  marked.setOptions({ breaks: true, gfm: true });

  // Wire up onboarding
  document.getElementById('startBtn').addEventListener('click', onboardingSubmit);
  document.getElementById('apiKeyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') onboardingSubmit();
  });

  // Wire up main UI
  document.getElementById('newChatBtn').addEventListener('click', newChat);
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('clearDataBtn').addEventListener('click', clearAllData);
  document.getElementById('stopBtn').addEventListener('click', stopGeneration);

  // Suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('messageInput').value = btn.dataset.msg;
      autoResize(document.getElementById('messageInput'));
      updateSendBtn();
      document.getElementById('messageInput').focus();
    });
  });

  // Textarea auto-resize + send on Enter
  const input = document.getElementById('messageInput');
  input.addEventListener('input', () => { autoResize(input); updateSendBtn(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!document.getElementById('sendBtn').disabled) sendMessage();
    }
  });

  // Click outside settings to close
  document.getElementById('settingsModal').addEventListener('click', e => {
    if (e.target === document.getElementById('settingsModal')) closeSettings();
  });

  if (hasKey) {
    showApp();
  }
});

// ── ONBOARDING ─────────────────────────────────────────────
function onboardingSubmit() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key.startsWith('nvapi-')) {
    showInputError('apiKeyInput', 'Key must start with nvapi-');
    return;
  }
  state.apiKey = key;
  state.model = document.getElementById('modelSelect').value;
  save();
  showApp();
}

function showInputError(id, msg) {
  const el = document.getElementById(id);
  el.style.borderColor = '#e53e3e';
  el.placeholder = msg;
  setTimeout(() => {
    el.style.borderColor = '';
    el.placeholder = el.id === 'apiKeyInput' ? 'nvapi-xxxxxxxxxxxxxxxxxxxx' : '';
  }, 2000);
}

function showApp() {
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateModelBadge();
  renderConversationList();

  if (state.activeId && state.conversations[state.activeId]) {
    renderMessages();
  } else {
    newChat(false);
  }

  document.getElementById('messageInput').focus();
}

// ── CONVERSATIONS ──────────────────────────────────────────
function newChat(save_ = true) {
  const id = `chat_${Date.now()}`;
  state.conversations[id] = { title: 'New Chat', messages: [] };
  state.activeId = id;
  if (save_) save();
  renderConversationList();
  renderMessages();
  document.getElementById('messageInput').focus();
}

function selectConversation(id) {
  state.activeId = id;
  renderConversationList();
  renderMessages();
}

function renderConversationList() {
  const list = document.getElementById('conversationList');
  const ids = Object.keys(state.conversations).reverse();

  if (ids.length === 0) {
    list.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--text-faint)">No conversations yet</div>';
    return;
  }

  list.innerHTML = ids.map(id => {
    const conv = state.conversations[id];
    const active = id === state.activeId ? 'active' : '';
    return `
      <div class="conv-item ${active}" onclick="selectConversation('${id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        ${escHtml(conv.title)}
      </div>`;
  }).join('');
}

// ── RENDER MESSAGES ────────────────────────────────────────
function renderMessages() {
  const container = document.getElementById('messages');
  const emptyState = document.getElementById('emptyState');
  const conv = state.conversations[state.activeId];

  if (!conv || conv.messages.length === 0) {
    container.innerHTML = '';
    container.appendChild(emptyState);
    emptyState.classList.remove('hidden');
    document.getElementById('emptyModelName').textContent = modelLabel(state.model);
    return;
  }

  emptyState.classList.add('hidden');

  container.innerHTML = conv.messages.map((msg, i) => buildMessageHTML(msg, i)).join('');

  // Apply syntax highlighting to all code blocks
  container.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));

  scrollToBottom();
}

function buildMessageHTML(msg, index) {
  if (msg.role === 'user') {
    return `
      <div class="message user" id="msg_${index}">
        <div class="msg-avatar">U</div>
        <div class="msg-content">${escHtml(msg.content)}</div>
      </div>`;
  }

  const rendered = renderMarkdown(msg.content);
  return `
    <div class="message assistant" id="msg_${index}">
      <div class="msg-avatar">
        <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="10" fill="#76b900"/>
          <path d="M10 28L20 12L30 28H10Z" fill="white"/>
        </svg>
      </div>
      <div class="msg-content">${rendered}</div>
    </div>`;
}

function renderMarkdown(text) {
  let html = marked.parse(text || '');

  // Inject code headers with copy button + language label
  html = html.replace(/<pre><code class="language-(\w+)">/g, (_, lang) => {
    return `<pre><div class="code-header"><span class="code-lang">${escHtml(lang)}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><code class="language-${escHtml(lang)}">`;
  });

  // Code blocks without language
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

  // Clear input
  input.value = '';
  autoResize(input);
  updateSendBtn();

  // Hide empty state
  document.getElementById('emptyState').classList.add('hidden');

  const conv = state.conversations[state.activeId];
  conv.messages.push({ role: 'user', content: text });

  // Auto-title after first message
  if (conv.messages.length === 1) {
    conv.title = text.slice(0, 42) + (text.length > 42 ? '…' : '');
    renderConversationList();
  }

  // Render user message
  appendMessageDOM({ role: 'user', content: text }, conv.messages.length - 1);

  // Placeholder for assistant
  const assistantIndex = conv.messages.length;
  conv.messages.push({ role: 'assistant', content: '' });
  const assistantEl = appendMessageDOM({ role: 'assistant', content: '' }, assistantIndex);
  assistantEl.querySelector('.msg-content').classList.add('typing-cursor');

  scrollToBottom();

  // Start generation
  state.generating = true;
  state.abortController = new AbortController();
  document.getElementById('stopBtn').classList.remove('hidden');
  document.getElementById('sendBtn').disabled = true;

  try {
    const messages = buildMessages(conv.messages.slice(0, -1));
    const response = await fetch(NIM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.apiKey}`,
      },
      signal: state.abortController.signal,
      body: JSON.stringify({
        model: state.model,
        messages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || err?.message || `HTTP ${response.status}`);
    }

    await streamResponse(response, assistantEl, conv, assistantIndex);

  } catch (err) {
    if (err.name === 'AbortError') {
      // Stopped by user — keep partial content
    } else {
      const errMsg = `⚠️ Error: ${err.message}`;
      conv.messages[assistantIndex].content = errMsg;
      const contentEl = assistantEl.querySelector('.msg-content');
      contentEl.textContent = errMsg;
    }
  } finally {
    finishGeneration(assistantEl);
    save();
  }
}

function buildMessages(msgs) {
  const out = [];
  if (state.systemPrompt) {
    out.push({ role: 'system', content: state.systemPrompt });
  }
  out.push(...msgs.map(m => ({ role: m.role, content: m.content })));
  return out;
}

async function streamResponse(response, assistantEl, conv, index) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const contentEl = assistantEl.querySelector('.msg-content');
  let buffer = '';
  let fullText = '';

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
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          conv.messages[index].content = fullText;
          contentEl.innerHTML = renderMarkdown(fullText);
          contentEl.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
          scrollToBottom();
        }
      } catch { /* ignore parse errors in stream */ }
    }
  }
}

function finishGeneration(assistantEl) {
  state.generating = false;
  state.abortController = null;
  assistantEl.querySelector('.msg-content').classList.remove('typing-cursor');
  document.getElementById('stopBtn').classList.add('hidden');
  updateSendBtn();
}

function stopGeneration() {
  if (state.abortController) state.abortController.abort();
}

// ── DOM HELPERS ────────────────────────────────────────────
function appendMessageDOM(msg, index) {
  const emptyState = document.getElementById('emptyState');
  if (!emptyState.classList.contains('hidden')) {
    emptyState.classList.add('hidden');
  }

  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.innerHTML = buildMessageHTML(msg, index);
  const el = div.firstElementChild;
  container.appendChild(el);

  if (msg.role === 'assistant') {
    el.querySelectorAll('pre code').forEach(e => hljs.highlightElement(e));
  }

  return el;
}

function scrollToBottom() {
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

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function copyCode(btn) {
  const code = btn.closest('pre').querySelector('code');
  navigator.clipboard.writeText(code.innerText).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
}

function modelLabel(model) {
  const map = {
    'qwen/qwen3-coder-480b-a35b-instruct': 'Qwen3 Coder 480B A35B Instruct',
    'meta/llama-3.1-405b-instruct': 'Llama 3.1 405B Instruct',
    'nvidia/llama-3.1-nemotron-ultra-253b-v1': 'Nemotron Ultra 253B',
    'mistralai/mistral-large-2-instruct': 'Mistral Large 2',
  };
  return map[model] || model;
}

function updateModelBadge() {
  document.getElementById('modelBadge').textContent = modelLabel(state.model);
  document.getElementById('emptyModelName').textContent = modelLabel(state.model);
}

// ── SETTINGS ───────────────────────────────────────────────
function openSettings() {
  document.getElementById('settingsApiKey').value = state.apiKey;
  document.getElementById('settingsModel').value = state.model;
  document.getElementById('settingsSystemPrompt').value = state.systemPrompt;
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
  const key = document.getElementById('settingsApiKey').value.trim();
  if (key) state.apiKey = key;
  state.model = document.getElementById('settingsModel').value;
  state.systemPrompt = document.getElementById('settingsSystemPrompt').value;
  save();
  updateModelBadge();
  closeSettings();
}

function clearAllData() {
  if (!confirm('This will delete all conversations and settings. Continue?')) return;
  localStorage.removeItem('nim_state');
  location.reload();
}
