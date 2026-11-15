// 2026-08-25 入口桥接逻辑：营销子页面只上报用户意图，登录弹窗、Google 登录和进入产品首页均交由默认 VinaAgent 代码处理。
document.addEventListener("click", (event) => {
  const target = event.target && typeof event.target.closest === "function" ? event.target : null;
  if (!target) return;

  const isAuthenticated = document.body.classList.contains("marketing-authenticated");

  // 2026-08-26 改动逻辑：首屏新增的图片入口单独上报 Google 快捷登录意图，避免被通用“开始创作”流程拦截。
  if (target.closest("button.hero-google-login")) {
    window.parent.postMessage({ type: "vina-marketing-google-login" }, "*");
    return;
  }

  // 2026-08-31 改动逻辑：顶部新版“登录”按钮使用 primary small 结构，单独识别后打开登录弹窗，避免被通用开始创作分支拦截。
  if (target.closest("button.login, .nav-actions > .primary.small")) {
    window.parent.postMessage({ type: "vina-marketing-login" }, "*");
    return;
  }

  // 2026-08-31 改动逻辑：所有“开始创作”在未登录时打开登录弹窗；H5 登录后则转为电脑端创作引导，不重复登录。
  if (target.closest("[data-login-entry], button.primary, .sticky button")) {
    window.parent.postMessage({ type: isAuthenticated ? "vina-marketing-enter" : "vina-marketing-login" }, "*");
  }
}, true);
