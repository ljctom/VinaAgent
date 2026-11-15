/* 2026-10-10 改动逻辑：第二、第三步复用设计参考的鼠标局部边框光效。
 * 事件委托覆盖动态卡片，只通过 requestAnimationFrame 更新 CSS 坐标；
 * 不拦截事件、不修改发送/提交/编辑状态。
 * 2026-10-27 改动逻辑：第四步资产的图片提示词面板复用第二步的鼠标坐标更新，
 * 使已有渐变边框随指针位置移动；事件委托兼容角色、场景、物品动态切换。 */
(() => {
  const scope='.script-workspace[data-view="script-studio"]:is([data-script-stage="empty"],[data-script-stage="overall"],[data-script-stage="episode"]):not([data-setup-page="true"])';
  const targets='.script-input,.script-detail .story-summary,.script-detail .subject-card,.script-detail .scene-card,.script-detail .script-scene-card';
  // 2026-10-27 修正逻辑：按实际框体匹配图片提示词及资料面板，不依赖 generate 或编辑状态；
  // 排除右侧音色框，两块面板的标题、正文和操作区共用各自外框的局部光效坐标。
  const assetTarget='.asset-workspace[data-view="asset-library"]:not(.is-canvas-view) .asset-main :is(.asset-edit-region,.asset-profile-inspector:not(.asset-voice-inspector))';
  let frame=0, pending=null;
  document.addEventListener('pointermove',event=>{
    const card=event.target.closest?.(`${targets},${assetTarget}`);
    if(!card)return;
    const isAssetPrompt=card.matches(assetTarget);
    // 2026-11-06 Product Design：本集大纲正文开放编辑后复用分场卡同一套鼠标跟随边框光效。
    if(!isAssetPrompt && !card.closest(scope))return;
    if(!isAssetPrompt && !card.matches('.script-input,[contenteditable="true"],[contenteditable="plaintext-only"]') && !card.querySelector('[contenteditable="true"],[contenteditable="plaintext-only"],textarea:not(:disabled)'))return;
    pending={card,x:event.clientX,y:event.clientY};
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      const {card,x,y}=pending;
      if(!card.isConnected)return;
      const rect=card.getBoundingClientRect();
      let localX=x-rect.left, localY=y-rect.top;
      // 大型分场剧本卡将坐标投到最近边缘，沿用参考的局部边框可见方式。
      const glowHeight = rect.height;
      if(card.matches('.script-scene-card')) {
        localX = Math.max(0, Math.min(rect.width, localX));
        localY = Math.max(0, Math.min(glowHeight, localY));
        const distances=[localX,rect.width-localX,localY,glowHeight-localY];
        const edge=distances.indexOf(Math.min(...distances));
        if(edge===0)localX=0;
        else if(edge===1)localX=rect.width;
        else if(edge===2)localY=0;
        else localY=glowHeight;
      }
      card.style.setProperty('--glow-x',`${localX}px`);
      card.style.setProperty('--glow-y',`${localY}px`);
    });
  },{passive:true});
})();
