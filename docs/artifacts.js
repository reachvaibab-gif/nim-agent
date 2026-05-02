/* artifacts.js — NIM Chat artifact engine */

(function () {
  let _app = null;

  const ARTIFACT_RE = /<artifact\b([^>]*)>([\s\S]*?)<\/artifact>/gi;
  const FILE_RE =
    /\*\*([^\*\n]+\.[A-Za-z0-9_]+)\*\*\s*\n```(?:[\w+-]*)\n([\s\S]*?)```/g;

  function parseAttrs(attrStr) {
    const obj = {};
    const re = /([\w-]+)="([^"]*)"/g;
    let m;
    while ((m = re.exec(attrStr)) !== null) obj[m[1]] = m[2];
    return obj;
  }

  function extract(text) {
    const results = [];
    let m;
    ARTIFACT_RE.lastIndex = 0;
    while ((m = ARTIFACT_RE.exec(String(text || ""))) !== null) {
      const attrs = parseAttrs(m[1]);
      results.push({
        type: attrs.type || "code",
        title: attrs.title || "Artifact",
        language: attrs.language || "",
        content: m[2].trim(),
        raw: m[0],
      });
    }
    return results;
  }

  function extractFiles(text) {
    const files = [];
    const seen = new Set();
    FILE_RE.lastIndex = 0;
    let m;
    while ((m = FILE_RE.exec(String(text || ""))) !== null) {
      const path = m[1].trim().replace(/^\/+/, "");
      if (!seen.has(path)) {
        seen.add(path);
        files.push({ path, content: m[2], language: langFromPath(path) });
      }
    }
    // Also parse <artifact type="project"> blocks
    for (const artifact of extract(text)) {
      if (artifact.type === "project") {
        FILE_RE.lastIndex = 0;
        let pm;
        while ((pm = FILE_RE.exec(artifact.content)) !== null) {
          const path = pm[1].trim().replace(/^\/+/, "");
          if (!seen.has(path)) {
            seen.add(path);
            files.push({ path, content: pm[2], language: langFromPath(path) });
          }
        }
      }
    }
    return files;
  }

  function autoOpen(text) {
    const artifacts = extract(text);
    if (artifacts.length) {
      open(artifacts[0]);
      return;
    }
    const files = extractFiles(text);
    if (files.length) {
      _app?.renderFilePanel(files);
    }
  }

  function open(artifact) {
    const panel = document.getElementById("artifactPanel");
    const filePanel = document.getElementById("filePanel");
    if (!panel) return;
    filePanel?.classList.add("hidden");
    document.getElementById("app")?.classList.remove("has-files");
    panel.classList.remove("hidden");

    const badge = document.getElementById("artTypeBadge");
    const name = document.getElementById("artName");
    const body = document.getElementById("artifactBody");
    if (badge) badge.textContent = artifact.type.toUpperCase();
    if (name) name.textContent = artifact.title;

    _currentArtifact = artifact;
    _viewMode = "preview";
    renderArtifactBody(body, artifact);
    bindArtifactControls(artifact);
  }

  let _currentArtifact = null;
  let _viewMode = "preview";

  function renderArtifactBody(body, artifact) {
    body.innerHTML = "";
    if (_viewMode === "code") {
      const pre = document.createElement("pre");
      pre.className = "artifact-code";
      const code = document.createElement("code");
      const lang = artifact.language || langFromType(artifact.type);
      code.className = `language-${lang}`;
      code.textContent = artifact.content;
      pre.appendChild(code);
      body.appendChild(pre);
      if (window.hljs) hljs.highlightElement(code);
      return;
    }

    switch (artifact.type) {
      case "html": {
        const frame = document.createElement("iframe");
        frame.className = "artifact-frame";
        frame.sandbox =
          "allow-scripts allow-same-origin allow-forms allow-modals allow-popups";
        body.appendChild(frame);
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(artifact.content);
          doc.close();
        }
        break;
      }
      case "svg": {
        const wrap = document.createElement("div");
        wrap.style.cssText =
          "display:flex;justify-content:center;align-items:center;min-height:200px;padding:16px";
        wrap.innerHTML = artifact.content;
        const svg = wrap.querySelector("svg");
        if (svg) {
          svg.style.maxWidth = "100%";
          svg.style.height = "auto";
        }
        body.appendChild(wrap);
        break;
      }
      case "mermaid": {
        const wrap = document.createElement("div");
        wrap.className = "mermaid";
        wrap.textContent = artifact.content;
        body.appendChild(wrap);
        if (window.mermaid) {
          mermaid.initialize({ theme: "dark", startOnLoad: false });
          mermaid.run({ nodes: [wrap] });
        } else {
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
          script.onload = () => {
            mermaid.initialize({ theme: "dark", startOnLoad: false });
            mermaid.run({ nodes: [wrap] });
          };
          document.head.appendChild(script);
        }
        break;
      }
      case "markdown": {
        const div = document.createElement("div");
        div.className = "artifact-markdown msg-content";
        div.innerHTML =
          _app?.renderMarkdown(artifact.content) || artifact.content;
        body.appendChild(div);
        if (window.hljs)
          div
            .querySelectorAll("pre code")
            .forEach((el) => hljs.highlightElement(el));
        break;
      }
      case "project": {
        const files = extractFiles(artifact.content);
        if (files.length) {
          const summary = document.createElement("div");
          summary.className = "project-summary";
          summary.innerHTML = `
            <div class="project-info">
              <strong>${files.length} files</strong>
              <span>${artifact.title}</span>
            </div>
            <button class="art-btn" onclick="window.NIMArtifacts._openProjectFiles()">Open in side panel</button>
          `;
          body.appendChild(summary);
          _pendingProjectFiles = files;

          const treeContainer = document.createElement("div");
          treeContainer.className = "project-tree";
          renderFileTree(files, treeContainer, (index) => {
            _previewProjectFile(index);
          });
          body.appendChild(treeContainer);
        } else {
          body.innerHTML = `<p class="artifact-empty">No files detected in project output.</p>`;
        }
        break;
      }
      default: {
        const pre = document.createElement("pre");
        pre.className = "artifact-code";
        const code = document.createElement("code");
        code.className = `language-${artifact.language || "text"}`;
        code.textContent = artifact.content;
        pre.appendChild(code);
        body.appendChild(pre);
        if (window.hljs) hljs.highlightElement(code);
      }
    }
  }

  let _pendingProjectFiles = [];

  function bindArtifactControls(artifact) {
    const toggleBtn = document.getElementById("artToggle");
    const copyBtn = document.getElementById("artCopy");
    const dlBtn = document.getElementById("artDownload");
    const closeBtn = document.getElementById("artClose");
    const body = document.getElementById("artifactBody");

    if (toggleBtn) {
      toggleBtn.onclick = () => {
        _viewMode = _viewMode === "preview" ? "code" : "preview";
        toggleBtn.textContent = _viewMode === "preview" ? "Code" : "Preview";
        renderArtifactBody(body, artifact);
      };
      toggleBtn.textContent = _viewMode === "preview" ? "Code" : "Preview";
      const noPreview = ["code", "markdown"].includes(artifact.type);
      toggleBtn.classList.toggle("hidden", noPreview);
    }

    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(artifact.content).then(() => {
          copyBtn.textContent = "Copied";
          setTimeout(() => {
            copyBtn.textContent = "Copy";
          }, 1400);
        });
      };
    }

    if (dlBtn) {
      dlBtn.onclick = () => {
        const ext = artifact.language || extFromType(artifact.type);
        const name =
          artifact.title.replace(/[^a-z0-9_.-]/gi, "_") || "artifact";
        downloadText(artifact.content, `${name}.${ext}`, "text/plain");
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () =>
        document.getElementById("artifactPanel")?.classList.add("hidden");
    }
  }

  function openLibrary(artifacts) {
    if (!artifacts.length) return;
    open(artifacts[0]);
  }

  function init(appRef) {
    _app = appRef;
  }

  function langFromPath(path) {
    const ext = String(path || "")
      .split(".")
      .pop()
      .toLowerCase();
    const m = {
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
    };
    return m[ext] || ext;
  }

  function langFromType(type) {
    return (
      { html: "html", svg: "xml", mermaid: "markdown", markdown: "markdown" }[
        type
      ] || "text"
    );
  }

  function extFromType(type) {
    return (
      { html: "html", svg: "svg", markdown: "md", code: "txt", project: "txt" }[
        type
      ] || "txt"
    );
  }

  function escHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function downloadText(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderFileTree(files, container, onFileClick) {
    const tree = {};
    files.forEach((file, index) => {
      const parts = file.path.split("/");
      let current = tree;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          current[part] = { _index: index, _file: file };
        } else {
          if (!current[part] || current[part]._index !== undefined)
            current[part] = {};
          current = current[part];
        }
      });
    });

    function createNode(name, obj, depth = 0) {
      const el = document.createElement("div");
      el.className = "tree-node";
      el.style.paddingLeft = `${depth * 14}px`;

      if (obj._index !== undefined) {
        // File
        el.classList.add("tree-file");
        el.innerHTML = `
          <span class="tree-icon file-icon"></span>
          <span class="tree-name">${escHtml(name)}</span>
        `;
        el.onclick = () => onFileClick(obj._index);
      } else {
        // Folder
        el.classList.add("tree-folder");
        el.innerHTML = `
          <span class="tree-icon folder-icon"></span>
          <span class="tree-name">${escHtml(name)}</span>
        `;
        const children = document.createElement("div");
        children.className = "tree-children";
        Object.keys(obj)
          .sort((a, b) => {
            const aIsFile = obj[a]._index !== undefined;
            const bIsFile = obj[b]._index !== undefined;
            if (aIsFile === bIsFile) return a.localeCompare(b);
            return aIsFile ? 1 : -1; // Folders first
          })
          .forEach((childName) => {
            children.appendChild(createNode(childName, obj[childName], depth + 1));
          });
        el.appendChild(children);
        el.onclick = (e) => {
          e.stopPropagation();
          el.classList.toggle("collapsed");
        };
      }
      return el;
    }

    Object.keys(tree)
      .sort((a, b) => {
        const aIsFile = tree[a]._index !== undefined;
        const bIsFile = tree[b]._index !== undefined;
        if (aIsFile === bIsFile) return a.localeCompare(b);
        return aIsFile ? 1 : -1;
      })
      .forEach((name) => {
        container.appendChild(createNode(name, tree[name]));
      });
  }

  function _previewProjectFile(i) {
    if (_app && _pendingProjectFiles[i]) {
      _app.state.currentFiles = _pendingProjectFiles;
      _app.renderFilePanel(_pendingProjectFiles);
      setTimeout(() => window.previewFile?.(i), 100);
    }
  }

  window.NIMArtifacts = {
    init,
    extract,
    extractFiles,
    autoOpen,
    open,
    openLibrary,
    _openProjectFiles() {
      if (_pendingProjectFiles.length && _app)
        _app.renderFilePanel(_pendingProjectFiles);
    },
    _previewProjectFile(i) {
      _previewProjectFile(i);
    },
  };
})();
