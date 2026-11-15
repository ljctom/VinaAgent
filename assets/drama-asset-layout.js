/* 2026-09-30 Product Design：仅重排现有资产编辑器，所有业务按钮仍为原 DOM 节点。
   左侧形象入口转发到原形象按钮；不复制提示词、图片历史、音色或生成状态。 */
(() => {
  function initialize() {
    const workspace = document.querySelector('.asset-workspace');
    const inner = workspace?.querySelector('.asset-inner');
    if (!inner || inner.querySelector('.asset-browser-sidebar')) return;
    const toolbar = inner.querySelector('.asset-toolbar');
    const actions = workspace.querySelector('.asset-stage-actions');
    const sidebar = document.createElement('aside');
    sidebar.className = 'asset-browser-sidebar';
    sidebar.setAttribute('aria-label', '资产分类与形象列表');
    const list = document.createElement('div');
    list.className = 'asset-browser-list';
    const add = document.createElement('div');
    add.className = 'asset-browser-add';
    add.append(toolbar.querySelector('#assetAddCharacter'));
    // 2026-10-26 Product Design 样式调整：画布入口使用原节点，随选中的资产移到图片工具栏；点击事件保持原样。
    const canvasControls = toolbar.querySelector('.asset-view-controls');
    actions.prepend(canvasControls);
    toolbar.querySelector('.asset-toolbar-actions').remove();
    sidebar.append(toolbar, list, add);
    inner.prepend(sidebar);
    // 2026-09-30 Product Design 改动逻辑：把三个分类的原资产网格与底部原按钮统一移入右侧面板，
    // 外框与左侧列表共用同一网格行实现等高；操作行独立占位并靠右下，不覆盖编辑内容。
    // 仅移动原 DOM 节点，保留分类切换、画布编辑、批量生成与下一步的已有事件和状态。
    const panel = document.createElement('section');
    panel.className = 'asset-browser-detail-panel';
    panel.setAttribute('aria-label', '资产预览与编辑');
    panel.append(...inner.querySelectorAll('.asset-grid'), actions);
    inner.append(panel);
    workspace.classList.add('has-asset-browser');
    const groups = new Map();
    const selectedByType = new Map();
    let queued = false;
    // 2026-11-03 Product Design：资产名称仅占一行，按实际字体和可用宽度保留完整字符，
    // 超宽部分用三个英文点替代；完整名称保存在行上，供上方浮层与辅助阅读使用。
    const nameTooltip = document.createElement('div');
    nameTooltip.className = 'asset-browser-full-name-tooltip';
    nameTooltip.id = 'asset-browser-full-name-tooltip';
    nameTooltip.setAttribute('role', 'tooltip');
    nameTooltip.hidden = true;
    document.body.append(nameTooltip);
    let tooltipRow = null;
    function hideNameTooltip() {
      tooltipRow?.removeAttribute('aria-describedby');
      tooltipRow = null;
      nameTooltip.hidden = true;
    }
    function fitRowName(row) {
      const label = row.querySelector('.drama-character-variant-copy strong');
      const fullName = row.dataset.assetFullName;
      if (!label || !fullName || !label.clientWidth) return;
      label.textContent = fullName;
      const overflow = label.scrollWidth > label.clientWidth;
      row.dataset.nameOverflow = String(overflow);
      if (overflow) {
        const characters = Array.from(fullName);
        let start = 0;
        let end = Math.max(0, characters.length - 1);
        while (start < end) {
          const middle = Math.ceil((start + end) / 2);
          label.textContent = characters.slice(0, middle).join('') + '...';
          if (label.scrollWidth <= label.clientWidth) start = middle;
          else end = middle - 1;
        }
        label.textContent = characters.slice(0, start).join('') + '...';
      }
      if (tooltipRow === row) {
        if (!overflow) hideNameTooltip();
        else nameTooltip.textContent = fullName;
      }
    }
    function showNameTooltip(row) {
      hideNameTooltip();
      if (!row || row.dataset.nameOverflow !== 'true') return;
      tooltipRow = row;
      nameTooltip.textContent = row.dataset.assetFullName;
      row.setAttribute('aria-describedby', nameTooltip.id);
      nameTooltip.hidden = false;
      // 2026-11-03 Product Design：按 UI 稿将长名称浮层放在名称文字上方居中，间距 8px；
      // 继续挂在 body 避免列表裁切，并在视口边缘保留 8px，不改名称截断及原有交互。
      const label = row.querySelector('.drama-character-variant-copy strong');
      const bounds = (label || row).getBoundingClientRect();
      const popup = nameTooltip.getBoundingClientRect();
      nameTooltip.style.left = `${Math.max(8, Math.min(bounds.left + (bounds.width - popup.width) / 2, window.innerWidth - popup.width - 8))}px`;
      nameTooltip.style.top = `${Math.max(8, bounds.top - popup.height - 8)}px`;
    }
    list.addEventListener('pointerover', event => {
      const row = event.target.closest('.asset-browser-row');
      if (row && !row.contains(event.relatedTarget)) showNameTooltip(row);
    });
    list.addEventListener('pointerout', event => {
      const row = event.target.closest('.asset-browser-row');
      if (row && !row.contains(event.relatedTarget)) hideNameTooltip();
    });
    list.addEventListener('focusin', event => showNameTooltip(event.target.closest('.asset-browser-row')));
    list.addEventListener('focusout', hideNameTooltip);
    list.addEventListener('click', hideNameTooltip);
    document.addEventListener('scroll', hideNameTooltip, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') hideNameTooltip();
    });
    // 侧栏宽度、响应式布局或字体加载改变时重新计算截断，不改变原名称数据及形象点击行为。
    function scheduleNameSync() {
      hideNameTooltip();
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; sync(); });
    }
    const nameResizeObserver = new ResizeObserver(scheduleNameSync);
    nameResizeObserver.observe(list);
    window.addEventListener('resize', scheduleNameSync);
    document.fonts?.ready.then(scheduleNameSync);
    // 2026-11-01 Product Design：仅出海转绘预览标题显示名称编辑按钮；角色后缀保持展示，
    // 只编辑共享角色名。回车或点击外部/失焦提交，中文输入法确认不误提交，Esc 放弃。
    const nameEditors = new WeakMap();
    // 2026-11-02 Product Design：三类转绘资产按自己的来源显示原图；场景与物品使用新增的 16:9 压缩 JPG，避免借用人物原图。
    function getOriginalImage(card, editor) {
      const fallback = card.dataset.assetGroupType === 'scene'
        ? (card.dataset.assetGroupName === '旧实验楼走廊' ? 'corridor' : 'classroom')
        : card.dataset.assetGroupType === 'prop' ? 'archive-bag' : 'linyu';
      return editor?.dataset.redrawOriginalImage || `./assets/images/redraw-original/${fallback}.jpg`;
    }
    function installNameEditor(card, title) {
      if (!document.documentElement.classList.contains('redraw-embedded')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'redraw-asset-name-control';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'redraw-asset-name-edit';
      const icon = document.createElement('img');
      icon.src = './assets/icons/review-annotation/pencil.svg';
      icon.alt = '';
      // 2026-11-01 Product Design：编辑按钮 hover 或键盘聚焦时展示独立提示浮层，
      // 角色文案固定为“编辑角色名”；场景与物品随当前资产类型显示对应名字提示。
      const tooltip = document.createElement('span');
      tooltip.className = 'redraw-asset-name-tooltip';
      tooltip.id = `${title.id}-rename-tooltip`;
      tooltip.setAttribute('role', 'tooltip');
      edit.setAttribute('aria-describedby', tooltip.id);
      edit.append(icon, tooltip);
      title.before(wrapper);
      wrapper.append(title, edit);
      const state = { input: null, edit, title, tooltip };
      nameEditors.set(card, state);
      function finish(cancel = false) {
        if (!state.input) return;
        const name = state.input.value;
        state.input = null;
        if (!cancel) {
          const detail = { name, saved: false };
          card.dispatchEvent(new CustomEvent('vina:rename-redraw-asset', { detail }));
        }
        sync();
      }
      edit.addEventListener('click', () => {
        if (state.input) { state.input.focus(); return; }
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'redraw-asset-name-input';
        input.value = card.dataset.assetGroupName || '';
        input.maxLength = 60;
        input.setAttribute('aria-label', edit.getAttribute('aria-label'));
        input.autocomplete = 'off';
        input.spellcheck = false;
        // 2026-11-01 Product Design：名称编辑框至少按 12em 展开，短名字也保留充足输入空间；长名字仍按字数扩展，最多 20em。
        input.style.width = `${Math.max(12, Math.min(20, input.value.length * 2))}em`;
        state.input = input;
        title.querySelector('[data-redraw-asset-name]').replaceWith(input);
        input.addEventListener('blur', () => finish());
        input.addEventListener('keydown', event => {
          if (event.isComposing || event.keyCode === 229) return;
          if (event.key !== 'Enter' && event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          finish(event.key === 'Escape');
          edit.focus({ preventScroll: true });
        });
        input.focus();
        input.select();
      });
      // pointerdown 覆盖点击不可聚焦的图片和空白处，避免仅依赖 blur 漏掉确认。
      document.addEventListener('pointerdown', event => {
        if (state.input && !wrapper.contains(event.target)) finish();
      }, true);
    }
    function syncPreviewName(card, title, source) {
      const state = nameEditors.get(card);
      if (!state) { title.textContent = displayName(card, source); return; }
      const label = { character: '角色', scene: '场景', prop: '物品' }[card.dataset.assetGroupType];
      const editLabel = `编辑${label}名`;
      state.edit.setAttribute('aria-label', editLabel);
      state.tooltip.textContent = editLabel;
      state.edit.disabled = card.getAttribute('aria-busy') === 'true';
      if (state.input) return; // 资产状态刷新时保留用户正在输入的名称和光标。
      const name = document.createElement('span');
      name.dataset.redrawAssetName = '';
      name.textContent = card.dataset.assetGroupName;
      const suffix = document.createElement('span');
      suffix.className = 'redraw-asset-name-suffix';
      suffix.textContent = displayName(card, source).slice(card.dataset.assetGroupName.length);
      title.replaceChildren(name, suffix);
    }

    // 保留每个分类的选中资产；只改变卡片显示，不重建编辑器或清空用户输入。
    function select(card) {
      selectedByType.set(card.dataset.assetGroupType, card);
      sync();
    }
    function arrange(card) {
      const editor = card.querySelector('.is-inline-editor');
      const right = editor?.querySelector('.drama-character-editor-right');
      if (!right || right.querySelector('.asset-preview-region')) return;
      const details = editor.querySelector('.drama-character-editor-left');
      const title = editor.querySelector('.drama-character-editor-head h2');
      const previewHead = right.querySelector('.drama-character-preview-head');
      const preview = document.createElement('section');
      preview.className = 'asset-preview-region';
      preview.setAttribute('aria-label', '当前使用图片');
      const editing = document.createElement('section');
      editing.className = 'asset-edit-region';
      editing.setAttribute('aria-label', '资产描述、音色与图片生成');
      // 2026-09-30 Product Design 改动逻辑：把原标题节点移进图片卡片首行，和“当前使用图片”并列；保留标题 id，继续供无障碍标签和原编辑器逻辑复用。
      title.classList.add('asset-preview-title');
      title.dataset.assetPreviewTitle = '';
      previewHead.prepend(title);
      installNameEditor(card, title);
      // 2026-09-30 Product Design 改动逻辑：预览卡只保留当前图片；原形象按钮留在 details 中供左侧单层卡片转发点击，资产页不再重复展示切换条。
      // 2026-10-26 Product Design 样式调整：增加纯展示用的点阵底板，图片仍由原节点和原脚本更新，保持 contain 完整显示。
      const previewSurface = document.createElement('div');
      previewSurface.className = 'asset-preview-surface';
      const currentImage = right.querySelector('[data-character-current]');
      // 2026-11-02 Product Design：出海转绘角色、场景和物品都展示“原图 | 转绘图”。
      // 场景与物品左右等宽、图片均为 16:9；复用原结果节点及大图预览绑定，保留待生成、生成中和历史切换状态，普通短剧仍为单图。
      if (document.documentElement.classList.contains('redraw-embedded')) {
        previewSurface.classList.add('redraw-character-comparison');
        if (card.dataset.assetGroupType !== 'character') previewSurface.classList.add('redraw-wide-comparison');
        const originalPane = document.createElement('section');
        originalPane.className = 'redraw-character-pane redraw-character-original';
        const originalLabel = document.createElement('h3');
        originalLabel.className = 'redraw-character-image-label';
        originalLabel.textContent = '原图';
        const originalBody = document.createElement('div');
        originalBody.className = 'redraw-character-pane-body';
        const originalImage = document.createElement('img');
        originalImage.className = 'redraw-character-original-image';
        originalImage.dataset.redrawOriginalPreview = '';
        // 2026-11-01：对照原图使用本地压缩 JPG，避免加载大体积 PNG。
        originalImage.src = getOriginalImage(card, editor);
        originalImage.alt = `${card.dataset.assetGroupName}原图`;
        originalImage.draggable = false;
        originalBody.append(originalImage);
        originalPane.append(originalLabel, originalBody);
        const divider = document.createElement('div');
        divider.className = 'redraw-character-image-divider';
        divider.setAttribute('aria-hidden', 'true');
        const resultPane = document.createElement('section');
        resultPane.className = 'redraw-character-pane redraw-character-result';
        const resultLabel = document.createElement('h3');
        resultLabel.className = 'redraw-character-image-label';
        resultLabel.textContent = '转绘图';
        const resultBody = document.createElement('div');
        resultBody.className = 'redraw-character-pane-body';
        resultBody.append(currentImage);
        resultPane.append(resultLabel, resultBody);
        previewSurface.append(originalPane, divider, resultPane);
      } else {
        previewSurface.append(currentImage);
      }
      preview.append(previewHead, previewSurface);
      // 描述、音色与原形象按钮留在 details 容器内，确保类型隐藏规则和事件代理继续生效。
      editing.append(details, ...Array.from(right.children));
      // 2026-09-30 Product Design 改动逻辑：把原参数和生成按钮节点移入提示词外框底部，保留事件与菜单状态。
      // 只有 textarea 可输入；操作栏显式不可编辑，与正文独立占位，输入或滚动不会覆盖按钮行。
      const promptField = editing.querySelector('.drama-character-prompt-field');
      const sourceActions = editing.querySelector('.drama-character-source-actions');
      sourceActions.setAttribute('contenteditable', 'false');
      promptField.append(sourceActions);
      // 2026-10-26 Product Design 样式调整：参照 UI 稿子重排现有编辑器。
      // 仅新增展示容器并移动原节点；保留描述可编辑状态、确认按钮、输入框、音色控件及所有事件，不复制原稿新增的编辑/取消/预览行为。
      const profile = document.createElement('aside');
      profile.className = 'asset-settings-panel asset-profile-inspector';
      const profileHead = document.createElement('header');
      profileHead.className = 'asset-profile-heading';
      const profileTitle = document.createElement('h3');
      const isCharacter = card.dataset.assetGroupType === 'character';
      profileTitle.textContent = isCharacter ? '角色信息' : card.dataset.assetGroupType === 'scene' ? '场景资料' : '物品资料';
      profile.setAttribute('aria-label', profileTitle.textContent);
      profileHead.append(profileTitle);
      profile.append(profileHead, details);
      const descriptionActions = details.querySelector('.drama-character-description-actions');
      if (isCharacter && descriptionActions) profileHead.append(descriptionActions);
      // 2026-10-27 Product Design 改动逻辑：与“UI 稿最新”一样新建 header 承载图片提示词标题，
      // 不复用带 style="margin-top:14px" 的旧段落；移除旧节点后由现有标题栏 CSS 统一
      // 49px 高度、24px 行高和上下内边距，使文字与左侧角色信息垂直对齐，分隔线保持同高。
      const oldPromptLabel = Array.from(editing.children).find(node => node.matches('.drama-character-section-label'));
      const promptLabel = document.createElement('header');
      promptLabel.className = 'asset-generation-heading';
      promptLabel.textContent = '图片提示词';
      oldPromptLabel?.remove();
      // 提示词外框继续保留，参数、参考图、生成按钮均为原节点，数据属性及输入绑定不变。
      promptField.classList.add('asset-generation-panel');
      editing.replaceChildren(promptLabel, promptField);
      // 2026-10-27 Product Design：第四步资产页不再添加“参考设置”文字，保留原比例、清晰度及参数菜单交互。
      right.classList.add('has-inspector-layout');
      if (isCharacter) {
        profile.classList.add('asset-character-profile');
        const lowerRow = document.createElement('div');
        lowerRow.className = 'asset-character-edit-row';
        const voiceInspector = document.createElement('aside');
        voiceInspector.className = 'asset-settings-panel asset-profile-inspector asset-voice-inspector';
        voiceInspector.setAttribute('aria-label', '音色绑定');
        const voiceHead = document.createElement('header');
        voiceHead.className = 'asset-profile-heading';
        const voiceTitle = document.createElement('h3');
        voiceTitle.textContent = '音色绑定';
        voiceHead.append(voiceTitle);
        voiceInspector.append(voiceHead);
        const voice = details.querySelector('.drama-character-voice-section');
        if (voice) voiceInspector.append(voice);
        lowerRow.append(profile, editing);
        // 2026-10-27 Product Design 改动逻辑：预览与下方双面板之间新增整行拖动条。
        // 向上拖增加下方共同高度，预览占用剩余空间，contain 图片随预览等比缩小。
        // 限制下方至少 284px、预览至少 240px；指针捕获支持拖出分隔条后继续调整。
        const separator = document.createElement('div');
        separator.className = 'asset-character-height-resizer';
        separator.tabIndex = 0;
        separator.setAttribute('role', 'separator');
        separator.setAttribute('aria-orientation', 'horizontal');
        separator.setAttribute('aria-label', '上下拖动调整图片预览与角色信息、图片提示词高度');
        const setHeight = value => {
          const gap = parseFloat(getComputedStyle(right).rowGap) || 16;
          const maximum = Math.max(284, right.clientHeight - gap - 240);
          const height = Math.round(Math.max(284, Math.min(maximum, value)));
          right.style.setProperty('--asset-edit-height', `${height}px`);
          separator.setAttribute('aria-valuemin', '284');
          separator.setAttribute('aria-valuemax', String(Math.round(maximum)));
          separator.setAttribute('aria-valuenow', String(height));
        };
        let drag = null;
        separator.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.preventDefault();
          drag = { id:event.pointerId, y:event.clientY, height:lowerRow.getBoundingClientRect().height };
          separator.setPointerCapture(event.pointerId);
          document.documentElement.classList.add('is-resizing-asset-panels');
        });
        separator.addEventListener('pointermove', event => {
          if (drag?.id !== event.pointerId) return;
          setHeight(drag.height + drag.y - event.clientY);
        });
        const finishResize = event => {
          if (drag?.id !== event.pointerId) return;
          drag = null;
          document.documentElement.classList.remove('is-resizing-asset-panels');
          if (separator.hasPointerCapture(event.pointerId)) separator.releasePointerCapture(event.pointerId);
        };
        separator.addEventListener('pointerup', finishResize);
        separator.addEventListener('pointercancel', finishResize);
        separator.addEventListener('lostpointercapture', finishResize);
        // 键盘上下方向键每次调整 16px，与指针拖动共用同样的边界。
        separator.addEventListener('keydown', event => {
          if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          setHeight(lowerRow.getBoundingClientRect().height + (event.key === 'ArrowUp' ? 16 : -16));
        });
        lowerRow.append(separator);
        right.classList.add('has-character-profile-layout');
        right.append(preview, lowerRow, voiceInspector);
      } else {
        right.append(preview, editing, profile);
      }
    }
    function displayName(card, source) {
      const groupName = card.dataset.assetGroupName || '';
      const rawName = source?.querySelector('.drama-character-variant-copy strong')?.textContent?.trim() || groupName;
      const variantName = rawName === groupName ? (card.dataset.assetGroupType === 'character' ? '基础形象' : '') : rawName.startsWith(`${groupName}-`) ? rawName.slice(groupName.length + 1) : rawName;
      // 2026-11-03 改动逻辑：短剧资产中的班主任补充姓名；内部角色键仍沿用原值，
      // 确保图片、音色与生成状态继续绑定同一角色，出海转绘的可编辑名称沿用其原有逻辑。
      // 2026-11-03 改动逻辑：名称统一为“班主任张文涛”，不留空格并去掉“老师”二字；列表、预览标题和完整文案浮层共用此名称。
      const shownGroupName = groupName === '班主任' && !document.documentElement.classList.contains('redraw-embedded')
        ? '班主任张文涛' : groupName;
      return variantName ? `${shownGroupName} · ${variantName}` : shownGroupName;
    }
    // 2026-11-05 Product Design：按角色形象、场景、物品的列表顺序为图片编号。
    // 全页加载结束时一起计时，奇数 4 秒、偶数 15 秒；切换分类或重绘时沿用原编号。
    let promptRun = null;
    function stopPromptWaiting() {
      if (!promptRun) return;
      promptRun.timers.forEach(timer => window.clearTimeout(timer));
      promptRun = null;
      sync();
    }
    workspace.addEventListener('vina:asset-prompt-waiting', () => {
      stopPromptWaiting();
      promptRun = { oddFinished: false, nextIndex: 0, indexes: new WeakMap(), timers: [] };
      promptRun.timers.push(window.setTimeout(() => {
        promptRun.oddFinished = true;
        sync();
      }, 4000), window.setTimeout(stopPromptWaiting, 15000));
      sync();
    });
    window.addEventListener('vina-view-changed', event => {
      if (event.detail?.target !== 'asset-library') stopPromptWaiting();
    });

    function syncPromptWaiting(card, row, source) {
      const copy = row.querySelector('.drama-character-variant-copy');
      if (!copy || !source) return;
      let waiting = false;
      if (promptRun) {
        let indexes = promptRun.indexes.get(card);
        if (!indexes) {
          indexes = new Map();
          promptRun.indexes.set(card, indexes);
        }
        const key = source.dataset.assetPromptVariant ?? source.dataset.characterVariantIndex;
        if (!indexes.has(key)) indexes.set(key, ++promptRun.nextIndex);
        waiting = !promptRun.oddFinished || indexes.get(key) % 2 === 0;
      }
      // 只覆盖侧栏显示，等待结束后恢复原图片和最新状态。
      const label = copy.querySelector('.asset-prompt-waiting');
      row.classList.toggle('is-asset-prompt-generating', waiting);
      if (waiting && !label) {
        const status = document.createElement('span');
        status.className = 'asset-prompt-waiting';
        status.dataset.characterGenerationCopy = 'promptGenerating';
        status.textContent = '提示词生成中...';
        row.setAttribute('aria-label', `${row.dataset.assetFullName} · ${status.textContent}`);
        copy.append(status);
      } else if (!waiting && label) {
        label.remove();
        row.setAttribute('aria-label', `${row.dataset.assetFullName} · ${source.querySelector('.drama-character-variant-copy span')?.textContent?.trim() || ''}`);
      }
    }

    function sync() {
      observer.disconnect();
      const type = toolbar.querySelector('.asset-tab.active')?.dataset.assetPanelTarget || 'character';
      const cards = Array.from(inner.querySelectorAll('.asset-grid > [data-asset-group-name]'));
      const current = cards.filter(card => card.dataset.assetGroupType === type);
      if (!current.includes(selectedByType.get(type))) selectedByType.set(type, current[0]);
      for (const card of cards) {
        arrange(card);
        let group = groups.get(card);
        if (!group) {
          group = document.createElement('section');
          group.className = 'asset-browser-group';
          // 2026-09-30 Product Design 改动逻辑：每个形象仍是独立可点的行；仅多形象角色在外层显示柔和背景，不增加重复角色标题。
          group.append(document.createElement('div'));
          list.append(group);
          groups.set(card, group);
        }
        // 2026-10-27 Product Design 改动逻辑：按“UI 稿最新”的分组标记区分角色与其他资产；
        // 同一角色的基础形象、变装和其他形象继续共用一个 group，单形象角色也独立成组。
        // 每次同步更新类型，使新增角色和卡片归还列表时同样使用角色外框，形象点击和状态同步沿用原逻辑。
        group.dataset.assetGroupType = card.dataset.assetGroupType;
        const selected = selectedByType.get(type) === card;
        card.classList.toggle('is-browser-selected', selected);
        // 2026-10-26 Product Design 样式调整：共用的原画布按钮只随选中卡片调整展示位置，不增加或替换点击处理。
        if (selected) {
          const previewActions = card.querySelector('.asset-preview-region .drama-character-preview-actions');
          if (previewActions && canvasControls.parentElement !== previewActions) previewActions.prepend(canvasControls);
          // 2026-11-02 Product Design：角色操作组仍放音色栏；出海转绘场景、物品改放当前资料栏底部。
          // 只移动原按钮，保留积分、全量生成及下一步事件和显隐；避免回退到整个资产容器后形成横跨页面的浮层、挡住左下添加入口。
          const actionHost = card.querySelector('.asset-voice-inspector')
            || (document.documentElement.classList.contains('redraw-embedded') ? card.querySelector('.asset-profile-inspector') : null)
            || inner;
          if (actions.parentElement !== actionHost) actionHost.append(actions);
        }
        group.hidden = card.dataset.assetGroupType !== type;
        group.classList.toggle('is-selected', selected);
        const sourceButtons = Array.from(card.querySelectorAll('[data-character-variant-index]'));
        // 2026-09-30 Product Design 改动逻辑：标题跟随当前选中的形象更新，切换左侧形象后不会只剩角色名；单形象的场景与物品维持原名。
        const activeSource = sourceButtons.find(button => button.classList.contains('active')) || sourceButtons[0];
        const previewTitle = card.querySelector('[data-asset-preview-title]');
        if (previewTitle) syncPreviewName(card, previewTitle, activeSource);
        // 2026-11-01：只更新独立原图 img 的地址与无障碍说明，不复制或修改转绘结果节点。
        const originalPreview = card.querySelector('[data-redraw-original-preview]');
        if (originalPreview) {
          const original = getOriginalImage(card, card.querySelector('.is-inline-editor'));
          if (originalPreview.getAttribute('src') !== original) originalPreview.src = original;
          originalPreview.alt = `${displayName(card, activeSource)}原图`;
        }
        group.classList.toggle('is-multi-variant', card.dataset.assetGroupType === 'character' && sourceButtons.length > 1);
        // 2026-09-30 Product Design 修复逻辑：选中态由下方逐行同步，不纳入重建签名；
        // 避免仅切换 active 就替换整组按钮，保留鼠标目标与键盘焦点，内容或生成状态变化时仍正常重建。
        const signature = JSON.stringify(sourceButtons.map(button => [button.innerHTML, button.getAttribute('aria-label')]));
        if (group.dataset.signature !== signature) {
          group.dataset.signature = signature;
          const rows = sourceButtons.map((source, index) => {
            const row = source.cloneNode(true);
            row.removeAttribute('data-character-variant-index');
            row.className = 'asset-browser-row';
            row.dataset.variantIndex = String(index);
            // 2026-09-30 Product Design 改动逻辑：列表和图片标题共用同一名称格式，基础形象自动补名，场景和物品不重复。
            const name = displayName(card, source);
            row.dataset.assetFullName = name;
            row.querySelector('.drama-character-variant-copy strong').textContent = name;
            // 2026-09-30 Product Design 修复逻辑：名称和状态已在行内展示，只保留完整辅助名称；
            // 克隆时移除原按钮的 title，不再生成浏览器原生提示，避免重绘或切页后灰色标签残留。
            row.removeAttribute('title');
            row.setAttribute('aria-label', `${name} · ${source.querySelector('.drama-character-variant-copy span')?.textContent?.trim() || ''}`);
            row.addEventListener('click', () => {
              select(card);
              // 重新查询原按钮，避免生成或历史切换重绘后引用已经脱离页面的按钮。
              card.querySelectorAll('[data-character-variant-index]')[index]?.click();
              sync();
            });
            return row;
          });
          if (!rows.length) {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'asset-browser-row is-loading';
            row.textContent = `${card.dataset.assetGroupName} · 正在加载资产…`;
            row.addEventListener('click', () => select(card));
            rows.push(row);
          }
          group.lastElementChild.replaceChildren(...rows);
        }
        group.querySelectorAll('.asset-browser-row').forEach((row, index) => {
          const active = selected && Boolean(sourceButtons[index]?.classList.contains('active'));
          row.classList.toggle('active', active);
          row.setAttribute('aria-pressed', String(active));
          syncPromptWaiting(card, row, sourceButtons[index]);
          fitRowName(row);
        });
      }
      if (tooltipRow && !tooltipRow.isConnected) hideNameTooltip();
      // 分集编辑弹窗会临时借走原卡片；保留分组引用，归还时自动恢复原选中项。
      for (const [card, group] of groups) {
        if (!card.isConnected) { group.remove(); groups.delete(card); }
      }
      observer.observe(inner, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'title', 'aria-busy', 'data-redraw-original-image'] });
    }
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; sync(); });
    });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
