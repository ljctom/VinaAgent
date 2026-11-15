/* 2026-11-14 Product Design 改动逻辑：复用首页现有光晕和实际底色，给不透明顶栏增加
 * 同坐标背景裁切；同步底色以消除透明光晕叠在不同深色表面造成的接缝。
 * 监听页面滚动切换深色实底，返回顶部恢复光晕；页面切换、窗口变化、内容尺寸变化
 * 和浏览器历史恢复时同步，支持 1920px 内容上限、窄屏光晕和可关闭公告栏。
 * 只处理视觉变量，不改变原导航、账户、创作模式、输入及项目业务逻辑。 */
(() => {
  const body = document.body;
  const app = document.querySelector('body > .app');
  const hero = document.querySelector('.view[data-view="canvas"] .hero');
  if (!body || !app || !hero) return;

  let frame = 0;

  const update = () => {
    frame = 0;
    // 只读取根页面滚动，输入框、弹窗和技能列表内部滚动不改变顶栏状态。
    const scrolled = window.scrollY > 0;
    if (body.classList.contains('home-navbar-scrolled') !== scrolled) {
      body.classList.toggle('home-navbar-scrolled', scrolled);
    }

    if (body.dataset.primaryView !== 'canvas' ||
        body.matches('.marketing-entry-active, .team-console-open, .canvas-workbench-active, .drama-workflow-active') ||
        !hero.getClientRects().length) return;

    const rect = hero.getBoundingClientRect();
    const glow = getComputedStyle(hero, '::before');
    const surface = getComputedStyle(hero);
    const navbar = getComputedStyle(app, '::before');
    const navbarTop = parseFloat(navbar.top) || 0;
    // 将光晕在文档中的原点映射到固定顶栏，防止复制后被压缩到 52px 高度，
    // 并补偿侧栏、居中留白、公告栏及横向偏移，让顶栏底边与正文顶部连续。
    // 与 hero 最终生效的底色同步，兼容后加载的首页样式覆盖。
    app.style.setProperty('--home-navbar-surface', surface.backgroundColor);
    app.style.setProperty('--home-navbar-glow-image', glow.backgroundImage);
    app.style.setProperty('--home-navbar-glow-size', `${rect.width}px ${rect.height}px`);
    app.style.setProperty('--home-navbar-glow-position', `${rect.left}px ${rect.top + window.scrollY - navbarTop}px`);
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  // 原页面切换事件后延至下一帧读取，接住原路由紧随其后的 scrollTo(0)。
  window.addEventListener('vina-view-changed', schedule);
  document.addEventListener('DOMContentLoaded', schedule, { once: true });

  // 仅观察业务显隐状态与尺寸；不观察自己写入的 style，避免循环更新。
  const stateObserver = new MutationObserver(schedule);
  stateObserver.observe(body, { attributes: true, attributeFilter: ['class', 'data-primary-view'] });
  const sizeObserver = new ResizeObserver(schedule);
  sizeObserver.observe(hero);
  if (hero.parentElement) sizeObserver.observe(hero.parentElement);

  update();
})();
