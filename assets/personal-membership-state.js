// 2026-10-30 Product Design 改动逻辑：个人会员状态沿用会员页订阅结构，仅在当前会话中同步。
// 首页和账单页据此隐藏已开通会员的个人横幅；也兼容已有个人等级标签与会员资格接口，团队横幅不受影响。
(() => {
  const key = 'vina-personal-membership-subscription';
  let current = null;
  const read = () => {
    try { current = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { /* 存储不可用时继续使用本页内存状态。 */ }
    return current;
  };
  const save = (subscription) => {
    current = subscription;
    try { sessionStorage.setItem(key, JSON.stringify(subscription)); } catch (_) { /* 不阻断当前页的会员开通流程。 */ }
    window.dispatchEvent(new Event('vina:personal-membership-change'));
  };
  window.vinaPersonalMembershipState = { read, save };
  const init = () => {
    const card = document.querySelector('.global-account .profile-personal-summary.va-membership-card');
    if (!card) return;
    const tier = document.querySelector('.profile-popover-personal-tier');
    const sync = () => {
      const subscription = read();
      const eligibility = window.vinaMembershipEligibility?.('personal');
      const label = tier?.textContent.trim().toUpperCase();
      const hasPaidTier = Boolean(label && !['FREE', '免费版', '免费', '非会员'].includes(label));
      card.hidden = Boolean(eligibility?.active || subscription?.plan || hasPaidTier);
    };
    sync();
    // 会员页返回（含浏览器页面缓存恢复）、会话状态更新与个人等级变更时均重新计算，切换团队不改变此卡的独立显隐条件。
    window.addEventListener('pageshow', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('vina:personal-membership-change', sync);
    window.addEventListener('storage', (event) => { if (event.key === key || event.key === null) sync(); });
    if (tier) new MutationObserver(sync).observe(tier, { childList:true, characterData:true, subtree:true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
