/* 2026-10-10 Product Design 改动逻辑：复刻 ego 实际观察到的分类动效。
 * 悬停只移动光晕，点击后通过原按钮 active/aria-selected 更新滑动玻璃层；
 * 移出后光晕回到整体中心，透明度 .8 -> .4。此脚本只处理视觉变量，
 * 不调用 click、不更改选中状态、输入内容、原面板事件或键盘切换逻辑。 */
(() => {
  const tabs = document.querySelector('.view[data-view="canvas"] .home-agent-tabs');
  if (!tabs) return;
  const buttons = [...tabs.querySelectorAll('.home-composer-tab[role="tab"]')];
  if (!buttons.length) return;
  const glass = document.createElement('span');
  glass.className = 'home-agent-tab-glass';
  glass.setAttribute('aria-hidden', 'true');
  tabs.prepend(glass);
  let hovered = null;
  let focused = null;
  let frame = 0;

  const updateVisuals = () => {
    frame = 0;
    const active = buttons.find(button => button.classList.contains('active')) || buttons[0];
    // offset 坐标基于相对定位的胶囊内边缘，避免描边宽度导致光晕或玻璃错位。
    if (active.offsetWidth) {
      tabs.style.setProperty('--home-tab-glass-left', `${active.offsetLeft}px`);
      tabs.style.setProperty('--home-tab-glass-top', `${active.offsetTop}px`);
      tabs.style.setProperty('--home-tab-glass-width', `${active.offsetWidth}px`);
      tabs.style.setProperty('--home-tab-glass-height', `${active.offsetHeight}px`);
      tabs.classList.add('is-glass-ready');
    }
    const target = hovered || focused;
    tabs.style.setProperty('--home-tab-glow-x', target ? `${target.offsetLeft + target.offsetWidth / 2}px` : '50%');
    tabs.style.setProperty('--home-tab-glow-opacity', target ? '.8' : '.4');
  };
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(updateVisuals);
  };
  buttons.forEach(button => {
    // 真实鼠标滑过分类中心时更新光晕，触屏点击不保留鼠标悬停状态。
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hovered = button;
      scheduleUpdate();
    }, { passive: true });
    button.addEventListener('pointerleave', () => {
      if (hovered === button) hovered = null;
      scheduleUpdate();
    }, { passive: true });
    // 键盘焦点获得同样的光晕反馈；普通鼠标点击后的 focus 不阻止移出归中。
    button.addEventListener('focus', () => {
      focused = button.matches(':focus-visible') ? button : null;
      scheduleUpdate();
    });
    button.addEventListener('blur', () => {
      if (focused === button) focused = null;
      scheduleUpdate();
    });
  });
  tabs.addEventListener('pointerleave', () => {
    hovered = null;
    scheduleUpdate();
  }, { passive: true });
  // 兼容原鼠标、方向键及其他入口触发的 Tab 切换；仅监听按钮属性，
  // 不监听自身 CSS 变量，避免视觉更新触发递归。文案变化也同步重算宽度。
  const observer = new MutationObserver(scheduleUpdate);
  buttons.forEach(button => observer.observe(button, {
    attributes: true,
    attributeFilter: ['class', 'aria-selected'],
    childList: true,
    characterData: true,
    subtree: true
  }));
  const resizeObserver = new ResizeObserver(scheduleUpdate);
  resizeObserver.observe(tabs);
  buttons.forEach(button => resizeObserver.observe(button));
  updateVisuals();
})();
