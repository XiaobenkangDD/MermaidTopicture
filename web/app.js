(() => {
  const DEFAULT_CODE = `graph TD
    Start([开始]) --> Work[处理业务]
    Work --> Check{是否通过}
    Check -->|是| Done([完成])
    Check -->|否| Fix[修正后重试]
    Fix --> Work`;

  const els = {
    codeInput: document.getElementById('codeInput'),
    exampleSelect: document.getElementById('exampleSelect'),
    themeSelect: document.getElementById('themeSelect'),
    bgSelect: document.getElementById('bgSelect'),
    sizeRange: document.getElementById('sizeRange'),
    scaleRange: document.getElementById('scaleRange'),
    sizeLabel: document.getElementById('sizeLabel'),
    scaleLabel: document.getElementById('scaleLabel'),
    fileName: document.getElementById('fileName'),
    previewStage: document.getElementById('previewStage'),
    previewInner: document.getElementById('previewInner'),
    previewEmpty: document.getElementById('previewEmpty'),
    previewError: document.getElementById('previewError'),
    syntaxStatus: document.getElementById('syntaxStatus'),
    charCount: document.getElementById('charCount'),
    exportForm: document.getElementById('exportForm'),
    exportToast: document.getElementById('exportToast'),
    globalToast: document.getElementById('globalToast'),
    btnExport: document.getElementById('btnExport'),
    btnExportSide: document.getElementById('btnExportSide'),
    btnCopy: document.getElementById('btnCopy'),
    btnClear: document.getElementById('btnClear'),
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnZoomReset: document.getElementById('btnZoomReset'),
  };

  let renderTimer = null;
  let zoom = 1;
  let renderToken = 0;
  let mermaidApi = null;
  let lastTheme = null;

  async function loadMermaid() {
    if (mermaidApi) return mermaidApi;
    if (window.mermaid) {
      mermaidApi = window.mermaid;
      return mermaidApi;
    }
    const mod = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
    mermaidApi = mod.default || window.mermaid;
    window.mermaid = mermaidApi;
    return mermaidApi;
  }

  async function ensureMermaid(theme) {
    const mermaid = await loadMermaid();
    if (theme !== lastTheme || !lastTheme) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: theme || 'default',
        fontFamily: 'IBM Plex Sans, Noto Sans SC, sans-serif',
        themeVariables: {
          fontSize: '16px',
        },
      });
      lastTheme = theme || 'default';
    }
    return mermaid;
  }

  function selectedFormat() {
    const checked = document.querySelector('input[name="format"]:checked');
    return checked ? checked.value : 'svg';
  }

  function setStatus(ok, message) {
    els.syntaxStatus.textContent = message;
    els.syntaxStatus.className = `status ${ok ? 'ok' : 'err'}`;
  }

  function showToast(message, isError = false) {
    const targets = [els.exportToast, els.globalToast].filter(Boolean);
    for (const target of targets) {
      target.hidden = false;
      target.textContent = message;
      target.className = `toast${target.id === 'globalToast' ? ' global' : ''}${isError ? ' error' : ''}`;
    }
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      for (const target of targets) target.hidden = true;
    }, 7000);
  }

  function applyZoom() {
    els.previewInner.style.transform = `scale(${zoom})`;
    els.btnZoomReset.textContent = `${Math.round(zoom * 100)}%`;
  }

  function syncPreviewChrome() {
    const bg = els.bgSelect.value;
    const darkTheme = ['dark', 'neo-dark', 'redux-dark', 'redux-dark-color'].includes(els.themeSelect.value);
    els.previewStage.dataset.tone = darkTheme || bg === '#0B1220' ? 'dark' : 'light';
    if (bg === 'transparent') {
      els.previewStage.style.backgroundColor = '';
    } else {
      els.previewStage.style.backgroundColor = bg;
    }
  }

  function showEmpty() {
    els.previewInner.innerHTML = '';
    els.previewEmpty.hidden = false;
    els.previewEmpty.classList.remove('is-hidden');
    els.previewError.hidden = true;
    els.previewError.classList.add('is-hidden');
  }

  function showError(message) {
    els.previewInner.innerHTML = '';
    els.previewEmpty.hidden = true;
    els.previewEmpty.classList.add('is-hidden');
    els.previewError.hidden = false;
    els.previewError.classList.remove('is-hidden');
    els.previewError.textContent = message;
  }

  function showPreview(svg) {
    els.previewInner.innerHTML = svg;
    els.previewEmpty.hidden = true;
    els.previewEmpty.classList.add('is-hidden');
    els.previewError.hidden = true;
    els.previewError.classList.add('is-hidden');
  }

  async function renderPreview() {
    const code = els.codeInput.value.trim();
    els.charCount.textContent = `${els.codeInput.value.length} 字符`;
    syncPreviewChrome();

    if (!code) {
      showEmpty();
      setStatus(true, '等待输入');
      return;
    }

    const token = ++renderToken;
    const theme = els.themeSelect.value;
    setStatus(true, '正在渲染预览…');

    try {
      const mermaid = await ensureMermaid(theme);
      // 每次渲染使用唯一 id，避免 mermaid 内部缓存串图
      const id = `mmd-${Date.now()}-${token}`;
      const { svg } = await mermaid.render(id, code);
      if (token !== renderToken) return;
      showPreview(svg);
      setStatus(true, '语法正常 · 预览已更新');
    } catch (error) {
      if (token !== renderToken) return;
      showError(error.message || String(error));
      setStatus(false, '语法有误，请检查代码');
    }
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 180);
  }

  async function loadExamples() {
    const res = await fetch('/api/examples');
    const data = await res.json();
    const examples = data.examples || [];

    els.exampleSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '选择示例…';
    els.exampleSelect.appendChild(placeholder);

    for (const item of examples) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      els.exampleSelect.appendChild(option);
    }

    if (examples.some((item) => item.id === 'flowchart')) {
      els.exampleSelect.value = 'flowchart';
      await loadExample('flowchart');
      return;
    }

    els.codeInput.value = DEFAULT_CODE;
    scheduleRender();
  }

  async function loadExample(id) {
    if (!id) return;
    const res = await fetch(`/api/examples/${encodeURIComponent(id)}`);
    if (!res.ok) {
      showToast('加载示例失败', true);
      return;
    }
    const data = await res.json();
    els.codeInput.value = data.code || '';
    els.fileName.value = data.id || 'diagram';
    // 立即渲染，避免仅改 DOM 不触发 input 事件
    await renderPreview();
  }

  async function exportDiagram(event) {
    if (event) event.preventDefault();

    const code = els.codeInput.value.trim();
    if (!code) {
      showToast('请先输入 Mermaid 代码', true);
      return;
    }

    const payload = {
      code,
      format: selectedFormat(),
      theme: els.themeSelect.value,
      background: els.bgSelect.value,
      size: Number(els.sizeRange.value),
      scale: Number(els.scaleRange.value),
      filename: els.fileName.value.trim() || 'diagram',
    };

    els.btnExport.disabled = true;
    els.btnExportSide.disabled = true;
    const prevTop = els.btnExport.textContent;
    const prevSide = els.btnExportSide.textContent;
    els.btnExport.textContent = '导出中…';
    els.btnExportSide.textContent = '导出中…';
    showToast('正在导出高清图，请稍候…');

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '导出失败');
      }

      const binary = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([binary], { type: data.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast(`导出成功：${data.filename}（已保存到 ${data.path}）`);
    } catch (error) {
      showToast(error.message || '导出失败', true);
    } finally {
      els.btnExport.disabled = false;
      els.btnExportSide.disabled = false;
      els.btnExport.textContent = prevTop;
      els.btnExportSide.textContent = prevSide;
    }
  }

  function bindEvents() {
    els.codeInput.addEventListener('input', scheduleRender);
    els.themeSelect.addEventListener('change', () => {
      lastTheme = null;
      scheduleRender();
    });
    els.bgSelect.addEventListener('change', () => {
      syncPreviewChrome();
    });
    els.exampleSelect.addEventListener('change', () => {
      loadExample(els.exampleSelect.value);
    });
    els.exportForm.addEventListener('submit', exportDiagram);
    els.btnExport.addEventListener('click', exportDiagram);

    els.sizeRange.addEventListener('input', () => {
      els.sizeLabel.textContent = els.sizeRange.value;
    });
    els.scaleRange.addEventListener('input', () => {
      els.scaleLabel.textContent = `${els.scaleRange.value}×`;
    });

    els.btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(els.codeInput.value);
        showToast('代码已复制到剪贴板');
      } catch {
        showToast('复制失败，请手动选择', true);
      }
    });

    els.btnClear.addEventListener('click', () => {
      els.codeInput.value = '';
      els.exampleSelect.value = '';
      scheduleRender();
    });

    els.btnZoomIn.addEventListener('click', () => {
      zoom = Math.min(2.5, +(zoom + 0.1).toFixed(2));
      applyZoom();
    });
    els.btnZoomOut.addEventListener('click', () => {
      zoom = Math.max(0.5, +(zoom - 0.1).toFixed(2));
      applyZoom();
    });
    els.btnZoomReset.addEventListener('click', () => {
      zoom = 1;
      applyZoom();
    });

    window.addEventListener('keydown', (event) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        exportDiagram();
      }
      if (meta && event.key === 'Enter') {
        event.preventDefault();
        renderPreview();
      }
    });
  }

  async function boot() {
    els.sizeLabel.textContent = els.sizeRange.value;
    els.scaleLabel.textContent = `${els.scaleRange.value}×`;
    els.previewEmpty.classList.remove('is-hidden');
    els.previewError.classList.add('is-hidden');
    bindEvents();
    applyZoom();
    syncPreviewChrome();
    setStatus(true, '正在加载引擎…');

    try {
      await ensureMermaid(els.themeSelect.value);
      await loadExamples();
    } catch (error) {
      els.codeInput.value = DEFAULT_CODE;
      scheduleRender();
      showToast(`初始化异常：${error.message || error}`, true);
    }
  }

  boot();
})();
