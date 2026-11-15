/* 2026-11-09 Product Design 改动逻辑：全能创作图片和视频节点共用提示词上方的“＋ 上传”入口、图标和两项菜单。
 * 本地上传打开系统文件选择弹窗；从资产库选择打开原资产库弹窗，确认后新增参考节点并连入打开时捕获的目标。
 * 菜单关闭、键盘操作、只读禁用及异步封面刷新均复用视频原有流程；保留目标图片/视频及提示词。
 * 两项菜单复用既有本地导入和资产库，通过真实入边关联参考；不替换目标图片/视频或提示词。
 * 打开选择器时捕获目标，取消不创建节点；异步素材加载后刷新参考缩略图和 @ 候选。
 */
(function () {
  function install() {
    if (document.getElementById('character-asset-canvas-theme')) return;
    var panel = document.getElementById('nodeGeneratePanel');
    var stage = document.getElementById('stage');
    if (!panel || !stage || panel.querySelector('.vina-video-reference-upload')) return;

    var control = document.createElement('div');
    control.className = 'vina-video-reference-upload';
    control.hidden = true;
    // 2026-11-09 Product Design 改动逻辑：图片和视频共用资产库图标原始 SVG，内嵌图片显式填充为本地上传图标的 #9AA6B2，避免滤镜与透明度造成颜色差异。
    control.innerHTML = '<button type="button" class="vina-video-reference-upload-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="vinaVideoReferenceUploadMenu"><img src="./assets/icons/library-filter-plus.svg" alt=""><span>上传</span></button>' +
      '<div id="vinaVideoReferenceUploadMenu" class="vina-video-reference-upload-menu" role="menu" aria-label="添加参考素材" hidden>' +
      '<button type="button" role="menuitem" data-video-reference-local><img src="./assets/icons/drama-composer/upload.svg" alt=""><span>本地上传</span></button>' +
      '<button type="button" role="menuitem" data-video-reference-library><img src="data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjOUFBNkIyIiB2aWV3Qm94PScwIDAgMTYgMTYnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTTEyLjY2NyAwSDMuMzMzQTMuMzM4IDMuMzM4IDAgMCAwIDAgMy4zMzN2OS4zMzRBMy4zMzggMy4zMzggMCAwIDAgMy4zMzMgMTZoOS4zMzRBMy4zMzggMy4zMzggMCAwIDAgMTYgMTIuNjY3VjMuMzMzQTMuMzM4IDMuMzM4IDAgMCAwIDEyLjY2NyAwWm0yIDMuMzMzSDEwdi0yaDIuNjY3YTIgMiAwIDAgMSAyIDJaTTcuMzMzIDEuMzMzaDEuMzM0djMuMzM0YS42NjcuNjY3IDAgMCAxLTEuMzM0IDBWMS4zMzNabS00IDBINnYySDEuMzMzYTIgMiAwIDAgMSAyLTJabTkuMzM0IDEzLjMzNEgzLjMzM2EyIDIgMCAwIDEtMi0ydi04SDZhMiAyIDAgMCAwIDQgMGg0LjY2N3Y4YTIgMiAwIDAgMS0yIDJaJy8+PHBhdGggZD0nTTEyLjY2NyAxMmgtMmEuNjY3LjY2NyAwIDEgMCAwIDEuMzMzaDJhLjY2Ny42NjcgMCAxIDAgMC0xLjMzM1onLz48L3N2Zz4=" alt=""><span>从资产库选择</span></button></div>';
    panel.appendChild(control);
    var trigger = control.querySelector('.vina-video-reference-upload-trigger');
    var menu = control.querySelector('[role="menu"]');
    var options = Array.from(menu.querySelectorAll('button'));
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpg,.jpeg,.png,.webp,.mp3,image/jpeg,image/png,image/webp,video/*,audio/mpeg';
    input.multiple = true;
    input.hidden = true;
    input.setAttribute('aria-label', '上传参考素材');
    control.appendChild(input);
    var pickerTarget = null;
    var currentTarget = null;
    var frame = 0;

    // 2026-11-09 Product Design 改动逻辑：参考缩略图复用真实上游节点；大图挂到 body 的固定浮层，避免被素材行 overflow 裁切，并按视口限制位置。
    var referenceRow = panel.querySelector('.panel-incoming-reference-badges');
    var referencePreview = document.createElement('div');
    referencePreview.className = 'vina-node-reference-hover-preview';
    referencePreview.hidden = true;
    referencePreview.setAttribute('aria-hidden', 'true');
    document.body.appendChild(referencePreview);
    var previewBadge = null;

    // 2026-11-09 Product Design 修复逻辑：读取原图 naturalWidth/naturalHeight 决定浮层比例，宽高同时按同一缩放系数限制，横图、竖图和方图不再套用固定 212×160 容器。
    // 使用请求序号隔离异步加载，快速切换缩略图或移出后，旧图片不能重新打开浮层；加载失败则保持关闭。
    var previewRequest = 0;
    // 2026-11-09 Product Design：视频参考优先使用 poster，否则缓存真实首帧；不改变原节点播放器的播放、暂停或当前时间。
    var previewVideo = null;
    var videoCoverCache = new Map();
    function referenceVideo(source) {
      var video = source.querySelector('.thumb video, video.node-video');
      if (!video) return null;
      var childSource = video.querySelector('source[src]');
      var url = video.getAttribute('src') ? video.src : video.currentSrc || (childSource && childSource.src) || '';
      return url ? { element: video, url: url, poster: video.poster || '' } : null;
    }
    function captureReferenceVideoCover(info) {
      if (info.poster) return info.poster;
      var cached = videoCoverCache.get(info.url);
      if (cached) return cached.cover;
      var record = { cover: '', loading: true };
      videoCoverCache.set(info.url, record);
      function capture(video) {
        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;
        try {
          var canvas = document.createElement('canvas');
          var scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          var context = canvas.getContext('2d');
          if (!context) return false;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          record.cover = canvas.toDataURL('image/jpeg', .85);
          return true;
        } catch (error) { return false; }
      }
      if (capture(info.element)) { record.loading = false; return record.cover; }
      // 原视频未解码时用独立、静音且不播放的加载器取首帧；每个 URL 只提取一次，不随素材行重建重复解码。
      var loader = document.createElement('video');
      loader.muted = true;
      loader.defaultMuted = true;
      loader.playsInline = true;
      loader.preload = 'auto';
      var timeout;
      function finish() {
        window.clearTimeout(timeout);
        loader.onloadeddata = null;
        loader.onerror = null;
        loader.pause();
        loader.removeAttribute('src');
        loader.load();
        record.loading = false;
        scheduleSync();
      }
      loader.onloadeddata = function () { capture(loader); finish(); };
      loader.onerror = finish;
      timeout = window.setTimeout(finish, 15000);
      loader.src = info.url;
      return record.cover;
    }
    function enhanceVideoCover(badge, source) {
      var info = referenceVideo(source);
      if (!info) return;
      var cover = captureReferenceVideoCover(info);
      var fallback = badge.querySelector('.vina-node-reference-video-cover');
      if (cover) {
        var background = 'url(' + JSON.stringify(cover) + ')';
        if (badge.dataset.vinaVideoCover !== cover) {
          badge.style.backgroundImage = background;
          badge.dataset.vinaVideoCover = cover;
        }
        if (fallback) { fallback.pause(); fallback.removeAttribute('src'); fallback.load(); fallback.remove(); }
        Array.from(badge.children).forEach(function (child) { if (child.matches('svg, i[data-lucide]')) child.hidden = true; });
      } else if (!fallback) {
        // 跨域视频禁止 canvas 导出时，静止的原生首帧仍作为封面；关闭按钮保持在其上方。
        fallback = document.createElement('video');
        fallback.className = 'vina-node-reference-video-cover';
        fallback.muted = true;
        fallback.defaultMuted = true;
        fallback.playsInline = true;
        fallback.controls = false;
        fallback.preload = 'auto';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.tabIndex = -1;
        fallback.src = info.url;
        badge.prepend(fallback);
      }
    }
    function positionReferencePreview(badge, media, naturalWidth, naturalHeight) {
      if (!naturalWidth || !naturalHeight) return false;
      var rect = badge.getBoundingClientRect();
      var maxWidth = Math.max(1, Math.min(202, window.innerWidth - 26));
      var maxHeight = Math.max(1, Math.min(270, window.innerHeight - 26));
      var scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
      var width = naturalWidth * scale + 10;
      var height = naturalHeight * scale + 10;
      referencePreview.style.width = width + 'px';
      referencePreview.style.height = height + 'px';
      referencePreview.replaceChildren(media);
      referencePreview.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)) + 'px';
      referencePreview.style.top = Math.max(8, Math.min(window.innerHeight - height - 8, rect.top - height - 10)) + 'px';
      referencePreview.hidden = false;
      return true;
    }
    function showReferenceVideo(badge, source, info) {
      var request = previewRequest;
      var video = document.createElement('video');
      previewVideo = video;
      previewBadge = badge;
      // 视频按 videoWidth/videoHeight 等比显示；独立播放器静音、行内、自动循环，不创建进度条或其他播放控件。
      video.muted = true;
      video.defaultMuted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.disablePictureInPicture = true;
      video.disableRemotePlayback = true;
      video.preload = 'auto';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback');
      video.setAttribute('aria-hidden', 'true');
      video.tabIndex = -1;
      var cached = videoCoverCache.get(info.url);
      if (info.poster || (cached && cached.cover)) video.poster = info.poster || cached.cover;
      video.onloadedmetadata = function () {
        if (request !== previewRequest || previewVideo !== video || previewBadge !== badge || !badge.isConnected || !source.isConnected || !panel.classList.contains('vina-video-reference-enabled')) return;
        if (!positionReferencePreview(badge, video, video.videoWidth, video.videoHeight)) return;
        var playing = video.play();
        if (playing && typeof playing.catch === 'function') playing.catch(function () {});
      };
      video.onerror = function () { if (request === previewRequest) hideReferencePreview(); };
      video.src = info.url;
    }
    function hideReferencePreview() {
      previewRequest += 1;
      referencePreview.hidden = true;
      // 2026-11-09：移出、关闭、切换参考或节点时，连同尚未加载完的预览视频一起停止并释放，避免后台循环和异步旧预览重新打开。
      if (previewVideo) {
        previewVideo.onloadedmetadata = null;
        previewVideo.onerror = null;
        previewVideo.pause();
        previewVideo.removeAttribute('src');
        previewVideo.load();
        previewVideo = null;
      }
      referencePreview.replaceChildren();
      previewBadge = null;
    }
    function showReferencePreview(badge, source) {
      hideReferencePreview();
      if (!badge.isConnected || !source.isConnected || !panel.classList.contains('vina-video-reference-enabled')) return;
      var videoInfo = referenceVideo(source);
      if (videoInfo) { showReferenceVideo(badge, source, videoInfo); return; }
      var background = typeof getNodePreviewBackground === 'function' ? getNodePreviewBackground(source) : badge.style.backgroundImage;
      var inlineImage = source.querySelector('.thumb img');
      // 优先读取缩略图对应的原始背景图片；兼容带括号的引号 URL 和直接使用 img 的素材。
      // 2026-11-09：CSS url() 使用单层正则转义，保证背景图片地址能正确交给原图尺寸加载器。
      var match = String(background || '').match(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/);
      var url = match ? (match[1] || match[2] || match[3] || '').trim() : '';
      if (!url && inlineImage) url = inlineImage.currentSrc || inlineImage.src;
      if (!url) return;
      var request = previewRequest;
      var image = new Image();
      image.alt = '';
      image.draggable = false;
      previewBadge = badge;
      image.onload = function () {
        if (request !== previewRequest || previewBadge !== badge || !badge.isConnected || !source.isConnected || !panel.classList.contains('vina-video-reference-enabled')) return;
        if (!image.naturalWidth || !image.naturalHeight) { hideReferencePreview(); return; }
        // 2026-11-09：图片和视频统一按各自真实尺寸定位浮层，图片继续保持原图比例。
        positionReferencePreview(badge, image, image.naturalWidth, image.naturalHeight);
      };
      image.onerror = function () { if (request === previewRequest) hideReferencePreview(); };
      image.src = url;
    }
    function referenceWritable(target) {
      return writable(target) && panel.classList.contains('active') && !panel.classList.contains('vina-collaboration-readonly');
    }
    function removeReference(target, source) {
      // 2026-11-09：仅删除 source → 当前目标的真实入边，保留素材节点、其他目标的连线及提示词；上传和资产库素材沿用同一引用移除流程。
      if (!referenceWritable(target) || selectedMediaNode() !== target) return;
      hideReferencePreview();
      var edges = Array.from(stage.querySelectorAll('.edge:not(.preview)')).filter(function (edge) {
        return edge.dataset.from === source.id && edge.dataset.to === target.id;
      });
      if (!edges.length) return;
      edges.forEach(function (edge) {
        var snapshot = typeof snapshotEdge === 'function' ? snapshotEdge(edge) : null;
        edge.remove();
        // 复用原连线删除历史，撤销时恢复真实连线，参考缩略图和生成引用也随之恢复。
        if (snapshot && typeof pushHistory === 'function') pushHistory({ type: 'edge-delete', edge: snapshot });
      });
      // Agent 生成可能另存来源 ID；同步清除当前来源，避免缩略图关闭后仍通过隐藏数据参与生成，撤销恢复的真实入边仍能重新提供该参考。
      if (target.hasAttribute('data-vina-reference-node-ids')) {
        target.dataset.vinaReferenceNodeIds = String(target.dataset.vinaReferenceNodeIds || '').split(',').map(function (id) { return id.trim(); }).filter(function (id) { return id && id !== source.id; }).join(',');
      }
      if (typeof hideEdgeCutButton === 'function') hideEdgeCutButton();
      if (typeof updateEdges === 'function') updateEdges();
      else if (typeof updateIncomingReferenceBadges === 'function') updateIncomingReferenceBadges();
      if (typeof updateFloatingNodeTools === 'function') updateFloatingNodeTools();
      scheduleSync();
    }
    function enhanceReferenceBadges(target, visible) {
      if (!referenceRow) return;
      if (!visible || (previewBadge && !previewBadge.isConnected)) hideReferencePreview();
      if (!visible || typeof getIncomingSourceNodes !== 'function') return;
      var sources = getIncomingSourceNodes(target).slice(0, 4);
      Array.from(referenceRow.querySelectorAll('.incoming-reference-badge')).forEach(function (badge, index) {
        var source = sources[index];
        if (!source) return;
        enhanceVideoCover(badge, source);
        var remove = badge.querySelector('.vina-node-reference-remove');
        if (!remove) {
          // 原缩略图仅作装饰且 aria-hidden；启用鼠标/键盘预览和原生关闭按钮后向辅助技术公开。
          badge.removeAttribute('aria-hidden');
          badge.removeAttribute('title');
          badge.tabIndex = 0;
          badge.setAttribute('role', 'group');
          badge.setAttribute('aria-label', typeof getNodeTitle === 'function' ? getNodeTitle(source) : '参考素材');
          remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'vina-node-reference-remove';
          remove.title = '移除参考';
          remove.setAttribute('aria-label', '移除参考并取消对应连线');
          var icon = document.createElement('img');
          icon.src = new URL('./assets/icons/asset-preview-close.svg', document.baseURI).href;
          icon.alt = '';
          icon.draggable = false;
          remove.appendChild(icon);
          badge.appendChild(remove);
          badge.addEventListener('pointerenter', function () { showReferencePreview(badge, source); });
          badge.addEventListener('pointerleave', hideReferencePreview);
          badge.addEventListener('focusin', function () { showReferencePreview(badge, source); });
          badge.addEventListener('focusout', function (event) { if (!badge.contains(event.relatedTarget)) hideReferencePreview(); });
          // 阻止按钮事件触发画布选中、拖拽或节点快捷键；只移除本缩略图捕获的引用。
          remove.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
          remove.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); });
          remove.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            removeReference(target, source);
            trigger.focus();
          });
        }
        var disabled = !referenceWritable(target);
        if (remove.disabled !== disabled) remove.disabled = disabled;
      });
    }
    // 原更新函数会重建整行，仅观察行直属子节点以幂等补齐交互，避免按钮自身 DOM 更新触发重绘循环。
    if (referenceRow) new MutationObserver(scheduleSync).observe(referenceRow, { childList: true });
    window.addEventListener('resize', hideReferencePreview);
    document.addEventListener('scroll', hideReferencePreview, true);
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') hideReferencePreview(); });

    function selectedMediaNode() {
      var nodes = stage.querySelectorAll('.node.selected');
      if (nodes.length !== 1) return null;
      var node = nodes[0];
      var type = typeof getNodeMediaType === 'function' ? getNodeMediaType(node) : node.dataset.nodeType;
      // 2026-11-09：图片复用视频选材入口；仅单选普通图片/视频节点时显示，剪辑器、重拍及文本节点保持原流程。
      return (type === 'image' || type === 'video') && !node.classList.contains('libtv-composer-node') && !node.classList.contains('clip-remake-node') && !node.classList.contains('vina-markdown-node') ? node : null;
    }
    function writable(node) {
      return Boolean(node && node.isConnected && !node.classList.contains('vina-collaboration-locked') && !document.body.classList.contains('vina-example-readonly'));
    }
    function closeMenu(returnFocus) {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus && !control.hidden) trigger.focus();
    }
    function sync() {
      frame = 0;
      var node = selectedMediaNode();
      if (currentTarget !== node) closeMenu(false);
      currentTarget = node;
      var visible = Boolean(node && panel.classList.contains('active') && !document.body.classList.contains('vina-direct-mode'));
      if (control.hidden === visible) control.hidden = !visible;
      if (panel.classList.contains('vina-video-reference-enabled') !== visible) panel.classList.toggle('vina-video-reference-enabled', visible);
      var disabled = !writable(node) || panel.classList.contains('vina-collaboration-readonly');
      if (trigger.disabled !== disabled) trigger.disabled = disabled;
      options.forEach(function (option) { if (option.disabled !== disabled) option.disabled = disabled; });
      if (!visible || disabled) closeMenu(false);
      enhanceReferenceBadges(node, visible);
    }
    function scheduleSync() {
      if (!frame) frame = requestAnimationFrame(sync);
    }
    function openMenu(focusLast) {
      sync();
      if (control.hidden || trigger.disabled) return;
      hideReferencePreview();
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      options[focusLast ? options.length - 1 : 0].focus();
    }
    function referencePoint(target, index) {
      // createTypedNode 内部减去 120/88，这里补回偏移；参考放在目标左侧，逐行排列。
      var count = typeof getIncomingSourceNodes === 'function' ? getIncomingSourceNodes(target).length : 0;
      return { x: target.offsetLeft - 340 + 120, y: target.offsetTop + (count + index) * 330 + 88 };
    }
    function attachReferences(target, nodes) {
      if (!writable(target)) return false;
      nodes.forEach(function (source) {
        if (source && source !== target && typeof makeEdge === 'function') makeEdge(source, target, 'right', 'left');
      });
      // 恢复原图片/视频选中态，使新参考立即出现在原输入框；提示词和媒体内容均沿用原节点。
      if (typeof selectNode === 'function') selectNode(target);
      if (typeof updateEdges === 'function') updateEdges();
      if (typeof updateFloatingNodeTools === 'function') updateFloatingNodeTools();
      scheduleSync();
      return true;
    }
    function importLibraryReferences(target, assets) {
      if (!writable(target) || typeof createTypedNode !== 'function' || typeof makeEdge !== 'function') {
        if (typeof showToast === 'function') showToast('当前节点无法添加参考，请重新选择图片或视频节点');
        return false;
      }
      var created = [];
      assets.forEach(function (asset, index) {
        var type = asset.kind === 'voice' || asset.kind === 'audio' ? 'music' : 'image';
        var node = createTypedNode(type, referencePoint(target, index), null, null);
        if (!node) return;
        node.dataset.importedAsset = asset.id || '';
        // 2026-11-09：按捕获目标记录参考来源类型；两个入口均创建独立参考，不覆盖选中节点。
        node.dataset.nodeOrigin = (typeof getNodeMediaType === 'function' ? getNodeMediaType(target) : target.dataset.nodeType) === 'image' ? 'image-reference-library' : 'video-reference-library';
        node.dataset.nodePromptDraft = '';
        node.dataset.assetPrompt = '';
        var title = node.querySelector('.node-type');
        if (title && title.lastChild) title.lastChild.textContent = asset.name || '参考素材';
        var thumb = node.querySelector('.thumb');
        if (type === 'music' && typeof window.enhancePresetAudioNode === 'function') {
          window.enhancePresetAudioNode(node, asset.url || '', { id: asset.id, name: asset.name, preservePosition: true });
        } else if (thumb) {
          thumb.className = 'thumb ' + type + ' canvas-imported-asset';
          thumb.replaceChildren();
          if (asset.url) thumb.style.backgroundImage = 'url(' + JSON.stringify(asset.url) + ')';
          thumb.style.backgroundSize = 'contain';
          thumb.style.backgroundPosition = 'center';
          thumb.style.backgroundRepeat = 'no-repeat';
        }
        var tags = node.querySelectorAll('.node-footer .tag');
        if (tags[0]) tags[0].textContent = type === 'music' ? 'Audio' : '资产';
        if (tags[1]) tags[1].textContent = '参考素材';
        created.push(node);
      });
      if (typeof iconRefresh === 'function') iconRefresh();
      return attachReferences(target, created);
    }
    trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      if (menu.hidden) openMenu(false);
      else closeMenu(false);
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu(event.key === 'ArrowUp');
      }
    });
    menu.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        var index = options.indexOf(document.activeElement);
        var next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next].focus();
      }
      if (event.key === 'Tab') closeMenu(false);
    });
    options[0].addEventListener('click', function (event) {
      event.stopPropagation();
      pickerTarget = selectedMediaNode();
      closeMenu(false);
      if (!writable(pickerTarget)) return;
      input.value = '';
      input.click();
    });
    input.addEventListener('cancel', function () { pickerTarget = null; trigger.focus(); });
    input.addEventListener('change', function () {
      var target = pickerTarget;
      var files = Array.from(input.files || []);
      pickerTarget = null;
      input.value = '';
      if (!files.length || !writable(target)) return;
      var before = new Set(stage.querySelectorAll('.node'));
      var point = referencePoint(target, 0);
      var images = files.filter(function (file) { return file.type.startsWith('image/'); });
      var media = files.filter(function (file) { return file.type.startsWith('video/') || file.type === 'audio/mpeg' || /\.mp3$/i.test(file.name); });
      if (images.length && typeof window.vinaAddCanvasImages === 'function') window.vinaAddCanvasImages(images, point);
      if (media.length && typeof window.vinaAddCanvasMedia === 'function') window.vinaAddCanvasMedia(media, { x: point.x, y: point.y + Math.ceil(images.length / 3) * 330 });
      var created = Array.from(stage.querySelectorAll('.node')).filter(function (node) { return !before.has(node); });
      if (!created.length && typeof showToast === 'function') showToast('请选择 JPG、PNG、WebP 图片、视频或 MP3 音频');
      attachReferences(target, created);
    });
    options[1].addEventListener('click', function (event) {
      event.stopPropagation();
      var target = selectedMediaNode();
      closeMenu(false);
      if (!writable(target) || typeof window.vinaOpenAssetLibraryForVideoReference !== 'function') return;
      window.vinaOpenAssetLibraryForVideoReference(function (assets) { return importLibraryReferences(target, assets); }, trigger);
    });
    document.addEventListener('pointerdown', function (event) { if (!control.contains(event.target)) closeMenu(false); }, true);
    document.addEventListener('focusin', function (event) { if (!control.contains(event.target)) closeMenu(false); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopPropagation(); closeMenu(true); }
    }, true);
    // 2026-11-09：上游视频异步就绪后补封面；不监听 timeupdate，循环播放不会反复重绘素材行。
    ['loadedmetadata', 'loadeddata'].forEach(function (eventName) {
      stage.addEventListener(eventName, function (event) {
        if (event.target instanceof HTMLVideoElement) scheduleSync();
      }, true);
    });
    new MutationObserver(scheduleSync).observe(panel, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(function (changes) {
      // 2026-11-08：排除播放进度控件的逐帧更新，避免播放视频时反复重绘参考栏和重算入口状态。
      var relevant = changes.filter(function (change) {
        return change.target instanceof Element && !change.target.closest('.video-player, .vina-video-node-controls');
      });
      if (!relevant.length) return;
      scheduleSync();
      // 只在当前图片/视频的上游素材封面/播放器变化时刷新；不观察面板自身，避免重绘循环。
      var target = selectedMediaNode();
      var sources = target && typeof getIncomingSourceNodes === 'function' ? getIncomingSourceNodes(target) : [];
      if (relevant.some(function (change) {
        var element = change.target;
        return sources.indexOf(element.closest('.node')) >= 0 &&
          (element.matches('.thumb') || element.matches('video, img, audio, source'));
      }) && typeof updateIncomingReferenceBadges === 'function') updateIncomingReferenceBadges();
    }).observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'src', 'poster', 'style'] });
    new MutationObserver(scheduleSync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
