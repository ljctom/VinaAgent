/* 2026-11-07 Product Design：仅“实时协同”项目启用团队节点占用演示。
 * 占用记录按项目和节点隔离；团队当前成员与占用成员不同才只读，个人账号不受限制。
 * 本原型没有协同服务端，预置王昕编辑 node-4；不将本地状态冒充跨设备实时同步。
 */
(() => {
  'use strict';
  function install() {
    if (document.getElementById('character-asset-canvas-theme')) return;
    const stageElement = document.getElementById('stage');
    const panel = document.getElementById('nodeGeneratePanel');
    if (!stageElement || !panel) return;
    const host = window.parent;
    // 2026-11-08 Product Design 根因修复：本地 file 页面上的外部 SVG mask 可能加载失败；
    // 复用 arrow-up.svg 原始路径，仅调整描边色并内嵌为图片，不依赖跨文件遮罩或 Lucide 重绘。
    // 此处仅负责节点积分提交图标；对话发送/停止由所有项目共用的渲染组件负责。
    const nodeArrowSource = 'data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiBzdHJva2U9IiM2RjdCODgiIHN0cm9rZS13aWR0aD0iMS44IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDE2IDE2IiBhcmlhLWhpZGRlbj0idHJ1ZSI+PHBhdGggZD0iTTggMTNWM000LjUgNi41IDggM2wzLjUgMy41Ij48L3BhdGg+PC9zdmc+';
    function syncStableArrow(container, className, source, enabled) {
      if (!container) return;
      toggleClass(container, 'vina-collaboration-stable-arrow', enabled);
      let icon = container.querySelector('.' + className);
      if (enabled && !icon) {
        icon = document.createElement('img');
        icon.className = className;
        icon.src = source;
        icon.alt = '';
        icon.draggable = false;
        icon.setAttribute('aria-hidden', 'true');
        container.appendChild(icon);
      } else if (!enabled && icon) icon.remove();
    }

    let active = false;
    const ownerId = '10203471';
    const controls = new Map();
    // 2026-11-07 Product Design：同一协同项目内，对话输入独立于节点选择保持占用；
    // 头像标签与灰色说明置于输入框上方同一行，保留草稿、附件与原发送处理。
    const composer = document.querySelector('.chat .composer-wrap .composer');
    const chatControls = new Map();
    let chatSendPresentation = null; // 2026-11-08：占用时只覆盖发送展示，退出后恢复底层原状态。
    const chatDescription = composer?.getAttribute('aria-describedby');
    const chatAriaDisabled = composer?.getAttribute('aria-disabled');
    const chatStatus = document.createElement('div');
    chatStatus.className = 'vina-collaboration-chat-status';
    chatStatus.hidden = true;
    const chatHint = document.createElement('p');
    chatHint.id = 'vinaCollaborationChatHint';
    chatHint.className = 'vina-collaboration-chat-hint';
    chatHint.setAttribute('role', 'status');
    chatHint.setAttribute('aria-live', 'polite');
    chatStatus.appendChild(chatHint);
    if (composer) composer.before(chatStatus);
    const hint = document.createElement('p');
    hint.id = 'vinaCollaborationReadonlyHint';
    hint.className = 'vina-collaboration-readonly-hint';
    hint.setAttribute('role', 'status');
    hint.hidden = true;
    panel.appendChild(hint);

    function teamContext() {
      // srcdoc 与主页面同源；独立打开或跨源嵌入时不推断团队权限。
      try {
        const team = host.vinaProjectTeam;
        return {
          enabled: active && Boolean(host.document.querySelector('.global-account.is-team-account')),
          memberId: team?.currentMemberId,
          // 2026-11-09：配色也在同源保护内读取，独立画布或跨源嵌入仍安全回退为原有展示。
          memberColors: host.vinaCollaborationPresence?.memberColors,
          owner: team?.members?.find(member => member.id === ownerId && member.status === '正常')
        };
      } catch (_) { return { enabled: false }; }
    }
    function isChatLocked() {
      const context = teamContext();
      return Boolean(context.enabled && context.owner && context.memberId !== ownerId);
    }
    // 复用同一个头像资源与文案结构，避免节点和输入框的“编辑中”标签出现样式差异。
    function createEditorBadge() {
      const badge = document.createElement('span');
      badge.className = 'vina-collaboration-editor';
      const avatar = document.createElement('img');
      avatar.src = './assets/images/user-profile-default-avatar.png';
      avatar.alt = '';
      const label = document.createElement('span');
      label.textContent = '编辑中';
      badge.append(avatar, label);
      return badge;
    }
    const chatBadge = createEditorBadge();
    chatStatus.appendChild(chatBadge);

    function isLocked(node) {
      const context = teamContext();
      return Boolean(node && node === stageElement.querySelector('#node-4') && context.enabled && context.owner && context.memberId !== ownerId);
    }
    function selectedList() {
      return typeof selectedNodes === 'undefined' ? [] : Array.from(selectedNodes);
    }
    function selectionLocked() { return selectedList().some(isLocked); }
    function toggleClass(element, name, enabled) {
      if (element.classList.contains(name) !== enabled) element.classList.toggle(name, enabled);
    }
    function setAttribute(element, name, value) {
      if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    }
    function restoreControls(records = controls) {
      // 恢复进入只读前的真实状态，避免解锁时启用原本被其他业务禁用的控件。
      records.forEach((saved, control) => {
        if (saved.disabled !== undefined) control.disabled = saved.disabled;
        if (saved.editable === null) control.removeAttribute('contenteditable');
        else control.setAttribute('contenteditable', saved.editable);
        if (saved.aria === null) control.removeAttribute('aria-disabled');
        else control.setAttribute('aria-disabled', saved.aria);
      });
      records.clear();
    }
    // 2026-11-08 Product Design：占用中的按钮统一显示“发送”，不改内部 replyAction 或停止监听器。
    // 原回复逻辑异步重绘按钮时也保持此展示；解锁后按实际停止状态恢复标题和辅助信息。
    // 2026-11-08 Product Design：锁定态显式保护灰色圆按钮，防止旧停止态白底/方形样式重绘覆盖。
    // 仅在本项目他人占用时写 inline important；逐项保存原值及优先级，解锁时完整恢复。
    // 观察器也监听 style，但仅在值/优先级不一致时写入，异步重绘可恢复且不会自循环。
    const lockedSendStyles = {
      'display': 'inline-flex', 'align-items': 'center', 'justify-content': 'center',
      'box-sizing': 'border-box', 'width': '40px', 'min-width': '40px', 'max-width': '40px',
      'height': '40px', 'min-height': '40px', 'max-height': '40px', 'flex': '0 0 40px',
      'padding': '8px', 'border': '0px', 'border-radius': '50%',
      'background': '#37404f', 'color': '#080d12', 'box-shadow': 'none',
      'opacity': '1', 'transform': 'none', 'cursor': 'not-allowed'
    };
    function captureSendStyles(button) {
      return Object.fromEntries(Object.keys(lockedSendStyles).map(name => [name, {
        value: button.style.getPropertyValue(name), priority: button.style.getPropertyPriority(name)
      }]));
    }
    function protectLockedSend(button) {
      Object.entries(lockedSendStyles).forEach(([name, value]) => {
        // CSSOM 会把十六进制颜色标准化为 rgb；比较标准值，避免每轮观察回调重写颜色。
        const expected = name === 'background' ? 'rgb(55, 64, 79)' : name === 'color' ? 'rgb(8, 13, 18)' : value;
        if (button.style.getPropertyValue(name) !== expected || button.style.getPropertyPriority(name) !== 'important') {
          button.style.setProperty(name, value, 'important');
        }
      });
    }
    function syncChatSend(locked) {
      const button = composer?.querySelector('#sendBtn');
      if (!button) return;
      // 2026-11-08：实时协同也只使用公共发送/停止组件；清除旧后备图片和标记，避免白色停止态样式残留。
      syncStableArrow(button, 'vina-collaboration-send-icon', '', false);
      if (locked) {
        if (!chatSendPresentation || chatSendPresentation.button !== button) chatSendPresentation = {
          button,
          title: button.getAttribute('title'),
          label: button.getAttribute('aria-label'),
          pressed: button.getAttribute('aria-pressed'),
          styles: captureSendStyles(button)
        };
        protectLockedSend(button);
        setAttribute(button, 'title', '发送');
        setAttribute(button, 'aria-label', '发送（其他成员编辑中，暂不可用）');
        if (button.hasAttribute('aria-pressed')) button.removeAttribute('aria-pressed');
      } else if (chatSendPresentation) {
        const saved = chatSendPresentation;
        Object.entries(saved.styles).forEach(([name, previous]) => {
          if (previous.value) button.style.setProperty(name, previous.value, previous.priority);
          else button.style.removeProperty(name);
        });
        const stopped = button.dataset.replyAction === 'stop';
        const values = {
          title: stopped ? '停止回复' : (saved.title === '停止回复' ? '发送' : saved.title),
          'aria-label': stopped ? '停止 AI 回复' : (saved.label === '停止 AI 回复' ? '发送' : saved.label),
          'aria-pressed': stopped ? (saved.pressed || 'false') : null
        };
        Object.entries(values).forEach(([name, value]) => {
          if (value == null) button.removeAttribute(name);
          else setAttribute(button, name, value);
        });
        chatSendPresentation = null;
      }
    }
    function syncChat() {
      if (!composer) return;
      const locked = isChatLocked();
      syncChatSend(locked);
      toggleClass(composer, 'vina-collaboration-chat-locked', locked);
      if (chatStatus.hidden !== !locked) chatStatus.hidden = !locked;
      if (locked) {
        const name = teamContext().owner.name;
        const message = `${name}编辑中，暂时无法对话`;
        if (chatHint.textContent !== message) chatHint.textContent = message;
        setAttribute(chatBadge, 'title', `${name}正在编辑`);
        setAttribute(chatBadge, 'aria-label', `${name}正在编辑，对话输入暂时只读`);
        setAttribute(composer, 'aria-disabled', 'true');
        setAttribute(composer, 'aria-describedby', [chatDescription, chatHint.id].filter(Boolean).join(' '));
        composer.querySelectorAll('button, input, textarea, select, [contenteditable]').forEach(control => {
          if (!chatControls.has(control)) chatControls.set(control, {
            disabled: 'disabled' in control ? control.disabled : undefined,
            editable: control.getAttribute('contenteditable'),
            aria: control.getAttribute('aria-disabled')
          });
          if ('disabled' in control && !control.disabled) control.disabled = true;
          if (control.hasAttribute('contenteditable')) setAttribute(control, 'contenteditable', 'false');
          setAttribute(control, 'aria-disabled', 'true');
        });
        if (composer.contains(document.activeElement)) document.activeElement.blur();
      } else if (chatControls.size) {
        // 退出项目、切回个人账号或占用者本人进入时恢复原状态，不强行启用本就禁用的发送按钮。
        restoreControls(chatControls);
        if (chatDescription == null) composer.removeAttribute('aria-describedby');
        else setAttribute(composer, 'aria-describedby', chatDescription);
        if (chatAriaDisabled == null) composer.removeAttribute('aria-disabled');
        else setAttribute(composer, 'aria-disabled', chatAriaDisabled);
      }
    }
    function sync() {
      syncChat();
      // 2026-11-09 Product Design：当前成员选中可编辑节点时使用自己的协作色；他人占用节点仍显示占用者颜色。
      // 色值复用父页面成员名单映射，退出实时协同或切回个人账号立即移除，保留其他项目原有选中样式。
      const context = teamContext();
      const colors = context.memberColors;
      stageElement.querySelectorAll('.node').forEach(item => {
        const memberId = context.enabled ? (isLocked(item) ? ownerId : item.classList.contains('selected') ? context.memberId : null) : null;
        const color = colors?.[memberId];
        if (color) {
          setAttribute(item, 'data-vina-collaboration-member', memberId);
          if (item.style.getPropertyValue('--vina-collaboration-member-color') !== color) item.style.setProperty('--vina-collaboration-member-color', color);
        } else {
          if (item.hasAttribute('data-vina-collaboration-member')) item.removeAttribute('data-vina-collaboration-member');
          if (item.style.getPropertyValue('--vina-collaboration-member-color')) item.style.removeProperty('--vina-collaboration-member-color');
        }
      });
      const node = stageElement.querySelector('#node-4');
      const locked = isLocked(node);
      if (node) {
        toggleClass(node, 'vina-collaboration-locked', locked);
        let badge = node.querySelector('.vina-collaboration-editor');
        if (locked && !badge) {
          badge = createEditorBadge();
          node.appendChild(badge);
        }
        if (badge) {
          if (badge.hidden !== !locked) badge.hidden = !locked;
          if (locked) {
            const name = teamContext().owner.name;
            setAttribute(badge, 'title', `${name}正在编辑`);
            setAttribute(badge, 'aria-label', `${name}正在编辑，此节点暂时只读`);
          }
        }
      }
      const readonly = typeof selectedNode !== 'undefined' && isLocked(selectedNode);
      syncStableArrow(panel.querySelector('#nodeGenerateSend .send-circle'), 'vina-collaboration-node-send-icon', nodeArrowSource, readonly);
      toggleClass(panel, 'vina-collaboration-readonly', readonly);
      if (hint.hidden !== !readonly) hint.hidden = !readonly;
      if (readonly) {
        const message = `${teamContext().owner.name}正在编辑，暂时无法修改或提交`;
        if (hint.textContent !== message) hint.textContent = message;
        panel.querySelectorAll('button, input, textarea, select, [contenteditable]').forEach(control => {
          if (!controls.has(control)) controls.set(control, {
            disabled: 'disabled' in control ? control.disabled : undefined,
            editable: control.getAttribute('contenteditable'),
            aria: control.getAttribute('aria-disabled')
          });
          if ('disabled' in control && !control.disabled) control.disabled = true;
          if (control.hasAttribute('contenteditable')) setAttribute(control, 'contenteditable', 'false');
          setAttribute(control, 'aria-disabled', 'true');
        });
        if (typeof closeNodeParamMenus === 'function') closeNodeParamMenus();
      } else if (controls.size) restoreControls();
    }

    // 同步钩子在原选择/参数渲染后执行；更换节点立即恢复编辑，不覆盖草稿和原提交逻辑。
    const originalUpdate = updateFloatingNodeTools;
    updateFloatingNodeTools = function (...args) {
      const result = originalUpdate.apply(this, args);
      sync();
      return result;
    };
    const originalParam = setNodeParam;
    setNodeParam = function (key, value, node = selectedNode) {
      if (!isLocked(node)) return originalParam.call(this, key, value, node);
    };
    const originalGenerate = markNodeGeneratingFromPrompt;
    markNodeGeneratingFromPrompt = function (node = selectedNode) {
      if (!isLocked(node)) return originalGenerate.call(this, node);
    };
    const originalGenerating = setNodeGenerating;
    setNodeGenerating = function (node, ...args) {
      if (!isLocked(node)) return originalGenerating.call(this, node, ...args);
    };
    const originalRemove = removeNodeById;
    removeNodeById = function (id) {
      if (!isLocked(document.getElementById(id))) return originalRemove.call(this, id);
    };
    const originalDelete = deleteSelectedNodes;
    deleteSelectedNodes = function (...args) {
      if (!selectionLocked()) return originalDelete.apply(this, args);
    };

    // 对话快捷键和发送按钮共用原 submitPrompt；函数入口也校验占用，防止程序调用绕过禁用控件。
    if (typeof submitPrompt === 'function') {
      const originalSubmit = submitPrompt;
      submitPrompt = async function (...args) {
        if (!isChatLocked()) return originalSubmit.apply(this, args);
      };
    }

    function block(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    function capture(event) {
      if (!active) return;
      const target = event.target;
      // 捕获阶段同时拦截可视 contenteditable、原 textarea、附件入口、回车、粘贴、拖入与发送。
      // 对话占用不随画布选中其他节点而解除；个人账号和其他项目继续使用原有事件。
      if (composer && isChatLocked() && composer.contains(target)) {
        if (event.type === 'focusin' && typeof target.blur === 'function') target.blur();
        block(event);
        return;
      }
      const node = target.closest?.('.node');
      if (isLocked(node)) {
        if (event.type === 'pointerdown' && event.button === 0) {
          // 只选中并展示原生成面板，不进入节点原有的拖拽或连线监听器。
          selectNode(node);
          block(event);
        } else if (event.type === 'contextmenu' || event.type === 'dragstart') block(event);
        return;
      }
      // 多选中包含被占用节点时阻止整组拖拽；其他节点单独选中后仍可正常移动。
      if (event.type === 'pointerdown' && selectionLocked() &&
          (target.closest?.('.vina-multi-selection-frame') || (node && selectedList().includes(node)))) {
        block(event);
        return;
      }
      if (typeof selectedNode !== 'undefined' && isLocked(selectedNode)) {
        const inPanel = panel.contains(target);
        const action = target.closest?.('#nodeActionBar button');
        const viewAction = action?.matches('#focusNodeBtn, #downloadNodeBtn, #saveNodeAssetBtn');
        // disabled 属性之外再拦截可视引用编辑器、快捷键和程序触发的提交事件。
        if (inPanel || (action && !viewAction)) {
          block(event);
          return;
        }
      }
      if (event.type === 'keydown' && selectionLocked() &&
          !target.closest?.('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]') &&
          (['Delete', 'Backspace'].includes(event.key) || ((event.ctrlKey || event.metaKey) && ['z', 'y', 'x'].includes(event.key.toLowerCase())))) block(event);
    }
    ['pointerdown', 'click', 'contextmenu', 'dragstart', 'beforeinput', 'input', 'keydown', 'submit', 'paste', 'drop', 'compositionstart', 'focusin'].forEach(type => {
      document.addEventListener(type, capture, true);
    });
    // 处理拖动期间收到占用状态的情况；不能让已经建立的拖拽继续移动此节点。
    document.addEventListener('pointermove', () => {
      if (typeof drag !== 'undefined' && drag?.type === 'node' && drag.nodes?.some(item => isLocked(item.node))) drag = null;
    }, true);
    new MutationObserver(sync).observe(stageElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    new MutationObserver(sync).observe(panel, { childList: true, subtree: true });
    // 输入区可能动态挂载引用编辑器/附件控件；原生禁用与 contenteditable 状态变动时重新应用占用。
    if (composer) new MutationObserver(syncChat).observe(composer, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'contenteditable', 'title', 'aria-label', 'aria-pressed', 'class', 'style'] });
    try {
      const account = host.document.querySelector('.global-account');
      if (account) new MutationObserver(sync).observe(account, { attributes: true, attributeFilter: ['class'] });
      host.addEventListener('vina-project-membership-change', sync);
      host.addEventListener('vina:team-created', sync);
    } catch (_) { /* 独立画布没有主页面账号，不开启团队占用。 */ }
    window.addEventListener('message', event => {
      if (event.source !== host || event.data?.type !== 'vina-canvas-collaboration-project') return;
      active = event.data.enabled === true;
      if (active) {
        const title = document.querySelector('.project-name');
        if (title) title.textContent = event.data.title || '实时协同';
      }
      sync();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
