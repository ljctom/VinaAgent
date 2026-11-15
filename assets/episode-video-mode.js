// 2026-09-14：分集模式控制独立于全能创作；每集保留自己的 iframe，切换模式不重载内容。
(() => {
  'use strict';
  const workspace = document.querySelector('[data-view="episode-detail"]');
  const storyboard = document.getElementById('episodeVideoStoryboardPanel');
  const canvas = document.getElementById('episodeVideoCanvasPanel');
  const title = document.getElementById('episodeDetailTopTitle');
  const editButton = document.getElementById('detailEditButton');
  const detailVideo = document.getElementById('detailVideo');
  const panelResizer = document.getElementById('detailPanelResizer');
  // 2026-09-26 Product Design 改动逻辑：左栏分隔线独立于右侧预览分隔线，两侧拖动各自只改变对应列宽。
  const sidebarResizer = document.getElementById('detailSidebarResizer');
  if (!workspace || !storyboard || !canvas || !title) return;
  // 2026-11-09 改动逻辑：短剧剪辑顶栏直接导出到本地，移除格式菜单；保留原标题及返回入口。
  const composerTitle = document.getElementById('episodeComposerTitle');
  const composerActions = document.getElementById('episodeComposerActions');
  const composerExportToggle = composerActions?.querySelector('[data-episode-composer-export-toggle]');
  let composerExportJob = null;
  let composerDownloadBlob = null;
  const tabs = Array.from(workspace.querySelectorAll('[data-episode-video-mode]'));
  const canvasAgentButton = workspace.querySelector('[data-episode-side-panel="agent"]');
  const sidePanelButtons = Array.from(workspace.querySelectorAll('[data-episode-side-panel]'));
  const frames = new Map();
  let activeComposerFrame = null;
  let episode = title.textContent.trim();
  // 2026-09-17 改动逻辑：记录剪辑器是否由第 3 步卡片按钮直接打开，以便关闭后返回分集视频列表而不是本集提示词页。
  let openedFromEditStep = false;
  // 2026-09-16 修复逻辑：为每次进入剪辑分配递增请求号；重复点击或返回时让旧轮询自动失效，避免迟到的首次请求再次切换页面。
  let editorOpenRequestId = 0;
  // 2026-10-26 修复逻辑：仅短剧分集管理打开请求的定时器与加载状态，离开后立即取消，避免旧请求覆盖新入口。
  let cancelEditorOpen = null;
  const editorLoading = document.createElement('div');
  editorLoading.className = 'episode-editor-loading';
  editorLoading.hidden = true;
  // 2026-11-09 文案改动：初次进入及后续每次进入的加载提示统一使用“正在打开剪辑器…”，仅替换名称，不修改加载样式、时长或流程。
  editorLoading.innerHTML = '<img src="./assets/icons/script-loader.svg" alt="" width="24" height="24"><span role="status" aria-live="polite">正在打开剪辑器…</span><div hidden><button type="button" data-editor-retry>重新加载</button><button type="button" data-editor-back>返回分集视频</button></div>';
  canvas.append(editorLoading);
  function setEditorLoading(loading, failed = false) {
    workspace.classList.toggle('is-episode-editor-loading', loading);
    canvas.setAttribute('aria-busy', String(loading && !failed));
    editorLoading.hidden = !loading;
    editorLoading.querySelector('img').hidden = failed;
    editorLoading.querySelector('[role="status"]').textContent = failed ? '剪辑加载失败，请重新加载' : '正在打开剪辑器…';
    editorLoading.querySelector('div').hidden = !failed;
  }
  editorLoading.querySelector('[data-editor-retry]').addEventListener('click', () => {
    // 2026-10-26 修复逻辑：失败后仅重建当前短剧分集的 iframe，重新完成初始化，不重载整页或全能创作。
    cancelEditorOpen?.();
    setComposerToolbarVisible(false);
    frames.get(episode)?.remove();
    frames.delete(episode);
    openCurrentVideoEditor(openedFromEditStep);
  });
  editorLoading.querySelector('[data-editor-back]').addEventListener('click', returnToPrompt);
  // 2026-11-09 Product Design 改动逻辑：短剧导出独立管理等待状态，防止重复提交；全能创作继续使用原有导出逻辑。
  function setComposerExportBusy(busy) {
    if (!composerExportToggle) return;
    composerExportToggle.disabled = busy;
    composerExportToggle.setAttribute('aria-busy', String(busy));
    composerExportToggle.innerHTML = busy
      ? '<img class="episode-composer-export-spinner" src="./assets/icons/script-loader.svg" alt="" aria-hidden="true"><span>合成中...</span>'
      : '导出';
  }
  function showComposerExportToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'vina-direct-toast is-visible';
    toast.dataset.vinaToastType = type;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2400);
  }
  // 2026-11-09 改动逻辑：用户确认下载文件内容不限，复用现有 MP4 文件，仅实现等待与浏览器原生下载交互。
  // 本地 file:// 无法 fetch 视频文件，因此按需读取项目已有的视频编码资源，转换为可实际保存的 Blob。
  // 正式接入时，此函数应替换为合成服务返回的文件；不把本次下载当作已应用裁剪、字幕或音轨的合成产物。
  function prepareComposerDownloadFile() {
    if (composerDownloadBlob) return composerDownloadBlob;
    composerDownloadBlob = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./assets/review-capture-media/drama-broom-flight.mp4.js', document.baseURI).href;
      script.onload = () => {
        script.remove();
        try {
          const encoded = window.reviewCaptureMedia?.['drama-broom-flight.mp4'];
          if (!encoded) throw new Error('视频文件暂不可用');
          const binary = atob(encoded);
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
          resolve(new Blob([bytes], { type: 'video/mp4' }));
        } catch (error) { reject(error); }
      };
      script.onerror = () => { script.remove(); reject(new Error('视频文件加载失败')); };
      document.body.append(script);
    }).catch(error => { composerDownloadBlob = null; throw error; });
    return composerDownloadBlob;
  }
  async function runComposerLocalExport() {
    if (!activeComposerFrame || activeComposerFrame.hidden || composerExportJob) return;
    if (window.vinaTeamPermissionDenied?.('download')) return;
    const job = { frame: activeComposerFrame, cancelled: false };
    const filename = `${(composerTitle?.textContent || episode || '短剧视频').replace(/[\\/:*?"<>|]/g, '-')}.mp4`;
    composerExportJob = job;
    setComposerExportBusy(true);
    showComposerExportToast('视频合成中，请稍后...');
    // 提前加载下载文件，并立即收集错误，避免两秒等待期间出现未处理的 Promise 拒绝。
    const fileReady = prepareComposerDownloadFile().then(blob => ({ blob }), error => ({ error }));
    try {
      // 2026-11-09：按要求固定等待两秒。正式合成耗时应根据实际情况，以任务完成回执为准，不固定为两秒。
      await new Promise(resolve => window.setTimeout(resolve, 2000));
      if (job.cancelled || job.frame !== activeComposerFrame || workspace.hidden) return;
      const file = await fileReady;
      if (file.error) throw file.error;
      if (job.cancelled || job.frame !== activeComposerFrame || workspace.hidden) return;
      // 2026-11-09 改动逻辑：移除 showSaveFilePicker 和文件写入授权，避免出现“此网站可以看到您所做的修改”保存窗口。
      // 直接通过 Blob 链接的 download 属性发起浏览器常规下载，由浏览器自己的下载提示/面板接管。
      // 网页不能强制展开浏览器下载面板；若用户开启“下载前询问保存位置”，保存位置窗口仍遵循浏览器设置。
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      if (!job.cancelled) showComposerExportToast('视频下载失败，请重试', 'error');
    } finally {
      if (composerExportJob === job) {
        composerExportJob = null;
        setComposerExportBusy(false);
      }
    }
  }
  function setComposerToolbarVisible(open, frame = null) {
    const visible = Boolean(open && frame);
    activeComposerFrame = visible ? frame : null;
    workspace.classList.toggle('is-episode-composer-open', visible);
    // 2026-10-10 Product Design 改动逻辑：短剧剪辑左上角复用当前分集详情标题，以“第几集 · 集名”展示；每次打开读取当前集，避免固定显示“视频合成”或沿用上一集标题。
    if (composerTitle) {
      composerTitle.textContent = (title.textContent.trim() || episode).replace(/\s*[：:]\s*/, ' · ');
      composerTitle.hidden = !visible;
    }
    if (composerActions) composerActions.hidden = !visible;
    // 2026-11-09：离开剪辑或切换分集时撤销尚未触发的下载，防止旧定时任务在其他页面发起下载。
    if (composerExportJob && (!visible || composerExportJob.frame !== frame)) {
      composerExportJob.cancelled = true;
      composerExportJob = null;
      setComposerExportBusy(false);
    }
    // 2026-09-26 改动逻辑：剪辑顶栏出现时收起旧切集弹层，退出后不会意外恢复一个已展开的分集菜单。
    if (visible) {
      const switcherMenu = document.getElementById('episodeSwitcherMenu');
      if (switcherMenu) switcherMenu.hidden = true;
      document.getElementById('episodeSwitcherToggle')?.setAttribute('aria-expanded', 'false');
    }
  }
  composerExportToggle?.addEventListener('click', event => {
    event.stopPropagation();
    runComposerLocalExport();
  });
  // 2026-09-30 Product Design 改动逻辑：导入入口只存在于短剧顶栏；确认后模拟转圈及当前剪辑视图刷新，保留素材和草稿，不执行真实替换。
  const importButton = document.getElementById('episodeComposerImport');
  const importModal = document.getElementById('episodeComposerImportModal');
  const importCancel = document.getElementById('episodeComposerImportCancel');
  const importConfirm = document.getElementById('episodeComposerImportConfirm');
  let importFrame = null;
  function closeImportModal() {
    if (importModal) importModal.hidden = true;
    importButton?.focus();
  }
  importButton?.addEventListener('click', () => {
    if (!activeComposerFrame || importButton.disabled) return;
    importFrame = activeComposerFrame;
    importModal.hidden = false;
    importCancel?.focus();
  });
  importCancel?.addEventListener('click', closeImportModal);
  importModal?.addEventListener('click', event => { if (event.target === importModal) closeImportModal(); });
  importModal?.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeImportModal(); }
    if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === importCancel ? importConfirm : importCancel)?.focus();
    }
  });
  importConfirm?.addEventListener('click', () => {
    const frame = importFrame;
    closeImportModal();
    if (!frame || frame !== activeComposerFrame || frame.hidden) return;
    importButton.disabled = true;
    importButton.setAttribute('aria-busy', 'true');
    // 2026-11-09 Product Design 改动逻辑：导入等待沿用现有加载图标，通过专属样式显示浅色并持续旋转；固定等待两秒，其他导入确认和刷新逻辑不变。
    importButton.innerHTML = '<img class="episode-composer-import-spinner" src="./assets/icons/script-loader.svg" alt="" aria-hidden="true">导入中…';
    window.setTimeout(() => {
      importButton.disabled = false;
      importButton.removeAttribute('aria-busy');
      importButton.textContent = '导入该集视频';
      // 模拟刷新仅作用于发起操作的当前短剧剪辑视图，不重载整页、不影响其他集及全能创作。
      if (activeComposerFrame !== frame || frame.hidden || workspace.hidden) return;
      openCurrentVideoEditor(true);
      frame.classList.remove('episode-composer-import-refresh');
      void frame.offsetWidth;
      frame.classList.add('episode-composer-import-refresh');
    }, 2000);
  });
  // 2026-09-30 改动逻辑：剪辑审核代理视频生成页同一个按钮，防止两处产生独立提交状态。
  document.getElementById('episodeComposerReview')?.addEventListener('click', () => {
    if (!activeComposerFrame || activeComposerFrame.hidden) return;
    document.getElementById('detailReviewComplete')?.click();
  });
  // 2026-11-09 改动逻辑：移除旧导出菜单的外部点击与 Escape 监听，避免干扰原生保存窗口；退出剪辑仍由左上返回处理。
  // 2026-09-17 Product Design 改动逻辑：拖动提示词右边框时实时改写视频列宽；为提示词保留可编辑下限，并支持方向键微调与双击恢复默认。
  // 2026-10-25 阿语镜像逻辑：读取工作区实际方向，指针以对应面板的真实外沿计算宽度，
  // 左右交换后拖动和方向键仍跟随屏幕移动；不更改列宽参数、上下限或非阿语行为。
  const isStoryboardRTL = () => getComputedStyle(storyboard).direction === 'rtl';
  function previewWidthFromPointer(clientX) {
    const bounds = storyboard.querySelector('.detail-player-panel').getBoundingClientRect();
    return isStoryboardRTL() ? clientX - bounds.left : bounds.right - clientX;
  }
  function sidebarWidthFromPointer(clientX) {
    const bounds = storyboard.querySelector('.episode-agent-sidebar').getBoundingClientRect();
    return isStoryboardRTL() ? bounds.right - clientX : clientX - bounds.left;
  }
  function getPreviewWidthLimits() {
    const panelWidth = storyboard.getBoundingClientRect().width;
    const sidebar = storyboard.querySelector('.episode-agent-sidebar');
    const sidebarWidth = window.matchMedia('(min-width: 1000px)').matches && sidebar && !sidebar.hidden ? sidebar.getBoundingClientRect().width : 0;
    const gap = Number.parseFloat(getComputedStyle(storyboard).columnGap) || 10;
    const gapCount = sidebarWidth ? 2 : 1;
    const min = 230;
    const minPromptWidth = sidebarWidth ? 420 : 520;
    const availableMax = panelWidth - sidebarWidth - gap * gapCount - minPromptWidth;
    const max = Math.max(min, Math.min(panelWidth * .58, availableMax));
    return { min, max };
  }
  function setPreviewWidth(nextWidth) {
    const limits = getPreviewWidthLimits();
    const width = Math.round(Math.min(limits.max, Math.max(limits.min, nextWidth)));
    storyboard.style.setProperty('--episode-preview-width', `${width}px`);
    panelResizer?.setAttribute('aria-valuemin', String(Math.round(limits.min)));
    panelResizer?.setAttribute('aria-valuemax', String(Math.round(limits.max)));
    panelResizer?.setAttribute('aria-valuenow', String(width));
  }
  function resetPreviewWidth() {
    storyboard.style.removeProperty('--episode-preview-width');
    const width = storyboard.querySelector('.detail-player-panel')?.getBoundingClientRect().width || 320;
    panelResizer?.setAttribute('aria-valuenow', String(Math.round(width)));
  }
  if (panelResizer) {
    panelResizer.addEventListener('pointerdown', event => {
      if (!window.matchMedia('(min-width: 1000px)').matches) return;
      event.preventDefault();
      panelResizer.setPointerCapture(event.pointerId);
      panelResizer.classList.add('is-dragging');
      document.body.classList.add('is-episode-panel-resizing');
      setPreviewWidth(previewWidthFromPointer(event.clientX));
    });
    panelResizer.addEventListener('pointermove', event => {
      if (!panelResizer.classList.contains('is-dragging')) return;
      setPreviewWidth(previewWidthFromPointer(event.clientX));
    });
    const finishPanelResize = event => {
      if (!panelResizer.classList.contains('is-dragging')) return;
      if (panelResizer.hasPointerCapture(event.pointerId)) panelResizer.releasePointerCapture(event.pointerId);
      panelResizer.classList.remove('is-dragging');
      document.body.classList.remove('is-episode-panel-resizing');
    };
    panelResizer.addEventListener('pointerup', finishPanelResize);
    panelResizer.addEventListener('pointercancel', finishPanelResize);
    panelResizer.addEventListener('dblclick', resetPreviewWidth);
    panelResizer.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const current = storyboard.querySelector('.detail-player-panel')?.getBoundingClientRect().width || 320;
      setPreviewWidth(current + (event.key === 'ArrowLeft' ? 16 : -16) * (isStoryboardRTL() ? -1 : 1));
    });
    window.addEventListener('resize', () => {
      const inlineWidth = Number.parseFloat(storyboard.style.getPropertyValue('--episode-preview-width'));
      if (Number.isFinite(inlineWidth)) setPreviewWidth(inlineWidth);
    });
    resetPreviewWidth();
  }
  // 2026-09-26 Product Design 改动逻辑：左栏默认保持原 clamp 宽度；仅在桌面展开时接受拖动，保留中央编辑区 420px，方向键微调并允许双击清除自定义宽度。
  function getDefaultSidebarWidth() {
    return Math.min(280, Math.max(240, window.innerWidth * .146));
  }
  function getSidebarWidthLimits() {
    // 2026-09-26 Product Design 修复逻辑：列宽上限使用网格内容宽度，扣除容器内边距，确保中央编辑区实际保有 420px。
    const panelStyle = getComputedStyle(storyboard);
    const panelWidth = storyboard.getBoundingClientRect().width - (Number.parseFloat(panelStyle.paddingLeft) || 0) - (Number.parseFloat(panelStyle.paddingRight) || 0);
    const previewWidth = storyboard.querySelector('.detail-player-panel')?.getBoundingClientRect().width || 230;
    const gap = Number.parseFloat(panelStyle.columnGap) || 10;
    const min = 200;
    const max = Math.max(min, Math.min(panelWidth * .48, panelWidth - previewWidth - gap * 2 - 420));
    return { min, max };
  }
  function setSidebarWidth(nextWidth) {
    const limits = getSidebarWidthLimits();
    const width = Math.round(Math.min(limits.max, Math.max(limits.min, nextWidth)));
    storyboard.style.setProperty('--episode-sidebar-width', `${width}px`);
    sidebarResizer?.setAttribute('aria-valuemin', String(limits.min));
    sidebarResizer?.setAttribute('aria-valuemax', String(Math.round(limits.max)));
    sidebarResizer?.setAttribute('aria-valuenow', String(width));
  }
  function resetSidebarWidth() {
    storyboard.style.removeProperty('--episode-sidebar-width');
    sidebarResizer?.setAttribute('aria-valuenow', String(Math.round(getDefaultSidebarWidth())));
    sidebarResizer?.setAttribute('aria-valuemax', String(Math.round(getSidebarWidthLimits().max)));
  }
  if (sidebarResizer) {
    sidebarResizer.addEventListener('pointerdown', event => {
      const sidebar = storyboard.querySelector('.episode-agent-sidebar');
      if (!window.matchMedia('(min-width: 1000px)').matches || !sidebar || sidebar.hidden) return;
      event.preventDefault();
      sidebarResizer.setPointerCapture(event.pointerId);
      sidebarResizer.classList.add('is-dragging');
      document.body.classList.add('is-episode-panel-resizing');
      // 2026-09-26 Product Design 修复逻辑：以左栏真实起点计算拖动距离，首次按下不会因外层 padding 造成宽度跳动。
      setSidebarWidth(sidebarWidthFromPointer(event.clientX));
    });
    sidebarResizer.addEventListener('pointermove', event => {
      if (!sidebarResizer.classList.contains('is-dragging')) return;
      setSidebarWidth(sidebarWidthFromPointer(event.clientX));
    });
    const finishSidebarResize = event => {
      if (!sidebarResizer.classList.contains('is-dragging')) return;
      if (sidebarResizer.hasPointerCapture(event.pointerId)) sidebarResizer.releasePointerCapture(event.pointerId);
      sidebarResizer.classList.remove('is-dragging');
      document.body.classList.remove('is-episode-panel-resizing');
    };
    sidebarResizer.addEventListener('pointerup', finishSidebarResize);
    sidebarResizer.addEventListener('pointercancel', finishSidebarResize);
    sidebarResizer.addEventListener('dblclick', resetSidebarWidth);
    sidebarResizer.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const current = storyboard.querySelector('.episode-agent-sidebar')?.getBoundingClientRect().width || getDefaultSidebarWidth();
      setSidebarWidth(current + (event.key === 'ArrowRight' ? 16 : -16) * (isStoryboardRTL() ? -1 : 1));
    });
    window.addEventListener('resize', () => {
      const inlineWidth = Number.parseFloat(storyboard.style.getPropertyValue('--episode-sidebar-width'));
      if (Number.isFinite(inlineWidth)) setSidebarWidth(inlineWidth);
      else resetSidebarWidth();
    });
    resetSidebarWidth();
  }
  function getFirstCanvasProjectName() {
    return document.querySelector('[data-project-panel="canvas"] .project-card[data-project-destination="canvas-workbench"] .project-title')?.textContent.trim() || '未命名项目';
  }
  // 2026-09-17 改动逻辑：短剧内嵌画布使用专属上下文隐藏项目横条并把腾出的高度补给 Agent；通过 iframe 标记隔离，全能创作不受影响。
  function configureEpisodeCanvas(frame) {
    let frameDocument;
    try { frameDocument = frame.contentDocument; } catch (error) { return; }
    if (!frameDocument?.documentElement) return;
    frameDocument.documentElement.classList.add('vina-episode-canvas-context');
    // 2026-10-27 Product Design：分集剪辑 iframe 复用同一确认弹窗主题，只处理结果/文件夹删除确认；不改剪辑、导出、节点操作或其他弹窗。
    if (!frameDocument.getElementById('drama-confirmations-ui1027')) {
      const confirmationTheme = frameDocument.createElement('link');
      confirmationTheme.id = 'drama-confirmations-ui1027';
      confirmationTheme.rel = 'stylesheet';
      confirmationTheme.href = new URL('./assets/drama-confirmations-ui1027.css?v=20261027-confirmation-only', document.baseURI).href;
      frameDocument.body.appendChild(confirmationTheme);
    }
    installStoryboardTimeline(frame);
    if (!frameDocument.getElementById('vina-episode-canvas-context-style')) {
      const style = frameDocument.createElement('style');
      style.id = 'vina-episode-canvas-context-style';
      style.textContent = `
        /* 2026-09-17 改动逻辑：短剧画布移除项目标题横条，Agent 标题上移并沿用原底部边距，从而增加消息与输入区域的可用高度。 */
        html.vina-episode-canvas-context .chat > .chat-head { display: none !important; }
        html.vina-episode-canvas-context .chat:not(.is-conversation-collapsed)::before { top: 24px !important; }
      `;
      frameDocument.head.append(style);
    }
    const chat = frameDocument.getElementById('chatPanel');
    if (!chat) return;
    // 2026-09-17 改动逻辑：画布内关闭按钮仍负责收起 Agent，同时把收起状态同步到外层顶栏，顶栏 Agent 成为唯一恢复入口。
    const syncAgentButton = () => {
      if (workspace.dataset.episodeVideoMode !== 'canvas') return;
      const expanded = !chat.classList.contains('is-conversation-collapsed');
      canvasAgentButton?.setAttribute('aria-expanded', String(expanded));
      canvasAgentButton?.classList.toggle('is-active', expanded);
    };
    syncAgentButton();
    if (chat.dataset.episodeCanvasCollapseSync !== 'true') {
      chat.dataset.episodeCanvasCollapseSync = 'true';
      new frame.contentWindow.MutationObserver(syncAgentButton).observe(chat, { attributes:true, attributeFilter:['class'] });
    }
  }
  // 2026-09-17 改动逻辑：时间轴只注入分集 iframe；所有草稿、拖拽浮图和命中区域留在该 iframe，完全隔离全能创作。
  function installStoryboardTimeline(frame) {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc?.body || doc.getElementById('episode-storyboard-timeline-style')) return;
    const style = doc.createElement('style');
    style.id = 'episode-storyboard-timeline-style';
    style.textContent = `
      #episodeStoryboardTimeline { position:fixed; left:30%; right:28px; bottom:68px; z-index:100000; padding:16px 18px 18px; border:1px solid #ffffff21; border-radius:28px; background:#202020; color:#bbb; box-shadow:0 12px 44px #0008; font:14px/1.4 system-ui,sans-serif; }
      #episodeStoryboardTimeline[hidden] { display:none !important; }
      #episodeStoryboardTimeline .episode-timeline-head { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:10px; }
      #episodeStoryboardTimeline .episode-timeline-hint { display:flex; align-items:center; gap:6px; }
      #episodeStoryboardTimeline .episode-timeline-actions { display:flex; gap:8px; flex-shrink:0; }
      #episodeStoryboardTimeline button { border:0; border-radius:20px; padding:7px 13px; background:#393939; color:white; font:600 14px/1.4 system-ui,sans-serif; cursor:pointer; }
      #episodeStoryboardTimeline button[data-apply] { background:#fff; color:#111; }
      #episodeStoryboardTimeline button:focus-visible { outline:2px solid #398bff; outline-offset:3px; }
      #episodeStoryboardTimeline .episode-timeline-track { display:flex; align-items:center; gap:4px; overflow-x:auto; min-height:104px; padding:2px; scrollbar-width:thin; scrollbar-color:#555 transparent; }
      #episodeStoryboardTimeline .episode-timeline-clip, #episodeStoryboardTimeline .episode-timeline-slot { position:relative; flex:0 0 184px; height:104px; box-sizing:border-box; border-radius:4px; border:1px solid #ffffff24; overflow:hidden; background-size:cover; background-position:center; transition:transform .12s; }
      #episodeStoryboardTimeline .episode-timeline-clip video { width:100%; height:100%; object-fit:cover; pointer-events:none; }
      #episodeStoryboardTimeline .episode-timeline-clip span { position:absolute; inset:auto 0 0; padding:16px 8px 6px; color:#ddd; font-size:12px; background:linear-gradient(transparent,#0009); }
      #episodeStoryboardTimeline .episode-timeline-clip.is-replace { border:2px solid #398bff; box-shadow:inset 0 0 0 100px #398bff38; }
      #episodeStoryboardTimeline .episode-timeline-clip.is-replace::after { content:''; position:absolute; inset:0; background:#398bff33; pointer-events:none; }
      #episodeStoryboardTimeline .episode-timeline-slot { display:flex; align-items:center; justify-content:center; border:1px dashed #398bff; background:#398bff30; color:#62a5ff; font-size:28px; }
      .episode-storyboard-drag-ghost { position:fixed; width:174px; height:98px; z-index:2147483600; pointer-events:none; border:1px solid #ffffff50; border-radius:4px; overflow:hidden; background:#252525 center/cover; box-shadow:0 12px 32px #0009; }
      .episode-storyboard-drag-ghost video { width:100%; height:100%; object-fit:cover; }
      html.vina-episode-canvas-context #nodeActionBar [data-episode-add-storyboard][hidden] { display:none !important; }
      @media(max-width:800px) { #episodeStoryboardTimeline { left:16px !important; right:16px; bottom:64px; padding:12px; } #episodeStoryboardTimeline .episode-timeline-hint { font-size:12px; } }
    `;
    doc.head.append(style);
    const panel = doc.createElement('section');
    panel.id = 'episodeStoryboardTimeline';
    panel.hidden = true;
    panel.setAttribute('aria-label', '添加到故事板');
    panel.innerHTML = '<div class="episode-timeline-head"><span class="episode-timeline-hint"><svg width="15" height="18" viewBox="0 0 18 20" fill="none" stroke="currentColor" aria-hidden="true"><rect x="1" y="2" width="3" height="16" rx="1"/><rect x="7" y="2" width="3" height="16" rx="1"/><path d="M12 10h6m-3-3 3 3-3 3"/></svg>将素材移动到分镜轴上即可替换/添加新分镜</span><div class="episode-timeline-actions"><button type="button" data-cancel>取消</button><button type="button" data-apply>应用</button></div></div><div class="episode-timeline-track" aria-label="故事板分镜轴"></div>';
    doc.body.append(panel);
    const track = panel.querySelector('.episode-timeline-track');
    let draft = [], draftKey = '', drag = null, hit = null, suppressClick = false;
    const ghost = doc.createElement('div');
    ghost.className = 'episode-storyboard-drag-ghost';
    const placeholder = doc.createElement('div');
    placeholder.className = 'episode-timeline-slot';
    placeholder.textContent = '+';
    let button;
    let contextButton;
    const selected = () => doc.querySelector('.node.selected');
    const playable = node => {
      if (!node || node.dataset.generationStatus === 'generating' || node.dataset.remakeGenerationStatus === 'generating' || node.querySelector('.thumb.blank, .thumb.generating')) return null;
      const video = node.querySelector('video.node-video, .thumb video');
      return video && (video.currentSrc || video.getAttribute('src')) ? video : null;
    };
    // 2026-09-17 改动逻辑：优先用素材封面，无封面时从当前视频帧提取图片；跨域无法取帧则用静音首帧预览兜底。
    function mediaFromNode(node, video) {
      let poster = video.poster || '';
      if (!poster && video.readyState >= 2 && video.videoWidth) {
        try {
          const image = doc.createElement('canvas');
          image.width = 480;
          image.height = Math.round(480 * video.videoHeight / video.videoWidth);
          image.getContext('2d').drawImage(video, 0, 0, image.width, image.height);
          poster = image.toDataURL('image/jpeg', .85);
        } catch (_) { /* 远程媒体受浏览器跨域保护时使用视频首帧。 */ }
      }
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Number(node.dataset.videoDuration) || 9;
      // 2026-09-17 修复逻辑：节点输入框位于共享浮层，不在节点内部；选中节点读取当前编辑值，其他节点读取各自保存的提示词字段。
      const editor = doc.getElementById('nodePrompt');
      const prompt = node === selected() && editor ? editor.value : (node.dataset.nodePromptDraft ?? node.dataset.generationPrompt ?? node.dataset.assetPrompt ?? node.dataset.remakePrompt ?? node.dataset.prompt ?? node.querySelector('textarea')?.value ?? '');
      // 保存拖拽时画面位置，无法跨域导出图片时，故事板用同源地址的视频静帧还原相同封面。
      return { videoSrc: video.currentSrc || video.src, videoPoster: poster, videoCoverTime: String(video.currentTime || 0), cover: poster ? `url(${JSON.stringify(poster)})` : '', duration: `${Math.round(duration * 10) / 10}s`, generationState: 'generated', prompt, sourceNodeId: node.id };
    }
    function fillPreview(element, clip) {
      element.style.backgroundImage = clip.cover || 'none';
      if (!clip.cover && clip.videoSrc) {
        const video = doc.createElement('video');
        video.src = clip.videoSrc;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(Number(clip.videoCoverTime) || .001, Math.max(0, video.duration - .001)); }, { once:true });
        element.append(video);
      }
    }
    function render() {
      track.replaceChildren();
      draft.forEach((clip, index) => {
        const card = doc.createElement('div');
        card.className = 'episode-timeline-clip';
        card.dataset.index = String(index);
        fillPreview(card, clip);
        const label = doc.createElement('span');
        label.textContent = `分镜${index + 1}`;
        card.append(label);
        track.append(card);
      });
    }
    function clearHit() {
      hit = null;
      placeholder.remove();
      track.querySelectorAll('.is-replace').forEach(card => card.classList.remove('is-replace'));
    }
    function finishDrag() {
      drag = null;
      ghost.remove();
      clearHit();
    }
    function close() { finishDrag(); panel.hidden = true; button?.setAttribute('aria-expanded', 'false'); }
    panel.querySelector('[data-cancel]').addEventListener('click', close);
    panel.querySelector('[data-apply]').addEventListener('click', () => {
      if (window.vinaApplyEpisodeStoryboard?.(draftKey, draft)) {
        close();
        setMode('storyboard', true);
      }
    });
    function open() {
      const snapshot = window.vinaReadEpisodeStoryboard?.();
      if (!snapshot) return;
      if (panel.hidden) { draftKey = snapshot.key; draft = snapshot.clips.map(clip => ({ ...clip })); render(); }
      const chat = doc.getElementById('chatPanel');
      const rect = chat?.getBoundingClientRect();
      panel.style.left = rect && !chat.classList.contains('is-conversation-collapsed') ? `${Math.min(rect.right + 24, win.innerWidth * .48)}px` : 'max(24px, 12%)';
      panel.hidden = false;
      button?.setAttribute('aria-expanded', 'true');
    }
    function syncButton() {
      const remake = doc.querySelector('#nodeActionBar [data-clip-remake]');
      if (!remake) return;
      if (!button?.isConnected) {
        button = doc.createElement('button');
        button.type = 'button';
        button.className = 'clip-remake-toolbar-btn';
        button.dataset.episodeAddStoryboard = 'true';
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M3 9h5M3 15h5m5-6v6m-3-3h6"/></svg><span>添加到故事板</span>';
        button.addEventListener('pointerdown', event => event.stopPropagation());
        button.addEventListener('click', event => { event.stopPropagation(); open(); });
        remake.before(button);
      }
      const canAddToStoryboard = Boolean(playable(selected()));
      button.hidden = !canAddToStoryboard;

      // 2026-09-17 改动逻辑：短剧分集画布的视频节点右键菜单复用上方“添加到故事板”入口；仅有效视频显示，点击后打开同一条故事板时间轴。
      const contextMenu = doc.getElementById('contextMenu');
      if (contextMenu && !contextButton?.isConnected) {
        contextButton = doc.createElement('button');
        contextButton.type = 'button';
        contextButton.dataset.episodeAddStoryboardContext = 'true';
        contextButton.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M3 9h5M3 15h5m5-6v6m-3-3h6"/></svg>添加到故事板';
        contextButton.addEventListener('click', event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          contextMenu.style.display = 'none';
          open();
        });
        contextMenu.prepend(contextButton);
      }
      if (contextButton) contextButton.hidden = !canAddToStoryboard;
    }
    let syncQueued = false;
    new win.MutationObserver(() => {
      if (syncQueued) return;
      syncQueued = true;
      win.requestAnimationFrame(() => { syncQueued = false; syncButton(); });
    }).observe(doc.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class'] });
    syncButton();
    // 2026-09-17 改动逻辑：时间轴打开时拖动视频主体只复制素材；拦截原节点移动，浮动缩略图跟随指针，原视频仍留在画布。
    doc.addEventListener('pointerdown', event => {
      if (panel.hidden || event.button !== 0 || event.target.closest('button,input,textarea,.connect-handle,[data-video-controls],.node-video-controls,.clip-remake-player-controls')) return;
      const node = event.target.closest('.node');
      const video = playable(node);
      if (!video || !event.target.closest('.thumb')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      drag = { node, video, x:event.clientX, y:event.clientY, id:event.pointerId, active:false };
    }, true);
    doc.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
      if (!drag.active) {
        drag.active = true;
        drag.clip = mediaFromNode(drag.node, drag.video);
        ghost.replaceChildren();
        fillPreview(ghost, drag.clip);
        doc.body.append(ghost);
      }
      ghost.style.left = `${event.clientX - 87}px`;
      ghost.style.top = `${event.clientY - 76}px`;
      const bounds = track.getBoundingClientRect();
      if (event.clientY < bounds.top - 15 || event.clientY > bounds.bottom + 15 || event.clientX < bounds.left || event.clientX > bounds.right) { clearHit(); return; }
      if (event.clientX > bounds.right - 36) track.scrollLeft += 14;
      if (event.clientX < bounds.left + 36) track.scrollLeft -= 14;
      // 保留插入占位区域的命中，避免两侧缩略图腾挪后在替换和插入之间抖动。
      if (placeholder.isConnected) {
        const slot = placeholder.getBoundingClientRect();
        if (event.clientX >= slot.left - 4 && event.clientX <= slot.right + 4) return;
      }
      clearHit();
      const cards = [...track.querySelectorAll('.episode-timeline-clip')];
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const index = Number(card.dataset.index);
        if (event.clientX <= rect.right) {
          if (event.clientX < rect.left + 26) hit = { type:'insert', index };
          else if (event.clientX > rect.right - 26) hit = { type:'insert', index:index + 1 };
          else { hit = { type:'replace', index }; card.classList.add('is-replace'); }
          break;
        }
      }
      if (!hit) hit = { type:'insert', index:draft.length };
      if (hit.type === 'insert') track.insertBefore(placeholder, cards[hit.index] || null);
    }, true);
    doc.addEventListener('pointerup', event => {
      if (!drag || event.pointerId !== drag.id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (drag.active && hit) {
        const clip = { ...drag.clip };
        if (hit.type === 'replace') draft[hit.index] = { ...draft[hit.index], ...clip };
        else draft.splice(hit.index, 0, clip);
        render();
      }
      suppressClick = drag.active;
      finishDrag();
      win.setTimeout(() => { suppressClick = false; }, 0);
    }, true);
    doc.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    doc.addEventListener('pointercancel', finishDrag, true);
    win.addEventListener('blur', finishDrag);
    doc.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.stopImmediatePropagation(); close(); } }, true);
    // 切换模式或分集时丢弃未应用草稿，重新打开始终从当前故事板读取。
    frame.vinaCloseStoryboardTimeline = close;
  }
  function syncStoryboardSidePanelButtons() {
    const sidebar = workspace.querySelector('.episode-agent-sidebar');
    sidePanelButtons.forEach(button => {
      const pane = document.getElementById(button.getAttribute('aria-controls'));
      const expanded = Boolean(sidebar && !sidebar.hidden && pane && !pane.hidden);
      button.setAttribute('aria-expanded', String(expanded));
      button.classList.toggle('is-active', expanded);
    });
  }
  // 2026-11-04 修复逻辑：file:// 下独立 HTML iframe 是不透明来源，改用普通本地脚本
  // 读取短剧专属静态页面字符串，再通过 srcdoc 继承首页来源；不使用 fetch、本地服务或全能画布工厂。
  // 本地源码包按需加载并在各集间复用；失败时清理脚本和 Promise，允许现有“重新加载”入口重试。
  let localEpisodeCanvasSourcePromise = null;
  function loadLocalEpisodeCanvasSource() {
    if (typeof window.__vinaEpisodeCanvasLocalHtml === 'string' && window.__vinaEpisodeCanvasLocalHtml) {
      return Promise.resolve(window.__vinaEpisodeCanvasLocalHtml);
    }
    if (!localEpisodeCanvasSourcePromise) {
      localEpisodeCanvasSourcePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        let settled = false;
        const finish = error => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          script.onload = null;
          script.onerror = null;
          script.remove();
          if (error) reject(error);
          else resolve(window.__vinaEpisodeCanvasLocalHtml);
        };
        const timeout = window.setTimeout(() => finish(new Error('短剧本地剪辑资源加载超时')), 15000);
        script.async = true;
        script.src = new URL('./assets/episode-canvas/local-source.js?v=20261112-free-wan-team-models', document.baseURI).href;
        script.onload = () => finish(
          typeof window.__vinaEpisodeCanvasLocalHtml === 'string' && window.__vinaEpisodeCanvasLocalHtml
            ? null : new Error('短剧本地剪辑资源不可用')
        );
        script.onerror = () => finish(new Error('无法读取短剧本地剪辑资源，请保留完整的 assets 文件夹'));
        document.head.append(script);
      }).catch(error => {
        localEpisodeCanvasSourcePromise = null;
        throw error;
      });
    }
    return localEpisodeCanvasSourcePromise;
  }
  // 2026-11-04 修复逻辑：每个分集文档只初始化一次，DOMContentLoaded 与 load 不再重复清空工程。
  function initializeEpisodeCanvas(frame) {
    if (frame.dataset.episodeInitToken || !frame.isConnected) return;
    frame.dataset.episodeCanvasReady = 'false';
    frame.dataset.episodeInitToken = frame.name + ':' + Date.now();
    frame.contentWindow.postMessage({ type:'vina-canvas-new-project', projectName:getFirstCanvasProjectName(), episodeInitToken:frame.dataset.episodeInitToken }, '*');
    configureEpisodeCanvas(frame);
  }
  function ensureCanvas() {
    let frame = frames.get(episode);
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = episode + ' · 独立画布';
      frame.name = 'episode-video:' + episode;
      frame.allow = 'autoplay; fullscreen; clipboard-write';
      // 2026-09-26 改动逻辑：刷新短剧专属 iframe 缓存，使分集剪辑菜单加载 MP4 与剪映工程选项；全能创作画布继续使用自己的代码入口。
      // 2026-09-26 改动逻辑：刷新短剧内嵌剪辑器缓存，仅分集工程隐藏第二行并将内容上移。
      // 2026-10-11 改动逻辑：更新静态画布缓存版本，使独立分集剪辑器也加载 Figma Toast 及显式失败状态。
      // 2026-10-26 修复逻辑：只更新短剧专属 iframe 缓存，加载初始化完成握手；全能创作入口不变。
      const localFile = window.location.protocol === 'file:';
      if (!localFile) frame.src = './assets/episode-canvas/index.html?v=20261112-free-wan-team-models';
      // 2026-11-04 修复逻辑：忽略本地 iframe 挂载时的 about:blank load；真正的 srcdoc
      // 文档通过 DOM 就绪消息或 load 初始化，同一文档的迟到 load 不再重置已打开的剪辑器。
      frame.addEventListener('load', () => {
        if (localFile && frame.contentDocument?.URL !== 'about:srcdoc') return;
        initializeEpisodeCanvas(frame);
      });
      frames.set(episode, frame);
      canvas.append(frame);
      if (localFile) {
        loadLocalEpisodeCanvasSource().then(source => {
          // 2026-11-04 修复逻辑：重试已替换的旧 iframe 不再写入；资源基址从当前首页生成，
          // 不保存开发电脑绝对路径，复制文件夹到 Windows/Mac 或含空格的目录后仍按项目根目录加载。
          if (!frame.isConnected) return;
          const base = new URL('./', document.baseURI).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
          let html = source.replace(/<base\b[^>]*>/i, () => '<base href="' + base + '">');
          // 原独立页已把 base 指向项目根目录，阿语资源也统一从 assets 解析，避免 srcdoc 指向上级目录。
          html = html.replace(/(<script\b[^>]*\bsrc=["'])\.\.\/(arabic-(?:copy|i18n)\.js)/g, '$1./assets/$2');
          // 2026-11-04 修复逻辑：DOM 与 defer 业务脚本就绪便通知父页，不等待外部图片的 load，
          // 避免其他电脑无法访问远端预览图片时连带阻塞剪辑器；启动完成仍由原令牌回执确认。
          const readyScript = '<script>document.addEventListener("DOMContentLoaded",function(){window.parent.postMessage({type:"vina-episode-canvas-document-ready"},"*");},{once:true});</script>';
          const bodyEnd = html.lastIndexOf('</body>');
          frame.srcdoc = bodyEnd < 0 ? html + readyScript : html.slice(0, bodyEnd) + readyScript + html.slice(bodyEnd);
        }).catch(error => {
          if (!frame.isConnected) return;
          frame.dataset.episodeCanvasError = 'source-load';
          console.error('短剧剪辑器本地资源加载失败', error);
          frame.dispatchEvent(new Event('error'));
        });
      }
    }
    // 2026-09-26 改动逻辑：切换到另一集的 iframe 前撤下旧剪辑器代理按钮，等待新工程真实打开后再显示第一行操作。
    if (activeComposerFrame && activeComposerFrame !== frame) setComposerToolbarVisible(false);
    frames.forEach(item => { item.hidden = item !== frame; });
    return frame;
  }
  function setMode(mode, focus = false) {
    const isCanvas = mode === 'canvas';
    // 2026-09-26 改动逻辑：退出短剧画布时同步撤下代理顶栏，普通分集详情恢复原切集与侧栏入口。
    if (!isCanvas) {
      editorOpenRequestId += 1;
      cancelEditorOpen?.();
      setEditorLoading(false);
      setComposerToolbarVisible(false);
    }
    // 2026-09-17 改动逻辑：退出画布即取消未提交时间轴草稿。
    if (!isCanvas) frames.forEach(frame => frame.vinaCloseStoryboardTimeline?.());
    storyboard.hidden = isCanvas;
    canvas.hidden = !isCanvas;
    workspace.dataset.episodeVideoMode = mode;
    tabs.forEach(tab => {
      const active = tab.dataset.episodeVideoMode === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    if (isCanvas) {
      const frame = ensureCanvas();
      configureEpisodeCanvas(frame);
    } else {
      syncStoryboardSidePanelButtons();
    }
  }
  // 2026-09-17 改动逻辑：画布模式的顶栏 Agent 不再打开故事板侧栏，只展开 iframe 内 Agent；剧本模式下保留既有按钮行为。
  canvasAgentButton?.addEventListener('click', event => {
    if (workspace.dataset.episodeVideoMode !== 'canvas') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const frame = ensureCanvas();
    configureEpisodeCanvas(frame);
    const chat = frame.contentDocument?.getElementById('chatPanel');
    if (!chat) return;
    if (chat.classList.contains('is-conversation-collapsed')) chat.querySelector('.canvas-conversation-restore')?.click();
    canvasAgentButton.setAttribute('aria-expanded', 'true');
    canvasAgentButton.classList.add('is-active');
  }, true);
  // 2026-09-17 改动逻辑：整集剪辑由第 3 步卡片按钮直接触发；force 让该入口绕过详情页内部按钮状态。
  function openCurrentVideoEditor(force = false) {
    if ((!force && (!editButton || editButton.getAttribute('aria-disabled') === 'true')) || !detailVideo) return;
    // 2026-09-16 改动逻辑：剪辑阶段固定展示一段现有演示视频，不再读取分镜卡片、生成状态或多片段列表；时间轴始终只有一个视频片段。
    const fixedVideoSource = new URL('./assets/videos/drama-broom-flight.mp4?v=20260728-original', document.baseURI).href;
    const clips = [{
      key: 'fixed-single-video',
      src: fixedVideoSource,
      title: `${episode} · 成片`,
      duration: 139
    }];
    // 2026-09-16 改动逻辑：使用新的单视频工程键避免复用此前可能为空的多片段工程，并继续隐藏剪辑阶段内部模式切换。
    const request = { key: `${episode}::fixed-single-video-v1`, title: `${episode} · 成片剪辑`, clips, hideModeSwitcher: force };
    detailVideo.pause();
    cancelEditorOpen?.();
    const requestId = ++editorOpenRequestId;
    const requestedEpisode = episode;
    // 2026-10-26 Product Design 修复逻辑：先遮住短剧画布，保留 iframe 正常布局供时间轴初始化；剪辑器真实打开后一次性显示。
    // 2026-11-04 改动逻辑：从打开等待页开始计时，白色转圈固定显示 1500ms；剪辑器在遮罩下并行初始化。
    const loadingStartedAt = performance.now();
    setEditorLoading(true);
    setComposerToolbarVisible(false);
    setMode('canvas');
    const frame = ensureCanvas();
    const deadline = Date.now() + 60000;
    let timer = null;
    let loadingTimer = null;
    let loadingFinished = false;
    let editorReady = false;
    let stopped = false;
    let opened = false;
    const cleanup = () => {
      stopped = true;
      window.clearTimeout(timer);
      // 2026-11-04 改动逻辑：返回、切集和重试时同时撤销 1.5 秒计时，旧请求不再改变当前等待页。
      window.clearTimeout(loadingTimer);
      frame.removeEventListener('load', scheduleOpen);
      frame.removeEventListener('error', fail);
      if (cancelEditorOpen === cleanup) cancelEditorOpen = null;
    };
    const isCurrent = () => !stopped && requestId === editorOpenRequestId && !workspace.hidden && requestedEpisode === episode && workspace.dataset.episodeVideoMode === 'canvas';
    // 2026-11-04 改动逻辑：内容提前就绪也等满 1.5 秒再显示；慢加载时转圈仍按时结束，保留等待提示直到真实剪辑面板就绪。
    const revealEditor = () => {
      if (!isCurrent() || !loadingFinished || !editorReady) return;
      cleanup();
      setComposerToolbarVisible(true, frame);
      document.body.classList.add('libtv-composer-full-active');
      setEditorLoading(false);
    };
    const fail = () => {
      if (!isCurrent()) return cleanup();
      cleanup();
      setComposerToolbarVisible(false);
      document.body.classList.remove('libtv-composer-full-active');
      setEditorLoading(true, true);
    };
    function scheduleOpen() {
      window.clearTimeout(timer);
      timer = window.setTimeout(openWhenReady, 100);
    }
    function openWhenReady() {
      if (!isCurrent()) return cleanup();
      if (Date.now() >= deadline) return fail();
      // 2026-11-04 修复逻辑：资源缺失/超时属于已知失败，立即进入原重试状态，不再空等一分钟。
      if (frame.dataset.episodeCanvasError) return fail();
      // 2026-10-26 修复逻辑：专属 iframe 回执保证 DOM、启动消息及延迟初始化已经完成，不再只判断打开函数是否存在。
      if (frame.dataset.episodeCanvasReady !== 'true') return scheduleOpen();
      try {
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        if (!opened && typeof win?.vinaOpenEpisodeVideoComposer === 'function') {
          opened = win.vinaOpenEpisodeVideoComposer(request) === true;
          // 给内嵌页的 MutationObserver 和已排队初始化任务一轮执行机会，再确认面板仍在 DOM 中。
          if (opened) return scheduleOpen();
        } else if (opened) {
          const editor = doc?.querySelector('.libtv-editor.is-full.is-episode-composer:not([hidden])');
          const project = Array.from(doc?.querySelectorAll('.libtv-composer-node') || []).find(node => node.dataset.vinaEpisodeClipKey === request.key);
          if (editor?.isConnected && project?.isConnected && win.getComputedStyle(editor).display !== 'none') {
            editorReady = true;
            revealEditor();
            return;
          }
          opened = false;
        }
      } catch (error) {
        // 2026-11-04 修复逻辑：浏览器明确拒绝来源访问时终止轮询，避免吞掉权限错误后持续显示加载中。
        if (error?.name === 'SecurityError') {
          console.error('短剧剪辑器来源访问失败', error);
          return fail();
        }
        opened = false;
      }
      scheduleOpen();
    }
    cancelEditorOpen = cleanup;
    // 2026-11-04 改动逻辑：转圈时长独立于 iframe 就绪轮询，每次打开固定 1.5 秒，避免快加载一闪而过或慢加载一直旋转。
    loadingTimer = window.setTimeout(() => {
      if (!isCurrent()) return cleanup();
      loadingFinished = true;
      editorLoading.querySelector('img').hidden = true;
      revealEditor();
    }, Math.max(0, 1500 - (performance.now() - loadingStartedAt)));
    frame.addEventListener('load', scheduleOpen);
    frame.addEventListener('error', fail);
    openWhenReady();
  }

  // 2026-09-15 改动逻辑：父页左上返回优先关闭剪辑器，保留当前分集并进入视频提示词，阻止原返回分集列表事件。
  function returnToPrompt() {
    // 2026-09-16 修复逻辑：关闭或返回时立即作废尚未完成的首次加载轮询，防止 iframe 稍后就绪又自动弹回剪辑器。
    editorOpenRequestId += 1;
    // 2026-09-26 改动逻辑：无论由左上返回还是右侧关闭退出，立即恢复分集顶栏原状态。
    setComposerToolbarVisible(false);
    setMode('storyboard', true);
    document.body.classList.remove('libtv-composer-full-active');
    if (openedFromEditStep) {
      // 2026-09-17 改动逻辑：卡片直达的剪辑工程关闭后回到第 3 步分集视频列表，不停留在详情页。
      openedFromEditStep = false;
      document.querySelector('[data-workflow-view="episode-video"]')?.click();
      return;
    }
    workspace.querySelector('button[data-detail-view="prompt"]')?.click();
  }
  window.addEventListener('click', event => {
    const back = event.target.closest?.('.script-back');
    if (!back || !workspace.contains(back) || workspace.hidden || workspace.dataset.episodeVideoMode !== 'canvas') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    frames.get(episode)?.contentWindow?.vinaCloseEpisodeVideoComposer?.();
    returnToPrompt();
  }, true);
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setMode(tab.dataset.episodeVideoMode));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = 1;
      if (next === undefined) return;
      event.preventDefault();
      setMode(tabs[next].dataset.episodeVideoMode, true);
    });
  });
  editButton?.addEventListener('click', () => openCurrentVideoEditor(false));
  // 2026-09-16 修复逻辑：暴露可直接调用且可消费待处理标记的入口；即使首次点击早于本脚本初始化，请求也不会像一次性事件一样丢失。
  function requestEpisodeEditorStep() {
    // 2026-09-17 修复逻辑：延迟消费首次入口前确认仍停留在卡片直达的分集详情；用户已返回时清除请求，避免下一帧重新打开剪辑器。
    if (workspace.hidden || !workspace.classList.contains('is-episode-edit-entry')) {
      window.__vinaPendingEpisodeEditorStep = null;
      return;
    }
    episode = title.textContent.trim();
    openedFromEditStep = true;
    window.__vinaPendingEpisodeEditorStep = null;
    openCurrentVideoEditor(true);
  }
  window.vinaRequestOpenEpisodeEditorStep = requestEpisodeEditorStep;
  window.addEventListener('vina-open-episode-editor-step', requestEpisodeEditorStep);
  // 2026-09-14：切换到其他集或重新进入分集时默认故事板；各集已创建的画布仍留在内存。
  new MutationObserver(() => {
    const next = title.textContent.trim();
    if (next !== episode) {
      episode = next;
      // 2026-09-16 修复逻辑：标题异步刷新时以当前工作流入口决定模式；剪辑步骤重新定位本集工程，只有普通分镜详情才恢复故事板。
      if (!workspace.hidden && workspace.classList.contains('is-episode-edit-entry')) requestEpisodeEditorStep();
      else setMode('storyboard');
    }
  }).observe(title, { childList:true, characterData:true, subtree:true });
  new MutationObserver(() => { if (workspace.hidden) setMode('storyboard'); })
    .observe(workspace, { attributes:true, attributeFilter:['hidden'] });
  window.addEventListener('message', event => {
    const sourceFrame = [...frames.values()].find(frame => frame.contentWindow === event.source);
    if (!sourceFrame) return;
    // 2026-11-04 修复逻辑：本地 DOM 就绪消息只接受已登记 iframe 的真实窗口；
    // file:// 的 origin 为 null，不能拿来源字符串代替窗口身份。HTTP 入口仍沿用 load 初始化。
    if (event.data?.type === 'vina-episode-canvas-document-ready') {
      if (window.location.protocol === 'file:' && sourceFrame.contentDocument?.URL === 'about:srcdoc') {
        initializeEpisodeCanvas(sourceFrame);
      }
      return;
    }
    // 2026-10-26 修复逻辑：初始化回执只认证对应短剧 iframe 的本次启动令牌，旧工程消息不能提前结束当前加载。
    if (event.data?.type === 'vina-episode-canvas-ready') {
      if (event.data.episodeInitToken === sourceFrame.dataset.episodeInitToken) sourceFrame.dataset.episodeCanvasReady = 'true';
      return;
    }
    // 2026-10-26 修复逻辑：非当前分集、隐藏页面及非画布模式的迟到消息不再改变剪辑顶栏或页面。
    if (sourceFrame !== frames.get(episode) || sourceFrame.hidden || workspace.hidden || workspace.dataset.episodeVideoMode !== 'canvas') return;
    // 2026-11-09 改动逻辑：已认证短剧 iframe 的旧本地导出消息也进入直接下载流程；剪映请求不再处理，全能创作不进入此分支。
    if (event.data?.type === 'vina-episode-editor-export-format') {
      if (event.data.format === 'mp4') runComposerLocalExport();
      return;
    }
    if (event.data?.type === 'vina-canvas-return-home') setMode('storyboard', true);
    // 2026-09-15 改动逻辑：从分集视频进入的剪辑器点击右上角关闭后，恢复进入前的故事板界面，而不是停留在画布模式。
    if (event.data?.type === 'vina-episode-editor-closed') returnToPrompt();
    // 2026-09-15 改动逻辑：分集画布的剪辑器全屏状态同步到父页面，沿用主画布规则隐藏右上账户栏，退出剪辑后立即恢复。
    if (event.data?.type === 'vina-libtv-composer-fullscreen') {
      // 2026-10-26 修复逻辑：加载中的全屏消息只代表开始挂载，最终可见性由打开请求确认后统一提交。
      if (workspace.classList.contains('is-episode-editor-loading')) return;
      document.body.classList.toggle('libtv-composer-full-active', Boolean(event.data.active));
      // 2026-09-26 改动逻辑：仅当前短剧分集剪辑全屏时显示合并后的第一行；普通画布剪辑和半屏状态沿用各自原顶栏。
      const showComposerToolbar = Boolean(event.data.active && event.data.episode && !sourceFrame.hidden && !workspace.hidden && workspace.dataset.episodeVideoMode === 'canvas');
      setComposerToolbarVisible(showComposerToolbar, sourceFrame);
    }
  });
  // 2026-09-16 修复逻辑：首次初始化直接消费剪辑入口状态，不先显示故事板再等下一帧；入口标记也可补偿待处理请求被提前消费的加载时序。
  if (!workspace.hidden && workspace.classList.contains('is-episode-edit-entry')) requestEpisodeEditorStep();
  else setMode('storyboard');
})();
