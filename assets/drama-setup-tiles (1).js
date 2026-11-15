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
    image.src = './assets/icons/' + icons[key];
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
      grid.replaceChildren(...fields, style, genre, ...choices);
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
    const selected = selector => [...panel.querySelectorAll(selector)].map(node => node.textContent.trim()).join('、');
    const observer = new MutationObserver(sync);
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
          if (key === 'style') {
            const draft = panel.__scriptSetupDraft;
            const customText = panel.querySelector('[data-script-setup-custom] textarea')?.value.trim();
            summary = draft ? (draft.styleId === 'custom' ? (customText || '自定义画风') : (draft.styleId ? draft.styleName : ''))
              : selected('[data-script-setup-style][aria-pressed="true"] .script-setup-style-name');
            if (!draft && customText && !panel.querySelector('[data-script-setup-custom]').hidden) summary = customText;
          } else if (key === 'genre') summary = selected('[data-script-setup-genre][aria-pressed="true"]');
          else summary = selected('[data-script-setup-choice-key="' + key + '"] [data-script-setup-choice-option][aria-pressed="true"]');
          value.textContent = summary || '自动';
          button.classList.toggle('has-selection', !!summary);
        } else button.classList.add('has-selection');
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
