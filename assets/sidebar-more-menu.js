/* 2026-10-31 Product Design 改动逻辑：左下角三横线展开右侧模板菜单。
 * 仅管理浮层状态和焦点；模板按钮保留 data-view-target，复用 app.js 的原模板页导航。
 * 再次点击、点击外部、切换页面、失去菜单焦点和 Esc 均收起；方向键支持单项菜单操作。
 */
(() => {
  'use strict';
  const root = document.querySelector('.sidebar .sidebar-more');
  const toggle = document.getElementById('sidebarMoreToggle');
  const menu = document.getElementById('sidebarMoreMenu');
  const template = menu?.querySelector('[data-view-target="template-library"]');
  if (!root || !toggle || !menu || !template) return;

  function setOpen(open, restoreFocus = false) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) template.focus();
    else if (restoreFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('click', (event) => {
    if (menu.hidden) return;
    if (!root.contains(event.target)) setOpen(false);
    // 点击模板时先收起，再交给既有导航监听器显示模板页；焦点返回可见的三横线。
    else if (template.contains(event.target)) setOpen(false, true);
  }, true);
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false, true);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  });
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) setOpen(false);
  });
})();
