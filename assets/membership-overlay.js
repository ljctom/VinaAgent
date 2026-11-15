// 2026-10-30 Product Design：会员页作为无边框全屏弹窗覆盖当前页面，复用原 HTML/CSS，入口不再导航或写入历史。
// 原生 dialog 保留底层 DOM 并隔离键盘焦点；关闭恢复滚动、入口焦点和个人会员状态，兼容 file 本地文件。
(() => {
  const channel = 'vina-membership-overlay';
  let overlay = null;
  let frame = null;
  let ready = false;
  let audience = 'team';
  // 2026-11-07：模型会员提示随本次打开传递，等会员页 ready 后仅消费一次。
  let pendingNotice = null;
  let returnFocus = null;
  let scrollState = null;
  // 2026-11-12：打开时读取个人中心的页面语言，后续语言变化单独同步给已加载的 iframe。
  const pageLanguage = () => window.vinaPageLanguage?.get() || document.documentElement.lang || 'zh-CN';
  // 2026-11-14：每次打开及语言变化均重置会员页辅助名称；超市已有独立首页 dialog，不再复用 iframe 标题。
  const syncLabel = () => {
    if (!overlay || !frame) return;
    const labels = { 'zh-CN': '会员方案', en: 'Membership plans', ja: 'メンバーシッププラン', fr: 'Abonnements', ms: 'Pelan keahlian', ar: 'الخطط' };
    const label = labels[pageLanguage()] || labels['zh-CN'];
    overlay.setAttribute('aria-label', label);
    frame.title = label;
  };
  const sendLanguage = () => {
    syncLabel();
    if (ready) frame.contentWindow?.postMessage({ channel, type: 'language', language: pageLanguage() }, '*');
  };
  document.addEventListener('vina:language-change', sendLanguage);
  const sendOpen = () => {
    if (!ready || !overlay?.open) return;
    frame.contentWindow?.postMessage({ channel, type: 'open', audience, notice: pendingNotice, language: pageLanguage() }, '*');
    pendingNotice = null;
  };
  const closeMembership = () => { if (overlay?.open) overlay.close(); };
  const createOverlay = () => {
    overlay = document.createElement('dialog');
    overlay.id = 'vinaMembershipOverlay';
    overlay.setAttribute('aria-label', '会员方案');
    frame = document.createElement('iframe');
    frame.title = '会员方案';
    // 不复制会员布局，也不改写当前窗口 URL；独立文档使所有原有样式与内部弹窗继续生效。
    const destination = new URL('./membership.html?embedded=membership-modal', document.baseURI);
    destination.searchParams.set('lang', pageLanguage());
    frame.src = destination.href;
    overlay.append(frame);
    document.body.append(overlay);
    overlay.addEventListener('cancel', (event) => { event.preventDefault(); closeMembership(); });
    overlay.addEventListener('close', () => {
      pendingNotice = null;
      if (scrollState) {
        document.documentElement.style.overflow = scrollState.htmlOverflow;
        document.body.style.overflow = scrollState.bodyOverflow;
        window.scrollTo(scrollState.x, scrollState.y);
        scrollState = null;
      }
      window.dispatchEvent(new Event('vina:personal-membership-change'));
      const target = returnFocus?.isConnected && !returnFocus.closest('[hidden], [inert]') ? returnFocus : document.getElementById('topAccountAvatar');
      target?.focus({ preventScroll: true });
    });
  };
  // 2026-11-07 Product Design：同步打开订阅全屏页；Toast 由目标页显示，不在底层画布等待。
  window.openVinaMembershipPage = (nextAudience = 'team', trigger, options = {}) => {
    // 2026-11-14：兼容已有积分直达调用，但在宿主首页打开原生超市，不创建透明 iframe。
    if (options.view === 'store') { window.openVinaVPointStore?.(nextAudience, trigger); return; }
    window.closeVinaVPointStore?.();
    pendingNotice = options.notice === 'model-membership-required' ? options.notice : null;
    audience = nextAudience === 'personal' ? 'personal' : 'team';
    if (!overlay) createOverlay();
    syncLabel();
    if (!overlay.open) {
      const popover = document.getElementById('profilePopover');
      const accountTrigger = document.querySelector('[aria-controls="profilePopover"]') || document.getElementById('topAccountAvatar');
      returnFocus = trigger || document.activeElement;
      if (popover && !popover.hidden) {
        if (popover.contains(returnFocus)) returnFocus = accountTrigger || returnFocus;
        popover.hidden = true;
        accountTrigger?.setAttribute('aria-expanded', 'false');
      }
      scrollState = { x: window.scrollX, y: window.scrollY, htmlOverflow: document.documentElement.style.overflow, bodyOverflow: document.body.style.overflow };
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      overlay.showModal();
    }
    sendOpen();
  };
  window.closeVinaMembershipPage = closeMembership;
  // file 页面来源为 null，使用实际 iframe 窗口对象验证来源，避免接收其他页面发出的关闭或会员状态消息。
  window.addEventListener('message', (event) => {
    if (!frame || event.source !== frame.contentWindow || event.data?.channel !== channel) return;
    const { type, subscription, label } = event.data;
    if (type === 'ready') { ready = true; sendOpen(); }
    if (type === 'label' && typeof label === 'string' && event.data.view !== 'store') {
      overlay.setAttribute('aria-label', label);
      frame.title = label;
    }
    if ((type === 'subscription' || type === 'close') && typeof subscription?.plan === 'string') window.vinaPersonalMembershipState?.save(subscription);
    if (type === 'close') closeMembership();
  });
  // 2026-10-30 Product Design：图示的 FREE／V 点余额、增加席位、积分加量由统一捕获事件直接打开团队会员。
  // 明确识别按钮和入口标记，不依赖按钮原有业务监听或 href；捕获后阻止重复打开及地址跳转，关闭时归还对应入口焦点。
  // 账号菜单其他会员链接仍按原有目标识别，样式与文案保持原样；membership.html 继续作为弹窗内容来源，不能删除。
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-membership-overlay-open], .home-header-benefits, #teamExpandButton, #teamCreditsButton, a[href]');
    if (!trigger) return;
    const explicitEntry = trigger.matches('[data-membership-overlay-open], .home-header-benefits, #teamExpandButton, #teamCreditsButton');
    if (!explicitEntry) {
      const url = new URL(trigger.href, document.baseURI);
      if (url.origin !== window.location.origin || !url.pathname.endsWith('/membership.html')) return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    window.openVinaMembershipPage(trigger.dataset.membershipOverlayOpen || trigger.dataset.membershipTarget || 'team', trigger);
  }, true);
})();
