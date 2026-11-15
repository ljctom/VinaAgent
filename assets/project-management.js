(() => {
  "use strict";
  // 2026-09-23 项目管理复用团队内存模型；与现有原型一致，刷新后恢复演示数据，不伪造项目消耗或集数。
  const team = window.vinaProjectTeam;
  const projectView = document.querySelector('.view[data-view="projects"]');
  const account = document.querySelector('.global-account');
  const homeProjects = document.querySelector('[data-home-projects]');
  const homeProjectList = document.querySelector('[data-home-project-list]');
  if (!team || !projectView || !account) return;
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = (value) => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const dialog = document.createElement('dialog');
  dialog.className = 'pm-dialog';
  dialog.setAttribute('aria-labelledby', 'pm-title');
  document.body.append(dialog);
  // 2026-09-23 移除成员逻辑：二次确认独立于管理弹窗，取消与 Esc 都不会改动项目授权。
  const removeDialog = document.createElement('dialog');
  removeDialog.className = 'pm-confirm-dialog';
  // 2026-10-29 Product Design 修复：专用 ID 隔离移除确认弹窗的高度与居中规则，避免被工作区弹窗尺寸撑满。
  removeDialog.id = 'pmProjectMemberRemoveDialog';
  removeDialog.innerHTML = '<h3 id="pm-confirm-title">移除项目成员</h3><p class="pm-confirm-message"></p><div class="pm-confirm-actions"><button type="button" class="pm-secondary" data-pm-confirm="cancel">取消</button><button type="button" class="pm-confirm-remove" data-pm-confirm="remove">确认移除</button></div>';
  removeDialog.setAttribute('aria-labelledby', 'pm-confirm-title');
  document.body.append(removeDialog);
  let currentIndex = -1, currentCard = null, trigger = null, tab = 'credits', adding = false, query = '', draft = new Set(), message = '', standaloneBoard = false, standaloneMembers = false;
  let pendingRemoval = null, removalTrigger = null;
  // 2026-10-29 移除反馈：复用短剧 toast.css 的完整外观、成功图标与 2600ms 时长。
  // 使用独立原生手动 popover 进入顶层，避免被仍打开的项目成员 dialog 遮挡；不改共享 Toast 的其他流程。
  let removalDraftChanged = false, memberToastTimer;
  const memberToast = document.createElement('div');
  memberToast.id = 'pmProjectMemberToast';
  memberToast.className = 'vina-toast-layer';
  memberToast.setAttribute('popover', 'manual');
  memberToast.hidden = true;
  memberToast.innerHTML = '<div class="vina-figma-toast" data-vina-toast-type="success" role="status" aria-live="polite" aria-atomic="true"><span class="vina-figma-toast-icon" aria-hidden="true"><img src="./assets/icons/toast/success.svg" alt=""></span><span class="vina-figma-toast-message"></span></div>';
  document.body.append(memberToast);
  function notifyMemberChange(text) {
    clearTimeout(memberToastTimer);
    memberToast.querySelector('.vina-figma-toast-message').textContent = text;
    memberToast.hidden = false;
    if (typeof memberToast.showPopover === 'function') {
      if (memberToast.matches(':popover-open')) memberToast.hidePopover();
      memberToast.showPopover();
    }
    memberToastTimer = setTimeout(() => {
      if (typeof memberToast.hidePopover === 'function' && memberToast.matches(':popover-open')) memberToast.hidePopover();
      memberToast.hidden = true;
    }, 2600);
  }

  const activeMembers = () => team.members.filter((member) => member.status === '正常').sort((a,b) => Number(b.role === '管理员') - Number(a.role === '管理员'));
  const included = (member) => member.projectMode === 'all' || member.assignedProjects?.includes(currentIndex);
  const selected = (member) => member.projectMode === 'all' || (adding ? draft.has(member.id) : included(member));
  const matches = (member) => [member.name,member.id,member.phone,member.role].some((value) => String(value).toLowerCase().includes(query.toLowerCase().trim()));
  const button = (action, label, className = 'pm-secondary') => `<button type="button" class="${className}" data-pm-action="${action}">${label}</button>`;
  // 2026-09-23 项目卡片演示逻辑：以稳定卡片 ID 绑定各自集数、成员和积分，避免新建项目误用这些演示记录。
  const cardSamples = {
    // 2026-09-24 默认短剧项目演示逻辑：给默认卡片补齐 10 集与两位成员的示例消耗，使总积分、每集平均积分和普通成员本人积分都显示对应数字。
    'default-drama-project': { episodes: 10, costs: [['10188563',1200],['10191268',800]] },
    'project-library-0': { episodes: 4, costs: [['10188563',900],['10191268',800],['10205619',980]] },
    'project-library-1': { episodes: 2, costs: [['10191268',400],['10206142',570]] },
    'project-library-2': { episodes: 3, costs: [['10207388',1000],['10203471',840]] },
    'project-library-3': { episodes: 2, costs: [['10204836',500],['10205619',620]] },
    'project-library-4': { episodes: 6, costs: [['10188563',1600],['10206142',1400],['10207388',1200]] },
    'project-library-5': { episodes: 2, costs: [['10204836',650],['10203471',900]] },
    'project-library-6': { episodes: 4, costs: [['10188563',1000],['10191268',800],['10205619',1480]] }
  };
  // 2026-09-24 张晨演示授权逻辑：补充两张既有项目卡片的参与权限，积分仍只读取原有真实演示记录。
  const extraZhangCardIds = new Set(['project-library-1', 'project-library-2']);
  function seedCardProject(id, index) {
    const sample = cardSamples[id];
    if (!sample) return;
    if (!team.projects[index].episodeCount) team.projects[index].episodeCount = sample.episodes;
    if (extraZhangCardIds.has(id)) {
      const zhang = team.members.find((member) => member.id === '10188563');
      if (zhang?.projectMode === 'assigned' && !zhang.assignedProjects.includes(index)) zhang.assignedProjects.push(index);
    }
    sample.costs.forEach(([memberId, cost], position) => {
      const member = team.members.find((item) => item.id === memberId);
      if (member?.projectMode === 'assigned' && !member.assignedProjects.includes(index)) member.assignedProjects.push(index);
      if (!team.consumptions.some((entry) => entry.projectIndex === index && entry.memberId === memberId)) {
        // 2026-09-24 默认项目积分记录逻辑：默认卡片使用固定演示日期，避免非数字项目 ID 生成无效时间；既有项目仍沿用原日期规则。
        const day = id === 'default-drama-project' ? 24 : 10 + Number(id.split('-').at(-1));
        team.consumptions.push({ memberId, projectIndex: index, time: `2026-09-${String(day).padStart(2,'0')} 10:${String(position * 12).padStart(2,'0')}:00`, cost });
      }
    });
    team.refresh();
  }
  // 2026-09-29 Product Design 改动逻辑：保存项目成员会重绘看板行；关闭后优先返回原按钮，旧按钮已移除时定位同一项目的新按钮。
  function close() {
    dialog.close();
    const replacement = trigger?.dataset.teamProjectAction
      ? document.querySelector(`[data-team-project-action="${trigger.dataset.teamProjectAction}"][data-team-project-index="${currentIndex}"]`)
      : null;
    (trigger?.isConnected ? trigger : replacement)?.focus();
  }
  // 2026-09-29 Product Design 改动逻辑：项目卡片和团队项目看板共用弹窗入口；看板传原始项目索引和目标页签，避免复制成员授权或积分统计逻辑。
  function openProject(index, initialTab = 'credits', source = null) {
    // 2026-09-29 Product Design 修复逻辑：团队管理整页可从个人账号入口进入；仅在项目卡片页要求团队账号，团队看板内允许打开同一项目弹窗。
    if (!Number.isInteger(index) || !team.projects[index] || (!account.classList.contains('is-team-account') && !document.body.classList.contains('team-console-open'))) return;
    trigger = source;
    currentIndex = index;
    currentCard = source?.closest('.project-card') || null;
    if (currentCard) {
      team.projects[index].name = currentCard.querySelector('.project-title')?.textContent.trim() || team.projects[index].name;
      if (currentCard.dataset.episodeCount != null) team.projects[index].episodeCount = Number(currentCard.dataset.episodeCount);
      team.refresh();
    }
    tab = initialTab === 'members' ? 'members' : 'credits';
    // 2026-09-29 Product Design 改动逻辑：团队项目看板的成员和积分入口各自直达内容，均不显示短剧项目卡片的页签；成员入口继续直接进入添加成员界面。
    standaloneBoard = Boolean(source?.hasAttribute('data-team-project-action'));
    standaloneMembers = standaloneBoard && tab === 'members';
    dialog.classList.toggle('pm-board-standalone', standaloneBoard);
    adding = standaloneMembers && team.canManage();
    draft = new Set(activeMembers().filter(included).map((member) => member.id));
    query = ''; message = '';
    removalDraftChanged = false; // 2026-10-29：每次打开独立记录本轮移除草稿，取消后不报告保存成功。
    render(); dialog.showModal(); dialog.querySelector('.pm-close').focus();
  }
  window.vinaOpenProjectManagement = openProject;
  function memberTable(list, mode) {
    // 2026-09-23 项目成员表格统一显示成员、账号、角色和操作四列；团队归属已由当前团队上下文确定，无需重复展示。
    const rows = list.map((member) => {
      const locked = member.projectMode === 'all';
      // 2026-09-24 项目成员操作展示逻辑：普通成员无操作权限时显示“-”；管理员仍可区分自动参与和可移除成员。
      let action = '<span class="pm-muted">-</span>';
      if (team.canManage()) {
        action = locked ? '<span class="pm-muted">自动参与所有项目</span>' : mode === 'available'
          ? button(`add:${member.id}`, '添加成员', 'pm-link')
          : button(`remove:${member.id}`, '移除成员', 'pm-secondary pm-table-action');
      }
      return `<tr><td><strong>${escape(member.name)}</strong></td><td>${escape(member.id)}</td><td><span class="pm-tag">${escape(member.role)}</span></td><td>${action}</td></tr>`;
    }).join('');
    return `<div class="pm-table-wrap"><table class="pm-table"><thead><tr><th>成员</th><th>账号</th><th>角色</th><th>操作</th></tr></thead><tbody>${rows || `<tr><td class="pm-empty" colspan="4">${query ? '没有找到匹配的成员' : mode === 'available' ? '暂无可添加成员' : '暂无项目成员'}</td></tr>`}</tbody></table></div>`;
  }
  function creditContent() {
    // 2026-09-24 项目积分可见性逻辑：普通成员可查看项目总消耗和每集平均值；成员明细仅展示本人积分，其他成员显示“-”。
    const canViewAllCredits = team.canManage();
    const currentMemberId = team.currentMemberId;
    const entries = team.consumptions.filter((entry) => entry.projectIndex === currentIndex);
    const total = entries.reduce((sum, entry) => sum + entry.cost, 0);
    const project = team.projects[currentIndex];
    // 2026-09-29 Product Design 改动逻辑：弹窗集数直接复用项目看板“待审核/审核通过/总集数”的总集数计算，平均每集积分同步使用同一分母。
    const episodes = team.reviewCounts(project)?.total ?? 0;
    // 2026-09-23 成员积分展示逻辑：每位当前或有历史消耗的成员各占一行，按成员分别汇总积分；成员为第一列、角色为第二列，移除授权不抹除历史消耗。
    const memberRows = team.members.filter((member) => (included(member) && member.status === '正常') || entries.some((entry) => entry.memberId === member.id)).map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role || '成员',
      cost: entries.filter((entry) => entry.memberId === member.id).reduce((sum, entry) => sum + entry.cost, 0)
    }));
    // 2026-09-23 历史成员展示逻辑：已不在团队成员列表中的账号按成员 ID 分行保留积分，避免将不同成员合并为一行。
    const knownIds = new Set(team.members.map((member) => member.id));
    const unknownMembers = new Map();
    entries.forEach((entry) => {
      if (knownIds.has(entry.memberId)) return;
      const id = String(entry.memberId ?? '');
      unknownMembers.set(id, (unknownMembers.get(id) || 0) + entry.cost);
    });
    unknownMembers.forEach((cost, id) => memberRows.push({ id, name: id ? `已离开团队（${id}）` : '已离开团队', role: '历史成员', cost }));
    // 2026-09-24 Product Design 文案及积分展示逻辑：移除成员表上方说明，标题改为“项目成员积分消耗”；其他成员（含历史成员）的数字统一用“-”占位。
    return `<div class="pm-summary"><div class="pm-stat"><span>总消耗积分</span><strong>${number(total)}</strong><small>积分</small></div><div class="pm-stat"><span>集数</span><strong>${number(episodes)}</strong><small>集</small></div><div class="pm-stat"><span>平均每集积分消耗</span><strong>${episodes ? number(total / episodes) : '-'}</strong><small>积分 / 集</small></div></div><div class="pm-toolbar"><div><h3>项目成员积分消耗</h3></div></div><div class="pm-table-wrap"><table class="pm-table"><thead><tr><th>成员</th><th>角色</th><th class="pm-number">消耗积分</th></tr></thead><tbody>${memberRows.map((row) => `<tr><td>${escape(row.name)}</td><td><span class="pm-tag">${escape(row.role)}</span></td><td class="pm-number"><strong>${canViewAllCredits || row.id === currentMemberId ? number(row.cost) : '-'}</strong></td></tr>`).join('') || '<tr><td class="pm-empty" colspan="3">暂无积分消耗记录</td></tr>'}</tbody></table></div>`;
  }
  function memberContent() {
    const members = activeMembers();
    const assigned = members.filter(selected);
    const search = `<input class="pm-search" type="search" data-pm-search placeholder="搜索成员、账号" aria-label="搜索成员或账号" value="${escape(query)}">`;
    // 2026-09-23 Product Design 改动逻辑：项目成员列表标题仅显示“项目成员”，移除旁边的人数与下方同步说明；搜索、添加成员和表格继续按原有逻辑渲染。
    // 2026-09-24 项目弹窗布局逻辑：所有身份移除底部操作栏；添加成员时把取消、保存移到内容标题旁，保存反馈留在成员区。
    if (!adding) return `<div class="pm-toolbar"><div><h3>项目成员</h3>${message ? `<p class="pm-feedback" role="status">${escape(message)}</p>` : ''}</div><div class="pm-tools">${search}${team.canManage() ? button('edit', '添加成员', 'pm-primary') : ''}</div></div>${memberTable(assigned.filter(matches),'list')}`;
    // 2026-09-29 Product Design 改动逻辑：看板成员弹窗的取消和保存由右下角固定操作栏承载；项目卡片原有工具栏继续保持原布局。
    // 2026-09-29 Product Design 改动逻辑：项目看板成员管理弹窗移除“添加项目成员”小标题及底部自动加入说明，保留授权说明、双栏名单和右下角操作；项目卡片原有布局不变。
    return `<div class="pm-toolbar"><div>${standaloneMembers ? '' : '<h3>添加项目成员</h3>'}<p>从团队选择成员，保存后同步更新项目授权</p></div>${standaloneMembers ? '' : `<div class="pm-tools">${button('cancel','取消')}${button('save','保存成员','pm-primary')}</div>`}</div><div class="pm-columns"><section class="pm-column"><div class="pm-column-head"><h3>可添加成员 <span class="pm-muted">${members.filter((member) => !selected(member)).length}</span></h3>${search}</div>${memberTable(members.filter((member) => !selected(member) && matches(member)),'available')}</section><section class="pm-column"><div class="pm-column-head"><h3>项目已有成员 <span class="pm-muted">${assigned.length}</span></h3></div>${memberTable(assigned,'selected')}</section></div>${standaloneMembers ? '' : '<p class="pm-hint">参与团队所有项目的成员自动加入；如需调整，请在团队管理中修改其分配方式。</p>'}`;
  }
  function renderBody() { dialog.querySelector('.pm-body').innerHTML = tab === 'credits' ? creditContent() : memberContent(); }
  function render() {
    const project = team.projects[currentIndex];
    // 2026-09-23 标题逻辑：标题直接显示当前项目名称，单行放大；关闭按钮仅显示图标并保留屏幕阅读器名称。
    // 2026-09-24 项目弹窗布局逻辑：积分和成员页均不再渲染底部“完成”栏，统一使用右上角关闭控件。
    // 2026-09-29 Product Design 改动逻辑：看板的成员管理和积分明细弹窗均直接呈现各自内容，省略红框页签；仅成员管理保留右下角取消、保存。
    const tabs = standaloneBoard ? '' : `<div class="pm-tabs" role="tablist" aria-label="项目管理模块"><button id="pm-tab-credits" type="button" role="tab" aria-controls="pm-content" aria-selected="${tab === 'credits'}" tabindex="${tab === 'credits' ? 0 : -1}" data-pm-action="tab:credits">积分消耗</button><button id="pm-tab-members" type="button" role="tab" aria-controls="pm-content" aria-selected="${tab === 'members'}" tabindex="${tab === 'members' ? 0 : -1}" data-pm-action="tab:members">项目成员管理</button></div>`;
    const footer = standaloneMembers && team.canManage() ? `<footer class="pm-footer">${button('cancel', '取消')}${button('save', '保存', 'pm-primary')}</footer>` : '';
    dialog.innerHTML = `<header class="pm-header"><h2 id="pm-title" title="${escape(project.name)}">${escape(project.name)}</h2><button type="button" class="pm-close" data-pm-action="close" aria-label="关闭项目管理"><img src="https://api.iconify.design/lucide/x.svg?color=%23b9c4c5" alt=""></button></header>${tabs}<div id="pm-content" class="pm-body" ${standaloneBoard ? '' : `role="tabpanel" aria-labelledby="pm-tab-${tab}"`}></div>${footer}`;
    renderBody();
  }
  function saveMembership() {
    // 只增减当前项目授权；不影响成员的其他项目、角色或历史消耗；自动参与成员保持锁定。
    activeMembers().forEach((member) => {
      if (member.projectMode === 'all') return;
      const ids = new Set(member.assignedProjects || []);
      if (draft.has(member.id)) ids.add(currentIndex); else ids.delete(currentIndex);
      member.assignedProjects = [...ids];
    });
    team.refresh();
  }
  dialog.addEventListener('click', (event) => {
    const action = event.target.closest('[data-pm-action]')?.dataset.pmAction;
    if (!action) { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } return; }
    if (action === 'close') { close(); return; }
    if (action.startsWith('tab:')) { tab = action.split(':')[1]; adding = false; query = ''; message = ''; render(); dialog.querySelector(`#pm-tab-${tab}`).focus(); return; }
    if (!team.canManage()) return;
    if (action === 'edit') { adding = true; draft = new Set(activeMembers().filter(included).map((member) => member.id)); query = ''; message = ''; }
    if (action === 'cancel') { if (standaloneMembers) { close(); return; } adding = false; query = ''; message = ''; }
    // 2026-09-29 Product Design 改动逻辑：看板成员弹窗保存草稿后直接关闭；卡片项目管理仍返回成员列表并显示保存反馈。
    // 2026-10-29：仍仅在保存时提交成员草稿，提交成功后才提示移除生效。
    if (action === 'save') {
      saveMembership();
      const reportRemoval = removalDraftChanged;
      removalDraftChanged = false;
      if (standaloneMembers) { close(); if (reportRemoval) notifyMemberChange('项目成员已保存，移除已生效'); return; }
      adding = false; query = ''; message = '项目成员已保存，团队项目授权已同步';
      if (reportRemoval) notifyMemberChange('项目成员已保存，移除已生效');
    }
    if (action.startsWith('remove:')) {
      const member = activeMembers().find((item) => item.id === action.split(':')[1]);
      if (!member || member.projectMode === 'all') return;
      pendingRemoval = member.id;
      removalTrigger = event.target.closest('[data-pm-action]');
      removeDialog.querySelector('.pm-confirm-message').textContent = `确定将 ${member.name} 从「${team.projects[currentIndex].name}」移除吗？移除后该成员将无法再参与此项目，历史积分消耗仍会保留。`;
      removeDialog.showModal();
      removeDialog.querySelector('[data-pm-confirm="cancel"]').focus();
      return;
    }
    if (action.startsWith('add:')) {
      const [operation,id] = action.split(':');
      const member = activeMembers().find((item) => item.id === id);
      if (!member || member.projectMode === 'all') return;
      if (!adding) draft = new Set(activeMembers().filter(included).map((item) => item.id));
      draft.add(id);
    }
    render();
    dialog.querySelector('[data-pm-search], [data-pm-action="edit"], .pm-close')?.focus();
  });
  dialog.addEventListener('input', (event) => {
    if (!event.target.matches('[data-pm-search]')) return;
    query = event.target.value;
    renderBody();
    const field = dialog.querySelector('[data-pm-search]');
    field?.focus();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.target.getAttribute('role') !== 'tab' || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 'credits' : event.key === 'End' ? 'members' : tab === 'credits' ? 'members' : 'credits';
    dialog.querySelector(`[data-pm-action="tab:${target}"]`).click();
  });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  removeDialog.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-pm-confirm]')?.dataset.pmConfirm;
    if (!choice) return;
    let removalNotice = '';
    if (choice === 'remove' && pendingRemoval && team.canManage()) {
      // 2026-09-23 确认移除逻辑：只撤销当前项目的成员授权，添加流程中的改动继续留在草稿直至保存。
      const member = activeMembers().find((item) => item.id === pendingRemoval);
      if (member && member.projectMode !== 'all') {
        if (!adding) draft = new Set(activeMembers().filter(included).map((item) => item.id));
        draft.delete(member.id);
        if (!adding) { saveMembership(); message = `已将 ${member.name} 移出本项目`; }
        // 2026-10-29：确认移除成功才生成提示；草稿阶段明确说明保存后生效，取消及不可移除成员不显示成功提示。
        removalNotice = adding ? `已移除 ${member.name}，保存后生效` : `已将 ${member.name} 移出本项目`;
        if (adding) removalDraftChanged = true;
        render();
      }
    }
    removeDialog.close();
    // 2026-10-29：关闭确认弹窗后展示短剧同款顶层 Toast，成员管理弹窗保持原流程。
    if (removalNotice) notifyMemberChange(removalNotice);
    pendingRemoval = null;
    if (choice === 'cancel') removalTrigger?.isConnected && removalTrigger.focus();
    else dialog.querySelector('[data-pm-search], [data-pm-action="edit"], .pm-close')?.focus();
  });
  removeDialog.addEventListener('close', () => { pendingRemoval = null; });
  // 2026-09-26 Product Design：项目页补充演示卡片；制作阶段和审核状态独立保存，
  // 筛选仅作用于短剧，仍与团队授权取交集；示例入口统一复用现有项目，不创建新的工作区。
  const stages = ['基础设定', '大纲', '分集剧本', '资产', '分集视频'];
  let projectFilter = '全部状态';
  const tabs = projectView.querySelector('.plain-tabs');
  const filter = document.createElement('details');
  filter.className = 'project-status-filter';
  // 2026-09-29 Product Design 改动逻辑：短剧筛选菜单只保留“全部状态”和五个制作阶段选项，移除分组标题及项目状态选项。
  filter.innerHTML = `<summary aria-label="筛选短剧制作阶段"><span>全部状态</span><img src="https://api.iconify.design/lucide/chevron-down.svg?color=%239aa6b2" alt=""></summary><div class="project-status-menu" role="group" aria-label="短剧筛选">${['全部状态', ...stages].map((label, index) => `<button type="button" data-project-filter="${label}" aria-pressed="${index === 0}">${label}</button>`).join('')}</div>`;
  tabs.append(filter);
  const filterEmpty = document.createElement('div');
  filterEmpty.className = 'project-filter-empty';
  filterEmpty.hidden = true;
  filterEmpty.innerHTML = '<p>暂无符合筛选条件的短剧</p><button type="button">查看全部短剧</button>';
  projectView.querySelector('[data-project-panel="drama"]').append(filterEmpty);
  function selectProjectFilter(value) {
    projectFilter = value;
    filter.querySelector('summary span').textContent = value;
    filter.querySelectorAll('[data-project-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.projectFilter === value)));
    filter.open = false;
    syncProjectVisibility();
  }
  filter.addEventListener('click', (event) => {
    const button = event.target.closest('[data-project-filter]');
    if (button) { selectProjectFilter(button.dataset.projectFilter); filter.querySelector('summary').focus(); }
  });
  filterEmpty.querySelector('button').addEventListener('click', () => selectProjectFilter('全部状态'));
  document.addEventListener('click', (event) => { if (!filter.contains(event.target)) filter.open = false; });
  filter.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { filter.open = false; filter.querySelector('summary').focus(); }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    filter.open = true;
    const buttons = [...filter.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next].focus();
  });
  tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-project-tab]');
    if (!tab) return;
    filter.hidden = tab.dataset.projectTab !== 'drama';
    filter.open = false;
    syncProjectVisibility();
  });
  filter.hidden = tabs.querySelector('.active')?.dataset.projectTab !== 'drama';
  // 2026-09-26 保留原有静态卡片 ID，新增画布不能改变短剧的团队授权和积分映射。
  projectView.querySelectorAll('.project-card').forEach((card, index) => {
    if (!card.dataset.projectId && !card.dataset.managementId) card.dataset.managementId = `project-library-${index}`;
  });
  const dramaCards = [...projectView.querySelectorAll('[data-project-panel="drama"] .project-card')];
  dramaCards.forEach((card, index) => {
    card.dataset.projectStep = String(card.dataset.projectId === 'default-drama-project' ? 5 : ({ overall: 2, empty: 3, episode: 5 }[card.dataset.scriptStage] || 1));
    card.dataset.projectStatus = '未完成';
  });
  const demoRows = [
    ['长安来信', 1, '未完成'], ['雨夜追光', 2, '未完成'], ['第七次心动', 3, '未完成'],
    ['雾中的答案', 4, '未完成'], ['最后一班地铁', 5, '未审核'], ['逆光而行', 5, '审核不通过'],
    // 2026-10-29 项目卡片不使用已完成；片段全部制作完成且未送审的项目归入未审核。
    ['春日来客', 5, '审核通过'], ['时光便利店', 5, '未审核']
  ];
  function appendDemoCard(type, title, index, step, status) {
    const panel = projectView.querySelector(`[data-project-panel="${type}"]`);
    const source = panel.querySelector('.project-card');
    if (!source) return;
    const card = source.cloneNode(true);
    card.querySelectorAll('.project-management-entry, .project-step-progress').forEach((node) => node.remove());
    delete card.dataset.projectId;
    delete card.dataset.managementId;
    card.dataset.projectDemo = type;
    card.dataset.managementId = `project-demo-${type}-${index}`;
    // 2026-11-05 Product Design：仅原夏日新品发布卡片使用独立文本项目标记，保留稳定管理 ID、封面、改名和删除能力。
    if (type === 'canvas' && index === 0) card.dataset.textNodesProject = 'true';
    card.querySelector('.project-title').textContent = title;
    card.querySelector('.project-time').textContent = `2026/09/${String(25 - index).padStart(2, '0')} ${index % 2 ? '14:36' : '10:28'}`;
    if (type === 'drama') {
      card.dataset.projectStep = String(step);
      card.dataset.projectStatus = status;
      card.dataset.scriptStage = ['empty', 'overall', 'episode', 'asset', 'video'][step - 1];
    }
    panel.querySelector('.project-grid').insertBefore(card, panel.querySelector('[data-new-project]'));
  }
  demoRows.forEach(([title, step, status], index) => appendDemoCard('drama', title, index, step, status));
  ['文本节点', '品牌故事短片', '旅行灵感画布', '秋季上新计划'].forEach((title, index) => appendDemoCard('canvas', title, index));
  // 2026-11-05 Product Design：全部卡片创建后再将文本项目移到全能创作首位，保留其他卡片相对顺序、管理 ID 与专属导航；不改变短剧列表或克隆来源。
  const textNodesProjectCard = projectView.querySelector('[data-project-panel="canvas"] .project-card[data-text-nodes-project="true"]');
  if (textNodesProjectCard) textNodesProjectCard.parentElement.prepend(textNodesProjectCard);
  // 2026-11-09 Product Design：仅对调“产品发布视频画布”和“实时协同”两张既有卡片的位置；在 ID 分配及卡片克隆完成后移动完整节点，保留各自封面、名称、时间、权限和专属入口，其他卡片顺序不变。
  const productLaunchProjectCard = projectView.querySelector('[data-project-panel="canvas"] .project-card[data-management-id="project-library-0"]');
  const realtimeProjectCard = projectView.querySelector('[data-project-panel="canvas"] .project-card[data-realtime-collaboration-project="true"]');
  if (productLaunchProjectCard && realtimeProjectCard && productLaunchProjectCard.nextElementSibling === realtimeProjectCard) {
    productLaunchProjectCard.before(realtimeProjectCard);
  }
  // 2026-09-26 Product Design 改动逻辑：项目页短剧封面从图二对应的 17 张真人剧风格图中洗牌抽取；一轮内不重复，已分配卡片在列表刷新时保持原图。
  const dramaCoverChoices = Array.from({ length: 17 }, (_, index) => `live-${String(index + 1).padStart(2, '0')}.jpg`);
  const assignedDramaCovers = new WeakSet();
  let remainingDramaCovers = [];
  function assignDramaCover(card) {
    if (card.dataset.projectDestination !== 'script-studio' || assignedDramaCovers.has(card)) return;
    const cover = card.querySelector('.project-cover');
    if (!cover) return;
    if (!remainingDramaCovers.length) {
      remainingDramaCovers = [...dramaCoverChoices];
      for (let index = remainingDramaCovers.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [remainingDramaCovers[index], remainingDramaCovers[randomIndex]] = [remainingDramaCovers[randomIndex], remainingDramaCovers[index]];
      }
    }
    cover.classList.add('has-image');
    // 2026-09-26 Product Design 修复逻辑：用页面基准地址生成绝对图片 URL，并以内联优先级覆盖旧封面规则，避免相对路径解析后显示空白。
    const coverUrl = new URL(`./assets/images/drama-styles/${remainingDramaCovers.pop()}`, document.baseURI).href;
    cover.style.setProperty('background-image', `url("${coverUrl}")`, 'important');
    assignedDramaCovers.add(card);
  }
  // 2026-09-26 导航逻辑：演示短剧卡片统一打开“西部世界”；新增画布卡片复用第一张画布。
  // 编辑、删除仍保留各自按钮行为，不拦截这些操作，也不影响用户新建的短剧。
  projectView.addEventListener('click', (event) => {
    const card = event.target.closest('.project-card');
    if (!card || event.target.closest('button, input') || card.querySelector('.project-title-input')) return;
    // 2026-11-05 Product Design：文本项目单独启动，不再转点第一张画布；拦截到此为止，其他项目及短剧继续原导航。
    if (card.dataset.textNodesProject === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.vinaOpenTextNodesProject(card.querySelector('.project-title')?.textContent.trim() || '文本节点');
      return;
    }
    const isDemoDrama = dramaCards.includes(card) || card.dataset.projectDemo === 'drama';
    const target = isDemoDrama ? projectView.querySelector('[data-project-id="default-drama-project"]') : card.dataset.projectDemo === 'canvas' ? projectView.querySelector('[data-project-panel="canvas"] .project-card:not([data-project-demo])') : null;
    if (target && target !== card) { event.preventDefault(); event.stopImmediatePropagation(); target.click(); }
  }, true);
  function decorateDramaCard(card, dramaIndex) {
    if (card.dataset.projectDestination !== 'script-studio') return;
    const step = Number(card.dataset.projectStep) || ({ empty: 1, overall: 2, episode: 3, asset: 4, video: 5 }[card.dataset.scriptStage] || 1);
    // 2026-10-29 Product Design：制作阶段优先；分集“已完成”不作为项目状态。实际分集汇总优先于预置卡片标签，并按稳定 ID 隔离项目。
    const projectId = card.dataset.projectId || card.dataset.managementId;
    const summary = window.vinaDramaProjectSummaries?.get(projectId);
    let status = card.dataset.projectStatus || '未完成';
    if (summary) {
      const complete = summary.total > 0 && summary.completed === summary.total;
      const submitted = summary.pending + summary.approved + summary.rejected;
      status = !complete ? '未完成' : !submitted ? '未审核' : summary.approved === summary.total ? '审核通过' : '审核不通过';
      card.dataset.episodeCount = String(summary.total);
      // 看板与卡片读取同一汇总，待提交数量只统计已完成且未提交的集，不用剩余集数反推。
      const project = team.projects.find((item) => item.id === projectId);
      if (project) Object.assign(project, {
        episodeCount: summary.total, reviewTotalCount: summary.total,
        unsubmittedReviewCount: summary.unsubmitted, pendingReviewCount: summary.pending,
        approvedReviewCount: summary.approved, status
      });
    }
    if (status === '已完成') status = '未审核';
    if (!['未完成', '未审核', '审核通过', '审核不通过'].includes(status)) status = '未完成';
    if (card.dataset.projectStatus !== status) card.dataset.projectStatus = status;
    const label = status === '未完成' ? stages[step - 1] : status;
    let badge = card.querySelector('.project-stage-badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'project-stage-badge'; card.querySelector('.project-cover')?.append(badge); }
    // 2026-10-29 Product Design UI 同步逻辑：状态文字仍使用现有 label，圆点由设计稿的 ::before 样式绘制，避免重复圆点与基线偏移；状态计算、筛选及集数取值保持不变。
    if (badge.textContent !== label) badge.textContent = label;
    // 2026-09-26 Product Design 改动逻辑：短剧卡片时间右侧展示椭圆集数标签；优先使用已有集数，演示项目按稳定顺序填入含两位数的样例值。
    const sampleEpisodeCounts = [8, 12, 6, 15, 9, 10, 7, 18, 5, 12, 16, 11, 20];
    const storedEpisodeCount = Number(card.dataset.episodeCount);
    // 2026-10-29 实际分集汇总允许总集数为 0；已有样例仅在未提供真实集数时沿用样例数量。
    const episodeCount = card.dataset.episodeCount != null && Number.isInteger(storedEpisodeCount) && storedEpisodeCount >= 0 ? storedEpisodeCount : sampleEpisodeCounts[dramaIndex % sampleEpisodeCounts.length];
    let episodeBadge = card.querySelector('.project-episode-count');
    if (!episodeBadge) {
      episodeBadge = document.createElement('span');
      episodeBadge.className = 'project-episode-count';
      card.querySelector('.project-time')?.insertAdjacentElement('afterend', episodeBadge);
    }
    if (episodeBadge.textContent !== `${episodeCount}集`) episodeBadge.textContent = `${episodeCount}集`;
    // 2026-09-29 Product Design 改动逻辑：卡片不再展示五段进度线和 x/5 数字；阶段仍保存在卡片数据中供筛选和封面标签使用。
    card.querySelector('.project-step-progress')?.remove();
  }
  // 2026-09-30 Product Design 改动逻辑：不再为任何账号创建项目卡片管理按钮；用 WeakSet 记录已注册卡片，保留团队看板数据与授权同步，避免列表监听重复注册。
  const registeredCards = new WeakSet();
  function attachCards() {
    let dramaIndex = 0;
    projectView.querySelectorAll('.project-card').forEach((card, index) => {
      assignDramaCover(card);
      if (card.dataset.projectDestination === 'script-studio') decorateDramaCard(card, dramaIndex++);
      card.querySelectorAll('.project-management-entry').forEach((entry) => entry.remove());
      if (registeredCards.has(card)) return;
      // 静态卡片的初始索引只用作唯一 ID，不作为消耗数组索引；动态项目使用已有业务 ID，改名不改变授权。
      const id = card.dataset.projectId || card.dataset.managementId || `project-library-${index}`;
      card.dataset.managementId = id;
      const type = card.dataset.projectDestination === 'script-studio' ? '短剧' : '画布';
      const name = card.querySelector('.project-title')?.textContent.trim() || '未命名项目';
      const episodeCount = card.dataset.episodeCount == null ? undefined : Number(card.dataset.episodeCount);
      // 2026-09-23 项目管理修复逻辑：把项目卡片显示的时间传给共享模型，注册后的项目可参与团队看板的最近修改排序。
      const updatedAt = card.querySelector('.project-time')?.textContent.trim().replace(/\//g, '-').replace(' ', 'T');
      // 2026-09-29 改动逻辑：短剧卡片同步到团队看板的五步进度；尚未生成内容归“设定”，其后依次为大纲、剧本、资产、视频。
      const progress = { overall: '大纲', empty: '设定', episode: '剧本', asset: '资产', video: '视频' }[card.dataset.scriptStage] || '设定';
      const projectIndex = team.register(id,name,type,episodeCount,updatedAt,progress);
      seedCardProject(id, projectIndex);
      registeredCards.add(card);
    });
    syncProjectVisibility();
  }
  // 2026-09-24 普通成员可见性逻辑：项目页和首页卡片统一读取共享授权；无授权卡片连同交互入口一起隐藏，管理员及个人账号保留原列表。
  function syncProjectVisibility() {
    const restricted = account.classList.contains('is-team-account') && !team.canManage();
    const member = team.members.find((item) => item.id === team.currentMemberId && item.status === '正常');
    const cards = [...projectView.querySelectorAll('.project-card'), ...homeProjectList?.querySelectorAll('.project-card') || []];
    cards.forEach((card) => {
      const id = card.dataset.projectId || card.dataset.managementId;
      const index = team.projects.findIndex((project) => project.id === id);
      const allowed = !restricted || (member && index >= 0 && (member.projectMode === 'all' || member.assignedProjects?.includes(index)));
      // 2026-09-26 阶段筛选与授权共同决定显示，避免账号切换或成员刷新覆盖筛选结果。
      const isDrama = projectView.contains(card) && card.dataset.projectDestination === 'script-studio';
      // 2026-09-29 改动逻辑：移除进度线后直接读取卡片阶段数据，确保保留的制作阶段筛选继续生效。
      const step = Number(card.dataset.projectStep) || ({ empty: 1, overall: 2, episode: 3, asset: 4, video: 5 }[card.dataset.scriptStage] || 1);
      const matchesFilter = !isDrama || projectFilter === '全部状态' || projectFilter === stages[step - 1];
      card.hidden = !allowed || !matchesFilter;
      card.style.display = card.hidden ? 'none' : '';
    });
    // 2026-09-24 空状态逻辑：项目分组没有可见卡片时恢复新建入口，首页没有可见项目时隐藏整块。
    projectView.querySelectorAll('.project-panel').forEach((panel) => {
      const emptyButton = panel.querySelector('[data-new-project]');
      if (emptyButton) emptyButton.hidden = ![...panel.querySelectorAll('.project-card')].every((card) => card.hidden);
    });
    const dramaPanel = projectView.querySelector('[data-project-panel="drama"]');
    const noMatches = ![...dramaPanel.querySelectorAll('.project-card')].some((card) => !card.hidden);
    filterEmpty.hidden = projectFilter === '全部状态' || !noMatches;
    if (!filterEmpty.hidden) dramaPanel.querySelector('[data-new-project]').hidden = true;
    if (homeProjects && homeProjectList) homeProjects.hidden = ![...homeProjectList.querySelectorAll('.project-card')].some((card) => !card.hidden);
  }
  // 账号切换即时同步团队状态与项目可见性；监听项目列表增删以覆盖新建卡片，不干扰项目内部画布。
  function syncAccount() { const isTeam = account.classList.contains('is-team-account'); document.body.classList.toggle('project-team-account',isTeam); if (!isTeam && dialog.open) close(); syncProjectVisibility(); }
  new MutationObserver(syncAccount).observe(account,{attributes:true,attributeFilter:['class']});
  // 2026-10-29 制作阶段变化后刷新标签与阶段筛选；仅监听业务阶段属性，避免标签渲染反复触发自身。
  new MutationObserver(attachCards).observe(projectView,{childList:true,subtree:true,attributes:true,attributeFilter:['data-script-stage']});
  window.addEventListener('vina-drama-project-state-change', () => {
    attachCards();
    team.refresh();
  });
  if (homeProjectList) new MutationObserver(syncProjectVisibility).observe(homeProjectList,{childList:true});
  window.addEventListener('vina-project-membership-change', syncProjectVisibility);
  attachCards(); syncAccount();
})();
