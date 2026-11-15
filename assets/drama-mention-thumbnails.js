/* 2026-09-30 Product Design 改动逻辑：仅同步视频详情中 @ 标签的展示缩略图。
 * 按素材原名或标签匹配当前片段上方可见参考卡，读取其实际背景图，提示词和分镜表共用同一图片。
 * 参考卡换图、切换片段或标签重新渲染后重新同步；没有同名参考图时保留原展示，音频保留音符。
 * 不改提示词文字、引用身份、素材内容、选择、生成、删除或审核逻辑。
 */
(() => {
  const root = document.querySelector('.episode-detail-workspace');
  const references = document.getElementById('detailReferenceList');
  if (!root || !references) return;
  const key = value => String(value || '').replace(/^@/, '').replace(/\s+/g, '');
  let pending = false;
  const sync = () => {
    pending = false;
    const covers = new Map();
    references.querySelectorAll('.detail-reference-card:not([hidden]):not(.audio-ref)').forEach(card => {
      const cover = getComputedStyle(card).backgroundImage;
      if (!cover || cover === 'none') return;
      [card.dataset.referenceDisplayName, card.dataset.referenceLabel, card.querySelector('.detail-reference-name')?.textContent].forEach(name => {
        if (key(name)) covers.set(key(name), cover);
      });
    });
    root.querySelectorAll('.detail-mention-token').forEach(token => {
      const thumb = token.querySelector('.detail-mention-thumb');
      if (!thumb || thumb.classList.contains('audio-ref')) return;
      const cover = covers.get(key(token.dataset.referenceMention)) || covers.get(key(token.lastElementChild?.textContent));
      // 只在实际图片变化时写入，避免展示监听因自身更新重复触发。
      if (cover && thumb.style.backgroundImage !== cover) thumb.style.backgroundImage = cover;
    });
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(sync);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(references, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['style','class','hidden','data-reference-label','data-reference-display-name'] });
  ['detailPromptText', 'detailStoryboard'].forEach(id => {
    const container = document.getElementById(id);
    if (container) observer.observe(container, { childList:true, subtree:true, characterData:true });
  });
  schedule();
})();
