// 2026-10-25 阿语完整适配：同步/生成读取提示词规范原文，避免显示用阿语改写 @ 素材标识；真实用户输入仍按当前内容保存。
/* 2026-09-13 改动逻辑：分镜表与所有视频片段共用的晚宴提示词一一对应，固定拆为 0–3s、3–6s、6–10s、10–14s 四镜。
 * 2026-09-17 改动逻辑：默认九列在“对白·旁白”后依次增加“光影氛围”和“音效”；2026-09-23 分镜图片移入顶部参考栏，不再插入表格。
 * 光影与音效按每个镜头的动作和情绪单独描述，便于直接编辑并同步到提示词。
 * 2026-09-13 新增逻辑：正文单元格全部可编辑；首次输入后点亮“同步修改到提示词”，同步时等待三秒并显示“正在生成提示词”，随后切到提示词视图但保持提示词原文不变。
 * 2026-09-22 Product Design 改动逻辑：时长列改为紧凑数字输入框并保留 s 单位；支持直接输入、键盘方向键和悬停后原生上下微调按钮。 */
(() => {
  const prompt = document.getElementById('detailPromptText');
  const board = document.getElementById('detailStoryboard');
  const title = document.getElementById('detailShotTitle');
  if (!prompt || !board || !title) return;

  const card = board.closest('.detail-prompt-card');
  const promptTools = card.querySelector('.detail-prompt-tools');
  const buttons = [...document.querySelectorAll('[data-detail-view]')].filter(el => el.tagName === 'BUTTON');
  const syncButton = document.getElementById('detailStoryboardSync');
  const syncLabel = syncButton?.querySelector('.detail-storyboard-sync-label');
  // 2026-09-28 Product Design 改动逻辑：同步按钮的气泡与正文标签共用状态文案，等待生成时显示“正在生成提示词”。
  const syncTooltip = document.getElementById('detailStoryboardSyncTooltip');
  const optimizeButton = document.getElementById('detailPromptOptimizeButton');
  const optimizeLoading = document.getElementById('detailPromptOptimizeLoading');
  const generateButton = document.getElementById('detailGenerateButton');
  const syncConfirmModal = document.getElementById('storyboardSyncConfirmModal');
  const generateWithoutSyncButton = document.getElementById('storyboardGenerateWithoutSync');
  const syncAndGenerateButton = document.getElementById('storyboardSyncAndGenerate');
  const mentionKinds = new Map([
    ['洛根·克罗斯', 'role'],
    ['艾娃·门罗', 'role'],
    ['克洛伊·辛克莱', 'role'],
    ['梅森·里德', 'role'],
    ['理查德·辛克莱', 'headmaster']
  ]);
  // 2026-09-13 改动逻辑：分镜表只把画面描述中的人物引用做成胶囊；场景列和对白列均保持普通文字。
  const mentionPattern = /@(洛根·克罗斯|艾娃·门罗|克洛伊·辛克莱|梅森·里德|理查德·辛克莱)/g;
  let signature = '';
  let syncTimer = 0;
  let optimizeTimer = 0;
  let storyboardChanged = false;
  let bypassGenerateConfirmation = false;

  // 2026-10-11 Product Design 改动逻辑：同步完成使用独立成功 Toast，复用全站 Figma 提示层；不占用标题修改或参考图生成的消息和计时器。
  const syncToast = document.createElement('div');
  syncToast.className = 'title-toast';
  syncToast.dataset.vinaToastType = 'success';
  syncToast.setAttribute('role', 'status');
  syncToast.setAttribute('aria-live', 'polite');
  syncToast.setAttribute('aria-atomic', 'true');
  document.body.appendChild(syncToast);
  let syncToastTimer = 0;

  function showSyncSuccessToast() {
    syncToast.textContent = '分镜修改已同步到提示词';
    syncToast.classList.add('is-visible');
    window.clearTimeout(syncToastTimer);
    syncToastTimer = window.setTimeout(() => syncToast.classList.remove('is-visible'), 3000);
  }

  // 2026-09-26 Product Design 改动逻辑：以工具栏真实高度界定加载区，窄屏换行时仍只遮住分镜表或提示词正文。
  if (promptTools && window.ResizeObserver) {
    const updateOptimizeBounds = () => card.style.setProperty('--detail-prompt-tools-height', `${promptTools.getBoundingClientRect().height}px`);
    new ResizeObserver(updateOptimizeBounds).observe(promptTools);
    updateOptimizeBounds();
  }

  // 2026-09-13 改动逻辑：同步按钮默认置灰；只有当前分镜发生输入且不在同步中时才亮起，防止重复提交。
  function updateSyncState({ changed = storyboardChanged, syncing = false } = {}) {
    storyboardChanged = changed;
    // 2026-10-11 改动逻辑：将未同步状态和分镜一起保存，历史切换恢复该次生成对应的状态。
    const activeShot = document.querySelector('.episode-detail-workspace .shot-card.active');
    if (activeShot) activeShot.dataset.storyboardChanged = String(changed);
    if (!syncButton) return;
    syncButton.classList.toggle('is-syncing', syncing);
    syncButton.disabled = !changed || syncing;
    syncButton.setAttribute('aria-busy', String(syncing));
    syncButton.setAttribute('aria-label', syncing ? '正在生成提示词' : (changed ? '同步修改到提示词' : '同步修改到提示词，修改分镜表后可用'));
    const syncText = syncing ? '正在生成提示词' : '同步修改到提示词';
    if (syncLabel) syncLabel.textContent = syncText;
    if (syncTooltip) syncTooltip.textContent = syncText;
  }

  // 2026-09-17 改动逻辑：四行内容在原有镜头信息末尾补齐逐镜光影氛围与音效，使新增两列始终位于表格最后且与剧情节奏对应。
  function buildRows() {
    return [
      ['01', '3s', '大学礼堂·长桌旁', '中近景', '平视侧面缓慢推近，焦点停在克洛伊眼神', '@克洛伊·辛克莱僵住，望向@洛根·克罗斯与@艾娃·门罗；@梅森·里德在后方退半步。', '—', '暖金吊灯映亮长桌，克洛伊面部渐落入冷影，空气骤然凝滞。', '宴会低语渐弱，杯盘轻碰；低沉悬念音缓缓起。'],
      ['02', '3s', '大学礼堂·校董席', '中近景', '沿既有视线平移，保持同侧轴线', '@理查德·辛克莱站在校董席旁，压低声音质问画外的洛根。', '理查德·辛克莱：“洛根，你知道自己在说什么吗？”', '校董席上方硬质侧光切出深重阴影，压迫感增强。', '压低的质问声贴近收音；背景人群窃语与弦乐低音持续。'],
      ['03', '4s', '大学礼堂·长桌侧面', '中景·特写', '侧面中景切手部特写，连续跟随戴戒动作', '@洛根·克罗斯握住@艾娃·门罗右手，将银戒推至无名指根；艾娃先看戒指，再看洛根。', '—', '柔暖烛光掠过双手，银戒闪出短促高光，背景虚化成金色光斑。', '衣料细响、指尖摩擦与戒指轻响；心跳声逐渐清晰。'],
      ['04', '4s', '大学礼堂·宾客席前', '中近景', '动作匹配切至正面，静止收束', '@洛根·克罗斯握着@艾娃·门罗戴戒的右手，当众宣布婚约；众人震惊戒备。', '洛根·克罗斯：“艾娃·门罗，是我的未婚妻。”', '正面聚光锁住两人，宾客席压暗，明暗反差定格宣告瞬间。', '宣告声清晰回荡；全场倒吸气与零星惊呼后骤然静默。']
    ];
  }

  function appendRichText(cell, value) {
    let cursor = 0;
    let match;
    mentionPattern.lastIndex = 0;
    while ((match = mentionPattern.exec(value))) {
      if (match.index > cursor) cell.append(document.createTextNode(value.slice(cursor, match.index)));
      const token = document.createElement('span');
      token.className = 'detail-mention-token storyboard-mention-token';
      token.dataset.referenceMention = match[1];
      const thumb = document.createElement('span');
      thumb.className = `detail-mention-thumb ${mentionKinds.get(match[1]) || 'role'}`;
      const label = document.createElement('span');
      label.textContent = match[0];
      token.append(thumb, label);
      cell.append(token);
      cursor = match.index + match[0].length;
    }
    if (cursor < value.length) cell.append(document.createTextNode(value.slice(cursor)));
  }

  // 2026-09-22 Product Design 改动逻辑：数字与单位分开渲染，使用户只需编辑秒数；type=number 复用浏览器原生微调控件并保留键盘可访问性。
  // 2026-10-27 Product Design：沿用设计稿的数字、s 单位、独立上下按钮三栏结构；微调触发原输入与保存事件，限制 1–60 秒并保留只读状态。
  function appendDurationInput(cell, value, rowIndex, readonly) {
    const seconds = Math.max(1, Math.min(60, Math.round(Number.parseFloat(value) || 1)));
    const field = document.createElement('div');
    field.className = 'storyboard-duration-field';
    const input = document.createElement('input');
    input.className = 'storyboard-duration-input';
    input.type = 'number';
    input.min = '1';
    input.max = '60';
    input.step = '1';
    input.value = value === '' ? '' : String(seconds);
    input.defaultValue = String(seconds);
    input.inputMode = 'numeric';
    input.disabled = readonly;
    input.setAttribute('aria-label', `分镜 ${rowIndex + 1} 时长（秒）`);
    const suffix = document.createElement('span');
    suffix.className = 'storyboard-duration-suffix';
    suffix.setAttribute('aria-hidden', 'true');
    suffix.textContent = 's';
    const controls = document.createElement('span');
    controls.className = 'storyboard-duration-steppers';
    const steppers = [1, -1].map(delta => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'storyboard-duration-step';
      button.setAttribute('aria-label', `分镜 ${rowIndex + 1} ${delta > 0 ? '增加' : '减少'}1秒`);
      button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${delta > 0 ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'}"/></svg>`;
      button.addEventListener('click', () => {
        if (input.disabled) return;
        const current = Number.parseFloat(input.value) || Number(input.defaultValue) || 1;
        input.value = String(Math.max(1, Math.min(60, Math.round(current) + delta)));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      controls.append(button);
      return button;
    });
    const updateSteppers = () => {
      const current = Number(input.value || input.defaultValue);
      steppers[0].disabled = readonly || current >= 60;
      steppers[1].disabled = readonly || current <= 1;
    };
    input.addEventListener('input', updateSteppers);
    input.addEventListener('change', updateSteppers);
    updateSteppers();
    field.append(input, suffix, controls);
    cell.append(field);
  }

  // 2026-09-22 Product Design 改动逻辑：失焦或点击微调按钮后把时长收敛为 1–60 的整数，避免空值、负数或小数进入后续生成参数。
  function normalizeDurationInput(input) {
    if (input.value === '') return;
    const parsed = Math.round(Number(input.value));
    const fallback = Number(input.defaultValue) || 1;
    input.value = String(Number.isFinite(parsed) ? Math.max(1, Math.min(60, parsed)) : fallback);
  }

  // 2026-09-22 Product Design 改动逻辑：重绘前读取现有正文和原图索引，增删及展开图片列时保留手工编辑，空镜头不借用其他行的图片。
  function readCurrentRows() {
    return [...board.querySelectorAll('tbody tr[data-shot-row]')].map(tr => {
      const row = [...tr.querySelectorAll('td[data-column]')].map(cell => {
        if (cell.dataset.column === '0') return '';
        return cell.querySelector('input')?.value ?? cell.textContent;
      });
      row.imageIndex = tr.dataset.imageIndex === '' ? null : Number(tr.dataset.imageIndex);
      return row;
    });
  }

  function render(force = false, suppliedRows = null) {
    const text = (window.VinaArabic?.active ? window.VinaArabic.sourceText(prompt) : prompt.textContent).trim();
    const next = JSON.stringify([title.textContent, text]);
    if (!force && next === signature) return;
    const preserve = next === signature && Boolean(board.querySelector('table'));
    // 2026-09-26 Product Design 改动逻辑：优先恢复片段自己的分镜；空提示词仍显示九列表头和一行可编辑空分镜，不再隐藏整张表。
    const activeShot = document.querySelector('.episode-detail-workspace .shot-card.active');
    const storedRows = activeShot?.dataset.storyboardRows;
    const rows = suppliedRows ?? (preserve ? readCurrentRows() : storedRows ? JSON.parse(storedRows) : text ? buildRows().map((row, index) => Object.assign(row, { imageIndex: index })) : [Array(9).fill('')]);
    // 2026-10-11 改动逻辑：历史恢复及片段重绘读取自己的未同步标记，不能把上一版本的同步状态带入当前版本。
    const changed = preserve ? storyboardChanged : activeShot?.dataset.storyboardChanged === 'true';
    signature = next;
    board.replaceChildren();

    const table = document.createElement('table');
    // 2026-09-17 改动逻辑：移除表头上方“片段 · 分镜数 · 总时长”汇总行，让列标题直接贴合表格顶部；底层片段和分镜数据保持不变。
    const group = document.createElement('colgroup');
    // 2026-09-23 Product Design：分镜表固定九列，预览图片独立放在顶部，保留时长输入宽度。
    const columnWidths = ['4%', '88px', '10%', '8%', '13%', '27%', '15%', '11%', '7%'];
    columnWidths.forEach(width => {
      const col = document.createElement('col');
      col.style.width = width;
      group.append(col);
    });
    table.append(group);

    const header = table.createTHead().insertRow();
    const headerLabels = ['镜号', '时长', '场景', '景别', '运镜', '画面描述', '对白·旁白', '光影氛围', '音效'];
    headerLabels.forEach((label, columnIndex) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      if (columnIndex === 0) th.className = 'storyboard-index-cell';
      if (label === '分镜图') th.className = 'storyboard-image-cell';
      if (label === '时长') th.className = 'storyboard-duration-cell';
      if (label === '场景') th.className = 'storyboard-scene-cell';
      if (label === '景别') th.className = 'storyboard-shot-size-cell';
      if (label === '光影氛围') th.className = 'storyboard-lighting-cell';
      if (label === '音效') th.className = 'storyboard-sound-cell';
      header.append(th);
    });

    const body = table.createTBody();
    rows.forEach((row, rowIndex) => {
      const tr = body.insertRow();
      tr.dataset.shotRow = String(rowIndex);
      tr.dataset.imageIndex = row.imageIndex ?? '';
      row[0] = String(rowIndex + 1).padStart(2, '0');
      row.forEach((value, columnIndex) => {
        const cell = tr.insertCell();
        cell.dataset.column = String(columnIndex);
        const readonly = document.body.classList.contains('example-project-readonly');
        const isDuration = columnIndex === 1;
        if (columnIndex === 0) cell.className = 'storyboard-index-cell';
        if (isDuration) cell.className = 'storyboard-duration-cell';
        if (columnIndex === 2) cell.className = 'storyboard-scene-cell';
        if (columnIndex === 3) cell.className = 'storyboard-shot-size-cell';
        // 2026-09-22 Product Design 改动逻辑：时长交由数字框独立编辑，其余正文继续沿用 contenteditable；只读示例项目同步禁用两种编辑方式。
        cell.contentEditable = columnIndex === 0 || isDuration || readonly ? 'false' : 'true';
        cell.spellcheck = false;
        if (columnIndex === 0) {
          const number = document.createElement('span');
          number.className = 'storyboard-row-number';
          number.textContent = row[0];
          cell.append(number);
          if (!readonly) appendRowControls(cell, rowIndex);
        } else if (isDuration) {
          appendDurationInput(cell, value, rowIndex, readonly);
        } else {
          cell.setAttribute('aria-label', readonly ? '分镜内容' : '可编辑分镜内容');
          appendRichText(cell, value);
        }
      });
    });
    board.append(table);
    if (!rows.length && !document.body.classList.contains('example-project-readonly')) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'storyboard-empty-add';
      add.textContent = '增加分镜头';
      add.addEventListener('click', () => insertRow(0));
      board.append(add);
    }
    updateSyncState({ changed, syncing: false });
  }

  // 2026-09-22 Product Design 改动逻辑：整行悬停切换镜号/删除按钮；分隔线上下 14px 均可唤出左侧加号，操作提示由统一浮层呈现。
  const tooltip = document.createElement('div');
  tooltip.className = 'storyboard-row-tooltip';
  tooltip.id = 'storyboardRowTooltip';
  tooltip.role = 'tooltip';
  tooltip.hidden = true;
  document.body.append(tooltip);
  function hideTooltip() { tooltip.hidden = true; }
  function prepareTooltip(button, label) {
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-describedby', tooltip.id);
    const show = () => {
      const rect = button.getBoundingClientRect();
      tooltip.textContent = label;
      tooltip.style.left = `${rect.right + 8}px`;
      tooltip.style.top = `${rect.top + rect.height / 2}px`;
      tooltip.hidden = false;
    };
    button.addEventListener('mouseenter', show);
    button.addEventListener('focus', show);
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('blur', hideTooltip);
  }
  function appendRowControls(cell, index) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'storyboard-row-delete';
    // 2026-10-27 Product Design：复用设计稿垃圾桶矢量，继承 currentColor，使悬停时图标和底色一起变红。
    // Share the outline and script steps' currentColor trash glyph.
    const icon = document.createElement('span');
    icon.className = 'episode-outline-trash-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="2 2 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V4h6v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
    remove.append(icon);
    prepareTooltip(remove, '删除该分镜头');
    remove.addEventListener('click', () => requestDelete(index, remove));
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'storyboard-row-add';
    // 复用当前参考素材区的加号外观。
    add.textContent = document.getElementById('detailReferenceAdd')?.textContent || '＋';
    prepareTooltip(add, '增加分镜头');
    add.addEventListener('click', () => insertRow(index + 1));
    cell.append(remove, add);
  }
  function commitRows(rows, focusIndex) {
    hideTooltip();
    window.clearTimeout(syncTimer);
    // 2026-09-26 改动逻辑：新增或删除分镜后立即写入当前片段，切换片段和编辑提示词时继续保留表格内容。
    const activeShot = document.querySelector('.episode-detail-workspace .shot-card.active');
    if (activeShot) activeShot.dataset.storyboardRows = JSON.stringify(rows);
    render(true, rows);
    updateSyncState({ changed: true });
    board.querySelectorAll('tbody tr')[focusIndex]?.querySelector('.storyboard-duration-input')?.focus();
    if (!rows.length) board.querySelector('.storyboard-empty-add')?.focus();
  }
  function insertRow(index) {
    if (document.body.classList.contains('example-project-readonly')) return;
    const rows = readCurrentRows();
    rows.splice(index, 0, Object.assign(Array(9).fill(''), { imageIndex: null }));
    commitRows(rows, index);
  }
  // 原生 dialog 提供模态焦点约束与 Escape 取消；取消不修改数据，确认才删除并重排编号。
  const deleteDialog = document.createElement('dialog');
  deleteDialog.className = 'storyboard-row-delete-dialog storyboard-sync-confirm-dialog';
  deleteDialog.setAttribute('aria-labelledby', 'storyboardRowDeleteTitle');
  deleteDialog.setAttribute('aria-describedby', 'storyboardRowDeleteMessage');
  deleteDialog.innerHTML = '<h2 id="storyboardRowDeleteTitle">删除分镜头</h2><p id="storyboardRowDeleteMessage"></p><div class="storyboard-sync-confirm-actions"><button type="button" class="storyboard-sync-confirm-secondary" data-cancel>取消</button><button type="button" class="storyboard-sync-confirm-primary" data-confirm>确认删除</button></div>';
  document.body.append(deleteDialog);
  let pendingDelete = null;
  function requestDelete(index, trigger) {
    hideTooltip();
    pendingDelete = { index, trigger, signature };
    deleteDialog.querySelector('p').textContent = `确定删除第 ${String(index + 1).padStart(2, '0')} 个分镜头吗？删除后该行内容将无法恢复。`;
    deleteDialog.showModal();
    deleteDialog.querySelector('[data-cancel]').focus();
  }
  deleteDialog.querySelector('[data-cancel]').addEventListener('click', () => deleteDialog.close());
  deleteDialog.addEventListener('close', () => {
    pendingDelete?.trigger?.focus();
    pendingDelete = null;
  });
  deleteDialog.querySelector('[data-confirm]').addEventListener('click', () => {
    const pending = pendingDelete;
    pendingDelete = null;
    deleteDialog.close();
    if (!pending || pending.signature !== signature || document.body.classList.contains('example-project-readonly')) return;
    const rows = readCurrentRows();
    rows.splice(pending.index, 1);
    commitRows(rows, Math.min(pending.index, rows.length - 1));
  });
  function clearBoundary() {
    board.querySelector('.is-insert-boundary')?.classList.remove('is-insert-boundary');
  }
  board.addEventListener('pointermove', event => {
    if (event.target.closest('.storyboard-row-add')) return;
    clearBoundary();
    const row = event.target.closest('tr[data-shot-row]');
    if (!row) return;
    const bounds = row.getBoundingClientRect();
    if (Math.abs(event.clientY - bounds.bottom) <= 14) row.classList.add('is-insert-boundary');
    else if (Math.abs(event.clientY - bounds.top) <= 14) row.previousElementSibling?.classList.add('is-insert-boundary');
  });
  board.addEventListener('pointerleave', clearBoundary);
  board.addEventListener('scroll', () => { hideTooltip(); clearBoundary(); });

  function select(view) {
    card.dataset.detailView = view;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.detailView === view)));
    if (view === 'storyboard') render();
  }

  buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.detailView)));
  // 2026-09-13 改动逻辑：切换任意视频片段都恢复同一份分镜表，并取消上一片段尚未完成的同步等待。
  new MutationObserver(() => {
    window.clearTimeout(syncTimer);
    // 2026-09-26 Product Design 改动逻辑：切换片段时结束上一片段的优化反馈，防止旧计时器在新片段上强行切换视图。
    window.clearTimeout(optimizeTimer);
    if (optimizeLoading) optimizeLoading.hidden = true;
    if (optimizeButton) { optimizeButton.disabled = false; optimizeButton.removeAttribute('aria-busy'); }
    signature = '';
    select('storyboard');
  }).observe(title, { childList: true, subtree: true, characterData: true });
  new MutationObserver(() => render()).observe(prompt, { childList: true, subtree: true, characterData: true });
  prompt.addEventListener('input', () => render());
  // 2026-10-27 改动逻辑：分镜表仅接收文字。粘贴只插入 text/plain，丢弃 HTML 和剪贴板图片；
  // 拖放及 beforeinput 的图片插入也被阻止，避免浏览器把图片直接塞进 contenteditable 单元格。
  // 事件限定在表格内，顶部参考素材和提示词编辑器继续沿用各自的素材流程。
  board.addEventListener('paste', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const cell = event.target.closest('td[contenteditable="true"]');
    if (!cell || !board.contains(cell) || document.body.classList.contains('example-project-readonly')) return;
    const text = event.clipboardData?.getData('text/plain') || '';
    if (text) {
      document.execCommand('insertText', false, text);
      cell.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, true);
  ['dragover', 'drop'].forEach(type => board.addEventListener(type, event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  }, true));
  board.addEventListener('beforeinput', event => {
    if (['insertFromDrop', 'insertFromPaste', 'insertFromPasteAsQuotation', 'insertImage'].includes(event.inputType)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  // 2026-09-13 改动逻辑：只监听表格正文的真实编辑输入，切换视图或脚本重绘不会误点亮同步按钮。
  board.addEventListener('input', event => {
    // 2026-09-22 Product Design 改动逻辑：数字框输入与原表格文字编辑共用“已修改”状态，确保改秒数后也能同步到提示词。
    if (!event.target.closest('td[contenteditable="true"], .storyboard-duration-input')) return;
    updateSyncState({ changed: true, syncing: false });
    // 2026-09-26 改动逻辑：正文和时长编辑分别属于当前片段，输入时保存分镜行，防止切换后回到预置演示内容。
    const activeShot = document.querySelector('.episode-detail-workspace .shot-card.active');
    if (activeShot) activeShot.dataset.storyboardRows = JSON.stringify(readCurrentRows());
  });
  board.addEventListener('change', event => {
    if (!event.target.matches('.storyboard-duration-input')) return;
    normalizeDurationInput(event.target);
  });
  board.addEventListener('focusout', event => {
    if (!event.target.matches('.storyboard-duration-input')) return;
    normalizeDurationInput(event.target);
  });
  // 2026-09-16 改动逻辑：同步过程抽成可复用流程；手动同步完成后仅切换提示词，弹窗确认同步完成后则继续触发原视频生成事件。
  function syncStoryboard(onComplete) {
    if (!storyboardChanged || syncButton?.disabled) return;
    const unchangedPrompt = prompt.innerHTML;
    updateSyncState({ changed: true, syncing: true });
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      prompt.innerHTML = unchangedPrompt;
      updateSyncState({ changed: false, syncing: false });
      select('prompt');
      // 2026-10-11 改动逻辑：仅在现有原型同步完成并切换视图后显示成功反馈；手动同步和“同步并生成”共用，后者随后继续视频生成。
      showSyncSuccessToast();
      onComplete?.();
    }, 3000);
  }

  syncButton?.addEventListener('click', () => {
    syncStoryboard();
  });

  // 2026-09-26 改动逻辑：30 秒模型切换到 15 秒模型并确认后，与魔法棒共用正文居中转圈及 Toast；1.5 秒后提示生成完成，原型保留原提示词与分镜内容。
  function runPromptOptimization({ adaptingDuration = false } = {}) {
    if (optimizeButton.disabled || !optimizeLoading) return;
    const loadingToast = optimizeLoading.querySelector('.detail-prompt-optimize-toast');
    if (loadingToast) loadingToast.textContent = adaptingDuration ? '正在生成适配 15 秒的提示词…' : '正在优化生成提示词';
    optimizeButton.disabled = true;
    optimizeButton.setAttribute('aria-busy', 'true');
    optimizeLoading.hidden = false;
    window.clearTimeout(optimizeTimer);
    optimizeTimer = window.setTimeout(() => {
      optimizeLoading.hidden = true;
      optimizeButton.disabled = false;
      optimizeButton.removeAttribute('aria-busy');
      select('prompt');
      if (adaptingDuration) window.dispatchEvent(new Event('detail-prompt-adapt-complete'));
    }, 1500);
  }
  optimizeButton?.addEventListener('click', () => runPromptOptimization());
  window.addEventListener('detail-prompt-adapt-duration', () => runPromptOptimization({ adaptingDuration: true }));

  function closeSyncConfirmModal() {
    if (syncConfirmModal) syncConfirmModal.hidden = true;
  }

  function continueVideoGeneration() {
    bypassGenerateConfirmation = true;
    generateButton?.click();
    bypassGenerateConfirmation = false;
  }

  // 2026-09-16 改动逻辑：仅当分镜存在未同步编辑时拦截原生成点击；无修改或用户已作选择后继续沿用 app.js 的既有生成流程。
  generateButton?.addEventListener('click', event => {
    if (bypassGenerateConfirmation || !storyboardChanged) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (syncConfirmModal) syncConfirmModal.hidden = false;
    generateWithoutSyncButton?.focus();
  }, true);

  generateWithoutSyncButton?.addEventListener('click', () => {
    closeSyncConfirmModal();
    continueVideoGeneration();
  });

  syncAndGenerateButton?.addEventListener('click', () => {
    closeSyncConfirmModal();
    syncStoryboard(continueVideoGeneration);
  });

  // 2026-09-16 改动逻辑：点击遮罩或按 Escape 只关闭确认弹窗，不擅自选择同步策略，也不触发生成。
  syncConfirmModal?.addEventListener('click', event => {
    if (event.target === syncConfirmModal) closeSyncConfirmModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || syncConfirmModal?.hidden !== false) return;
    closeSyncConfirmModal();
    generateButton?.focus();
  });
  // @ 入口需要可见编辑器承接插入位置，点击时自动进入提示词视图。
  document.getElementById('detailMentionButton')?.addEventListener('click', () => select('prompt'), true);
  // 2026-10-11 改动逻辑：为生成历史提供轻量快照接口；默认分镜用于首次登记 V1，捕获时读取真实九列，恢复时取消旧同步/优化计时器并强制重绘，提示词视图仍由既有切换入口管理。
  window.vinaDetailStoryboardHistory = {
    defaultRows(hasPrompt) { return JSON.stringify(hasPrompt ? buildRows() : [Array(9).fill('')]); },
    capture() {
      const activeShot = document.querySelector('.episode-detail-workspace .shot-card.active');
      if (!activeShot) return;
      render();
      activeShot.dataset.storyboardRows = JSON.stringify(readCurrentRows());
      activeShot.dataset.storyboardChanged = String(storyboardChanged);
    },
    restore() {
      window.clearTimeout(syncTimer);
      window.clearTimeout(optimizeTimer);
      closeSyncConfirmModal();
      if (optimizeLoading) optimizeLoading.hidden = true;
      if (optimizeButton) { optimizeButton.disabled = false; optimizeButton.removeAttribute('aria-busy'); }
      signature = '';
      render(true);
    }
  };
  select('storyboard');
})();

