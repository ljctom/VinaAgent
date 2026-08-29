// 2026-08-25 入口桥接逻辑：营销子页面只上报用户意图，登录弹窗、Google 登录和进入产品首页均交由默认 VinaAgent 代码处理。
document.addEventListener("click", (event) => {
  const target = event.target && typeof event.target.closest === "function" ? event.target : null;
  if (!target) return;

  // 2026-08-26 改动逻辑：首屏新增的图片入口单独上报 Google 快捷登录意图，避免被通用“开始创作”流程拦截。
  if (target.closest("button.hero-google-login")) {
    window.parent.postMessage({ type: "vina-marketing-google-login" }, "*");
    return;
  }

  if (target.closest("button.login")) {
    window.parent.postMessage({ type: "vina-marketing-login" }, "*");
    return;
  }

  // 2026-08-26 改动逻辑：能力区新增的居中主按钮与五张卡片文字入口统一直达父页面登录弹窗，桌面端和 H5 均不走复制桌面网址的旧创作分支。
  if (target.closest("[data-login-entry]")) {
    window.parent.postMessage({ type: "vina-marketing-login" }, "*");
    return;
  }

  if (target.closest("button.primary, .sticky button")) {
    window.parent.postMessage({ type: "vina-marketing-enter" }, "*");
  }
}, true);
