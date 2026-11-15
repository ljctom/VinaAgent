/* 2026-10-12 Product Design 改动逻辑：复现 ego 参考页 Vue Flow 背景的实际参数。
 * 100% 时点间距 16px、半径 1.5px、填色 #141A21；间距和半径均随画布缩放同比变化。
 * 点阵平移与舞台实际原点一致，保留参考 patternTransform 的半格偏移和额外 1px 偏移。
 * 背景独立覆盖完整视口，避免 2600×1800 舞台边界截断；不修改视口、节点、缩放范围和业务事件。
 */
(function () {
  function installReferenceBackground() {
    if (document.getElementById('character-asset-canvas-theme')) return;
    var stage = document.getElementById('stage');
    var workspace = document.querySelector('.workspace');
    if (!stage || !workspace || document.querySelector('.vina-creation-dot-grid')) return;

    var ns = 'http://www.w3.org/2000/svg';
    var grid = document.createElementNS(ns, 'svg');
    var defs = document.createElementNS(ns, 'defs');
    var pattern = document.createElementNS(ns, 'pattern');
    var dot = document.createElementNS(ns, 'circle');
    var fill = document.createElementNS(ns, 'rect');
    grid.classList.add('vina-creation-dot-grid');
    grid.setAttribute('aria-hidden', 'true');
    grid.setAttribute('focusable', 'false');
    pattern.id = 'vina-creation-reference-dot-pattern';
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    dot.setAttribute('fill', '#141a21');
    fill.setAttribute('width', '100%');
    fill.setAttribute('height', '100%');
    fill.setAttribute('fill', 'url(#vina-creation-reference-dot-pattern)');
    pattern.appendChild(dot);
    defs.appendChild(pattern);
    grid.appendChild(defs);
    grid.appendChild(fill);
    document.body.prepend(grid);
    document.documentElement.classList.add('vina-creation-background-ready');

    var pendingFrame = 0;
    function updateGrid() {
      pendingFrame = 0;
      // 故事板不显示舞台，保留已有参数；切回画布后由 body 的 class 观察器重新同步。
      if (document.body.classList.contains('vina-direct-mode')) return;
      var rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var matrix = new DOMMatrixReadOnly(getComputedStyle(stage).transform);
      var scale = Math.hypot(matrix.a, matrix.b) || 1;
      var gap = 16 * scale;
      var radius = 1.5 * scale;
      // getBoundingClientRect 含舞台 50% 定位与全部容器偏移，拖拽侧栏、收起 Agent 后也保持点阵与节点对齐。
      pattern.setAttribute('x', String(rect.left % gap));
      pattern.setAttribute('y', String(rect.top % gap));
      pattern.setAttribute('width', String(gap));
      pattern.setAttribute('height', String(gap));
      pattern.setAttribute('patternTransform', 'translate(' + (-gap / 2 - 1) + ',' + (-gap / 2 - 1) + ')');
      dot.setAttribute('cx', String(radius));
      dot.setAttribute('cy', String(radius));
      dot.setAttribute('r', String(radius));
    }
    function scheduleGrid() {
      if (!pendingFrame) pendingFrame = window.requestAnimationFrame(updateGrid);
    }
    // 观察原变换入口的结果，覆盖滚轮、缩放滑块、平移、小地图定位和自动适配，无须替换原 applyTransform。
    new MutationObserver(scheduleGrid).observe(stage, { attributes: true, attributeFilter: ['style'] });
    new MutationObserver(scheduleGrid).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    var frameObserver = new ResizeObserver(scheduleGrid);
    frameObserver.observe(workspace);
    frameObserver.observe(document.body);
    window.addEventListener('resize', scheduleGrid);
    scheduleGrid();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installReferenceBackground, { once: true });
  } else {
    installReferenceBackground();
  }
})();
