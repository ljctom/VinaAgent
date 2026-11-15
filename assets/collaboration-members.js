/* 2026-11-09 Product Design：实时协同项目在账户头像左侧展示成员入口，故事板和画布共用父页面组件。
 * 原型尚无在线成员服务；以下五个固定成员 ID 仅演示此项目的在场名单，姓名读取当前团队模型。
 * 头像只使用已有默认机器人及三种固定配色，不读取自定义头像；按钮最多显示三个，人数取完整名单。
 * 成员改名/移除、切换账号、离开项目均同步；不修改项目授权、编辑占用、积分或成员数据。
 */
(() => {
  'use strict';
  const account = document.querySelector('.global-account');
  const profile = account?.querySelector('.account-avatar');
  if (!account || !profile) return;

  const presenceIds = ['10191268', '10188563', '10203471', '10204836', '10205619'];
  /* 2026-11-15 需求注释：实时协同用户标识色（供后续需求文档引用）。
   * 需求：为协同用户从以下 10 种预设颜色中随机选取一种，作为该用户的协同标识色。
   * 01 晴空蓝 #64B5FF；02 浅紫 #B59AFF；03 薄荷绿 #55E08A；04 暖金 #F3BE62；05 玫瑰粉 #F28DBA；
   * 06 冰青 #50D4E8；07 珊瑚橙 #F18B63；08 青碧 #45C8B0；09 鸢尾蓝 #7F96F2；10 青柠黄 #C6D76B。
   * 对应范围：协作者列表姓名右侧的颜色圆点、画布节点编辑边框及“编辑中”标签、Agent 输入区域的协同编辑标识。
   * 同一用户的上述协同标识使用同一颜色，使成员身份与正在编辑的内容保持对应。
   * 本次仅补充需求注释；下方 memberColors 仍为当前原型的 5 人固定配色，尚未实现 10 色随机分配。
   * 会话内颜色保持、颜色去重和超过 10 人的复用规则尚待需求定义，不在此注释中视为已确认规则。
   */
  // 2026-11-09 Product Design：每人固定一种协作色；父页面名单圆点与 iframe 选中节点读取同一映射。
  // 王昕保留现有占用节点的绿色，另外四人分别使用蓝、紫、橙、粉色；长英文名仅用于此项目的展示示例。
  const memberColors = Object.freeze({
    '10191268': '#64B5FF',
    '10188563': '#B59AFF',
    '10203471': '#55E08A',
    '10204836': '#F3BE62',
    '10205619': '#F28DBA'
  });
  window.vinaCollaborationPresence = Object.freeze({ memberColors });
  const displayName = member => member.id === '10205619' ? 'Christopher Alexander Montgomery' : member.name;
  let active = false;
  let signature = '';
  const component = document.createElement('div');
  component.className = 'vina-collaboration-members';
  component.hidden = true;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'vina-collaboration-members-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'vinaCollaborationMembersPanel');
  const stack = document.createElement('span');
  stack.className = 'vina-collaboration-members-stack';
  stack.setAttribute('aria-hidden', 'true');
  const count = document.createElement('span');
  count.className = 'vina-collaboration-members-count';
  const arrow = document.createElement('img');
  arrow.className = 'vina-collaboration-members-chevron';
  arrow.src = './assets/canvas-ui-reference/chevron-down.svg';
  arrow.alt = '';
  arrow.setAttribute('aria-hidden', 'true');
  trigger.append(stack, count, arrow);

  // 面板为只读成员列表，支持 Tab 正常离开；Escape 和点击外部收起，避免把姓名误作菜单操作。
  const panel = document.createElement('section');
  panel.id = 'vinaCollaborationMembersPanel';
  panel.className = 'vina-collaboration-members-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'vinaCollaborationMembersHeading');
  const heading = document.createElement('h2');
  heading.id = 'vinaCollaborationMembersHeading';
  const list = document.createElement('ul');
  panel.append(heading, list);
  component.append(trigger, panel);
  account.insertBefore(component, profile);

  // 2026-11-09 Product Design：只有实际被单行省略的姓名 hover 时显示下方完整名字浮层。
  // 浮层置于可滚动名单外，避免被最后一行裁切；移开、滚动、关闭名单或切换项目即收起。
  const nameTooltip = document.createElement('div');
  nameTooltip.id = 'vinaCollaborationMemberNameTooltip';
  nameTooltip.className = 'vina-collaboration-member-tooltip';
  nameTooltip.setAttribute('role', 'tooltip');
  nameTooltip.hidden = true;
  component.append(nameTooltip);
  let tooltipName = null;
  function hideNameTooltip() {
    nameTooltip.hidden = true;
    if (tooltipName) tooltipName.removeAttribute('aria-describedby');
    tooltipName = null;
  }
  function showNameTooltip(name) {
    hideNameTooltip();
    if (panel.hidden || component.hidden || name.scrollWidth <= name.clientWidth) return;
    tooltipName = name;
    nameTooltip.textContent = name.textContent;
    name.setAttribute('aria-describedby', nameTooltip.id);
    nameTooltip.hidden = false;
    const anchor = name.getBoundingClientRect();
    const bounds = nameTooltip.getBoundingClientRect();
    // 完整名字优先显示在姓名下方 8px；靠近窗口边缘时避让，保证浮层内容可见。
    nameTooltip.style.left = Math.max(12, Math.min(anchor.left, window.innerWidth - bounds.width - 12)) + 'px';
    nameTooltip.style.top = (anchor.bottom + 8 + bounds.height <= window.innerHeight - 12
      ? anchor.bottom + 8 : Math.max(12, anchor.top - bounds.height - 8)) + 'px';
  }
  list.addEventListener('scroll', hideNameTooltip);
  window.addEventListener('resize', hideNameTooltip);

  function avatar(memberId) {
    const image = document.createElement('img');
    image.className = 'vina-collaboration-member-avatar vina-collaboration-member-avatar-' + (presenceIds.indexOf(memberId) % 3);
    image.src = './assets/images/user-profile-default-avatar.png';
    image.alt = '';
    image.draggable = false;
    return image;
  }
  function close(restoreFocus = false) {
    hideNameTooltip();
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !component.hidden) trigger.focus();
  }
  function sync() {
    const team = window.vinaProjectTeam;
    const members = presenceIds.map(id => team?.members?.find(member => member.id === id && member.status === '正常')).filter(Boolean);
    const visible = active && account.classList.contains('is-team-account') && document.body.classList.contains('canvas-workbench-active') && members.length > 0;
    component.hidden = !visible;
    if (!visible) close();
    const next = JSON.stringify(members.map(member => [member.id, member.name]));
    if (next === signature) return;
    signature = next;
    hideNameTooltip();
    stack.replaceChildren(...members.slice(0, 3).map(member => avatar(member.id)));
    count.textContent = String(members.length);
    heading.textContent = '协作者 · ' + members.length;
    trigger.setAttribute('aria-label', '查看当前项目的 ' + members.length + ' 位协作者');
    trigger.title = '查看项目协作者';
    list.replaceChildren(...members.map(member => {
      const row = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'vina-collaboration-member-name';
      name.textContent = displayName(member);
      // 使用自定义下方浮层代替原生 title，避免浏览器延迟提示与新浮层重复出现。
      name.addEventListener('mouseenter', () => showNameTooltip(name));
      name.addEventListener('mouseleave', hideNameTooltip);
      // 圆点独立占位，长名字只截断文字本身，不挤掉右侧的成员颜色。
      const dot = document.createElement('span');
      dot.className = 'vina-collaboration-member-dot';
      dot.textContent = '·';
      dot.style.color = memberColors[member.id];
      dot.setAttribute('aria-hidden', 'true');
      row.append(avatar(member.id), name, dot);
      return row;
    }));
  }
  trigger.addEventListener('click', () => {
    sync();
    if (component.hidden) return;
    panel.hidden = !panel.hidden;
    if (panel.hidden) hideNameTooltip();
    trigger.setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.addEventListener('pointerdown', event => {
    if (!component.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      close(true);
      event.stopPropagation();
    }
  });
  component.addEventListener('focusout', event => {
    // 2026-11-09：Tab 移到其他控件时关闭；点击只读姓名导致焦点回到 body 时保留面板，允许选择和复制用户名。
    if (event.relatedTarget && !component.contains(event.relatedTarget)) close();
  });

  // 画布在 iframe 内，指针事件不会冒泡到父页面；每次重载绑定当前文档，切换模式仍共用同一入口。
  const canvas = document.getElementById('canvasFrame');
  const boundDocuments = new WeakSet();
  function bindCanvasDismiss() {
    try {
      const canvasDocument = canvas?.contentDocument;
      if (!canvasDocument || boundDocuments.has(canvasDocument)) return;
      boundDocuments.add(canvasDocument);
      canvasDocument.addEventListener('pointerdown', () => close(), true);
      canvasDocument.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) close(true);
      }, true);
    } catch (_) { /* 跨源 iframe 仍由父页面失焦处理关闭。 */ }
  }
  canvas?.addEventListener('load', bindCanvasDismiss);
  bindCanvasDismiss();
  window.addEventListener('blur', () => close());
  window.addEventListener('vina:canvas-collaboration-project', event => {
    active = event.detail?.enabled === true;
    close();
    sync();
  });
  window.addEventListener('vina-project-membership-change', sync);
  window.addEventListener('vina:team-created', sync);
  new MutationObserver(sync).observe(account, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
})();
