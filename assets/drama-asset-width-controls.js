/* 2026-10-27 Product Design 改动逻辑：取消资产列表和音色区域的左右宽度拖拽，
   不创建分隔条、不设置列宽变量，布局沿用默认宽度；保留模型菜单装饰和可用高度计算。
   上下高度拖动由 drama-asset-layout.js 独立提供，不受本次调整影响。 */
(() => {
  function start() {
    const workspace = document.querySelector('.asset-workspace[data-view="asset-library"]');
    const inner = workspace?.querySelector('.asset-inner');
    if (!inner) return;
    workspace.setAttribute('data-asset-popover-reference', '');
    inner.removeAttribute('data-asset-width-resize');
    inner.style.removeProperty('--asset-list-width');
    inner.style.removeProperty('--asset-voice-width');
    inner.querySelectorAll('.asset-panel-width-resizer').forEach(handle => handle.remove());
    inner.querySelectorAll('[data-asset-voice-resizable]').forEach(board => board.removeAttribute('data-asset-voice-resizable'));
    let queued = 0;
    function setProperty(node, key, value) {
      if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value);
    }
    function sync() {
      queued = 0;
    }
    function schedule() { if (!queued) queued = requestAnimationFrame(sync); }
    new MutationObserver(schedule).observe(workspace,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
    new ResizeObserver(schedule).observe(inner);
    window.addEventListener('resize',schedule);
    window.addEventListener('scroll',schedule,true);
    window.visualViewport?.addEventListener('resize',schedule);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
