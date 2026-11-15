/* 2026-10-27 Product Design 改动逻辑：复用设计稿菜单可用高度测量，选择器只限定首页模型，防止下拉超出视口；原选择业务不变。 */
/* Fit each open menu to the space at its actual anchor, not the whole viewport. */
(() => {
 const selector='.view[data-view="canvas"] #home-drama-panel .drama-model-popover';
 let pending=0;
 function fit(){
  pending=0;
  const viewport=window.visualViewport;
  const top=viewport?.offsetTop||0, bottom=top+(viewport?.height||window.innerHeight),margin=16;
  document.querySelectorAll(selector).forEach(menu=>{
   if(menu.hidden||!menu.getClientRects().length)return;
   const r=menu.getBoundingClientRect();
   const control=menu.closest('[data-drama-model-control],.drama-model-control');
   const trigger=control?.querySelector('[data-drama-model-toggle]') || (menu.id==='detailModelPopover'?document.getElementById('detailModelButton'):menu.id==='detailSettingsPopover'?document.getElementById('detailSettingsButton'):null);
   const anchor=trigger?.getBoundingClientRect();
   // A menu opening upward keeps its bottom edge anchored while its height shrinks.
   const upward=anchor?r.bottom<=anchor.top+4:menu.closest('.episode-detail-workspace,.drama-character-editor,.asset-workspace')!==null;
   const available=upward?r.bottom-top-margin:bottom-r.top-margin;
   menu.style.setProperty('--model-menu-available-height',Math.max(0,Math.floor(available))+'px');
  });
 }
 function schedule(){if(!pending)pending=requestAnimationFrame(fit)}
 new MutationObserver(records=>{
  if(records.some(r=>r.type==='childList'||r.target.matches?.(selector)))schedule();
 }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 window.addEventListener('resize',schedule);
 window.addEventListener('scroll',e=>{if(!e.target.closest?.(selector))schedule()},true);
 window.visualViewport?.addEventListener('resize',schedule);
 schedule();
})();
