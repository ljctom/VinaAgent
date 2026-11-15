// 2026-09-14 改动逻辑：父页面只负责上传入口；独立 iframe 复用短剧第二、三步，所有流程变量、DOM、资产画布与分镜状态均在子页面隔离。
(() => {
  const embedded = document.documentElement.classList.contains('redraw-embedded');
  const $ = selector => document.querySelector(selector);
  const validFiles = files => Array.from(files).filter(file => /\.(mp4|mov)$/i.test(file.name));
  if (!embedded) {
    const dialog = $('#overseasRedrawDialog');
    const input = $('[data-redraw-input]');
    const zone = $('[data-redraw-dropzone]');
    // 2026-11-04 Product Design 改动逻辑：直接绑定首页 Tab 中的上传与历史按钮，移除中间来源弹窗。
    const homeUploadButton = $('[data-home-remake-video-upload]');
    const homeUploadInput = $('[data-home-remake-video-input]');
    let frame;
    // 2026-11-01 原片播放：父页为实际选中的视频保留临时 Blob URL，供同源转绘 iframe 播放；重新建立实例时释放旧地址。
    let sourceMediaUrls = [];
    const releaseSourceMediaUrls = () => { sourceMediaUrls.forEach(url => URL.revokeObjectURL(url)); sourceMediaUrls = []; };
    window.addEventListener('pagehide', event => { if (!event.persisted) releaseSourceMediaUrls(); });
    let returnFocus;
    let oldOverflow;
    document.querySelectorAll('[data-overseas-redraw-open]').forEach(button => button.addEventListener('click', () => {
      returnFocus = button;
      if (frame) { frame.hidden = false; oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; frame.focus(); }
      else dialog.showModal();
    }));
    $('[data-redraw-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const r = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
    });
    function enter(files, opener = returnFocus, allowEmpty = false, sourceProject = null) {
      // 2026-09-26 Product Design 改动逻辑：左键按实际选择的视频文件名生成分集；右键入口按八集示例原片进入。
      const selectedFiles = validFiles(files).slice(0, 50);
      if (!selectedFiles.length && !allowEmpty && !sourceProject) { $('[data-redraw-status]').textContent = '请选择 MP4 或 MOV 视频文件'; return false; }
      // 2026-11-04 Product Design【仅原型】：视频转绘历史项目与右键“选择视频”共用八集示例原片，
      // 不依赖历史项目是否保存分集；子页沿用同一队列渲染第一步原片和第三步视频内容。
      // 这里只为原型填充展示数据，不代表读取了历史项目的真实视频；实际选择文件仍按真实文件名生成分集。
      // 来源项目仅传递 ID 和标题，普通短剧的项目数据、分集状态及打开逻辑均不修改。
      const seedNames = selectedFiles.length ? selectedFiles.map(file => file.name)
        : Array.from({ length: 8 }, (_, index) => `示例原片${String(index + 1).padStart(2, '0')}.mp4`);
      // 2026-11-04：直接记录本次首页来源按钮，退出转绘后将焦点还给该按钮，保持重制转绘 Tab 选中。
      returnFocus = opener || returnFocus;
      if (dialog.open) dialog.close();
      input.value = '';
      // 2026-09-26 改动逻辑：每次从首页开启新转绘项目时释放上一个已退出的 iframe，避免隐藏实例继续占用页面和保留旧分集。
      frame?.remove();
      releaseSourceMediaUrls();
      sourceMediaUrls = selectedFiles.map(file => URL.createObjectURL(file));
      frame = document.createElement('iframe');
      frame.className = 'redraw-workflow-frame';
      frame.title = '出海转绘独立工作流';
      // 2026-11-01 Product Design：个人版播放复用短剧原生全屏播放器，允许转绘 iframe 内的视频请求全屏。
      frame.allowFullscreen = true;
      const url = new URL(location.href);
      url.searchParams.set('workflow', 'overseas-redraw');
      // 2026-09-26 改动逻辑：文件名放在本次 iframe 地址的 hash 中，子页初始化时直接读取，避免加载消息早于列表监听导致显示 0 集。
      // 2026-11-01 改动逻辑：历史项目传递独立来源标识及分集元数据，沿用现有原型按名称建队列的方式，不修改原项目或伪造上传文件。
      const sourceParams = new URLSearchParams({ 'redraw-files': JSON.stringify(seedNames) });
      // 2026-11-01：临时媒体地址与文件名按同一顺序传递，不上传文件内容；右键示例和历史入口没有实际文件，继续使用原型视频。
      if (sourceMediaUrls.length) sourceParams.set('redraw-media', JSON.stringify(sourceMediaUrls));
      if (sourceProject) sourceParams.set('redraw-project', JSON.stringify({ id: sourceProject.id, title: sourceProject.title }));
      url.hash = sourceParams.toString();
      frame.src = url.href;
      oldOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.append(frame);
      frame.focus();
      return true;
    }
    // 2026-09-26 改动逻辑：首页上传按钮与右键快捷入口共用本脚本的转绘入口，文件选择不再依赖主应用脚本的初始化顺序。
    window.vinaOpenOverseasRedrawWorkflow = (files, opener) => enter(files, opener);
    // 2026-11-04 Product Design 改动逻辑：三种来源直接在 Tab 内操作，文件夹和视频继续复用原文件处理，状态提示显示在首页面板。
    const folderButton = $('[data-home-remake-folder-upload]');
    const folderInput = $('[data-home-remake-folder-input]');
    const historyButtons = Array.from(document.querySelectorAll('[data-home-remake-history-open]'));
    let historyButton = historyButtons[0];
    let historyMode = 'video';
    const sourceStatus = $('[data-home-remake-source-status]');
    function setSourceStatus(message = '') {
      if (!sourceStatus) return;
      sourceStatus.textContent = message;
      sourceStatus.hidden = !message;
    }
    folderButton?.addEventListener('click', () => { setSourceStatus(); folderInput?.click(); });
    folderInput?.addEventListener('change', () => {
      const videos = validFiles(folderInput.files || []).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
      if (videos.length) enter(videos, folderButton);
      else if (folderInput.files?.length) setSourceStatus('该文件夹中没有 MP4 或 MOV 视频，请重新选择文件夹');
      folderInput.value = '';
    });

    // 2026-11-01 Product Design 改动逻辑：历史弹窗只读取现有短剧卡片，不复制示例项目；按稳定 ID 去重，并直接校验共享团队模型以避免筛选状态影响可选范围。
    const historyDialog = document.createElement('dialog');
    historyDialog.id = 'homeRemakeHistoryDialog';
    historyDialog.className = 'home-remake-history-dialog';
    historyDialog.setAttribute('aria-labelledby', 'homeRemakeHistoryTitle');
    historyDialog.setAttribute('aria-describedby', 'homeRemakeHistoryDescription');
    // 2026-11-04 Product Design 改动逻辑：历史弹窗去掉制作阶段表头及整列内容，保留项目名称、集数、搜索、单选和确认流程；视频步骤筛选与权限规则不变。
    // 2026-11-04 Product Design 改动逻辑：移除“项目名称”表头整行及其分隔线与占位，搜索框下直接显示项目列表，保留搜索、单选与确认逻辑。
    historyDialog.innerHTML = `<header class="home-remake-history-header"><div><h2 id="homeRemakeHistoryTitle">选择历史项目</h2><p id="homeRemakeHistoryDescription">从短剧项目中选择一个项目，继续重制转绘</p></div><button class="home-remake-history-close" type="button" data-remake-history-cancel aria-label="关闭历史项目选择"><img src="./assets/icons/script-close.svg" alt=""></button></header>
      <div class="home-remake-history-search"><input type="search" data-remake-history-search aria-label="搜索短剧项目" placeholder="搜索项目名称" autocomplete="off"></div>
      <div class="home-remake-history-list" data-remake-history-list role="group" aria-label="历史短剧项目"></div>
      <p class="home-remake-history-message" data-remake-history-message role="status" hidden></p>
      <footer class="home-remake-history-footer"><span data-remake-history-selection aria-live="polite">请选择一个项目</span><div><button class="home-remake-history-cancel" type="button" data-remake-history-cancel>取消</button><button class="home-remake-history-confirm" type="button" data-remake-history-confirm disabled>确认</button></div></footer>`;
    document.body.append(historyDialog);
    const historyList = historyDialog.querySelector('[data-remake-history-list]');
    const historySearch = historyDialog.querySelector('[data-remake-history-search]');
    const historyConfirm = historyDialog.querySelector('[data-remake-history-confirm]');
    const historySelection = historyDialog.querySelector('[data-remake-history-selection]');
    const historyMessage = historyDialog.querySelector('[data-remake-history-message]');
    let historyProjects = [], selectedHistoryId = '';
    const escapeHistory = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    function readHistoryProjects() {
      const team = window.vinaProjectTeam;
      const restricted = $('.global-account')?.classList.contains('is-team-account') && team && !team.canManage();
      const member = restricted ? team.members.find(item => item.id === team.currentMemberId && item.status === '正常') : null;
      const seen = new Set();
      return Array.from(document.querySelectorAll('[data-project-panel="drama"] .project-card')).flatMap((card, index) => {
        const id = card.dataset.projectId || card.dataset.managementId || `drama-card-${index}`;
        if (seen.has(id)) return [];
        // 2026-11-03：视频入口仅允许第五步项目；改编入口显示所有阶段，权限过滤继续共用原逻辑。
        if (historyMode === 'video' && window.vinaGetHistoryDramaRoute?.(id) !== 'video') return [];
        seen.add(id);
        const projectIndex = team?.projects.findIndex(project => project.id === id) ?? -1;
        if (restricted && (!member || projectIndex < 0 || (member.projectMode !== 'all' && !member.assignedProjects?.includes(projectIndex)))) return [];
        return [{ id, card, title: card.querySelector('.project-title')?.textContent.trim() || '未命名短剧',
          count: Number(card.dataset.episodeCount) || 0 }];
      });
    }
    // 2026-11-09 Product Design 改动逻辑：视频转绘列表仅显示项目名称，去掉“短剧项目”和集数副标题；剧本改编入口沿用现有展示。
    function renderHistory() {
      const query = historySearch.value.trim().toLocaleLowerCase();
      const projects = historyProjects.filter(project => project.title.toLocaleLowerCase().includes(query));
      historyList.innerHTML = projects.length ? projects.map(project => `<label class="home-remake-history-row"><input type="radio" name="remake-history-project" value="${escapeHistory(project.id)}" ${selectedHistoryId === project.id ? 'checked' : ''}><span class="home-remake-history-project"><strong>${escapeHistory(project.title)}</strong>${historyMode === 'video' ? '' : `<small>${project.count ? `共 ${project.count} 集` : '短剧项目'}</small>`}</span></label>`).join('') : `<div class="home-remake-history-empty">${query ? '未找到匹配的项目，请尝试其他名称' : (historyMode === 'video' ? '暂无已到视频步骤的历史项目' : '暂无可选择的短剧项目')}</div>`;
      const selected = historyProjects.find(project => project.id === selectedHistoryId);
      historyConfirm.disabled = !selected;
      // 2026-11-09 Product Design 改动逻辑：视频转绘移除未选择和已选择的底部提示，保留空容器使取消、确认按钮继续靠右。
      historySelection.textContent = historyMode === 'video' ? '' : (selected ? `已选择：${selected.title}` : '请选择一个项目');
    }
    // 2026-11-03 Product Design：两个按钮复用原生项目弹窗，切换入口时清空搜索与选中，
    // 同步标题、说明及空状态，取消后焦点回到本次点击的入口。
    historyButtons.forEach(button => button.addEventListener('click', () => {
      setSourceStatus();
      historyButton = button;
      historyMode = button.dataset.homeRemakeHistoryOpen === 'video' ? 'video' : 'script';
      // 2026-11-04 Product Design 改动逻辑：同步当前入口供样式识别，仅收窄出海视频转绘的项目弹窗，剧本改编继续使用原宽度。
      historyDialog.dataset.historyMode = historyMode;
      historyDialog.querySelector('#homeRemakeHistoryTitle').textContent = historyMode === 'video' ? '选择视频转绘项目' : '选择剧本改编项目';
      historyDialog.querySelector('#homeRemakeHistoryDescription').textContent = historyMode === 'video' ? '仅展示已到视频步骤的历史项目，选择后继续重制转绘' : '从全部历史短剧项目中选择，重新设定目标国家并改编剧本';
      historyProjects = readHistoryProjects();
      selectedHistoryId = '';
      historySearch.value = '';
      historyMessage.hidden = true;
      renderHistory();
      historyDialog.showModal();
      historySearch.focus();
    }));
    historySearch.addEventListener('input', renderHistory);
    historyList.addEventListener('change', event => {
      if (!event.target.matches('input[type="radio"]')) return;
      selectedHistoryId = event.target.value;
      // 保留原生 radio 的焦点与方向键导航，不在选中时重建列表。
      const selected = historyProjects.find(project => project.id === selectedHistoryId);
      historyConfirm.disabled = !selected;
      // 2026-11-09 Product Design 改动逻辑：视频转绘移除未选择和已选择的底部提示，保留空容器使取消、确认按钮继续靠右。
      historySelection.textContent = historyMode === 'video' ? '' : (selected ? `已选择：${selected.title}` : '请选择一个项目');
    });
    // 2026-11-04 Product Design 改动逻辑：关闭、取消、Escape 和遮罩均直接返回首页重制转绘面板，不再重新打开来源弹窗。
    function returnToHistorySource() {
      historyDialog.close('cancel');
    }
    historyDialog.querySelectorAll('[data-remake-history-cancel]').forEach(button => button.addEventListener('click', returnToHistorySource));
    historyDialog.addEventListener('cancel', event => {
      event.preventDefault();
      returnToHistorySource();
    });
    historyDialog.addEventListener('click', event => { if (event.target === historyDialog) {
      const rect = historyDialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) returnToHistorySource();
    } });
    // 2026-11-04：仅取消关闭时恢复首页历史按钮焦点；确认进入工作流时保留新工作区的焦点。
    historyDialog.addEventListener('close', () => {
      if (historyDialog.returnValue === 'cancel' && (!frame || frame.hidden)) historyButton?.focus();
    });
    historyConfirm.addEventListener('click', () => {
      // 确认前重新读取，项目已删除或权限已变化时保留弹窗并要求重新选择。
      const selected = readHistoryProjects().find(project => project.id === selectedHistoryId);
      if (!selected) {
        selectedHistoryId = '';
        historyProjects = readHistoryProjects();
        renderHistory();
        historyMessage.textContent = '该项目已不可用，请重新选择';
        historyMessage.hidden = false;
        return;
      }
      // 2026-11-03：只在历史来源确认入口分流，视频项目继续原转绘；前期项目新建独立改编短剧，
      // 先进入第一步，确认目标国家后进入第二步发送历史附件；不修改原项目或普通短剧入口。
      // 2026-11-03：由用户选择的入口决定流程，视频项目也可通过剧本入口重新改编。
      if (historyMode === 'script') {
        if (typeof window.vinaStartHistoryDramaAdaptation !== 'function') {
          historyMessage.textContent = '项目初始化尚未完成，请稍后重试';
          historyMessage.hidden = false;
          return;
        }
        // 先关闭顶层 dialog，避免它在新建工作区后将焦点还给已隐藏的首页。
        historyDialog.close();
        if (!window.vinaStartHistoryDramaAdaptation(selected.id, selected.title)) {
          historyDialog.showModal();
          historyMessage.textContent = '无法读取该项目，请重新选择';
          historyMessage.hidden = false;
        }
        return;
      }
      // 2026-11-04 Product Design【仅原型】：任意可选的视频转绘历史项目都走右键“选择视频”的八集填充入口，
      // 保留所选项目名称，第一步与第三步共用示例分集；不读取或回写普通短剧的历史分集数据。
      // 正式业务应读取所选项目的真实原片与视频，本处仅用于原型展示，剧本改编分支保持原逻辑。
      historyDialog.close();
      enter([], historyButton, true, { id: selected.id, title: selected.title });
    });
    homeUploadButton?.addEventListener('click', () => { setSourceStatus(); homeUploadInput?.click(); });
    homeUploadInput?.addEventListener('change', () => {
      const files = Array.from(homeUploadInput.files || []);
      if (files.length) {
        if (!validFiles(files).length) { setSourceStatus('请选择 MP4 或 MOV 视频文件'); homeUploadInput.value = ''; return; }
        enter(files, homeUploadButton);
      }
      homeUploadInput.value = '';
    });
    // 2026-11-01 Product Design【仅原型演示】：选择文件夹与选择视频共用右键快捷入口，跳过系统选择器，
    // 按八集示例原片直接进入转绘，展示“已上传八个视频”的状态；此处没有读取或实际上传本地文件。
    // 正式业务代码不得采用此右键模拟上传逻辑：应由用户实际选择文件夹/视频，完成真实文件校验与上传后再进入流程；左键继续保留现有选择逻辑。
    [folderButton, homeUploadButton].forEach(button => button?.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      enter([], event.currentTarget, true);
    }));
    zone.addEventListener('click', () => input.click());
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('change', () => enter(input.files));
    ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('is-dragging'); }));
    zone.addEventListener('dragleave', event => { if (!zone.contains(event.relatedTarget)) zone.classList.remove('is-dragging'); });
    zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('is-dragging'); enter(event.dataTransfer.files); });
    window.addEventListener('message', event => {
      // 2026-11-02 修复逻辑：仅接受当前同源转绘实例的退出消息；移除实例和临时视频地址，恢复外层首页的滚动与上传入口焦点，避免停留在缺少侧栏和上传绑定的内嵌首页。
      // 2026-11-02 修复逻辑：本地 file 页面发送消息时 event.origin 为 null，不能与 location.origin 的 file:// 直接比较；文件模式只放行当前转绘 iframe 的本地来源，HTTP 模式仍严格校验同源。
      const trustedOrigin = location.protocol === 'file:'
        ? event.origin === 'null' || event.origin === 'file://'
        : event.origin === location.origin;
      if (!frame || !trustedOrigin || event.source !== frame.contentWindow || event.data?.type !== 'vina-redraw-exit') return;
      frame.remove();
      frame = null;
      releaseSourceMediaUrls();
      document.body.style.overflow = oldOverflow ?? '';
      const focusTarget = returnFocus?.isConnected ? returnFocus : sourceOpenButton;
      focusTarget?.focus({ preventScroll: true });
    });
    return;
  }

  // 2026-11-01 Product Design：各步骤共用旧浮动退出节点清理，兼容已打开实例及页面往返恢复；顶部返回箭头继续使用独立的 data-redraw-exit。
  function removeLegacyRedrawExit() {
    document.querySelectorAll('.redraw-exit-fixed').forEach(button => button.remove());
  }
  window.addEventListener('pageshow', removeLegacyRedrawExit);

  function initialize() {
    removeLegacyRedrawExit();
    // 2026-11-02 修复逻辑：转绘各步骤共用退出入口；内嵌实例通知外层关闭，独立打开时去掉转绘地址参数后加载完整首页。
    const exit = () => {
      // 2026-11-02：file:// 是不透明消息来源，必须使用 * 作为目标；接收方仍验证当前 iframe 的 contentWindow，不接受其他窗口退出请求。
      if (parent !== window) parent.postMessage({ type: 'vina-redraw-exit' }, location.protocol === 'file:' || location.origin === 'null' ? '*' : location.origin);
      else location.href = location.pathname;
    };
    // 2026-11-02 修复逻辑：返回按钮和路由退出桥接先于账户继承、分集渲染及播放器初始化绑定，防止后续初始化中断后首步无法退出。
    $('[data-redraw-exit]')?.addEventListener('click', exit);
    window.addEventListener('vina-redraw-request-exit', exit);
    // 2026-09-26 改动逻辑：进入转绘 iframe 时立即启用短剧全屏布局和首步状态，后续初始化即使延迟也不暴露首页顶栏、侧栏或遮住进度条。
    document.body.classList.add('drama-workflow-active');
    document.body.dataset.redrawStep = 'redraw-original';
    // 2026-09-26 改动逻辑：子页面一旦有 DOM 就先展示上传原片页并解除遮罩；后续列表初始化异常时也不会留下整页空白。
    document.querySelectorAll('[data-view]').forEach(view => { view.hidden = view.dataset.view !== 'redraw-original'; });
    document.documentElement.classList.add('redraw-ready');
    // 2026-11-01 Product Design：独立转绘页继承同源入口的个人/团队标记，第四格沿用普通短剧的播放/审片显隐规则。
    // 审片权限仍实时读取入口团队的开关，避免子页默认管理员身份放行无审片权限的成员；独立打开时使用本页身份。
    if (parent !== window) {
      try {
        $('.global-account')?.classList.toggle('is-team-account', Boolean(parent.document.querySelector('.global-account.is-team-account')));
        if (window.vinaProjectTeam && parent.vinaProjectTeam) {
          window.vinaProjectTeam.canReviewDrama = () => parent.vinaProjectTeam.canReviewDrama();
        }
      } catch (error) {
        // 2026-11-02 修复逻辑：浏览器可能隔离 file 父子页面；此时保留子页自身账户初始化，不让父页 DOM 读取的 SecurityError 中断原片列表、步骤和退出事件。HTTP 同源继承保持原样。
        if (error.name !== 'SecurityError') throw error;
      }
    }
    // 2026-09-26 Product Design 改动逻辑：进入转绘页就按入口带来的文件名建立原片队列，右键入口自然显示八集示例。
    // 2026-11-06 Product Design 改动逻辑：封面展示复用 UI 新的八张本地原图；分集数据、视频 URL、播放和上传处理保持原样。
    const covers = ['linyu', 'zhangman', 'coatman', 'classroom', 'teacher', 'corridor', 'headmaster', 'archive-bag']
      .map(name => `url('./assets/images/redraw-original/${name}.jpg') center / cover no-repeat #0d141b`);
    const seedNames = (() => {
      try {
        const names = JSON.parse(new URLSearchParams(location.hash.slice(1)).get('redraw-files'));
        return Array.isArray(names) ? names : [];
      } catch { return []; }
    })();
    // 2026-11-01 原片播放：读取入口传来的本地视频地址；仅原型/历史示例缺少原文件时播放短剧现有演示视频，不代表真实上传内容。
    const seedMediaUrls = (() => {
      try {
        const urls = JSON.parse(new URLSearchParams(location.hash.slice(1)).get('redraw-media'));
        return Array.isArray(urls) ? urls : [];
      } catch { return []; }
    })();
    // 2026-11-05 Product Design 改动逻辑：出海转绘缺少上传文件时，原片预览改用 app.js 现有素材目录中的 720×1280（9:16）、约 36 秒竖屏视频，替换横屏汽车视频。
    // 仅替换当前独立转绘实例的默认来源；实际上传视频仍优先使用 Blob URL，普通短剧的媒体地址和播放逻辑不变。
    const demoSourceVideo = 'https://cdn.piccopilot.com/static/video_maker_template_video/7588208422147984653.mp4';
    const localSourceMediaUrls = new Set();
    function createSourceMediaUrl(file) {
      const url = URL.createObjectURL(file);
      localSourceMediaUrls.add(url);
      return url;
    }
    function releaseSourceMediaUrl(url) {
      if (localSourceMediaUrls.delete(url)) URL.revokeObjectURL(url);
    }
    window.addEventListener('pagehide', event => {
      if (!event.persisted) Array.from(localSourceMediaUrls).forEach(releaseSourceMediaUrl);
    });
    let episodes = seedNames.slice(0, 50).map((filename, index) => ({
      id: index + 1,
      name: `第 ${index + 1} 集`,
      filename: String(filename || `原片 ${index + 1}.mp4`),
      mediaUrl: typeof seedMediaUrls[index] === 'string' && seedMediaUrls[index].startsWith('blob:') ? seedMediaUrls[index] : demoSourceVideo,
      duration: '00:30',
      cover: covers[index % covers.length]
    }));
    // 2026-11-01 改动逻辑：历史入口在独立转绘工作流展示来源项目名称；不跳转普通短剧设定，也不改写原项目。
    try {
      const sourceProject = JSON.parse(new URLSearchParams(location.hash.slice(1)).get('redraw-project'));
      if (sourceProject?.title) {
        const title = $('.redraw-project-title');
        if (title) title.textContent = sourceProject.title;
        const heading = $('.redraw-original-heading h1');
        if (heading) heading.textContent = '项目原片';
      }
    } catch { /* 非历史入口继续沿用默认上传原片标题。 */ }
    let serial = episodes.length;
    let chosenStyle = '';
    let chosenRegion = '';
    // 2026-11-01 Product Design：参考强度仅保留在当前转绘实例，初始不预选，不新增解析前的必选校验。
    let chosenStrength = '';
    // 2026-09-30 Product Design 改动逻辑：转绘复用剧本创作的三分类和真实封面目录，选择与自定义草稿仅保存在当前转绘实例。
    let category = 'live';
    let customStyleDescription = '';
    // 2026-11-06 Product Design 改动逻辑：转绘风格面板移除自定义分类入口，仅展示 AI真人剧和 AI漫剧；预设卡片、选择和后续解析逻辑不变。
    const redrawStyleCategories = [
      { id: 'live', name: 'AI真人剧' },
      { id: 'comic', name: 'AI漫剧' }
    ];
    const redrawStyleCatalog = Array.from(document.querySelectorAll('[data-script-setup-style]')).map(card => ({
      id: card.dataset.scriptSetupStyle,
      name: card.dataset.scriptSetupStyleName,
      category: card.dataset.scriptSetupStyleCategory,
      image: card.querySelector('img')?.getAttribute('src') || ''
    }));
    // 2026-11-03 Product Design：成功确认解析后锁定本次转绘实例的新增原片能力；步骤往返不重置，重新创建项目时才恢复。
    let sourceAdditionLocked = false;
    let replaceId = null;
    let dragging = null;
    const sourceInput = $('[data-redraw-source-input]');
    const grid = $('[data-redraw-original-grid]');
    const notice = $('[data-redraw-notice]');
    // 2026-09-26 Product Design 改动逻辑：转绘首步的缺失国家提示复用独立 toast 节点，并在重复点击时重新计时。
    const validationToast = $('[data-redraw-toast]');
    let validationToastTimer = 0;
    function showValidationToast(message) {
      validationToast.textContent = message;
      validationToast.hidden = false;
      window.clearTimeout(validationToastTimer);
      validationToastTimer = window.setTimeout(() => { validationToast.hidden = true; }, 2400);
    }
    const stylePanel = $('#redrawStylePanel');
    const regionPanel = $('#redrawRegionPanel');
    const styleToggle = $('[data-redraw-style-toggle]');
    const regionToggle = $('[data-redraw-region-toggle]');
    const strengthPanel = $('#redrawStrengthPanel');
    const strengthToggle = $('[data-redraw-strength-toggle]');
    const originalEpisodeCard = $('[data-episode-card]').cloneNode(true);
    // 2026-11-01 Product Design：封面中央播放图标复用短剧视频阶段现有 SVG，不另画图标；原生按钮同时支持鼠标与键盘。
    const sourcePlayIcon = originalEpisodeCard.querySelector('.episode-cover-play').innerHTML;
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    // 2026-11-01 Product Design 修复：直接以 img 显示已有 Lucide SVG，图标内嵌为 data URL，移除 CSS mask 的路径和本地文件限制。
    // 图形沿用原资源，仅把描边设为按钮文字色；手柄、重传、删除、上移、下移均有图标，禁用透明度仍由父按钮统一控制。
    // 2026-11-06 Product Design 改动逻辑：删除图标沿用现有 Lucide 图片，仅将默认描边改为 UI 新的灰蓝色，保留原 img 渲染及按钮事件。
    const sourceIconImages = Object.freeze({
      'redraw-source/grip-vertical': 'data:image/svg+xml;base64,PCEtLSAyMDI2LTExLTAxIFByb2R1Y3QgRGVzaWduOiByZXVzZSBMdWNpZGUgaWNvbnMgZm9yIHNvdXJjZSB2aWRlbyBvcmRlcmluZyBhbmQgcmVwbGFjZW1lbnQuIC0tPgo8IS0tIEBsaWNlbnNlIGx1Y2lkZS1zdGF0aWMgdjAuNDY4LjAgLSBJU0MgLS0+CjxzdmcKICBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1ncmlwLXZlcnRpY2FsIgogIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICB3aWR0aD0iMjQiCiAgaGVpZ2h0PSIyNCIKICB2aWV3Qm94PSIwIDAgMjQgMjQiCiAgZmlsbD0ibm9uZSIKICBzdHJva2U9IiNhZWI4YzUiCiAgc3Ryb2tlLXdpZHRoPSIyIgogIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIKICBzdHJva2UtbGluZWpvaW49InJvdW5kIgo+CiAgPGNpcmNsZSBjeD0iOSIgY3k9IjEyIiByPSIxIiAvPgogIDxjaXJjbGUgY3g9IjkiIGN5PSI1IiByPSIxIiAvPgogIDxjaXJjbGUgY3g9IjkiIGN5PSIxOSIgcj0iMSIgLz4KICA8Y2lyY2xlIGN4PSIxNSIgY3k9IjEyIiByPSIxIiAvPgogIDxjaXJjbGUgY3g9IjE1IiBjeT0iNSIgcj0iMSIgLz4KICA8Y2lyY2xlIGN4PSIxNSIgY3k9IjE5IiByPSIxIiAvPgo8L3N2Zz4K',
      'redraw-source/rotate-cw': 'data:image/svg+xml;base64,PCEtLSAyMDI2LTExLTAxIFByb2R1Y3QgRGVzaWduOiByZXVzZSBMdWNpZGUgaWNvbnMgZm9yIHNvdXJjZSB2aWRlbyBvcmRlcmluZyBhbmQgcmVwbGFjZW1lbnQuIC0tPgo8IS0tIEBsaWNlbnNlIGx1Y2lkZS1zdGF0aWMgdjAuNDY4LjAgLSBJU0MgLS0+CjxzdmcKICBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1yb3RhdGUtY3ciCiAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iI2FlYjhjNSIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMjEgMTJhOSA5IDAgMSAxLTktOWMyLjUyIDAgNC45MyAxIDYuNzQgMi43NEwyMSA4IiAvPgogIDxwYXRoIGQ9Ik0yMSAzdjVoLTUiIC8+Cjwvc3ZnPgo=',
      'review-annotation/trash-2': 'data:image/svg+xml;base64,PCEtLSBAbGljZW5zZSBsdWNpZGUtc3RhdGljIHYwLjQ2OC4wIC0gSVNDIC0tPgo8c3ZnCiAgY2xhc3M9Imx1Y2lkZSBsdWNpZGUtdHJhc2gtMiIKICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgd2lkdGg9IjI0IgogIGhlaWdodD0iMjQiCiAgdmlld0JveD0iMCAwIDI0IDI0IgogIGZpbGw9Im5vbmUiCiAgc3Ryb2tlPSIjOWFhNmIyIgogIHN0cm9rZS13aWR0aD0iMiIKICBzdHJva2UtbGluZWNhcD0icm91bmQiCiAgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIKPgogIDxwYXRoIGQ9Ik0zIDZoMTgiIC8+CiAgPHBhdGggZD0iTTE5IDZ2MTRjMCAxLTEgMi0yIDJIN2MtMSAwLTItMS0yLTJWNiIgLz4KICA8cGF0aCBkPSJNOCA2VjRjMC0xIDEtMiAyLTJoNGMxIDAgMiAxIDIgMnYyIiAvPgogIDxsaW5lIHgxPSIxMCIgeDI9IjEwIiB5MT0iMTEiIHkyPSIxNyIgLz4KICA8bGluZSB4MT0iMTQiIHgyPSIxNCIgeTE9IjExIiB5Mj0iMTciIC8+Cjwvc3ZnPgo=',
      'redraw-source/arrow-up': 'data:image/svg+xml;base64,PCEtLSAyMDI2LTExLTAxIFByb2R1Y3QgRGVzaWduOiByZXVzZSBMdWNpZGUgaWNvbnMgZm9yIHNvdXJjZSB2aWRlbyBvcmRlcmluZyBhbmQgcmVwbGFjZW1lbnQuIC0tPgo8IS0tIEBsaWNlbnNlIGx1Y2lkZS1zdGF0aWMgdjAuNDY4LjAgLSBJU0MgLS0+CjxzdmcKICBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1hcnJvdy11cCIKICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgd2lkdGg9IjI0IgogIGhlaWdodD0iMjQiCiAgdmlld0JveD0iMCAwIDI0IDI0IgogIGZpbGw9Im5vbmUiCiAgc3Ryb2tlPSIjYWViOGM1IgogIHN0cm9rZS13aWR0aD0iMiIKICBzdHJva2UtbGluZWNhcD0icm91bmQiCiAgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIKPgogIDxwYXRoIGQ9Im01IDEyIDctNyA3IDciIC8+CiAgPHBhdGggZD0iTTEyIDE5VjUiIC8+Cjwvc3ZnPgo=',
      'redraw-source/arrow-down': 'data:image/svg+xml;base64,PCEtLSAyMDI2LTExLTAxIFByb2R1Y3QgRGVzaWduOiByZXVzZSBMdWNpZGUgaWNvbnMgZm9yIHNvdXJjZSB2aWRlbyBvcmRlcmluZyBhbmQgcmVwbGFjZW1lbnQuIC0tPgo8IS0tIEBsaWNlbnNlIGx1Y2lkZS1zdGF0aWMgdjAuNDY4LjAgLSBJU0MgLS0+CjxzdmcKICBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1hcnJvdy1kb3duIgogIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICB3aWR0aD0iMjQiCiAgaGVpZ2h0PSIyNCIKICB2aWV3Qm94PSIwIDAgMjQgMjQiCiAgZmlsbD0ibm9uZSIKICBzdHJva2U9IiNhZWI4YzUiCiAgc3Ryb2tlLXdpZHRoPSIyIgogIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIKICBzdHJva2UtbGluZWpvaW49InJvdW5kIgo+CiAgPHBhdGggZD0iTTEyIDV2MTQiIC8+CiAgPHBhdGggZD0ibTE5IDEyLTcgNy03LTciIC8+Cjwvc3ZnPgo='
    });
    const sourceIcon = name => `<img class="redraw-source-icon" src="${sourceIconImages[name]}" alt="" aria-hidden="true" draggable="false">`;
    function pickFiles(id = null) {
      // 2026-11-03：确认解析后不再打开新增文件选择器；已有分集的重新上传继续使用原入口。
      if (sourceAdditionLocked && id === null) return;
      replaceId = id; sourceInput.multiple = id === null; sourceInput.click();
    }
    // 2026-09-14 修正逻辑：集数编号按当前数组位置计算，素材 ID 与自定义集名随原片移动；排序、删除和新增后统一重排显示编号。
    function displayEpisodeName(episode, index) {
      const customName = /^第\s*\d+\s*集$/.test(episode.name) ? '' : episode.name;
      return `第 ${index + 1} 集${customName ? `：${customName}` : ''}`;
    }
    // 2026-11-01 Product Design：上移、下移和拖动完成后，以稳定素材 ID 找到新位置的视频行，显示约 1 秒灰蓝色边框。
    // 连续操作只标记最近一次移动的原片，并重新计时；重绘、离开步骤或页面时清除提示及定时器。
    let sourceMoveHighlightTimer = 0;
    function clearSourceMoveHighlight() {
      window.clearTimeout(sourceMoveHighlightTimer);
      sourceMoveHighlightTimer = 0;
      grid.querySelectorAll('.is-source-moved').forEach(card => card.classList.remove('is-source-moved'));
    }
    function highlightSourceMove(id) {
      clearSourceMoveHighlight();
      const card = grid.querySelector(`[data-source-id="${id}"]`);
      if (!card) return;
      card.classList.add('is-source-moved');
      sourceMoveHighlightTimer = window.setTimeout(() => {
        card.classList.remove('is-source-moved');
        sourceMoveHighlightTimer = 0;
      }, 1000);
    }
    window.addEventListener('pagehide', clearSourceMoveHighlight);
    window.addEventListener('vina-view-changed', clearSourceMoveHighlight);
    function render() {
      clearSourceMoveHighlight();
      // 2026-11-03 Product Design：原片行不再展示“未解析”标签；确认解析后隐藏并禁用添加按钮，后续重绘仍保留锁定状态。
      const addButton = $('[data-redraw-add]');
      addButton.hidden = sourceAdditionLocked;
      addButton.disabled = sourceAdditionLocked;
      // 2026-11-01 Product Design：每集独占一行，信息与右侧 2×2 操作区分列；保留改名、播放、重传、删除和上下移动的数据入口。
      // 2026-11-06 Product Design 改动逻辑：集名独立一组，文件名与时长分两行显示；原有 data 属性、集名输入框及所有操作按钮保持原样。
      grid.innerHTML = episodes.map((episode, i) => `<article class="redraw-original-card" data-source-id="${episode.id}">
        <button type="button" class="redraw-drag-handle" draggable="false" title="拖动调整分集顺序，也可使用右侧上移、下移按钮" aria-label="拖动调整${escape(displayEpisodeName(episode, i))}的顺序">${sourceIcon('redraw-source/grip-vertical')}</button>
        <button type="button" class="redraw-source-cover" draggable="false" data-source-play="${episode.id}" style="background:${episode.cover}" aria-label="播放${escape(displayEpisodeName(episode, i))}"><span class="redraw-source-play" aria-hidden="true">${sourcePlayIcon}</span><span class="redraw-source-duration">${episode.duration}</span></button>
        <div class="redraw-source-info"><div class="redraw-source-title"><input data-source-name="${episode.id}" value="${escape(displayEpisodeName(episode, i))}" size="${Math.max(6, Math.min(40, displayEpisodeName(episode, i).length * 2))}" maxlength="60" aria-label="第 ${i+1} 个分集名称"></div><div class="redraw-source-details"><p class="redraw-source-filename" title="${escape(episode.filename)}">${escape(episode.filename)}</p><p class="redraw-source-meta">时长 ${episode.duration}</p></div></div>
        <div class="redraw-source-actions">
          <button type="button" data-source-replace="${episode.id}">${sourceIcon('redraw-source/rotate-cw')}<span>重新上传</span></button>
          <button type="button" class="redraw-source-delete" data-source-delete="${episode.id}">${sourceIcon('review-annotation/trash-2')}<span>删除</span></button>
          <button type="button" data-source-up="${episode.id}" ${i===0?'disabled':''} aria-label="上移 ${escape(displayEpisodeName(episode, i))}">${sourceIcon('redraw-source/arrow-up')}<span>上移</span></button>
          <button type="button" data-source-down="${episode.id}" ${i===episodes.length-1?'disabled':''} aria-label="下移 ${escape(displayEpisodeName(episode, i))}">${sourceIcon('redraw-source/arrow-down')}<span>下移</span></button>
        </div></article>`).join('');
      // 2026-11-01：去掉顶部总集数行，不再查找已移除的节点；有原片时启用确认按钮，全部删除后继续禁用。
      $('[data-redraw-confirm]').disabled = !episodes.length;
    }
    function move(id, offset) {
      const from = episodes.findIndex(item => item.id === id), to = from + offset;
      if (from < 0 || to < 0 || to >= episodes.length || to === from) return;
      episodes.splice(to, 0, episodes.splice(from, 1)[0]); render();
      highlightSourceMove(id);
    }
    grid.addEventListener('change', event => {
      const id = Number(event.target.dataset.sourceName);
      const episode = episodes.find(item => item.id === id);
      if (episode) {
        // 编辑只保存集名，去除显示编号；编号始终由当前位置生成，不能跟随旧分集位置残留。
        const index = episodes.indexOf(episode);
        episode.name = event.target.value.trim().replace(/^第\s*\d+\s*集\s*[:：]?\s*/, '') || `第 ${index+1} 集`;
        event.target.value = displayEpisodeName(episode, index);
      }
    });
    // 2026-11-01 原片播放：按稳定分集 ID 取媒体，改名/排序不串片；沿用短剧原生全屏视频控件，退出时暂停、清理节点并归还焦点。
    let closeSourcePlayback = null;
    function playSourceEpisode(episode, opener) {
      closeSourcePlayback?.();
      const video = document.createElement('video');
      video.src = episode.mediaUrl || demoSourceVideo;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('aria-label', `播放${displayEpisodeName(episode, episodes.indexOf(episode))}`);
      video.style.cssText = 'position:fixed;inset:0;z-index:1000;width:100%;height:100%;background:#000;object-fit:contain';
      document.body.append(video);
      const cleanup = () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.remove();
        document.removeEventListener('fullscreenchange', onFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
        video.removeEventListener('webkitendfullscreen', cleanup);
        video.removeEventListener('error', onError);
        if (closeSourcePlayback === cleanup) closeSourcePlayback = null;
        if (opener.isConnected) opener.focus({ preventScroll: true });
      };
      const onFullscreenChange = () => {
        if (document.fullscreenElement !== video && document.webkitFullscreenElement !== video) cleanup();
      };
      const onError = () => {
        if (document.fullscreenElement === video) document.exitFullscreen?.().catch(() => {});
        else if (document.webkitFullscreenElement === video) document.webkitExitFullscreen?.();
        cleanup();
        showValidationToast('原片暂时无法播放，请重新上传 MP4 或 MOV 视频');
      };
      closeSourcePlayback = cleanup;
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', onFullscreenChange);
      video.addEventListener('webkitendfullscreen', cleanup);
      video.addEventListener('error', onError);
      // 全屏请求保留在点击事件内立即执行，避免异步等待丢失用户手势；Safari 使用原生视频全屏入口。
      try {
        const fullscreen = video.requestFullscreen ? video.requestFullscreen() : video.webkitEnterFullscreen ? video.webkitEnterFullscreen() : video.webkitRequestFullscreen ? video.webkitRequestFullscreen() : Promise.reject(new Error('fullscreen-unavailable'));
        fullscreen?.catch(() => { cleanup(); showValidationToast('暂时无法进入全屏播放，请重试'); });
        video.play().catch(() => {});
      } catch { cleanup(); showValidationToast('暂时无法进入全屏播放，请重试'); }
    }
    // 2026-11-02 Product Design 改动逻辑：原片删除复用普通短剧原生删除确认弹窗的共享类名，沿用 480px 深色面板、24px 内边距、16px 圆角及红色确认按钮。
    // 原生 showModal() 约束焦点并支持 Esc；待删除项记录稳定 ID，只有确认关闭才释放媒体并移除原片，取消不改数据。
    const sourceDeleteDialog = document.createElement('dialog');
    sourceDeleteDialog.className = 'storyboard-row-delete-dialog storyboard-sync-confirm-dialog redraw-source-delete-dialog';
    sourceDeleteDialog.setAttribute('aria-labelledby', 'redrawSourceDeleteTitle');
    sourceDeleteDialog.setAttribute('aria-describedby', 'redrawSourceDeleteMessage');
    sourceDeleteDialog.innerHTML = '<h2 id="redrawSourceDeleteTitle">删除原片？</h2><p id="redrawSourceDeleteMessage"></p><div class="storyboard-sync-confirm-actions"><button type="button" class="storyboard-sync-confirm-secondary" data-cancel>取消</button><button type="button" class="storyboard-sync-confirm-primary" data-confirm>确认删除</button></div>';
    document.body.append(sourceDeleteDialog);
    let pendingSourceDelete = null;
    function requestSourceDelete(id, trigger) {
      const index = episodes.findIndex(item => item.id === id);
      if (index < 0 || sourceDeleteDialog.open) return;
      pendingSourceDelete = { id, trigger };
      sourceDeleteDialog.returnValue = '';
      sourceDeleteDialog.querySelector('p').textContent = `确定删除「${displayEpisodeName(episodes[index], index)}」吗？删除后需重新上传原片。`;
      sourceDeleteDialog.showModal();
      sourceDeleteDialog.querySelector('[data-cancel]').focus({ preventScroll: true });
    }
    sourceDeleteDialog.querySelector('[data-cancel]').addEventListener('click', () => sourceDeleteDialog.close('cancel'));
    sourceDeleteDialog.querySelector('[data-confirm]').addEventListener('click', () => sourceDeleteDialog.close('confirm'));
    // 点击遮罩等同取消；点击面板内部的空白区域不关闭，避免误触后执行删除。
    sourceDeleteDialog.addEventListener('click', event => {
      if (event.target !== sourceDeleteDialog) return;
      const rect = sourceDeleteDialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) sourceDeleteDialog.close('cancel');
    });
    sourceDeleteDialog.addEventListener('close', () => {
      const pending = pendingSourceDelete;
      pendingSourceDelete = null;
      if (!pending) return;
      if (sourceDeleteDialog.returnValue !== 'confirm') {
        if (pending.trigger.isConnected) pending.trigger.focus({ preventScroll: true });
        return;
      }
      const index = episodes.findIndex(item => item.id === pending.id);
      if (index < 0) return;
      releaseSourceMediaUrl(episodes[index].mediaUrl);
      episodes.splice(index, 1);
      render();
      // 确认后重新编号及更新解析按钮；焦点移到相邻分集，删空时回到添加原片入口。
      const buttons = grid.querySelectorAll('[data-source-delete]');
      (buttons[Math.min(index, buttons.length - 1)] || $('[data-redraw-add]'))?.focus({ preventScroll: true });
    });
    window.addEventListener('vina-view-changed', () => {
      if (!sourceDeleteDialog.open) return;
      pendingSourceDelete = null;
      sourceDeleteDialog.close('cancel');
    });
    grid.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.sourcePlay) {
        const episode = episodes.find(item => item.id === Number(button.dataset.sourcePlay));
        if (episode) playSourceEpisode(episode, button);
        return;
      }
      if (button.dataset.sourceReplace) pickFiles(Number(button.dataset.sourceReplace));
      if (button.dataset.sourceDelete) {
        // 2026-11-02：点击删除仅发起二次确认，不立即修改原片列表或释放视频地址。
        requestSourceDelete(Number(button.dataset.sourceDelete), button);
        return;
      }
      if (button.dataset.sourceUp) move(Number(button.dataset.sourceUp), -1);
      if (button.dataset.sourceDown) move(Number(button.dataset.sourceDown), 1);
    });
    // 2026-11-01 Product Design：按补充参考图改为 Pointer Events 排序：原位显示灰蓝色虚线占位，整行副本跟随鼠标。
    // 手柄按下后移动 5px 才开始拖动，pointer capture 保证离开手柄后仍跟随；浮层 inert，不截获原片播放或操作。
    let dragPreview = null;
    let sourcePointerDrag = null;
    let dragScrollFrame = 0;
    let dropIndex = null;
    function clearDropTarget() {
      grid.querySelectorAll('.is-drop-before, .is-drop-after').forEach(card => card.classList.remove('is-drop-before', 'is-drop-after'));
      dropIndex = null;
    }
    function finishSourceDrag() {
      const pointer = sourcePointerDrag;
      sourcePointerDrag = null;
      window.cancelAnimationFrame(dragScrollFrame);
      dragPreview?.remove();
      dragPreview = null;
      clearDropTarget();
      grid.querySelectorAll('.is-source-dragging').forEach(card => card.classList.remove('is-source-dragging'));
      grid.classList.remove('is-source-sorting');
      dragging = null;
      if (pointer?.handle.hasPointerCapture(pointer.pointerId)) pointer.handle.releasePointerCapture(pointer.pointerId);
      // 2026-11-02 Product Design 修复逻辑：指针拖动结束或取消时释放把手焦点，避免紫色焦点框残留；键盘 Tab 导航仍使用原有焦点样式。
      if (pointer && document.activeElement === pointer.handle) pointer.handle.blur();
    }
    // 按鼠标位于卡片上半部/下半部显示插入线；换算删除原位置后的索引，保证上拖、下拖和首尾落位一致。
    function updateDropTarget(clientY) {
      clearDropTarget();
      const cards = Array.from(grid.querySelectorAll('[data-source-id]'));
      if (!cards.length) return;
      const card = cards.find(item => clientY < item.getBoundingClientRect().bottom) || cards[cards.length - 1];
      const rect = card.getBoundingClientRect();
      const before = clientY < rect.top + rect.height / 2;
      const index = cards.indexOf(card) + (before ? 0 : 1);
      const from = episodes.findIndex(item => item.id === dragging);
      if (from < 0 || index - (from < index ? 1 : 0) === from) return;
      dropIndex = index;
      card.classList.add(before ? 'is-drop-before' : 'is-drop-after');
    }
    function positionSourcePreview() {
      const pointer = sourcePointerDrag;
      if (!pointer || !dragPreview) return;
      // 整行浮层向右下轻移，与鼠标保持抓取关系；横向限制在视口内，纵向跟随鼠标且不参与列表布局。
      dragPreview.style.left = `${Math.max(8, Math.min(innerWidth - pointer.width - 8, pointer.x - pointer.offsetX + 12))}px`;
      dragPreview.style.top = `${pointer.y - pointer.offsetY + 12}px`;
    }
    function scrollSourceDrag() {
      const pointer = sourcePointerDrag;
      if (!pointer || dragging === null) return;
      // 长列表拖至视口边缘时自动滚动；每帧重算落位，让跨屏拖动也按实际行位置排序。
      const scroller = document.scrollingElement;
      const edge = 100;
      const distance = pointer.y < edge ? pointer.y - edge : pointer.y > innerHeight - edge ? pointer.y - innerHeight + edge : 0;
      if (scroller && distance) {
        const previous = scroller.scrollTop;
        scroller.scrollTop += Math.max(-16, Math.min(16, distance / 5));
        if (previous !== scroller.scrollTop) updateDropTarget(pointer.y);
      }
      dragScrollFrame = window.requestAnimationFrame(scrollSourceDrag);
    }
    function beginSourceDrag() {
      const pointer = sourcePointerDrag;
      // 新一轮拖动开始时清除上次完成提示，避免浮层副本带上旧边框。
      clearSourceMoveHighlight();
      dragging = pointer.id;
      dragPreview = pointer.card.cloneNode(true);
      dragPreview.classList.add('redraw-drag-preview');
      dragPreview.removeAttribute('data-source-id');
      dragPreview.setAttribute('aria-hidden', 'true');
      dragPreview.inert = true;
      dragPreview.style.width = `${pointer.width}px`;
      document.body.append(dragPreview);
      pointer.card.classList.add('is-source-dragging');
      grid.classList.add('is-source-sorting');
      positionSourcePreview();
      dragScrollFrame = window.requestAnimationFrame(scrollSourceDrag);
    }
    // 禁止浏览器另起原生拖动图，避免与自定义整行浮层重复；拖动能力仍由原位置的手柄提供。
    grid.addEventListener('dragstart', event => { if (event.target.closest('.redraw-drag-handle')) event.preventDefault(); });
    grid.addEventListener('pointerdown', event => {
      const handle = event.target.closest('.redraw-drag-handle');
      const card = handle?.closest('[data-source-id]');
      if (!card || event.button !== 0 || event.isPrimary === false || sourcePointerDrag) return;
      const id = Number(card.dataset.sourceId);
      if (!episodes.some(item => item.id === id)) return;
      const rect = card.getBoundingClientRect();
      event.preventDefault();
      // 2026-11-02 修复逻辑：鼠标或触摸按下时只捕获指针，不主动聚焦把手，避免拖动触发紫色焦点框。
      sourcePointerDrag = { id, card, handle, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width };
      handle.setPointerCapture(event.pointerId);
    });
    window.addEventListener('pointermove', event => {
      const pointer = sourcePointerDrag;
      if (!pointer || event.pointerId !== pointer.pointerId) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (dragging === null && Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) < 5) return;
      event.preventDefault();
      if (dragging === null) beginSourceDrag();
      positionSourcePreview();
      updateDropTarget(event.clientY);
    }, { passive: false });
    window.addEventListener('pointerup', event => {
      const pointer = sourcePointerDrag;
      if (!pointer || event.pointerId !== pointer.pointerId) return;
      // 在列表横向区域外松手视为取消；纵向允许首行之前和末行之后，以便直接移至首尾。
      const rect = grid.getBoundingClientRect();
      if (dragging === null || event.clientX < rect.left || event.clientX > rect.right) { finishSourceDrag(); return; }
      updateDropTarget(event.clientY);
      const id = dragging;
      const from = episodes.findIndex(item => item.id === id);
      const to = dropIndex === null ? from : dropIndex - (from < dropIndex ? 1 : 0);
      finishSourceDrag();
      if (from >= 0) {
        if (to !== from) move(id, to - from);
        else highlightSourceMove(id);
        // 2026-11-02 修复逻辑：排序完成后不再聚焦重绘后的把手，保留现有整行移动完成提示。
      }
    });
    window.addEventListener('pointercancel', event => { if (event.pointerId === sourcePointerDrag?.pointerId) finishSourceDrag(); });
    grid.addEventListener('lostpointercapture', event => { if (event.pointerId === sourcePointerDrag?.pointerId) finishSourceDrag(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && sourcePointerDrag) { event.preventDefault(); finishSourceDrag(); } });
    window.addEventListener('blur', finishSourceDrag);
    window.addEventListener('resize', finishSourceDrag);
    window.addEventListener('pagehide', finishSourceDrag);
    window.addEventListener('vina-view-changed', finishSourceDrag);
    $('[data-redraw-add]').addEventListener('click', () => pickFiles());
    sourceInput.addEventListener('change', () => {
      // 2026-11-03：文件选择回调也校验新增锁，避免确认前打开的选择器在确认后回传文件并追加原片。
      if (sourceAdditionLocked && replaceId === null) { sourceInput.value = ''; return; }
      const files = validFiles(sourceInput.files);
      if (!files.length) { notice.textContent = '请选择 MP4 或 MOV 视频文件'; return; }
      if (replaceId !== null) {
        const item = episodes.find(episode => episode.id === replaceId);
        // 2026-11-01：重新上传后替换本集播放源并释放旧本地地址；新增原片同样保存实际文件地址，示例视频只用于无实际文件的原型入口。
        if (item) { releaseSourceMediaUrl(item.mediaUrl); item.mediaUrl = createSourceMediaUrl(files[0]); item.filename = files[0].name; item.cover = covers[(covers.indexOf(item.cover)+1)%3]; }
      } else {
        const room = Math.max(0, 50-episodes.length);
        files.slice(0, room).forEach(file => { serial++; episodes.push({id:serial, name:`第 ${episodes.length+1} 集`, filename:file.name, mediaUrl:createSourceMediaUrl(file), duration:'00:30', cover:covers[(serial-1)%3]}); });
        notice.textContent = files.length > room ? '一次最多添加 50 集原片' : '';
      }
      sourceInput.value = ''; replaceId = null; render();
    });
    // 2026-11-01 Product Design：三个底栏设置面板互斥，选择、外部点击、Escape 与步骤切换均清理展开状态。
    function closePanels() {
      [stylePanel, regionPanel, strengthPanel].forEach(panel => { panel.hidden = true; });
      [styleToggle, regionToggle, strengthToggle].forEach(button => button.setAttribute('aria-expanded', 'false'));
    }
    // 2026-09-14 修正逻辑：面板始终向上展开，并按视口钳制横向位置，避免宽风格面板在小屏或左侧触发器下越界。
    function positionPanel(panel, button) {
      const rect = button.getBoundingClientRect();
      panel.style.position = 'fixed';
      panel.style.right = 'auto';
      panel.style.left = `${Math.max(12, Math.min(rect.left, innerWidth-panel.offsetWidth-12))}px`;
      panel.style.bottom = `${innerHeight-rect.top+12}px`;
      // 2026-09-30 Product Design 改动逻辑：同款风格弹窗宽度为 760px、高度最多 460px，始终贴按钮上方并限制在视口内，标题分类不参与滚动。
      panel.style.maxHeight = `${Math.max(0, Math.min(panel === stylePanel ? 460 : 570, rect.top-24))}px`;
    }
    function togglePanel(panel, button) { const open = panel.hidden; closePanels(); panel.hidden = !open; button.setAttribute('aria-expanded', String(open)); if(open) positionPanel(panel, button); }
    window.addEventListener('resize', () => { if(!stylePanel.hidden) positionPanel(stylePanel,styleToggle); if(!regionPanel.hidden) positionPanel(regionPanel,regionToggle); if(!strengthPanel.hidden) positionPanel(strengthPanel,strengthToggle); });
    // 2026-11-01 Product Design：资产、视频、详情和上传原片之间任意切换时都清理旧浮动退出，不给某个步骤单独保留入口。
    window.addEventListener('vina-view-changed', event => {
      removeLegacyRedrawExit();
      closePanels();
      // 2026-11-02 修复逻辑：资产、视频等步骤原有返回按钮会路由到 canvas 首页；只在转绘实例中把该路由转为退出，返回外层已有完整导航和上传事件的首页。资产画布返回列表及各步骤互切仍沿用原流程。
      if (event.detail.target === 'canvas' || event.detail.target === 'drama') { exit(); return; }
      document.body.dataset.redrawStep = event.detail.target;
    });
    styleToggle.addEventListener('click', () => togglePanel(stylePanel, styleToggle));
    regionToggle.addEventListener('click', () => togglePanel(regionPanel, regionToggle));
    // 2026-11-01 Product Design：打开参考强度后聚焦当前选项（首次为第一档），使用原生单选支持键盘操作；选择即更新标签、收起面板并归还焦点。
    strengthToggle.addEventListener('click', () => {
      togglePanel(strengthPanel, strengthToggle);
      if (!strengthPanel.hidden) (strengthPanel.querySelector('input:checked') || strengthPanel.querySelector('input')).focus();
    });
    strengthPanel.addEventListener('change', event => {
      const option = event.target.closest('[data-redraw-strength]');
      if (!option || !option.checked) return;
      chosenStrength = option.value;
      const label = `参考强度：${option.dataset.redrawStrength}`;
      $('[data-redraw-strength-label]').textContent = label;
      strengthToggle.setAttribute('aria-label', label);
      closePanels();
      strengthToggle.focus();
    });
    document.addEventListener('click', event => { if (!event.target.closest('.redraw-setting')) closePanels(); });
    document.addEventListener('keydown', event => { if(event.key === 'Escape') { const opener = !stylePanel.hidden ? styleToggle : !regionPanel.hidden ? regionToggle : !strengthPanel.hidden ? strengthToggle : null; closePanels(); opener?.focus(); } });
    // 2026-09-30 Product Design 改动逻辑：直接读取与剧本创作相同的静态画风卡片，复用卡片样式；选择后保留弹窗和选中边框，点击外部或 Escape 收起。
    function syncStyleLabel() {
      const name = chosenStyle === 'custom' ? '自定义' : redrawStyleCatalog.find(item => item.id === chosenStyle)?.name;
      $('[data-redraw-style-label]').textContent = name || '风格';
      styleToggle.setAttribute('aria-label', name ? `当前风格：${name}` : '选择风格');
    }
    function renderStyles() {
      $('[data-redraw-style-tabs]').innerHTML = redrawStyleCategories.map(item => `<button class="style-category${category === item.id ? ' is-active' : ''}" type="button" role="tab" data-redraw-category="${item.id}" aria-selected="${category === item.id}">${item.name}</button>`).join('');
      const list = $('[data-redraw-style-grid]');
      list.setAttribute('role', category === 'custom' ? 'group' : 'listbox');
      if (category === 'custom') {
        list.innerHTML = `<div class="home-drama-custom-style"><label for="redrawCustomStyle">画风描述</label><textarea id="redrawCustomStyle" data-redraw-custom-style aria-label="自定义画风" placeholder="描述你希望使用的画风，例如：暖色赛博朋克，融合东方建筑与电影感光影。">${escape(customStyleDescription)}</textarea></div>`;
        return;
      }
      list.innerHTML = redrawStyleCatalog.filter(item => item.category === category).map(item => `<button class="home-drama-style-card${chosenStyle === item.id ? ' is-selected' : ''}" type="button" role="option" data-redraw-style="${escape(item.id)}" aria-selected="${chosenStyle === item.id}"><img src="${escape(item.image)}" alt="${escape(item.name)}风格预览" loading="lazy"><span>${escape(item.name)}</span></button>`).join('');
    }
    stylePanel.addEventListener('click', event => {
      const tab = event.target.closest('[data-redraw-category]'), option = event.target.closest('[data-redraw-style]');
      if (tab) {
        category = tab.dataset.redrawCategory;
        if (category === 'custom') { chosenStyle = 'custom'; syncStyleLabel(); }
        renderStyles();
        $('[data-redraw-style-grid]').scrollTo({ top: 0 });
      }
      if (option) {
        chosenStyle = option.dataset.redrawStyle;
        syncStyleLabel();
        stylePanel.querySelectorAll('[data-redraw-style]').forEach(button => {
          const selected = button === option;
          button.classList.toggle('is-selected', selected);
          button.setAttribute('aria-selected', String(selected));
        });
      }
    });
    // 2026-09-30 改动逻辑：自定义描述跨分类切换保留，解析时随风格 ID 一起交给转绘流程。
    stylePanel.addEventListener('input', event => {
      if (!event.target.matches('[data-redraw-custom-style]')) return;
      customStyleDescription = event.target.value;
      chosenStyle = 'custom';
      syncStyleLabel();
    });
    const countries = ['美国','英国','加拿大','澳大利亚','德国','法国','日本','韩国','巴西','印度'];
    $('[data-redraw-regions]').innerHTML = countries.map(name => `<button type="button" data-redraw-country="${name}" aria-pressed="false">${name}<span>✓</span></button>`).join('');
    regionPanel.addEventListener('click', event => {
      const option = event.target.closest('[data-redraw-country]'); if(!option) return;
      chosenRegion = option.dataset.redrawCountry;
      $('[data-redraw-region-label]').textContent = chosenRegion;
      regionPanel.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed',String(button===option)));
      closePanels(); regionToggle.focus();
    });
    // 2026-09-22 改动逻辑：仅在转绘 iframe 内移除普通短剧的分集剧本步骤及前置连接线，保留上传原片、资产、分集视频三个入口。
    document.querySelectorAll('.steps [data-script-phase="episode"]').forEach(button => {
      if (button.previousElementSibling?.classList.contains('step-line')) button.previousElementSibling.remove();
      button.remove();
    });
    document.querySelectorAll('.steps [data-workflow-view]').forEach(button => {
      button.removeAttribute('data-script-phase');
      const number = button.querySelector('.step-num');
      const step = { 'script-studio': '1', 'asset-library': '2', 'episode-video': '3' }[button.dataset.workflowView];
      if (number && step && !button.classList.contains('complete')) number.textContent = step;
    });
    // 保留现有步骤事件，上传原片通过独立流程路由返回首步，不再进入普通剧本的分阶段处理。
    document.querySelectorAll('[data-workflow-view="script-studio"]').forEach(button => {
      Array.from(button.childNodes).filter(node => node.nodeType===Node.TEXT_NODE).forEach(node => node.textContent = '上传原片');
    });
    document.querySelectorAll('[data-script-project-title]').forEach(node => { node.textContent = '出海转绘'; });
    function syncEpisodes() {
      const target = $('[data-view="episode-video"] .episode-grid');
      target.replaceChildren();
      episodes.forEach((episode, i) => {
        const card = originalEpisodeCard.cloneNode(true);
        const title = /^第\s*\d+\s*集$/.test(episode.name) ? `第${i+1}集` : `第${i+1}集：${episode.name}`;
        // 每次改名或排序前保存稳定分集 ID 对应的状态，避免第三步按显示标题索引时互相串集。
        if (episode.videoState) episodeVideoStates.set(title, episode.videoState);
        else episode.videoState = getEpisodeVideoState(`redraw-source-${episode.id}`);
        episodeVideoStates.set(title, episode.videoState);
        card.dataset.episodeTitle = title;
        // 2026-11-01 Product Design：克隆卡片后同步所有操作入口的集名，改名、排序和新增分集均不再残留模板首集标题。
        card.querySelectorAll('[data-episode-title]').forEach(node => { node.dataset.episodeTitle = title; });
        card.querySelectorAll('[data-episode-action="watch"]').forEach(button => { button.setAttribute('aria-label', `播放${title}`); });
        card.querySelector('.episode-name').textContent = title;
        card.querySelector('.episode-cover').style.setProperty('--cover',episode.cover);
        card.querySelector('.episode-duration').textContent = episode.duration;
        const opener = card.querySelector('[data-open-episode-detail]');
        opener.dataset.episodeTitle = title;
        // 2026-11-01 修复逻辑：cloneNode 不会复制原卡片事件；为转绘动态分集重新绑定编辑、卡片空白区和键盘入口。
        // 共用主应用的分集打开逻辑，按卡片当前集名恢复该集分镜和参考素材；封面与操作按钮继续响应各自操作，避免冒泡重复进入。
        opener.addEventListener('click', () => openEpisodeDetail(card.dataset.episodeTitle));
        card.tabIndex = 0;
        card.setAttribute('role', 'link');
        card.setAttribute('aria-label', `进入${title}`);
        card.addEventListener('click', event => {
          if (event.target.closest('button, .episode-cover, [data-episode-review]')) return;
          openEpisodeDetail(card.dataset.episodeTitle);
        });
        card.addEventListener('keydown', event => {
          if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          openEpisodeDetail(card.dataset.episodeTitle);
        });
        // 2026-11-01 Product Design：动态分集补绑原短剧的播放、下载、剪辑及审片处理；审片保留已提交审核与团队权限检查。
        card.querySelectorAll('[data-episode-action]').forEach(bindEpisodeActionButton);
        card.querySelector('[data-open-episode-editor]')?.addEventListener('click', event => openDramaEpisodeEditor(event.currentTarget));
        card.querySelector('[data-open-episode-review-detail]')?.addEventListener('click', event => openSelectedEpisodeReview(event.currentTarget));
        target.append(card);
      });
      // 2026-10-11 修复：视频总览已改用项目概览集数标签；更新现有标签并容忍其缺失，避免旧 .episode-sub 选择器抛错阻断确认解析。
      const episodeCount = $('[data-view="episode-video"] [data-episode-project-count]');
      if (episodeCount) episodeCount.textContent = `共 ${episodes.length} 集`;
    }
    $('[data-redraw-confirm]').addEventListener('click', () => {
      if (!episodes.length) return;
      // 2026-09-26 改动逻辑：点击下一步时先要求选择转绘目标国家；未选择则 toast 提示，并停留在上传原片页。
      if (!chosenRegion) { showValidationToast('请先选择要转绘的目标国家'); return; }
      closePanels(); syncEpisodes();
      // 2026-11-03：仅在原片及国家校验通过、分集同步完成后锁定新增；从资产或视频返回第一步时不恢复按钮。
      sourceAdditionLocked = true;
      render();
      // 原型沿用现有资产解析等待态；风格、目标国家作为转绘参数保存，不改写普通短剧的配置。
      document.body.dataset.redrawStyle = chosenStyle;
      // 2026-09-30 改动逻辑：预设画风不携带旧自定义描述，自定义画风保存当前输入供后续解析使用。
      document.body.dataset.redrawCustomStyle = chosenStyle === 'custom' ? customStyleDescription.trim() : '';
      document.body.dataset.redrawRegion = chosenRegion;
      // 2026-11-01 改动逻辑：与风格、国家一起保留参考强度参数（strong/medium/weak，未选为空），供当前原型后续流程读取。
      document.body.dataset.redrawReferenceStrength = chosenStrength;
      showView('asset-library');
      showAssetParsingPrototypeState();
    });
    $('.asset-parsing-state').textContent = '正在解析原片并生成角色场景资产中，请稍后...';
    // 2026-11-01 Product Design：移除右下角浮动“退出转绘”，返回仍由现有左上角箭头处理。
    // 2026-09-26 改动逻辑：首轮渲染直接使用地址里的分集数量及原文件名，避免先展示空队列。
    notice.textContent = seedNames.length > 50 ? '一次最多添加 50 集原片' : '';
    render(); renderStyles(); syncEpisodes();
    // 2026-11-01 Product Design：仅转绘创建对比播放器；按当前分集在上传队列中的位置读取稳定 ID 和实际原片地址，普通短剧不初始化。
    window.vinaRedrawComparison = window.vinaCreateRedrawComparison?.({
      getSource: () => {
        const episode = episodes.find((item, i) => currentEpisodeVideoTitle === (/^第\s*\d+\s*集$/.test(item.name) ? `第${i+1}集` : `第${i+1}集：${item.name}`));
        return episode ? { id: episode.id, src: episode.mediaUrl } : null;
      },
      getShots: () => document.querySelectorAll('.shot-strip [data-shot-index]'),
      getActiveShot: getActiveShotCard,
      getMode: () => detailPlayMode,
      nextShot: () => { const next = getNextShotCard(getActiveShotCard()); if (next) setActiveShot(next, true); },
      restoreGenerated: () => {
        const state = getShotGenerationState(getActiveShotCard());
        setDetailPreviewGeneratedState(!['pending', 'failed'].includes(state), state === 'failed', state === 'rendering');
      }
    });
    showView('redraw-original');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true}); else initialize();
})();
