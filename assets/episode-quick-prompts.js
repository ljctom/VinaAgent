/* 2026-09-20 改动逻辑：快捷提示词同时支持分镜表单元格和提示词大框，点击词条后恢复打开弹层前保存的 Range，在原光标处插入并派发 input 事件。 */
(() => {
  const trigger = document.getElementById('detailQuickPromptButton');
  const prompt = document.getElementById('detailPromptText');
  const storyboard = document.getElementById('detailStoryboard');
  if (!trigger || !prompt || !storyboard) return;

  const storageKey = 'vinaEpisodeCustomQuickPrompts';
  const catalogs = [
    { id:'custom', label:'自定义', items:[] },
    { id:'movement', label:'运镜', items:['缓慢推镜（slow dolly-in）','推近变焦（gentle zoom-in）','缓慢拉镜（slow dolly-out）','拉远变焦（gentle zoom-out）','急推变焦（crash zoom / snap zoom-in）','急拉变焦（snap zoom-out）','平滑横移（lateral truck）','水平摇镜（gentle pan）','甩镜（whip pan）'] },
    { id:'shot', label:'景别', items:['大远景','远景','全景','中景','中近景','近景','特写','大特写','过肩镜头'] },
    { id:'light', label:'光线', items:['黄金时刻暖光（golden hour warm light）','蓝调时刻冷光（blue hour cool light）','阴天柔和均匀光（overcast soft even light）','正午顶光（high noon overhead light）','月光冷调（moonlight, cool blue tone）','蝴蝶光（butterfly / paramount lighting）','顺光均匀照亮（front lighting, even light）'] },
    { id:'lens', label:'镜头', items:['广角镜头 24mm','小广角 35mm','标准镜头 50mm','人像中焦 85mm'] },
    { id:'composition', label:'构图', items:['三分构图','居中对称构图','引导线构图','框中框构图','对角线构图','留白构图','前景遮挡','低水平线','高水平线','三角形构图','荷兰角'] },
    { id:'tone', label:'色调', items:['青橙调','暖橙日落调','冷蓝雨调','莫兰迪低饱和','单色黑白','复古暖黄','霓虹紫粉','绿调氤氲','高对比硬调'] },
    { id:'medium', label:'媒介', items:['电影胶片质感','数字电影质感','16mm 胶片颗粒','35mm 胶片质感','手绘动画','水彩插画','黏土定格动画','写实 3D 渲染'] },
    { id:'atmosphere', label:'氛围', items:['晨雾弥漫','雨天反光','暴雨倾盆','细雪飘落','暴风雪','烟雾弥漫','尘埃飞舞','太阳光晕','体积光','风沙','闪电雷暴','萤火虫飘动'] }
  ];
  let activeCategory = 'custom';
  let savedRange = null;
  let savedTarget = null;

  const popover = document.createElement('section');
  popover.className = 'detail-quick-prompt-popover';
  popover.id = 'detailQuickPromptPopover';
  popover.setAttribute('role','dialog');
  popover.setAttribute('aria-label','快捷提示词');
  popover.hidden = true;
  popover.innerHTML = '<nav class="detail-quick-prompt-tabs" role="tablist" aria-label="快捷提示词分类"></nav><div class="detail-quick-prompt-list" role="tabpanel"></div>';
  document.body.append(popover);

  const dialog = document.createElement('dialog');
  dialog.className = 'detail-quick-prompt-dialog';
  // 2026-10-27 Product Design：仅同步 UI 稿的表单展示层、提示文案和计数排版，保留保存与取消处理。
  dialog.innerHTML = '<header class="detail-quick-prompt-dialog-head"><div><h2 id="quickPhraseDialogTitle">添加常用短语</h2><p class="quick-phrase-dialog-hint" id="quickPhraseDialogHint">保存后可在快捷提示词中随时插入</p></div><button class="detail-quick-prompt-dialog-close" type="button" aria-label="关闭">×</button></header><div class="detail-quick-prompt-dialog-body"><textarea maxlength="500" aria-label="常用短语内容" aria-describedby="quickPhraseDialogCount" placeholder="例如：镜头缓慢推近，暖色柔光，电影胶片质感"></textarea><div class="quick-phrase-dialog-meta"><span>最多 500 字</span><p class="detail-quick-prompt-dialog-count" id="quickPhraseDialogCount">0/500</p></div></div><footer class="detail-quick-prompt-dialog-actions"><button type="button" data-quick-prompt-cancel>取消</button><button class="is-primary" type="button" data-quick-prompt-save disabled>保存短语</button></footer>';
  dialog.setAttribute('aria-labelledby','quickPhraseDialogTitle');
  dialog.setAttribute('aria-describedby','quickPhraseDialogHint');
  document.body.append(dialog);

  // 2026-09-20 改动逻辑：自定义短语关闭按钮不再直接删除；先展示不可恢复提示，只有用户二次确认后才写回本地存储。
  const deleteDialog = document.createElement('dialog');
  deleteDialog.className = 'detail-quick-prompt-delete-dialog';
  deleteDialog.innerHTML = '<div class="detail-quick-prompt-delete-copy"><h2>删除这条自定义短语？</h2><p>删除之后不可恢复。</p></div><footer class="detail-quick-prompt-delete-actions"><button type="button" data-quick-delete-cancel>取消</button><button class="is-danger" type="button" data-quick-delete-confirm>确认删除</button></footer>';
  document.body.append(deleteDialog);

  const tabs = popover.querySelector('.detail-quick-prompt-tabs');
  const list = popover.querySelector('.detail-quick-prompt-list');
  const textarea = dialog.querySelector('textarea');
  const count = dialog.querySelector('.detail-quick-prompt-dialog-count');
  const save = dialog.querySelector('[data-quick-prompt-save]');
  let pendingDeleteIndex = -1;

  function customItems() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]').filter(item => typeof item === 'string' && item.trim()); }
    catch (_) { return []; }
  }
  function writeCustom(items) { localStorage.setItem(storageKey, JSON.stringify(items)); }
  function currentEditable() {
    const active = document.activeElement;
    if (active === prompt || prompt.contains(active)) return prompt;
    const cell = active?.closest?.('#detailStoryboard td[contenteditable="true"]');
    if (cell) return cell;
    const selection = window.getSelection();
    const node = selection?.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return element?.closest?.('#detailPromptText, #detailStoryboard td[contenteditable="true"]') || null;
  }
  function rememberCaret() {
    const target = currentEditable();
    const selection = window.getSelection();
    if (!target || !selection?.rangeCount || !target.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
    savedTarget = target;
    savedRange = selection.getRangeAt(0).cloneRange();
  }
  function insertAtCaret(value) {
    let target = savedTarget?.isConnected ? savedTarget : (popover.closest('.detail-prompt-card')?.dataset.detailView === 'prompt' ? prompt : storyboard.querySelector('td[contenteditable="true"]'));
    if (!target) target = prompt;
    target.focus();
    const selection = window.getSelection();
    const range = savedRange && target.contains(savedRange.commonAncestorContainer) ? savedRange : document.createRange();
    if (!savedRange || !target.contains(savedRange.commonAncestorContainer)) { range.selectNodeContents(target); range.collapse(false); }
    selection.removeAllRanges(); selection.addRange(range);
    range.deleteContents();
    const text = document.createTextNode(value);
    const spacer = document.createTextNode(' ');
    range.insertNode(spacer); range.insertNode(text);
    range.setStartAfter(spacer); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    savedRange = range.cloneRange(); savedTarget = target;
    target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
  }
  // 2026-10-27 Product Design：弹层尺寸及上下方定位复用 UI 稿，空态 300px、列表 400px，按可用视口裁切；不改词条插入和存储。
  function positionPopover() {
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(520, window.innerWidth - 32);
    const above = Math.max(0, rect.top - 26);
    const below = Math.max(0, window.innerHeight - rect.bottom - 26);
    const upward = above >= 260 || above >= below;
    const preferred = activeCategory === 'custom' && !customItems().length ? 300 : 400;
    const height = Math.min(preferred, upward ? above : below);
    const left = Math.min(window.innerWidth - width - 16, Math.max(16, rect.left));
    const top = upward ? rect.top - height - 10 : rect.bottom + 10;
    popover.style.width = `${width}px`; popover.style.height = `${height}px`;
    popover.style.left = `${left}px`; popover.style.top = `${Math.max(16,top)}px`;
  }
  function render() {
    tabs.innerHTML = catalogs.map(category => `<button class="detail-quick-prompt-tab" type="button" role="tab" data-quick-category="${category.id}" aria-selected="${category.id === activeCategory}">${category.label}</button>`).join('');
    const category = catalogs.find(item => item.id === activeCategory);
    const items = category.id === 'custom' ? customItems() : category.items;
    if (category.id === 'custom' && !items.length) {
      list.innerHTML = '<div class="detail-quick-prompt-empty"><svg class="detail-quick-prompt-empty-icon" viewBox="0 0 36 36" aria-hidden="true"><rect x="7" y="5" width="22" height="26" rx="4"/><path d="M12 12h12M12 18h9M12 24h6"/></svg><span>还没有自定义短语</span><button class="detail-quick-prompt-new" type="button" data-quick-prompt-new>＋ 新建</button></div>';
      return;
    }
    list.classList.toggle('is-custom', category.id === 'custom');
    if (category.id === 'custom') {
      list.innerHTML = `<div class="detail-quick-prompt-custom-scroll">${items.map((item,index) => `<div class="detail-quick-prompt-custom-row"><button class="detail-quick-prompt-option" type="button" data-quick-prompt-value="${escapeHtml(item)}">${escapeHtml(item)}</button><button class="detail-quick-prompt-delete" type="button" data-quick-prompt-delete="${index}" aria-label="删除自定义短语">×</button></div>`).join('')}</div><div class="detail-quick-prompt-custom-footer"><button class="detail-quick-prompt-new" type="button" data-quick-prompt-new>＋ 新建</button></div>`;
      return;
    }
    list.innerHTML = items.map(item => `<button class="detail-quick-prompt-option" type="button" data-quick-prompt-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('');
  }
  function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
  function closePopover() { popover.hidden = true; trigger.setAttribute('aria-expanded','false'); }
  function openDialog() { closePopover(); textarea.value=''; count.textContent='0/500'; save.disabled=true; dialog.showModal(); textarea.focus(); }

  document.addEventListener('selectionchange', rememberCaret);
  storyboard.addEventListener('focusin', rememberCaret);
  prompt.addEventListener('focusin', rememberCaret);
  trigger.addEventListener('pointerdown', event => { rememberCaret(); event.preventDefault(); });
  trigger.addEventListener('click', () => { const opening = popover.hidden; if (!opening) return closePopover(); render(); positionPopover(); popover.hidden=false; trigger.setAttribute('aria-expanded','true'); });
  tabs.addEventListener('click', event => { const button=event.target.closest('[data-quick-category]'); if(!button)return; activeCategory=button.dataset.quickCategory; render(); positionPopover(); });
  list.addEventListener('click', event => {
    if (event.target.closest('[data-quick-prompt-new]')) return openDialog();
    const remove = event.target.closest('[data-quick-prompt-delete]');
    if (remove) { pendingDeleteIndex=Number(remove.dataset.quickPromptDelete); closePopover(); deleteDialog.showModal(); deleteDialog.querySelector('[data-quick-delete-cancel]')?.focus(); return; }
    const option=event.target.closest('[data-quick-prompt-value]');
    if (!option) return; insertAtCaret(option.dataset.quickPromptValue); closePopover();
  });
  textarea.addEventListener('input', () => { count.textContent=`${textarea.value.length}/500`; save.disabled=!textarea.value.trim(); });
  dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('.detail-quick-prompt-dialog-close,[data-quick-prompt-cancel]')) dialog.close(); });
  save.addEventListener('click', () => { const value=textarea.value.trim(); if(!value)return; const items=customItems(); items.unshift(value); writeCustom([...new Set(items)]); dialog.close(); activeCategory='custom'; render(); positionPopover(); popover.hidden=false; trigger.setAttribute('aria-expanded','true'); });
  deleteDialog.addEventListener('click', event => {
    if (event.target === deleteDialog || event.target.closest('[data-quick-delete-cancel]')) { pendingDeleteIndex=-1; deleteDialog.close(); return; }
    if (!event.target.closest('[data-quick-delete-confirm]') || pendingDeleteIndex < 0) return;
    const items=customItems(); items.splice(pendingDeleteIndex,1); writeCustom(items); pendingDeleteIndex=-1; deleteDialog.close(); activeCategory='custom'; render(); positionPopover(); popover.hidden=false; trigger.setAttribute('aria-expanded','true');
  });
  document.addEventListener('pointerdown', event => { if (popover.hidden || event.target.closest('#detailQuickPromptPopover,#detailQuickPromptButton,.detail-quick-prompt-dialog')) return; closePopover(); });
  document.addEventListener('keydown', event => { if(event.key==='Escape' && !popover.hidden) closePopover(); });
  window.addEventListener('resize', () => { if(!popover.hidden) positionPopover(); });
})();
