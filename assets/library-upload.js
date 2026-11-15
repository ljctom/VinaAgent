/* 2026-09-30 Product Design 改动逻辑：资产库独立上传流程，不使用标签、MP4或进度条。
   前端原型只在当前页面内存中保留文件，刷新即清空，不写入代码或浏览器持久存储；按个人/团队与四个分类隔离，原有演示资产保留。
   名称默认取文件名且最多 50 字；单文件限 20MB；读取和保存的加载状态只在预览内部显示。
   2026-10-29 C19 修复逻辑：画布保存的图片登记到本目录，沿用既有卡片和预览；个人/团队按 owner 隔离，删除时同步清理画布兼容缓存，刷新仍沿用现有临时数据生命周期。 */
(() => {
  const trigger = document.querySelector('[data-library-upload]');
  if (!trigger) return;
  const categories = { character: '角色', scene: '场景', object: '物品', voice: '音频' };
  const owners = { personal: '个人资产库', team: '团队资产' };
  const icon = (name, color = '999999') => `https://api.iconify.design/lucide/${name}.svg?color=%23${color}`;
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const teamAccount = () => Boolean(document.querySelector('.global-account.is-team-account'));
  let files = [], selectedId = '', location = null, saving = false, stored = [];
  const urls = new Map();
  // 2026-09-30 Product Design 改动逻辑：上传音频按新参考图显示左侧方形播放按钮、文件名、进度和时长；同时只播放一段上传音频。
  let activeUploadedAudio = null;
  const audioTime = (seconds) => { const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0; return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; };
  const audioName = (asset) => /\.mp3$/i.test(asset.name) ? asset.name : `${asset.name}.mp3`;
  function bindAudioCard(card, asset) {
    const audio = card.querySelector('audio');
    const play = card.querySelector('[data-upload-audio-play]');
    const seek = card.querySelector('[data-upload-audio-seek]');
    const update = () => {
      const playing = !audio.paused && !audio.ended;
      play.querySelector('img').src = icon(playing ? 'pause' : 'play', 'dce5f3');
      play.setAttribute('aria-label', `${playing ? '暂停' : '播放'} ${asset.name}`);
      play.classList.toggle('is-playing', playing);
      card.classList.toggle('is-playing-card', playing);
      seek.value = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
      seek.disabled = !(Number.isFinite(audio.duration) && audio.duration > 0);
      seek.style.setProperty('--audio-progress', `${seek.value}%`);
      card.querySelector('.subject-library-voice-time').textContent = `${audioTime(audio.currentTime)} / ${audioTime(audio.duration)}`;
    };
    play.addEventListener('click', async () => {
      if (!audio.paused) { audio.pause(); return; }
      activeUploadedAudio?.pause();
      activeUploadedAudio = audio;
      try { await audio.play(); } catch { toast('音频暂时无法播放，请重新上传'); }
    });
    seek.addEventListener('input', () => { if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Number(seek.value) / 100 * audio.duration; });
    ['timeupdate', 'loadedmetadata', 'play', 'pause', 'ended'].forEach((event) => audio.addEventListener(event, update));
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'library-upload-dialog';
  dialog.setAttribute('aria-labelledby', 'libraryUploadTitle');
  dialog.innerHTML = `
    <header class="library-upload-head"><h2 id="libraryUploadTitle">上传资产</h2><button class="library-upload-icon" type="button" data-upload-close aria-label="关闭"><img src="./assets/icons/script-close.svg" alt=""></button></header>
    <div class="library-upload-body">
      <div class="library-upload-files" data-upload-files aria-label="上传文件，可拖拽添加"></div>
      <div class="library-upload-fields">
        <div data-upload-name-field hidden><label class="library-upload-label" for="libraryUploadName">资产名称 <b>*</b></label><div class="library-upload-name-wrap"><input id="libraryUploadName" maxlength="50" autocomplete="off" aria-required="true"><span data-upload-count>0/50</span></div></div>
        <label class="library-upload-label" id="libraryUploadLocationLabel">保存位置 <b>*</b></label>
        <div class="library-upload-location"><button class="library-upload-location-trigger" type="button" data-upload-location aria-labelledby="libraryUploadLocationLabel libraryUploadLocationValue" aria-haspopup="listbox" aria-expanded="false"><span id="libraryUploadLocationValue">请选择分类</span><img src="${icon('chevron-down')}" alt=""></button><div class="library-upload-location-menu" data-upload-location-menu hidden></div></div>
        <p class="library-upload-error" data-upload-error role="alert" hidden></p>
      </div>
    </div>
    <footer class="library-upload-footer"><div class="library-upload-formats">支持的文件格式　jpg/jpeg/png、mp3<br>单个文件大小不超过 20MB</div><div class="library-upload-actions"><button class="library-upload-action" type="button" data-upload-cancel>取消</button><button class="library-upload-action is-primary" type="button" data-upload-save disabled>保存</button></div></footer>
    <input type="file" data-upload-input accept=".jpg,.jpeg,.png,.mp3,image/jpeg,image/png,audio/mpeg" multiple hidden>`;
  document.body.append(dialog);
  const query = (selector) => dialog.querySelector(selector);
  const fileArea = query('[data-upload-files]'), input = query('[data-upload-input]'), nameInput = query('#libraryUploadName');
  const locationTrigger = query('[data-upload-location]'), menu = query('[data-upload-location-menu]'), save = query('[data-upload-save]');
  const error = (message = '') => { query('[data-upload-error]').textContent = message; query('[data-upload-error]').hidden = !message; };

  // 2026-09-30 临时资产逻辑：不再读取或写入 IndexedDB；清理旧版数据库，当前页面仅使用 stored 数组。
  try { window.indexedDB?.deleteDatabase('vina-library-uploads'); } catch { /* 禁用浏览器存储时也可正常临时保存。 */ }
  const spinner = '<span class="library-upload-loading" role="status" aria-label="处理中"><img src="./assets/icons/script-loader.svg" alt=""></span>';
  // 2026-09-30 路径限制逻辑：图片仅可保存到角色、场景、物品，MP3 仅可保存到音频；混合选择时所有路径置灰。
  const compatibleCategory = (category) => files.every((file) => file.audio === (category === 'voice'));
  function syncLocation() {
    // 新增、移除文件或切换账号后，清除已不再可用的路径和回显。
    if (location && (!compatibleCategory(location.category) || (location.owner === 'team' && !teamAccount()))) {
      location = null;
      query('#libraryUploadLocationValue').textContent = '请选择分类';
    }
    renderMenu();
  }
  function ready() {
    save.disabled = saving || !location || !files.length || files.some((file) => file.loading || !file.name.trim()) || (location && (!compatibleCategory(location.category) || (location.owner === 'team' && !teamAccount())));
    dialog.setAttribute('aria-busy', String(saving));
    nameInput.disabled = saving;
    locationTrigger.disabled = saving;
    dialog.querySelectorAll('[data-upload-close], [data-upload-cancel]').forEach((button) => { button.disabled = saving; });
  }
  function renderFiles() {
    fileArea.innerHTML = `<button class="library-upload-add" type="button" data-upload-add aria-label="添加文件" ${saving ? 'disabled' : ''}><img src="${icon('plus')}" alt=""></button>` + files.map((file) => `
      <div class="library-upload-file ${file.id === selectedId ? 'is-selected' : ''}">
        <button class="library-upload-thumb" type="button" data-upload-select="${file.id}" aria-label="编辑 ${escape(file.file.name)} 的名称" ${saving ? 'disabled' : ''}>
          ${file.audio ? `<img class="library-upload-audio-icon" src="${icon('audio-lines', 'cccccc')}" alt="音频">` : `<img src="${file.url}" alt="${escape(file.name)}">`}${file.loading || saving ? spinner : ''}
        </button><button class="library-upload-icon library-upload-remove" type="button" data-upload-remove="${file.id}" aria-label="移除 ${escape(file.file.name)}" ${saving ? 'disabled' : ''}><img src="./assets/icons/script-close.svg" alt=""></button>
        <p class="library-upload-file-name" title="${escape(file.file.name)}">${escape(file.file.name)}</p>
      </div>`).join('');
    const selected = files.find((file) => file.id === selectedId);
    query('[data-upload-name-field]').hidden = !selected || selected.loading;
    nameInput.value = selected?.name || '';
    query('[data-upload-count]').textContent = `${nameInput.value.length}/50`;
    syncLocation();
    ready();
  }
  function setMenu(open) { menu.hidden = !open; locationTrigger.setAttribute('aria-expanded', String(open)); }
  function renderMenu() {
    // 2026-09-30 账号入口逻辑：个人账号完全隐藏团队保存入口，团队账号才显示两个大类；不匹配文件类型的路径禁用。
    menu.innerHTML = Object.entries(owners).filter(([owner]) => owner !== 'team' || teamAccount()).map(([owner, label]) => `<details class="library-upload-location-group" open><summary>${label}<img src="${icon('chevron-down')}" alt=""></summary><div role="listbox" aria-label="${label}">${Object.entries(categories).map(([category, title]) => `<button class="library-upload-location-option" type="button" role="option" data-upload-owner="${owner}" data-upload-category="${category}" aria-selected="${location?.owner === owner && location?.category === category}" ${!compatibleCategory(category) ? `disabled aria-disabled="true" title="${category === 'voice' ? '仅支持音频文件' : '仅支持图片文件'}"` : ''}>${title}</button>`).join('')}</div></details>`).join('');
  }
  const newId = () => window.crypto?.randomUUID?.() || `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // 2026-09-30 文件选择逻辑：选择或拖入多个文件，过滤格式和大小；每个文件可单独选中改名、移除，异步读取时在预览内转圈。
  async function addFiles(list) {
    if (saving) return;
    error();
    const messages = [];
    const added = [];
    Array.from(list).forEach((file) => {
      const audio = /\.mp3$/i.test(file.name);
      if (!/\.(jpe?g|png|mp3)$/i.test(file.name) || (file.type && !(audio ? ['audio/mpeg', 'audio/mp3'].includes(file.type) : ['image/jpeg', 'image/png'].includes(file.type)))) { messages.push(`${file.name}：仅支持 JPG、JPEG、PNG、MP3`); return; }
      if (!file.size || file.size > 20 * 1024 * 1024) { messages.push(`${file.name}：文件不能为空，且不能超过 20MB`); return; }
      added.push({ id: newId(), file, audio, name: file.name.replace(/\.[^.]+$/, '').slice(0, 50), url: URL.createObjectURL(file), loading: true });
    });
    files.push(...added);
    if (!selectedId && added.length) selectedId = added[0].id;
    renderFiles();
    if (files.some((file) => file.audio) && files.some((file) => !file.audio)) messages.push('图片和音频请分开保存，移除不同类型文件后即可选择分类');
    error(messages.join('；'));
    await Promise.all(added.map(async (item) => {
      try { await item.file.arrayBuffer(); item.loading = false; }
      catch { if (files.includes(item)) { files = files.filter((file) => file !== item); URL.revokeObjectURL(item.url); error('文件读取失败，请重新选择'); } }
    }));
    if (!files.some((file) => file.id === selectedId)) selectedId = files[0]?.id || '';
    if (dialog.open) renderFiles();
  }
  function close() { if (!saving) dialog.close(); }
  dialog.addEventListener('close', () => {
    files.forEach((file) => URL.revokeObjectURL(file.url));
    files = []; selectedId = ''; location = null; input.value = '';
    trigger.focus();
  });
  dialog.addEventListener('cancel', (event) => { if (saving) event.preventDefault(); });
  trigger.addEventListener('click', () => {
    error(); setMenu(false); renderMenu(); renderFiles();
    query('#libraryUploadLocationValue').textContent = '请选择分类';
    dialog.showModal();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-upload-close], [data-upload-cancel]')) close();
    if (event.target.closest('[data-upload-add]') && !saving) input.click();
    const select = event.target.closest('[data-upload-select]');
    if (select && !saving) { selectedId = select.dataset.uploadSelect; renderFiles(); nameInput.focus(); }
    const remove = event.target.closest('[data-upload-remove]');
    if (remove && !saving) {
      const file = files.find((item) => item.id === remove.dataset.uploadRemove);
      if (file) URL.revokeObjectURL(file.url);
      files = files.filter((item) => item !== file);
      if (!files.some((item) => item.id === selectedId)) selectedId = files[0]?.id || '';
      error(files.some((item) => item.audio) && files.some((item) => !item.audio) ? '图片和音频请分开保存，移除不同类型文件后即可选择分类' : '');
      renderFiles();
    }
    if (event.target.closest('[data-upload-location]') && !saving) { renderMenu(); setMenu(menu.hidden); }
    const option = event.target.closest('[data-upload-category]');
    if (option && !option.disabled && !saving && compatibleCategory(option.dataset.uploadCategory) && (option.dataset.uploadOwner !== 'team' || teamAccount())) {
      location = { owner: option.dataset.uploadOwner, category: option.dataset.uploadCategory };
      query('#libraryUploadLocationValue').textContent = `${owners[location.owner]} / ${categories[location.category]}`;
      setMenu(false); ready(); locationTrigger.focus(); error();
    }
    if (!event.target.closest('.library-upload-location')) setMenu(false);
  });
  locationTrigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); renderMenu(); setMenu(true); menu.querySelector('button:not(:disabled)')?.focus(); }
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMenu(false); locationTrigger.focus(); }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const options = Array.from(menu.querySelectorAll('details[open] button:not(:disabled)'));
      const current = options.indexOf(document.activeElement);
      options[(current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus();
    }
  });
  nameInput.addEventListener('input', () => {
    const file = files.find((item) => item.id === selectedId);
    if (file) file.name = nameInput.value;
    query('[data-upload-count]').textContent = `${nameInput.value.length}/50`;
    ready();
  });
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((type) => fileArea.addEventListener(type, (event) => { event.preventDefault(); if (!saving) fileArea.classList.add('is-dragging'); }));
  fileArea.addEventListener('dragleave', (event) => { if (!fileArea.contains(event.relatedTarget)) fileArea.classList.remove('is-dragging'); });
  fileArea.addEventListener('drop', (event) => { event.preventDefault(); fileArea.classList.remove('is-dragging'); addFiles(event.dataTransfer.files); });

  save.addEventListener('click', async () => {
    if (save.disabled) return;
    // 2026-09-30 分类逻辑：MP3 保存到音频，图片保存到角色/场景/物品；不允许在同一次保存中混入不同媒体类型。
    if (files.some((file) => file.audio !== (location.category === 'voice'))) { error(location.category === 'voice' ? '音频分类仅支持 MP3，请移除图片或选择其他分类' : 'MP3 请保存到音频分类，图片请保存到角色、场景或物品分类'); return; }
    error(); saving = true; setMenu(false); renderFiles();
    const destination = { ...location };
    const records = files.map((file) => ({ id: file.id, name: file.name.trim(), filename: file.file.name, blob: file.file, audio: file.audio, ...destination, createdAt: Date.now() }));
    try {
      // 临时保存只等待预览内转圈动画，不进行任何持久化写入。
      await new Promise((resolve) => setTimeout(resolve, 500));
      stored.unshift(...records); saving = false; dialog.close();
      const tab = document.querySelector(`[data-subject-tab="${destination.owner}"]`);
      if (destination.owner !== 'team' || teamAccount()) { tab?.click(); document.querySelector(`[data-material-category="${destination.category}"]`)?.click(); }
      renderStored(); toast('资产已保存');
    } catch { saving = false; renderFiles(); error('保存失败，请重试'); }
  });
  function toast(message) {
    const item = document.createElement('div'); item.className = 'library-upload-toast'; item.setAttribute('role', 'status'); item.textContent = message;
    document.body.append(item); setTimeout(() => item.remove(), 2800);
  }
  // 2026-10-29 C19 修复逻辑：上传文件使用本目录管理的 Blob URL，画布保存结果复用原图 URL，不重复读取文件或错误地对空 Blob 创建地址。
  function assetUrl(asset) { if (asset.url) return asset.url; if (!urls.has(asset.id)) urls.set(asset.id, URL.createObjectURL(asset.blob)); return urls.get(asset.id); }
  // 2026-10-29 C19 修复逻辑：统一向画布和其他选择器提供当前归属目录，画布保存及侧栏上传共用同一记录，合并方按 ID 去重。
  window.vinaGetUploadedLibraryAssets = (owner, category) => stored.filter((asset) => asset.owner === owner && asset.category === category).map((asset) => ({ id: asset.id, name: asset.name, category: asset.category, kind: asset.audio ? 'voice' : 'image', url: assetUrl(asset) }));
  window.vinaRegisterCanvasLibraryAsset = (asset) => {
    if (!asset || !['personal', 'team'].includes(asset.owner) || !['character', 'scene', 'object'].includes(asset.category) || !asset.id || !asset.url) return;
    const record = { id: String(asset.id), name: String(asset.name || '图片资产'), filename: String(asset.name || '图片资产'), owner: asset.owner, category: asset.category, url: String(asset.url), audio: false, source: 'canvas', createdAt: Date.now() };
    const existing = stored.find((item) => item.id === record.id && item.owner === record.owner);
    if (existing) Object.assign(existing, record);
    else stored.unshift(record);
    renderStored(true);
  };
  // 2026-10-29 C19 修复逻辑：兼容画布消息先于上传脚本初始化到达的情况，补登记已有缓存，不切换用户当前来源或分类。
  ['personal', 'team'].forEach((owner) => (window.vinaCanvasSavedAssets?.[owner] || []).forEach((asset) => window.vinaRegisterCanvasLibraryAsset({ ...asset, owner })));

  // 2026-09-30 列表逻辑：主脚本切换分类会重绘原网格，监听该网格后追加当前分类的上传卡片；比较 ID 避免监听自身更新形成循环。
  function renderStored(force = false) {
    if (activeUploadedAudio && !activeUploadedAudio.isConnected) { activeUploadedAudio.pause(); activeUploadedAudio = null; }
    const category = document.querySelector('.material-category-tab.active')?.dataset.materialCategory || 'character';
    ['personal', 'team'].forEach((owner) => {
      const grid = document.querySelector(`[data-subject-panel="${owner}"] .personal-subject-grid`);
      if (!grid) return;
      // 2026-09-30 音频布局逻辑：团队上传音频也使用与个人音频一致的加宽紧凑网格，其他分类保持原尺寸。
      grid.classList.toggle('subject-library-voice-grid', category === 'voice');
      const assets = stored.filter((asset) => asset.owner === owner && asset.category === category);
      const existing = Array.from(grid.querySelectorAll('[data-library-upload-id]'));
      if (force || existing.map((card) => card.dataset.libraryUploadId).join(',') !== assets.map((asset) => asset.id).join(',')) {
        existing.forEach((card) => card.remove());
        const fragment = document.createDocumentFragment();
        assets.forEach((asset) => {
          const card = document.createElement('article');
          card.className = 'library-upload-card'; card.dataset.libraryUploadId = asset.id;
          if (asset.audio) {
            card.classList.add('subject-library-voice-card', 'is-uploaded-audio');
            card.setAttribute('aria-label', asset.name);
            // 2026-09-30 参考图样式：常态显示文件名和时长，悬停或键盘聚焦时显示编辑、删除按钮。
            card.innerHTML = `<span class="subject-library-voice-copy"><span class="subject-library-voice-name" title="${escape(audioName(asset))}">${escape(audioName(asset))}</span></span><span class="subject-library-voice-actions"><button class="subject-library-voice-action" type="button" data-upload-edit="${asset.id}" aria-label="编辑 ${escape(asset.name)}"><img src="${icon('pencil', 'dce5f3')}" alt=""></button><button class="library-upload-card-delete subject-library-voice-action" type="button" data-upload-delete="${asset.id}" aria-label="删除 ${escape(asset.name)}"><img src="${icon('trash-2', 'dce5f3')}" alt=""></button></span><div class="subject-library-voice-preview"><button class="subject-library-voice-play" type="button" data-upload-audio-play aria-label="播放 ${escape(asset.name)}"><img src="${icon('play', 'dce5f3')}" alt=""></button><input class="library-upload-audio-seek" data-upload-audio-seek type="range" min="0" max="100" step="0.1" value="0" aria-label="${escape(asset.name)}播放进度" disabled><span class="subject-library-voice-time">0:00 / 0:00</span></div><audio src="${assetUrl(asset)}" preload="metadata" hidden></audio>`;
            bindAudioCard(card, asset);
          } else {
            card.innerHTML = `<button class="library-upload-card-cover" type="button" data-upload-preview="${asset.id}" aria-label="查看 ${escape(asset.name)}"><img src="${assetUrl(asset)}" alt="${escape(asset.name)}"></button><div class="library-upload-card-copy"><strong title="${escape(asset.name)}">${escape(asset.name)}</strong><button class="library-upload-card-delete" type="button" data-upload-delete="${asset.id}" aria-label="删除 ${escape(asset.name)}"><img src="${icon('trash-2')}" alt=""></button></div>`;
          }
          fragment.append(card);
        });
        grid.prepend(fragment);
      }
      grid.querySelectorAll('.personal-material-empty').forEach((empty) => { empty.hidden = assets.length > 0; empty.style.display = assets.length ? 'none' : ''; });
    });
  }
  const preview = document.createElement('dialog');
  preview.className = 'library-upload-preview'; preview.setAttribute('aria-labelledby', 'libraryUploadPreviewTitle');
  preview.innerHTML = `<header class="library-upload-head"><h2 id="libraryUploadPreviewTitle"></h2><button class="library-upload-icon" type="button" aria-label="关闭"><img src="./assets/icons/script-close.svg" alt=""></button></header><div class="library-upload-preview-media"></div>`;
  document.body.append(preview);
  preview.querySelector('button').addEventListener('click', () => preview.close());
  preview.addEventListener('close', () => { preview.querySelector('audio')?.pause(); preview.querySelector('.library-upload-preview-media').replaceChildren(); });
  const library = document.querySelector('[data-view="subject-library"]');
  // 2026-09-30 播放逻辑：切换来源、分类或试听预置音色时停止上传音频，避免不可见卡片继续播放。
  library.addEventListener('click', (event) => { if (event.target.closest('[data-subject-tab], [data-material-category], [data-subject-voice-play]')) activeUploadedAudio?.pause(); }, true);
  // 2026-09-30 改动逻辑：弹窗打开时账号身份变化，立即同步团队入口及保存按钮状态。
  const account = document.querySelector('.global-account');
  if (account) new MutationObserver(() => { if (dialog.open && !saving) { syncLocation(); ready(); } }).observe(account, { attributes: true, attributeFilter: ['class'] });
  library.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-upload-preview], [data-upload-delete], [data-upload-edit]');
    if (!button) return;
    event.stopPropagation();
    const asset = stored.find((item) => item.id === (button.dataset.uploadPreview || button.dataset.uploadDelete || button.dataset.uploadEdit));
    if (!asset) return;
    if (button.dataset.uploadEdit) {
      // 2026-09-30 编辑逻辑：音频改名只更新当前页面内存，刷新后随临时资产一起清除。
      const nextName = window.prompt('编辑资产名称（最多50字）', asset.name);
      if (nextName === null) return;
      if (!nextName.trim() || nextName.trim().length > 50) { toast('请输入1至50字的资产名称'); return; }
      activeUploadedAudio?.pause(); asset.name = nextName.trim(); renderStored(true); return;
    }
    if (button.dataset.uploadDelete) {
      if (!window.confirm(`确认删除“${asset.name}”吗？删除后无法恢复。`)) return;
      // 2026-10-29 C19 修复逻辑：共享目录删除后同步移除画布缓存中的同归属同 ID 记录，防止画布选择器重新合并出已删除素材；不撤销仍被画布节点使用的外部 URL。
      try {
        activeUploadedAudio?.pause();
        stored = stored.filter((item) => item !== asset);
        const canvasAssets = window.vinaCanvasSavedAssets?.[asset.owner];
        if (canvasAssets) {
          for (let index = canvasAssets.length - 1; index >= 0; index--) {
            if (String(canvasAssets[index].id) === asset.id) canvasAssets.splice(index, 1);
          }
        }
        if (urls.has(asset.id)) URL.revokeObjectURL(urls.get(asset.id));
        urls.delete(asset.id);
        renderStored(true);
      }
      catch { toast('删除失败，请重试'); }
      return;
    }
    // 2026-10-13 Product Design 改动逻辑：个人/团队上传图片共用新的 16:9 大图弹窗与使用按钮；音频继续使用原播放预览，不进入图片流程。
    if (!asset.audio) {
      window.vinaOpenOwnedAssetPreview?.({ id: asset.id, name: asset.name, url: assetUrl(asset), owner: asset.owner, category: asset.category }, button);
      return;
    }
    preview.querySelector('h2').textContent = asset.name;
    const media = document.createElement(asset.audio ? 'audio' : 'img'); media.src = assetUrl(asset);
    if (asset.audio) media.controls = true; else media.alt = asset.name;
    preview.querySelector('.library-upload-preview-media').replaceChildren(media); preview.showModal();
  }, true);
  document.querySelectorAll('[data-subject-panel="personal"] .personal-subject-grid, [data-subject-panel="team"] .personal-subject-grid').forEach((grid) => new MutationObserver(() => renderStored()).observe(grid, { childList: true }));
  document.querySelectorAll('[data-subject-tab], [data-material-category]').forEach((tab) => tab.addEventListener('click', () => renderStored()));
  // 2026-09-30 生命周期逻辑：页面离开时释放音频及临时文件地址；刷新后的新页面从空数组开始。
  window.addEventListener('pagehide', () => { activeUploadedAudio?.pause(); });
  renderStored();
})();
