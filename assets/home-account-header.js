// 2026-11-14 Product Design：首页右上角只新增外部展示与入口，不改写账号菜单、积分或订阅数据。
// 2026-11-14：会员按钮与 Free／Pro 共用当前个人／团队会员入口；积分使用首页原生 dialog，共用原积分包与确认操作。
(() => {
  const account = document.querySelector('.global-account');
  const plan = document.getElementById('homeHeaderPlan');
  const credits = document.getElementById('homeHeaderCredits');
  const tier = document.getElementById('homeHeaderTier');
  const amount = document.getElementById('homeHeaderCreditAmount');
  if (!account || !plan || !credits || !tier || !amount) return;
  const personalTier = account.querySelector('.profile-popover-personal-tier');
  const teamTier = account.querySelector('.va-membership-title strong');
  const originalCredits = account.querySelector('.home-header-benefits-points');
  const freeTiers = new Set(['', 'FREE', '免费版', '免费', '非会员']);
  const audience = () => account.classList.contains('is-team-account') ? 'team' : 'personal';
  const hasMembership = () => {
    const kind = audience();
    const eligibility = window.vinaMembershipEligibility?.(kind);
    if (typeof eligibility?.active === 'boolean') return eligibility.active;
    // 个人购买后使用已有会话状态；团队复用当前套餐名称，不把管理员或普通成员角色当成会员等级。
    const subscription = kind === 'personal' ? window.vinaPersonalMembershipState?.read() : null;
    if (subscription?.plan) return !freeTiers.has(subscription.plan.trim().toUpperCase());
    return !freeTiers.has((kind === 'team' ? teamTier : personalTier)?.textContent.trim().toUpperCase() || '');
  };
  const messages = {
    'zh-CN': ['开通会员', '会员方案', '限时优惠', '打开 V 点超市'],
    en: ['Join membership', 'Membership plans', 'Limited offer', 'Open V Credits shop'],
    ja: ['会員登録', '会員プラン', '期間限定', 'Vポイント購入を開く'],
    fr: ['S’abonner', 'Abonnements', 'Offre limitée', 'Ouvrir la boutique V'],
    ms: ['Sertai keahlian', 'Pelan keahlian', 'Tawaran terhad', 'Buka kedai mata V'],
    ar: ['اشترك الآن', 'خطط العضوية', 'عرض محدود', 'متجر نقاط V']
  };
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const sync = () => {
    const home = document.body.dataset.primaryView === 'canvas' &&
      !['canvas-workbench-active', 'drama-workflow-active', 'marketing-entry-active', 'team-console-open'].some(name => document.body.classList.contains(name));
    account.classList.toggle('is-home-header-account', home);
    const member = hasMembership();
    const copy = messages[window.vinaPageLanguage?.get() || document.documentElement.lang] || messages['zh-CN'];
    setText(tier, member ? 'Pro' : 'Free');
    setText(plan.querySelector('.home-header-plan-label'), copy[member ? 1 : 0]);
    setText(plan.querySelector('.home-header-plan-offer'), copy[2]);
    if (credits.getAttribute('aria-label') !== copy[3]) credits.setAttribute('aria-label', copy[3]);
    // 数量仍取原顶栏已有余额，只增加千位分隔；不替换成设计稿示例余额，也不改变个人中心的余额口径。
    const value = originalCredits?.textContent.replace(/[^0-9.]/g, '');
    if (value) setText(amount, Number(value).toLocaleString('en-US'));
  };
  plan.addEventListener('click', () => window.openVinaMembershipPage?.(audience(), plan));
  // 2026-11-14：等级区成为可键盘激活的会员入口；积分仅打开当前首页超市，不切换页面。
  tier.addEventListener('click', () => window.openVinaMembershipPage?.(audience(), tier));
  credits.addEventListener('click', () => window.openVinaVPointStore?.(audience(), credits));
  // 仅观察现有状态来源；文本相同不重复写入，避免与原多语言或账号观察器互相触发。
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-primary-view'] });
  new MutationObserver(sync).observe(account, { attributes: true, attributeFilter: ['class'] });
  [personalTier, teamTier, originalCredits].filter(Boolean).forEach(node => new MutationObserver(sync).observe(node, { childList: true, characterData: true, subtree: true }));
  ['pageshow', 'focus', 'vina:personal-membership-change'].forEach(name => window.addEventListener(name, sync));
  window.addEventListener('storage', sync);
  document.addEventListener('vina:language-change', sync);
  sync();
})();
