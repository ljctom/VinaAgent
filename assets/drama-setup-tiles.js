// 2026-10-25 阿语适配：摘要从 sourceText 读取规范值，并忽略仅由译文显示产生的字符变动，避免语言观察器与摘要观察器反复写入；其他语言沿用原逻辑。
// 2026-09-30 Product Design 改动逻辑：仅重排已有设定节点，保留原事件、草稿、选项和自定义保存逻辑；
// 十一个摘要按钮位于爆款预设下方，浮层在按钮区下方展开，选中摘要仅从现有 DOM/草稿读取。
(() => {
  const installed = new WeakSet();
  // 2026-09-30 Product Design 改动逻辑：六项设置改用 ego 提取的 Liblib 原始 SVG，集数复用其剧本结构图标；只更换资源引用，不改按钮与业务逻辑。
  const icons = {
    count: 'liblib-setup/structures.svg', ratio: 'review-annotation/square.svg', country: 'profile-language.svg',
    style: 'liblib-setup/style.svg', genre: 'message-square-text.svg',
    audiences: 'liblib-setup/audiences.svg', roles: 'liblib-setup/roles.svg',
    eras: 'liblib-setup/eras.svg', hooks: 'liblib-setup/hooks.svg',
    tones: 'message-square-text.svg', structures: 'liblib-setup/structures.svg'
  };
  let serial = 0;
  function decorateButton(button, label, key, valueNode) {
    const icon = document.createElement('span');
    icon.className = 'setup-tile-icon';
    const image = document.createElement('img');
    // 2026-10-02：模型按钮使用独立芯片图标，与菜单中各厂商模型图标区分。
    image.src = key === 'model' ? 'https://api.iconify.design/lucide/cpu.svg' : './assets/icons/' + icons[key];
    image.alt = '';
    icon.append(image);
    const copy = document.createElement('span');
    copy.className = 'setup-tile-copy';
    const title = document.createElement('span');
    title.className = 'setup-tile-label';
    title.textContent = label;
    valueNode.classList.add('setup-tile-value');
    copy.append(title, valueNode);
    button.replaceChildren(icon, copy);
    button.classList.add('setup-tile-button');
  }
  function install(panel) {
    if (installed.has(panel)) return;
    const presets = panel.querySelector('.script-setup-presets');
    const grid = panel.querySelector('[data-script-setup-choice-groups]');
    if (!presets || !grid) return;
    installed.add(panel);
    if (!panel.classList.contains('has-setup-tiles')) {
      panel.classList.add('has-setup-tiles');
      grid.classList.add('setup-tile-grid');
      const groups = [...grid.querySelectorAll('[data-script-setup-choice-key]')];
      const wrap = (label, key, nodes) => {
        const slot = document.createElement('div');
        slot.className = 'setup-tile-slot';
        slot.dataset.setupTile = key;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.setupTileToggle = '';
        decorateButton(button, label, key, document.createElement('span'));
        const popup = document.createElement('div');
        popup.className = 'setup-tile-popup';
        popup.hidden = true;
        popup.setAttribute('role', 'region');
        popup.setAttribute('aria-label', label);
        popup.append(...nodes);
        slot.append(button, popup);
        return slot;
      };
      const fields = [...panel.querySelectorAll('.script-setup-settings > .script-setup-field')];
      fields.forEach((field, index) => {
        const key = ['count', 'ratio', 'country'][index];
        const label = field.querySelector(':scope > span');
        const control = field.querySelector(':scope > div');
        const trigger = control.querySelector('button');
        const value = trigger.querySelector('span');
        field.classList.add('setup-tile-slot', 'setup-tile-native');
        field.dataset.setupTile = key;
        decorateButton(trigger, label.textContent, key, value);
        label.remove();
        control.classList.add('setup-tile-native-control');
        control.querySelector('.episode-count-popover').classList.add('setup-tile-popup');
      });
      const settings = panel.querySelector('.script-setup-settings');
      const tabs = panel.querySelector('.script-setup-tabs');
      const styleLabel = tabs.previousElementSibling;
      const style = wrap('画风', 'style', [styleLabel, tabs,
        panel.querySelector('[data-script-setup-style-grid]'), panel.querySelector('[data-script-setup-custom]')]);
      const genre = wrap('题材', 'genre', [panel.querySelector('.script-setup-genres')]);
      const choices = groups.map(group => wrap(group.querySelector('.script-setup-choice-title').childNodes[0].textContent.trim(), group.dataset.scriptSetupChoiceKey, [group]));
      // 2026-10-02 Product Design 改动逻辑：在集数和比例之间插入模型卡片；模型菜单沿用设定网格下方展开的弹窗结构。
      const modelSlot = wrap('模型', 'model', []);
      const modelList = document.createElement('div');
      modelList.className = 'setup-model-list';
      modelList.setAttribute('role', 'listbox');
      modelList.setAttribute('aria-label', '选择视频模型');
      (window.vinaSetupVideoModels?.catalog || []).forEach(model => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'drama-model-option';
        option.dataset.setupVideoModelOption = model.name;
        option.setAttribute('role', 'option');
        const icon = document.createElement('span');
        icon.className = 'drama-model-icon';
        const image = document.createElement('img');
        image.src = './assets/images/' + model.icon;
        image.alt = '';
        icon.append(image);
        const copy = document.createElement('span');
        copy.className = 'drama-model-copy';
        const name = document.createElement('span');
        name.className = 'drama-model-name';
        name.textContent = model.name;
        const duration = document.createElement('span');
        duration.className = 'drama-model-duration';
        duration.textContent = model.segmentSeconds + '秒';
        name.append(duration);
        const description = document.createElement('span');
        description.className = 'drama-model-description';
        description.textContent = model.description;
        copy.append(name, description);
        option.append(icon, copy);
        modelList.append(option);
      });
      modelSlot.querySelector('.setup-tile-popup').append(modelList);
      grid.replaceChildren(fields[0], modelSlot, ...fields.slice(1), style, genre, ...choices);
      settings.remove();
      // 2026-09-30 Product Design 改动逻辑：按钮上方新增“设定”，复用爆款预设标题容器及文字类；
      // 标题与网格一起被右侧面板克隆，安装时只创建一次，不影响现有选项和草稿逻辑。
      const heading = document.createElement('div');
      heading.className = 'script-setup-presets-heading setup-tile-heading';
      const headingLabel = document.createElement('span');
      headingLabel.className = 'script-setup-label';
      headingLabel.textContent = '设定';
      heading.append(headingLabel);
      presets.after(heading, grid);
    }

    // 2026-09-30 改动逻辑：右侧面板克隆时只重新绑定样式层的展开事件，原业务绑定仍由 app.js 创建；
    // 为每份副本分配独立 aria-controls，避免首次面板和右侧草稿指向同一个浮层。
    // 2026-10-02 Product Design 改动逻辑：“比例”升级为“参数”；两行各自独立必选，既有比例节点只移动以保留原事件，清晰度默认720p。
    const parameterSlot = grid.querySelector('[data-setup-tile="ratio"]');
    const parameterPopup = parameterSlot?.querySelector('.setup-tile-popup');
    const dimensions = { '9:16':[14,25], '16:9':[25,14], '1:1':[22,22], '3:4':[18,24], '4:3':[24,18] };
    function sizeRatioIcon(image, ratio) {
      const [width,height] = dimensions[ratio] || dimensions['9:16'];
      image.style.width = width + 'px';
      image.style.height = height + 'px';
      image.style.objectFit = 'fill';
    }
    if (parameterSlot) {
      parameterSlot.querySelector('.setup-tile-label').textContent = '参数';
      parameterPopup.classList.add('setup-parameter-popup');
      parameterPopup.setAttribute('role','region');
      parameterPopup.setAttribute('aria-label','视频参数');
      if (!parameterPopup.querySelector('.setup-parameter-ratios')) {
        const ratioRow = document.createElement('div');
        ratioRow.className = 'setup-parameter-ratios';
        ratioRow.setAttribute('role','listbox');
        ratioRow.setAttribute('aria-label','比例');
        ratioRow.setAttribute('aria-required','true');
        parameterPopup.querySelectorAll('[data-script-setup-ratio-option]').forEach(option => {
          const image = document.createElement('img');
          image.src = './assets/icons/review-annotation/square.svg';
          image.alt = '';
          image.className = 'setup-ratio-option-icon';
          sizeRatioIcon(image,option.dataset.scriptSetupRatioOption);
          option.prepend(image);
          ratioRow.append(option);
        });
        const qualityRow = document.createElement('div');
        qualityRow.className = 'setup-parameter-qualities';
        qualityRow.setAttribute('role','listbox');
        qualityRow.setAttribute('aria-label','清晰度');
        qualityRow.setAttribute('aria-required','true');
        ['480p','720p','1080p','4k'].forEach(quality => {
          const option = document.createElement('button');
          option.type = 'button';
          option.className = 'episode-count-option';
          option.dataset.setupQualityOption = quality;
          option.textContent = quality;
          option.setAttribute('role','option');
          qualityRow.append(option);
        });
        const ratioTitle = document.createElement('div');
        ratioTitle.className = 'setup-parameter-row-title';
        ratioTitle.textContent = '比例';
        const qualityTitle = ratioTitle.cloneNode();
        qualityTitle.textContent = '清晰度';
        parameterPopup.replaceChildren(ratioTitle,ratioRow,qualityTitle,qualityRow);
      }
      parameterPopup.querySelectorAll('[data-script-setup-ratio-option]').forEach(option => {
        option.addEventListener('click', () => queueMicrotask(() => {
          // 比例原事件写回后保持弹窗展开，便于继续选择第二行清晰度。
          parameterPopup.hidden = false;
          sync();
        }));
      });
      parameterPopup.querySelectorAll('[data-setup-quality-option]').forEach(option => {
        option.addEventListener('click', () => {
          const quality = option.dataset.setupQualityOption;
          if (panel.__scriptSetupDraft) {
            panel.__scriptSetupDraft.quality = quality;
            panel.dispatchEvent(new CustomEvent('vina-setup-quality-change', { detail:{quality} }));
          } else window.vinaSetupVideoModels?.setQuality(quality);
          sync();
        });
      });
    }
    const slots = [...grid.querySelectorAll('.setup-tile-slot')];
    slots.forEach(slot => {
      const button = slot.querySelector('.setup-tile-button');
      const popup = slot.querySelector('.setup-tile-popup');
      popup.id = 'script-setup-tile-popup-' + (++serial);
      popup.hidden = true;
      button.setAttribute('aria-controls', popup.id);
      button.setAttribute('aria-expanded', 'false');
      if (button.hasAttribute('data-setup-tile-toggle')) {
        button.addEventListener('click', () => {
          popup.hidden = !popup.hidden;
          sync();
        });
      }
    });
    // 2026-10-02：原面板直接修改正式设定，编辑副本只修改独立草稿；选择后保持向下弹窗展开并同步当前模型摘要。
    const modelSlot = grid.querySelector('[data-setup-tile="model"]');
    modelSlot?.addEventListener('click', event => {
      const option = event.target.closest('[data-setup-video-model-option]');
      if (!option) return;
      const model = option.dataset.setupVideoModelOption;
      if (panel.__scriptSetupDraft) {
        panel.__scriptSetupDraft.model = model;
        panel.dispatchEvent(new CustomEvent('vina-setup-model-change', { detail: { model } }));
      } else window.vinaSetupVideoModels?.set(model);
      // 2026-10-02 Product Design 改动逻辑：选中模型后保留弹窗展开，仅更新绿色选中框与卡片摘要；收起仍由再次点击模型卡片、切换其他设定、外部点击或 Escape 触发。
      sync();
    });
    panel.addEventListener('vina-setup-model-sync', sync);
    function close(except) {
      slots.forEach(slot => {
        if (slot === except) return;
        slot.querySelector('.setup-tile-popup').hidden = true;
        slot.querySelector('.setup-tile-button').setAttribute('aria-expanded', 'false');
      });
    }
    // 捕获阶段只收起其他浮层，不拦截选项事件；保留多选后继续展开、自定义输入和确认修改。
    panel.addEventListener('click', event => close(event.target.closest('.setup-tile-slot')), true);
    panel.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const open = slots.find(slot => !slot.querySelector('.setup-tile-popup').hidden);
      if (open) {
        event.stopPropagation();
        close();
        open.querySelector('.setup-tile-button').focus();
      }
    });
    const selected = selector => [...panel.querySelectorAll(selector)].map(node => (window.VinaArabic?.active ? window.VinaArabic.sourceText(node) : node.textContent).trim()).join('、');
    const observer = new MutationObserver(records => {
      if (window.VinaArabic?.active && records.every(record => window.VinaArabic.isPresentationMutation(record))) return;
      sync();
    });
    const observe = () => observer.observe(panel, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['aria-pressed', 'aria-expanded', 'hidden', 'class'] });
    function sync() {
      // 只更新摘要展示，并临时断开观察，避免摘要文本更新反复触发自身。
      observer.disconnect();
      slots.forEach(slot => {
        const key = slot.dataset.setupTile;
        const button = slot.querySelector('.setup-tile-button');
        const popup = slot.querySelector('.setup-tile-popup');
        const value = button.querySelector('.setup-tile-value');
        if (!slot.classList.contains('setup-tile-native')) {
          let summary = '';
          if (key === 'model') {
            summary = panel.__scriptSetupDraft?.model || window.vinaSetupVideoModels?.get() || 'Seedance 2.5';
            slot.querySelectorAll('[data-setup-video-model-option]').forEach(option => {
              const active = option.dataset.setupVideoModelOption === summary;
              option.classList.toggle('active', active);
              option.setAttribute('aria-selected', String(active));
            });
          } else if (key === 'style') {
            const draft = panel.__scriptSetupDraft;
            const customText = panel.querySelector('[data-script-setup-custom] textarea')?.value.trim();
            summary = draft ? (draft.styleId === 'custom' ? (customText || '自定义画风') : (draft.styleId ? draft.styleName : ''))
              : selected('[data-script-setup-style][aria-pressed="true"] .script-setup-style-name');
            if (!draft && customText && !panel.querySelector('[data-script-setup-custom]').hidden) summary = customText;
          } else if (key === 'genre') summary = selected('[data-script-setup-genre][aria-pressed="true"]');
          else summary = selected('[data-script-setup-choice-key="' + key + '"] [data-script-setup-choice-option][aria-pressed="true"]');
          value.textContent = summary || '自动';
          button.classList.toggle('has-selection', !!summary);
        } else {
          button.classList.add('has-selection');
          if (key === 'ratio') {
            // 2026-10-02：卡片摘要由独立比例值及清晰度组合，矩形图标按选中比例实时改变形状。
            const ratio = panel.__scriptSetupDraft?.ratio || panel.querySelector('[data-script-setup-ratio]')?.value || '9:16';
            const quality = panel.__scriptSetupDraft?.quality || window.vinaSetupVideoModels?.getQuality() || '720p';
            value.textContent = ratio + ', ' + quality;
            sizeRatioIcon(button.querySelector('.setup-tile-icon img'),ratio);
            popup.querySelectorAll('[data-script-setup-ratio-option]').forEach(option => {
              const active = option.dataset.scriptSetupRatioOption === ratio;
              option.classList.toggle('active',active);
              option.setAttribute('aria-selected',String(active));
            });
            popup.querySelectorAll('[data-setup-quality-option]').forEach(option => {
              const active = option.dataset.setupQualityOption === quality;
              option.classList.toggle('active',active);
              option.setAttribute('aria-selected',String(active));
            });
          }
        }
        button.classList.toggle('is-open', !popup.hidden);
        button.setAttribute('aria-expanded', String(!popup.hidden));
        button.setAttribute('aria-label', button.querySelector('.setup-tile-label').textContent + '：' + value.textContent);
      });
      observe();
    }
    panel.addEventListener('input', () => queueMicrotask(sync));
    // 草稿变化不一定改变选中属性（例如自定义画风），在原有 click 处理后统一同步摘要。
    panel.addEventListener('click', () => queueMicrotask(sync));
    sync();
  }
  function start() {
    document.querySelectorAll('.script-setup-panel').forEach(install);
    // 2026-09-30 收尾逻辑：外部点击监听只注册一次，只查询仍连接的面板，避免重复展开右侧副本后保留旧草稿节点。
    document.addEventListener('click', event => {
      document.querySelectorAll('.script-setup-panel.has-setup-tiles').forEach(panel => {
        if (panel.contains(event.target)) return;
        panel.querySelectorAll('.setup-tile-popup').forEach(popup => { popup.hidden = true; });
      });
    });
    const expanded = document.querySelector('[data-script-detail-setup-expanded]');
    if (expanded) new MutationObserver(() => expanded.querySelectorAll('.script-setup-panel').forEach(install))
      .observe(expanded, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
