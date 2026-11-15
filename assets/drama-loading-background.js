/* 2026-11-10 Product Design 改动逻辑：只读取短剧已有生成 class，为对应区域挂载
 * aria-hidden 的双层柔光背景；不修改任何文字、百分比、按钮、生成时长或业务数据。
 * 结束生成或节点被替换时卸载装饰层；监听结构和状态，不监听百分比文本或每帧样式。
 * 资产大预览的点阵 ::after 及资产画布 canvas-stage 均由原代码保留。
 */
(() => {
  const cssUrl = new URL('./assets/drama-loading-background.css?v=20261110-reference-flow', document.baseURI).href;
  const installedDocuments = new WeakSet();
  const boundFrames = new WeakSet();
  const targets = [
    '.script-workspace[data-view="script-studio"] .script-layout:has(> .script-detail.is-generating) > .script-generation-backdrop',
    '.asset-workspace.is-parsing-assets .asset-parsing-state',
    '.drama-character-current.is-generating',
    '.drama-character-variant-thumb.is-generating',
    '.asset-workspace .asset-browser-row.is-asset-prompt-generating .drama-character-variant-thumb',
    '.episode-workspace[data-view="episode-video"].is-generating-episode-scripts .episode-generating-state',
    '.episode-workspace[data-view="episode-video"] [data-episode-card].is-prompt-generating .episode-cover',
    '.episode-detail-workspace .detail-preview.is-rendering',
    '.episode-detail-workspace .shot-card.is-rendering .shot-thumb',
    '.episode-script-media-card.is-generating .episode-script-media-image'
  ].join(',');

  function install(doc, assetCanvas = false) {
    if (!doc?.body || installedDocuments.has(doc) || doc.documentElement.classList.contains('redraw-embedded')) return;
    installedDocuments.add(doc);
    doc.documentElement.classList.add('vina-drama-motion-enabled');
    if (assetCanvas) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      doc.head.appendChild(link);
    }
    const hosts = new Map();
    // 2026-11-10：只读取本地布局尺寸来缩放模糊，不固定容器尺寸，也不改变其横竖比例。
    const resize = new ResizeObserver(entries => {
      for (const { target, contentRect: { width, height } } of entries) {
        const blur = Math.max(2, Math.min(88, width * .06, Math.min(width, height) * .2));
        target.style.setProperty('--vina-drama-loading-blur', `${blur}px`);
      }
    });
    const selector = assetCanvas ? '.node .thumb.generating' : targets;

    function bindAssetCanvas() {
      if (assetCanvas) return;
      const frame = doc.getElementById('characterCanvasFrame');
      if (!frame || boundFrames.has(frame)) return;
      boundFrames.add(frame);
      // 2026-11-10：仅接入短剧专属同源资产画布；重新加载后安装到新文档，不接入全能创作。
      const onLoad = () => {
        try {
          const child = frame.contentDocument;
          if (child?.getElementById('character-asset-canvas-theme')) install(child, true);
        } catch (_) { /* 非同源页面不挂载装饰层。 */ }
      };
      frame.addEventListener('load', onLoad);
      onLoad();
    }

    function sync() {
      const active = assetCanvas || doc.body.classList.contains('drama-workflow-active');
      const current = new Set(active ? doc.querySelectorAll(selector) : []);
      for (const [host, layer] of hosts) {
        if (current.has(host) && host.isConnected) continue;
        resize.unobserve(host);
        layer.remove();
        host.classList.remove('vina-drama-motion-host');
        host.style.removeProperty('--vina-drama-loading-blur');
        hosts.delete(host);
      }
      for (const host of current) {
        if (hosts.has(host) && hosts.get(host).parentNode === host) continue;
        // 编辑卡会被克隆或重绘，先清除复制的装饰层，避免重复叠加；不碰原有内容节点。
        host.querySelectorAll(':scope > .vina-drama-motion-layer').forEach(layer => layer.remove());
        const layer = doc.createElement('div');
        layer.className = 'vina-drama-motion-layer';
        layer.setAttribute('aria-hidden', 'true');
        const flow = doc.createElement('div');
        flow.className = 'vina-drama-motion-layer__flow';
        layer.appendChild(flow);
        host.prepend(layer);
        host.classList.add('vina-drama-motion-host');
        hosts.set(host, layer);
        resize.observe(host);
      }
      bindAssetCanvas();
    }

    let pending = false;
    const observer = new MutationObserver(records => {
      if (pending || !records.some(record => {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        // 百分比文字更新与新增柔光内部节点不触发全页重扫。
        return !target?.closest('.vina-drama-motion-layer, .vina-drama-generation-copy');
      })) return;
      pending = true;
      queueMicrotask(() => { pending = false; sync(); });
    });
    observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-view'] });
    // iframe 被替换后释放旧文档的观察器；父页本身沿用页面生命周期。
    if (assetCanvas) doc.defaultView.addEventListener('pagehide', () => {
      observer.disconnect();
      resize.disconnect();
      hosts.clear();
    }, { once: true });
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(document), { once: true });
  else install(document);
})();
