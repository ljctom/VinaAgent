/* 2026-10-10 Product Design 改动逻辑：从「设计参考」提取边框鼠标跟随逻辑，
   仅更新首页输入容器的 --glow-x / --glow-y；不接入波点绘制、发送状态或其他业务逻辑。 */
(() => {
  const home = document.querySelector('.view[data-view="canvas"]');
  if (!home) return;
  const composer = home.querySelector('.home-composer-card .composer');
  const dramaCard = home.querySelector('.home-composer-card');

  [composer, dramaCard].forEach((panel) => {
    if (!panel) return;
    const updateBorderPosition = (event) => {
      const rect = panel.getBoundingClientRect();
      // 2026-10-30：使用容器内百分比定位，避免 CSS zoom/缩放后的屏幕像素与渐变局部坐标不一致，
      // 导致四角 hover 时高亮中心越过边界；未缩放时保持相同的鼠标跟随位置。
      if (!rect.width || !rect.height) return;
      panel.style.setProperty('--glow-x', `${(event.clientX - rect.left) / rect.width * 100}%`);
      panel.style.setProperty('--glow-y', `${(event.clientY - rect.top) / rect.height * 100}%`);
    };
    // 首次进入即定位高亮；移动时使用各自容器坐标，短剧整卡和创作内层不会错位。
    panel.addEventListener('pointerenter', updateBorderPosition, { passive: true });
    panel.addEventListener('pointermove', updateBorderPosition, { passive: true });
  });
})();