/* 2026-09-26 Product Design 改动逻辑：底部分镜预览图按钮与人物站位图按钮共用一秒生成中、生成完成反馈；顶部已生成参考卡点击后才打开单张静态分镜大图，关闭时恢复入口焦点。 */
(() => {
  const openButton = document.getElementById('detailStoryboardPreview');
  const modal = document.getElementById('storyboardPreviewModal');
  const closeButton = document.getElementById('storyboardPreviewClose');
  const previewCard = document.getElementById('detailStoryboardPreviewCard');
  const positioningButton = document.getElementById('detailPositioningPreview');
  const positioningCard = document.getElementById('detailCharacterPositioningCard');
  if (!openButton || !modal || !closeButton || !previewCard || !positioningButton || !positioningCard) return;

  let restoreFocus = null;
  let toastTimer = 0;
  const refreshToast = document.createElement('div');
  refreshToast.className = 'title-toast';
  refreshToast.setAttribute('role', 'status');
  refreshToast.setAttribute('aria-live', 'polite');
  const toastIcon = document.createElement('span');
  toastIcon.className = 'title-toast-icon';
  toastIcon.setAttribute('aria-hidden', 'true');
  toastIcon.textContent = '✓';
  const toastMessage = document.createElement('span');
  refreshToast.append(toastIcon, toastMessage);
  document.body.appendChild(refreshToast);

  function openPreview(fallbackButton) {
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : fallbackButton;
    modal.hidden = false;
    document.body.classList.add('storyboard-preview-open');
    closeButton.focus();
  }

  function closePreview() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('storyboard-preview-open');
    const focusTarget = restoreFocus;
    restoreFocus = null;
    focusTarget?.focus();
  }

  function showRefreshToast(message) {
    toastMessage.textContent = message;
    refreshToast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => refreshToast.classList.remove('is-visible'), 1800);
  }

  // 2026-09-26 改动逻辑：两种参考图统一在对应卡片原位显示一秒生成中遮罩，完成后撤去遮罩并提示已生成；分镜整图由顶部卡片单独打开。
  function refreshAsset(button, card, label) {
    if (button.disabled) return;
    card.hidden = false;
    card.classList.add('is-refreshing');
    card.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    showRefreshToast(`正在生成${label}…`);
    window.setTimeout(() => {
      card.classList.remove('is-refreshing');
      card.removeAttribute('aria-busy');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      showRefreshToast(`${label}已生成`);
    }, 1000);
  }

  positioningButton.addEventListener('click', () => refreshAsset(positioningButton, positioningCard, '人物站位图'));
  openButton.addEventListener('click', () => refreshAsset(openButton, previewCard, '分镜预览图'));
  previewCard.addEventListener('click', event => {
    if (event.target.closest('.detail-reference-remove')) return;
    event.stopPropagation();
    openPreview(previewCard.querySelector('.storyboard-reference-open') || openButton);
  });
  closeButton.addEventListener('click', closePreview);
  modal.addEventListener('click', event => {
    if (event.target === modal) closePreview();
  });
  document.addEventListener('keydown', event => {
    if (modal.hidden) return;
    if (event.key === 'Escape') closePreview();
    // 2026-09-26 改动逻辑：静态预览只有关闭按钮可聚焦，Tab 焦点始终留在弹窗内。
    if (event.key === 'Tab') {
      event.preventDefault();
      closeButton.focus();
    }
  });
})();
