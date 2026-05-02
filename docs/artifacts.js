/* Claude-style artifacts for NIM Chat */

(function () {
  let helpers = {};
  let currentArtifact = null;
  let mode = "preview";

  function init(injectedHelpers = {}) {
    helpers = injectedHelpers;
    bind("artClose", "click", close);
    bind("artToggle", "click", toggleMode);
    bind("artCopy", "click", copyCurrent);
    bind("artDownload", "click", downloadCurrent);
  }

  function bind(id, event, handler) {
    const element = document.getElementById(id);
    if (element) element.addEventListener(event, handler);
  }

  function extract(text) {
    const source = String(text || "");
    const artifacts = [];

    const artifactRe = /<artifact\b([^>]*)>([\s\S]*?)<\/artifact>/gi;
    let match;
    while ((match = artifactRe.exec(source)) !== null) {
      const attrs = parseAttributes(match[1]);
      const content = match[2].trim();
      if (!content) continue;
      artifacts.push({
        type: normalizeType(attrs.type || attrs.kind || languageToType(attrs.language)),
        title: attrs.title || attrs.name || titleForContent(content, attrs.language),
        language: attrs.language || languageFromContent(content),
        content,
      });
    }

    const files = extractFiles(source);
    if (files.length) {
      artifacts.push({
        type: "project",
        title: `Project (${files.length} files)`,
        language: "text",
        content: projectManifest(files),
        files,
      });
    }

    const htmlBlocks = extractCodeBlocks(source)
      .filter((block) => block.language === "html" && looksLikeHtmlDocument(block.content));
    for (const block of htmlBlocks) {
      if (!artifacts.some((artifact) => artifact.content === block.content)) {
        artifacts.push({
          type: "html",
          title: "HTML Preview",
          language: "html",
          content: block.content.trim(),
        });
      }
    }

    return artifacts;
  }

  function open(artifact) {
    if (!artifact) return;
    currentArtifact = artifact;
    mode = artifact.type === "html" || artifact.type === "markdown" || artifact.type === "project" ? "preview" : "code";
    render();
    document.getElementById("artifactPanel")?.classList.remove("hidden");
    document.getElementById("app")?.classList.add("has-artifact");

    if (artifact.type === "project" && artifact.files?.length && window.NIMApp) {
      window.NIMApp.renderFilePanel(artifact.files);
    }
  }

  function autoOpen(text) {
    const panel = document.getElementById("artifactPanel");
    if (panel && !panel.classList.contains("hidden")) return;
    const artifacts = extract(text);
    if (artifacts.length) open(artifacts[0]);
  }

  function close() {
    document.getElementById("artifactPanel")?.classList.add("hidden");
    document.getElementById("app")?.classList.remove("has-artifact");
  }

  function toggleMode() {
    if (!currentArtifact) return;
    mode = mode === "preview" ? "code" : "preview";
    render();
  }

  function render() {
    if (!currentArtifact) return;
    const badge = document.getElementById("artTypeBadge");
    const name = document.getElementById("artName");
    const toggle = document.getElementById("artToggle");
    const body = document.getElementById("artifactBody");

    if (badge) badge.textContent = mode === "preview" ? "Preview" : "Code";
    if (name) name.textContent = currentArtifact.title || "Artifact";
    if (toggle) toggle.textContent = mode === "preview" ? "Code" : "Preview";
    if (!body) return;

    if (mode === "code") {
      body.innerHTML = codeView(currentArtifact.content, currentArtifact.language);
      highlight(body);
      return;
    }

    if (currentArtifact.type === "html") {
      body.innerHTML = htmlPreview(currentArtifact.content);
      return;
    }

    if (currentArtifact.type === "markdown") {
      body.innerHTML = `<div class="artifact-markdown">${helpers.renderMarkdown ? helpers.renderMarkdown(currentArtifact.content) : escapeHtml(currentArtifact.content)}</div>`;
      highlight(body);
      return;
    }

    if (currentArtifact.type === "project") {
      body.innerHTML = projectPreview(currentArtifact.files || extractFiles(currentArtifact.content));
      return;
    }

    body.innerHTML = codeView(currentArtifact.content, currentArtifact.language);
    highlight(body);
  }

  function htmlPreview(html) {
    const srcdoc = strictSrcdoc(html);
    return `<iframe class="artifact-frame" sandbox="" referrerpolicy="no-referrer" srcdoc="${escapeAttr(srcdoc)}"></iframe>`;
  }

  function strictSrcdoc(html) {
    const csp = [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "img-src data: blob:",
      "font-src data:",
      "connect-src 'none'",
      "script-src 'none'",
      "frame-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; ");
    if (/<head[\s>]/i.test(html)) {
      return html.replace(/<head([^>]*)>/i, `<head$1><meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">`);
    }
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}"></head><body>${html}</body></html>`;
  }

  function codeView(content, language = "text") {
    const lang = language || "text";
    return `<pre class="artifact-code"><code class="language-${escapeAttr(lang)}">${escapeHtml(content)}</code></pre>`;
  }

  function projectPreview(files) {
    if (!files.length) return `<div class="artifact-empty">No files detected.</div>`;
    const total = files.reduce((sum, file) => sum + file.content.length, 0);
    return `
      <div class="project-summary">
        <div>
          <strong>${files.length} files</strong>
          <span>${formatBytes(total)} generated</span>
        </div>
        <button class="art-btn" onclick="NIMArtifacts.downloadFiles()">Download ZIP</button>
      </div>
      <div class="artifact-file-list">
        ${files.map((file, index) => `
          <button onclick="NIMArtifacts.openFile(${index})">
            <span>${escapeHtml(file.path)}</span>
            <small>${formatBytes(file.content.length)}</small>
          </button>`).join("")}
      </div>`;
  }

  function openFile(index) {
    if (!currentArtifact?.files?.[index]) return;
    const file = currentArtifact.files[index];
    open({
      type: languageToType(file.language),
      title: file.path,
      language: file.language,
      content: file.content,
    });
  }

  async function downloadFiles() {
    if (!currentArtifact?.files?.length) return;
    if (window.NIMApp) {
      window.NIMApp.renderFilePanel(currentArtifact.files);
      return;
    }
  }

  async function copyCurrent() {
    if (!currentArtifact) return;
    await navigator.clipboard.writeText(currentArtifact.content);
    helpers.toast?.("Artifact copied");
  }

  function downloadCurrent() {
    if (!currentArtifact) return;
    downloadBlob(currentArtifact.content, filenameFor(currentArtifact), mimeFor(currentArtifact));
  }

  function downloadBlob(content, filename, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function extractCodeBlocks(text) {
    const blocks = [];
    const re = /```([a-zA-Z0-9_+.-]*)\n([\s\S]*?)```/g;
    let match;
    while ((match = re.exec(String(text || ""))) !== null) {
      blocks.push({ language: (match[1] || "text").toLowerCase(), content: match[2] });
    }
    return blocks;
  }

  function extractFiles(text) {
    const source = String(text || "");
    const files = [];
    const seen = new Set();
    const fileRe = /\*\*([^*\n]+\.[A-Za-z0-9][A-Za-z0-9_.-]*)\*\*\s*\n```([a-zA-Z0-9_+.-]*)\n([\s\S]*?)```/g;
    let match;
    while ((match = fileRe.exec(source)) !== null) {
      const path = cleanPath(match[1]);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      files.push({ path, language: match[2] || languageFromPath(path), content: match[3] });
    }
    return files;
  }

  function parseAttributes(raw) {
    const attrs = {};
    const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let match;
    while ((match = re.exec(raw || "")) !== null) {
      attrs[match[1]] = match[3] ?? match[4] ?? match[5] ?? "";
    }
    return attrs;
  }

  function cleanPath(path) {
    return String(path || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\.\.+/g, ".")
      .replace(/[<>:"|?*]/g, "")
      .slice(0, 180);
  }

  function languageToType(language = "") {
    const lang = language.toLowerCase();
    if (lang === "html") return "html";
    if (lang === "md" || lang === "markdown") return "markdown";
    return "code";
  }

  function normalizeType(type = "code") {
    const t = String(type).toLowerCase();
    if (["html", "markdown", "project"].includes(t)) return t;
    return "code";
  }

  function languageFromContent(content) {
    if (looksLikeHtmlDocument(content)) return "html";
    return "text";
  }

  function languageFromPath(path) {
    const ext = String(path || "").split(".").pop().toLowerCase();
    const map = { js: "javascript", ts: "typescript", jsx: "jsx", tsx: "tsx", py: "python", html: "html", css: "css", md: "markdown", json: "json", sh: "bash", yml: "yaml", yaml: "yaml" };
    return map[ext] || ext;
  }

  function looksLikeHtmlDocument(content) {
    return /<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<section[\s>]/i.test(content || "");
  }

  function titleForContent(content, language = "") {
    if (language) return `${language.toUpperCase()} Artifact`;
    return looksLikeHtmlDocument(content) ? "HTML Preview" : "Code Artifact";
  }

  function projectManifest(files) {
    return files.map((file) => `**${file.path}**\n\`\`\`${file.language || ""}\n${file.content}\n\`\`\``).join("\n\n");
  }

  function filenameFor(artifact) {
    const safe = String(artifact.title || "artifact").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artifact";
    const ext = artifact.type === "html" ? "html" : artifact.type === "markdown" ? "md" : extensionForLanguage(artifact.language);
    return `${safe}.${ext}`;
  }

  function extensionForLanguage(language = "txt") {
    const map = { javascript: "js", typescript: "ts", python: "py", markdown: "md", bash: "sh", yaml: "yml" };
    return map[language] || language || "txt";
  }

  function mimeFor(artifact) {
    if (artifact.type === "html") return "text/html";
    if (artifact.type === "markdown") return "text/markdown";
    return "text/plain";
  }

  function highlight(root) {
    if (!window.hljs || !root) return;
    root.querySelectorAll("pre code").forEach((code) => {
      if (!code.dataset.highlighted) hljs.highlightElement(code);
    });
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

  window.NIMArtifacts = {
    init,
    extract,
    extractFiles,
    open,
    autoOpen,
    close,
    openFile,
    downloadFiles,
  };
})();
