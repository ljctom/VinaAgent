/* 2026-10-11 Product Design 改动逻辑：
 * 各页面已有 Toast 使用不同 DOM、显示类和计时器；只接管其呈现，保留原消息、显示/隐藏、校验和自动消失逻辑。
 * 用四种 Figma 原始图标区分结果，将同源画布/分集/3D/营销页的提示呈现在最外层 body，避免 iframe 裁切或弹窗遮挡。
 * 本次直接读取 Figma Toast 组件，不依赖设计规范 Skill。仅监听提示相关变化，避免每次业务重绘遍历整页。
 */
(function installVinaToastPresentation() {
  'use strict';
  const ownerScript = document.currentScript;
  const assetBase = new URL('.', ownerScript.src).href;
  // 同源子页面优先复用已安装的父层；单独打开子页面时在自己的视口安装。
  try {
    if (window.parent !== window && window.parent.VinaToast) {
      window.VinaToast = window.parent.VinaToast;
      window.VinaToast.install(document);
      return;
    }
  } catch (_) { /* 跨域页面只能使用自身提示层。 */ }

  const selector = [
    '.title-toast', '.mobile-copy-toast', '.team-toast', '.canvas-title-toast',
    '.canvas-asset-save-toast', '.libtv-editor-toast', '.node-download-toast',
    '.vina-image-import-toast', '.clip-remake-minimum-toast', '.vina-direct-toast',
    '.library-upload-toast', '.episode-agent-toast', '.redraw-validation-toast',
    '.detail-prompt-optimize-toast', '.toast'
  ].join(',');
  const classControlled = '.title-toast, .mobile-copy-toast, .team-toast, .libtv-editor-toast, .node-download-toast, .vina-direct-toast';
  const docs = new Map();
  const sources = new Map();
  const frameDocs = new WeakMap();
  let layer;

  // 没有显式状态的历史入口按语义兼容；业务可通过 data-vina-toast-type 指定，显式状态始终优先。
  function typeFor(message, source) {
    const explicit = source?.dataset.vinaToastType;
    if (['success', 'error', 'warning', 'info'].includes(explicit)) return explicit;
    if (source?.classList.contains('error')) return 'error';
    if (source?.classList.contains('success')) return 'success';
    if (source?.classList.contains('is-loading') || /正在自动切换|switching.*mode/i.test(message)) return 'info';
    // “权限设置已保存”是成功，“暂无权限”才是警告；同样先识别失败，避免“失败，请稍后重试”被误当处理中。
    if (/(暂无|没有|无|不足).*权限|普通成员.*(无法|不能)|请.*管理员|只读|后才可|无法再修改|请先|请至少|请输入|不能为空|不能超过|已达上限|席位已满|已在团队|至少保留|暂无|没有可|未找到|暂不可用|暂不支持.*快捷|read.only|no permission|permission denied|not permitted|contact.*administrator|^please|quota|limit|no .*available|not found|already .*team/i.test(message)) return 'warning';
    if (/失败|错误|异常|不正确|不支持|无法|不可用|error|fail|invalid|unsupported|not supported|unable|cannot|denied|reject/i.test(message)) return 'error';
    if (/正在|生成中|合成中|处理中|请稍后|opening|processing|generating|composing|preparing|starting|in progress/i.test(message)) return 'info';
    if (/成功|完成|已更新|已保存|已添加|已删除|已移除|已将|已复制|已发送|已提交|已撤回|已生成|已通过|success|completed|saved|updated|added|deleted|removed|copied|sent|submitted|withdrawn|generated/i.test(message)) return 'success';
    return 'info';
  }
  function messageFor(source) {
    // 排除旧勾选字符、SVG 和加载图标；保留正文节点，现有中英文翻译器仍更新原节点。
    return Array.from(source.childNodes).filter(node => !(node.nodeType === 1 && node.matches('.title-toast-icon, svg, i[data-lucide], .spinner')))
      .map(node => node.textContent).join('').trim();
  }
  function hiddenByAncestors(source) {
    let node = source.parentElement;
    let doc = source.ownerDocument;
    while (doc) {
      for (; node; node = node.parentElement) {
        if (node.hidden) return true;
        const style = doc.defaultView.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return true;
      }
      const frame = doc.defaultView.frameElement;
      if (!frame) break;
      if (!frame.isConnected) return true;
      node = frame;
      doc = frame.ownerDocument;
    }
    return false;
  }
  function visible(source) {
    if (!source.isConnected || source.hidden) return false;
    if (source.matches(classControlled) && !source.classList.contains('is-visible')) return false;
    if (source.matches('.toast#toast') && !source.classList.contains('show')) return false;
    return !hiddenByAncestors(source);
  }
  function getLayer() {
    if (!layer?.isConnected) {
      layer = document.createElement('div');
      layer.id = 'vinaToastLayer';
      layer.className = 'vina-toast-layer';
      document.body.append(layer);
    }
    return layer;
  }
  function sync(source) {
    const entry = sources.get(source);
    if (!entry) return;
    const message = messageFor(source);
    if (!message || !visible(source)) {
      entry.item?.remove();
      entry.item = null;
      if (!source.isConnected) sources.delete(source);
      return;
    }
    const type = typeFor(message, source);
    if (!entry.item) {
      entry.item = document.createElement('div');
      entry.item.className = 'vina-figma-toast';
      const icon = document.createElement('span');
      icon.className = 'vina-figma-toast-icon';
      icon.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.alt = '';
      icon.append(image);
      const text = document.createElement('span');
      text.className = 'vina-figma-toast-message';
      entry.item.append(icon, text);
      getLayer().append(entry.item);
    }
    if (entry.message !== message) entry.item.lastElementChild.textContent = message;
    if (entry.type !== type || !entry.item.dataset.vinaToastType) {
      entry.item.dataset.vinaToastType = type;
      entry.item.setAttribute('role', type === 'error' ? 'alert' : 'status');
      entry.item.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
      entry.item.setAttribute('aria-atomic', 'true');
      entry.item.firstElementChild.firstElementChild.src = assetBase + 'icons/toast/' + type + '.svg';
    }
    // 重新显示相同文案也要填充新节点，不能因上次缓存而显示空白。
    if (!entry.item.lastElementChild.textContent) entry.item.lastElementChild.textContent = message;
    entry.message = message;
    entry.type = type;
  }
  function register(source) {
    if (source.closest('#vinaToastLayer')) return;
    if (!sources.has(source)) {
      sources.set(source, { item: null });
      source.setAttribute('data-vina-toast-source', '');
    }
    sync(source);
  }
  function scan(node) {
    if (node.nodeType !== 1 || node.closest('#vinaToastLayer')) return;
    if (node.matches(selector)) register(node);
    node.querySelectorAll(selector).forEach(register);
    if (node.matches('iframe')) installFrame(node);
    node.querySelectorAll('iframe').forEach(installFrame);
  }
  function uninstall(doc) {
    docs.get(doc)?.disconnect();
    docs.delete(doc);
    sources.forEach((entry, source) => {
      if (source.ownerDocument === doc) { entry.item?.remove(); sources.delete(source); }
    });
  }
  function installFrame(frame) {
    if (!frame.dataset.vinaToastFrameBound) {
      frame.dataset.vinaToastFrameBound = 'true';
      frame.addEventListener('load', () => installFrame(frame));
    }
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      const oldDoc = frameDocs.get(frame);
      if (oldDoc && oldDoc !== doc) uninstall(oldDoc);
      frameDocs.set(frame, doc);
      install(doc);
    } catch (_) { /* 跨域 iframe 不读取、不修改。 */ }
  }
  function install(doc) {
    if (!doc?.body || docs.has(doc)) return;
    doc.defaultView.VinaToast = api;
    const style = doc.createElement('style');
    // 只隐藏已由共用组件接管的旧外观；不更改消息 DOM、计时器和父容器的显隐。
    style.textContent = '[data-vina-toast-source] { display: none !important; }';
    doc.head.append(style);
    const observer = new doc.defaultView.MutationObserver(records => {
      const pending = new Set();
      records.forEach(record => {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (!target || target.closest('#vinaToastLayer')) return;
        const source = target.closest(selector);
        if (source) pending.add(source);
        if (record.type === 'childList') record.addedNodes.forEach(scan);
        // 祖先弹窗显隐、页面切换、消息更新和移除都只重新核对已登记的 Toast。
        sources.forEach((_, candidate) => {
          if (!candidate.isConnected || target.contains(candidate)) pending.add(candidate);
          // 父页面切换隐藏的是 iframe 的祖先，contains 无法跨文档；逐层核对宿主以清除旧页面提示。
          let frame = candidate.ownerDocument.defaultView.frameElement;
          while (frame) {
            if (!frame.isConnected || target.contains(frame)) { pending.add(candidate); break; }
            frame = frame.ownerDocument.defaultView.frameElement;
          }
        });
      });
      pending.forEach(source => sources.has(source) ? sync(source) : register(source));
    });
    docs.set(doc, observer);
    scan(doc.body);
    observer.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'data-vina-toast-type'] });
    doc.defaultView.addEventListener('pagehide', () => uninstall(doc), { once: true });
  }
  const api = { install, typeFor };
  window.VinaToast = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(document), { once: true });
  else install(document);
})();
