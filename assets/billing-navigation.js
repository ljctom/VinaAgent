// 2026-10-30 Product Design 改动逻辑：账户菜单账单入口改为原地打开全屏弹窗，不再导航或缓存独立页面的账户栏。
(() => {
  document.addEventListener('click', event => {
    const trigger=event.target.closest('#profileBillingRecordsLink');
    if(!trigger)return;
    event.preventDefault();event.stopImmediatePropagation();
    const popover=document.getElementById('profilePopover');
    const accountTrigger=document.querySelector('[aria-controls="profilePopover"]')||document.getElementById('topAccountAvatar')||document.querySelector('.home-header-avatar');
    if(popover)popover.hidden=true;
    accountTrigger?.setAttribute('aria-expanded','false');
    window.openVinaBillingRecords?.('points',accountTrigger||trigger);
  },true);
})();
