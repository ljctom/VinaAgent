/* 2026-10-27 Product Design 改动逻辑：复用设计稿完整曲线页签视觉层；原三个按钮仍负责焦点、切换和内容。 */
/* Tab surfaces share one coordinate system so neighboring slopes meet without gaps.
   Only visual layers are updated; the original buttons own selection and panels. */
(() => {
  const tabs = document.querySelector('.view[data-view="canvas"] .home-drama-tabs');
  if (!tabs) return;
  const buttons = [...tabs.querySelectorAll('.home-drama-tab')];
  if (buttons.length !== 3) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('home-drama-tab-surfaces');
  svg.setAttribute('viewBox', '0 0 800 50.1674');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const hover = document.createElementNS(ns, 'path');
  hover.classList.add('home-drama-tab-hover-surface');
  const selected = document.createElementNS(ns, 'path');
  selected.classList.add('home-drama-tab-selected-surface');
  svg.append(hover, selected);
  tabs.prepend(svg);
  tabs.classList.add('has-shaped-tab-surfaces');

  /* 2026-10-30 Product Design 修复逻辑：首尾页签的选中与 hover 背景铺满 SVG 外侧直角，
     统一由 .home-drama-tabs 的 16px 圆角裁切；避免 SVG 的 24 单位圆角随宽高缩放后
     与卡片描边不一致，在上传剧本左上角、重制转绘右上角留下空缺。内部曲线保持不变，
     末尾选中态与开头 hover 态继续镜像复用路径，因此两侧及键盘焦点态同步修复。 */
  const first = 'M0 50.1674V0H230.381C240.13 0 248.91 5.89711 252.597 14.9215L260.903 35.2458C264.59 44.2702 273.37 50.1674 283.119 50.1674Z';
  const middle = 'M250.731 50.1674C260.555 50.1674 269.387 44.1804 273.025 35.0551L280.975 15.1123C284.613 5.98693 293.445 0 303.269 0H496.381C506.13 0 514.91 5.89711 518.597 14.9215L526.903 35.2458C530.59 44.2702 539.37 50.1674 549.119 50.1674Z';
  const hoverMiddle = 'M197 24V50.1674H550.119C540.37 50.1674 531.59 44.2702 527.903 35.2458L519.597 14.9215C515.91 5.89711 507.13 0 497.381 0H221C207.7452 0 197 10.7452 197 24Z';
  const hoverEnd = 'M496.381 0H800V50.1674H549.119C539.37 50.1674 530.59 44.2702 526.903 35.2458L518.597 14.9215C514.91 5.89711 506.13 0 496.381 0Z';
  let hovered = -1;
  let focused = -1;
  function draw() {
    const index = Math.max(0, buttons.findIndex(button => button.classList.contains('active')));
    selected.setAttribute('d', index === 1 ? middle : first);
    selected.setAttribute('transform', index === 2 ? 'translate(800 0) scale(-1 1)' : '');
    const target = hovered >= 0 ? hovered : focused;
    const visible = target >= 0 && target !== index;
    hover.setAttribute('visibility', visible ? 'visible' : 'hidden');
    if (!visible) return;
    hover.setAttribute('d', target === 1 ? hoverMiddle : hoverEnd);
    const mirror = target === 0 || (target === 1 && index === 2);
    hover.setAttribute('transform', mirror ? 'translate(800 0) scale(-1 1)' : '');
  }
  buttons.forEach((button, index) => {
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hovered = index;
      draw();
    });
    button.addEventListener('pointerleave', () => { hovered = -1; draw(); });
    button.addEventListener('focus', () => { focused = button.matches(':focus-visible') ? index : -1; draw(); });
    button.addEventListener('blur', () => { focused = -1; draw(); });
    new MutationObserver(draw).observe(button, { attributes:true, attributeFilter:['class','aria-selected'] });
  });
  tabs.addEventListener('pointerleave', () => { hovered = -1; draw(); });
  draw();
})();
