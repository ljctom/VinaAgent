/* 2026-10-24 Product Design 改动逻辑：首页创作工具栏新增创作偏好。
 * 目录、默认值、模型图标及清晰度规则沿用短剧第一步；首页两个 Tab 都可选择比例。
 * 打开时复制已保存值，切换 Tab 保留各自草稿；仅保存提交，取消/关闭/Esc 丢弃草稿。
 * 偏好保存在本机，首页提交通过 getPromptContext 携带已保存参数，正文输入保持原样。
 */
(() => {
  'use strict';
  const trigger = document.getElementById('homeCreationPreferencesTrigger');
  if (!trigger || window.vinaCreationPreferences) return;
  // 2026-11-09：新版偏好默认选择列表第一项；旧版记录仅迁移清晰度和比例，避免旧模型覆盖新的默认选择。
  // 用户之后手动选择并保存的模型写入新版记录，后续打开继续正常回显。
  const storageKey = 'vina-home-creation-preferences-v2';
  const legacyStorageKey = 'vina-home-creation-preferences-v1';
  // 与 assets/step1-v19-integration.js 同源目录；视频优先读取应用已公开的共享模型目录。
  const videoModels = window.vinaSetupVideoModels?.catalog || [{"name": "Seedance 2.5", "description": "最强视频模型，人物质感更真实", "seconds": 30}, {"name": "Wan 3.0", "description": "30s完整叙事，全能参考一体创作", "seconds": 30}, {"name": "MiniMax H3 Max", "description": "高性价比全模态，兼顾品质与成本", "seconds": 15}, {"name": "MiniMax H3", "description": "全模态生成编辑，音画控制更精准", "seconds": 15}, {"name": "MiniMax H3 Fast", "description": "极致速度生成，批量创作更高效", "seconds": 15}, {"name": "Seedance 2.0", "description": "原生音画生成，导演级运镜", "seconds": 15}, {"name": "Seedance 2.0 fast", "description": "旗舰能力加速，出片更高效", "seconds": 15}, {"name": "Seedance 2.0 mini", "description": "轻量低成本，批量创作更省", "seconds": 15}, {"name": "Kling V3 Omni", "description": "多模态生成编辑，创作更可控", "seconds": 15}];
  const imageModels = [
 {name:'Gpt Image 2.5 Flare',description:'专业图像模型，生成与编辑更快速',icon:'gpt'},
 {name:'Gpt Image 2.5 Sunburst',description:'最强图像模型，画质与精细编辑更强',icon:'gpt'},
 {name:'Gpt Image 2',description:'优质图像模型，生成与编辑更稳定',icon:'gpt'},
 {name:'Nano Banana 2',description:'生成更快，多图一致性更稳',icon:'banana'},
 {name:'Nano Banana pro',description:'专业设计更强，文字排版更准',icon:'banana'},
 {name:'Seedream 5.0 lite',description:'光影细腻，高质生图更轻快',icon:'seedance'}
];
  // 2026-10-24 Product Design 改动逻辑：两个模型目录首项统一为智能选择模型，
  // 自动项使用独立 auto 值与现有自动生成图标，不展示视频时长，不混入真实模型目录。
  const smartModel = { name: 'auto', label: '智能选择模型', description: '根据创作需求，自动匹配合适模型', auto: true };
  const catalogs = { video: [smartModel, ...videoModels], image: [smartModel, ...imageModels] };
  const ratios = [['16:9',30,18],['4:3',26,20],['1:1',23,23],['3:4',20,26],['9:16',17,29]];
  const defaults = {
    // 2026-11-12：未保存偏好时，视频默认 Wan 3.0；图片、清晰度和比例仍使用智能选择。
    video: { model: window.vinaSetupVideoModels?.defaultModel || 'Wan 3.0', resolution: 'auto', ratio: 'auto' },
    image: { model: catalogs.image[0].name, resolution: 'auto', ratio: 'auto' }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  // 2026-11-09 Product Design 改动逻辑：清晰度严格使用当前模型支持的选项；MiniMax H3 Max 仅支持 768p、1080p。
  // 切换模型时保留匹配的清晰度，不匹配则选择新模型第一项，不再追加旧清晰度；智能选择及比例保持原值。
  const resolutions = (kind, model) => kind === 'video'
    ? model === 'MiniMax H3 Max' ? ['768p','1080p'] : ['720p','1080p','4K']
    : model === 'Seedream 5.0 lite' ? ['2K','3K'] : ['1K','2K','4K'];
  const normalizeResolution = (kind, model, selected = 'auto') => {
    const values = resolutions(kind, model);
    return selected === 'auto' || values.includes(selected) ? selected : values[0];
  };
  function normalize(value) {
    const result = clone(defaults);
    for (const kind of ['video','image']) {
      const media = value?.[kind];
      if (!media || typeof media !== 'object') continue;
      if (catalogs[kind].some(model => model.name === media.model)) result[kind].model = media.model;
      // 2026-11-09：旧偏好读取和保存同样按模型匹配清晰度，无效旧值归到第一项；auto 继续表示智能选择。
      result[kind].resolution = normalizeResolution(kind, result[kind].model, media.resolution);
      if (media.ratio === 'auto' || ratios.some(([ratio]) => ratio === media.ratio)) result[kind].ratio = media.ratio;
    }
    return result;
  }
  let saved = clone(defaults), hasSaved = false, draft = null;
  try {
    const currentRecord = localStorage.getItem(storageKey);
    const stored = JSON.parse(currentRecord || localStorage.getItem(legacyStorageKey) || 'null');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      // 2026-11-12：旧版记录迁移时采用当前默认模型，保留旧参数并按原规则匹配清晰度。
      // 新版保存记录按原值读取，因此默认调整不会覆盖用户之后主动保存的模型。
      if (!currentRecord) {
        for (const kind of ['video', 'image']) {
          stored[kind] = { ...stored[kind], model: defaults[kind].model };
        }
      }
      saved = normalize(stored);
      hasSaved = true;
    }
  } catch (_) { /* 本地存储不可用或旧值损坏时，使用默认值，不阻断首页。 */ }
  // 2026-11-09 Product Design 文案调整：弹窗说明和未保存时的入口提示共用默认创作偏好说明，明确 Agent 使用所选模型与参数。
  const preferencesHint = '设置默认模型、清晰度和比例，Agent 将按此设置进行创作。';
  const dialog = document.createElement('dialog');
  dialog.id = 'homeCreationPreferencesDialog';
  dialog.className = 'creation-preferences-dialog';
  dialog.setAttribute('aria-labelledby', 'creationPreferencesTitle');
  dialog.setAttribute('aria-describedby', 'creationPreferencesHint');
  // 2026-11-09 Product Design 改动逻辑：弹窗标题、无障碍标签和保存提示统一使用模型偏好，与入口名称一致。
  dialog.innerHTML = `
    <header class="creation-preferences-head">
      <div><h2 id="creationPreferencesTitle">模型偏好</h2><p id="creationPreferencesHint">${preferencesHint}</p></div>
      <button class="creation-preferences-close" type="button" data-preferences-cancel aria-label="关闭模型偏好"><img src="./assets/icons/review-annotation/x.svg" alt=""></button>
    </header>
    <div class="creation-preferences-tabs" role="tablist" aria-label="模型偏好类型">
      <button id="creationPreferenceVideoTab" type="button" role="tab" aria-controls="creationPreferenceVideoPanel" aria-selected="true" tabindex="0" data-preferences-tab="video">视频</button>
      <button id="creationPreferenceImageTab" type="button" role="tab" aria-controls="creationPreferenceImagePanel" aria-selected="false" tabindex="-1" data-preferences-tab="image">图片</button>
    </div>
    <div class="creation-preferences-body">
      <section id="creationPreferenceVideoPanel" role="tabpanel" aria-labelledby="creationPreferenceVideoTab" data-preferences-panel="video"></section>
      <section id="creationPreferenceImagePanel" role="tabpanel" aria-labelledby="creationPreferenceImageTab" data-preferences-panel="image" hidden></section>
    </div>
    <footer class="creation-preferences-footer"><button type="button" class="creation-preferences-cancel" data-preferences-cancel>取消</button><button type="button" class="creation-preferences-save" data-preferences-save>保存设定</button></footer>`;
  document.body.append(dialog);
  const toast = document.createElement('div');
  toast.className = 'toast creation-preferences-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.dataset.vinaToastType = 'success';
  toast.hidden = true;
  document.body.append(toast);
  let toastTimer;
  const tabs = [...dialog.querySelectorAll('[data-preferences-tab]')];
  const panels = [...dialog.querySelectorAll('[data-preferences-panel]')];
  function iconFor(model) {
    return model.icon?.replace(/^model-/, '').replace(/\.png$/, '') || (model.name.startsWith('Seedance') ? 'seedance' : model.name.startsWith('MiniMax') ? 'minimax' : model.name.startsWith('Kling') ? 'kling' : 'wan');
  }
  // 2026-10-24：显示与提交使用中文智能选择文案，内部 auto 值不作为真实模型或固定参数传给 Agent。
  const modelLabel = value => value === 'auto' ? '智能选择模型' : value;
  const parameterLabel = value => value === 'auto' ? '智能选择' : value;
  // 2026-11-09 Product Design UI 同步：参数展示直接沿用 UI 1109，智能选择置于首项；
  // 四个清晰度按钮排成两列，其余三项排成一行；六个比例按钮排成三列两行，并同步比例图形。
  // 此处仅更新展示模板及网格列数，沿用原 data 属性、参数值与 aria-pressed，所有选择、联动和保存逻辑不变。
  function smartParameterChoice(key, value) {
    const icon = key === 'ratio' ? '<span class="creation-preferences-ratio-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/></svg></span>' : '';
    return `<button type="button" class="creation-preferences-smart-option" data-preferences-param="${key}" data-value="auto" aria-pressed="${value === 'auto'}">${icon}<span>智能选择</span></button>`;
  }
  function renderParameters(kind) {
    const media = draft[kind];
    const region = dialog.querySelector(`[data-preferences-parameters="${kind}"]`);
    const resolutionOptions = resolutions(kind, media.model);
    // 2026-11-09：智能选择作为同组首项，不再跨行。清晰度四项用2×2，三项用一行；比例六项用3×2。
    const resolutionColumns = resolutionOptions.length === 3 ? 2 : resolutionOptions.length + 1;
    region.innerHTML = `<div class="creation-preferences-block"><h3 id="creationPreferencesResolution-${kind}">清晰度</h3><div class="creation-preferences-resolutions" role="group" aria-labelledby="creationPreferencesResolution-${kind}" style="grid-template-columns:repeat(${resolutionColumns},minmax(0,1fr))">${smartParameterChoice('resolution', media.resolution)}${resolutionOptions.map(value => `<button type="button" data-preferences-param="resolution" data-value="${value}" aria-pressed="${media.resolution === value}">${value}</button>`).join('')}</div></div>
      <div class="creation-preferences-block"><h3 id="creationPreferencesRatio-${kind}">比例</h3><div class="creation-preferences-ratios" role="group" aria-labelledby="creationPreferencesRatio-${kind}">${smartParameterChoice('ratio', media.ratio)}${ratios.map(([value,width,height]) => `<button type="button" data-preferences-param="ratio" data-value="${value}" aria-pressed="${media.ratio === value}"><span class="creation-preferences-ratio-icon" aria-hidden="true"><span class="creation-preferences-ratio-shape" style="width:${width}px;height:${height}px"></span></span><span>${value}</span></button>`).join('')}</div></div>`;
  }
  // 2026-11-09 Product Design 改动逻辑：视频和图片页签均移除左栏“模型”小标题及其占位，列表直接展示；区域改用 aria-label 保留无障碍名称。
  function renderPanel(kind) {
    const panel = dialog.querySelector(`[data-preferences-panel="${kind}"]`);
    panel.innerHTML = `<div class="creation-preferences-layout"><section class="creation-preferences-models" aria-label="${kind === 'video' ? '视频' : '图片'}模型列表"><div class="creation-preferences-model-list">${catalogs[kind].map(model => `<button type="button" class="creation-preferences-model" data-preferences-model="${esc(model.name)}" aria-pressed="${draft[kind].model === model.name}"><span class="creation-preferences-model-icon"><img src="${model.auto ? './assets/home-generation-auto-reference.svg' : `./assets/icons/models/${iconFor(model)}.svg`}" alt=""${model.auto ? ' class="creation-preferences-smart-model-icon"' : ''}></span><span class="creation-preferences-model-copy"><span class="creation-preferences-model-title"><strong>${esc(model.label || model.name)}</strong>${kind === 'video' && !model.auto ? `<span class="creation-preferences-duration">${model.seconds || model.segmentSeconds}秒</span>` : ''}</span><span class="creation-preferences-description">${esc(model.description)}</span></span></button>`).join('')}</div></section><section class="creation-preferences-parameters" data-preferences-parameters="${kind}" aria-label="${kind === 'video' ? '视频' : '图片'}参数"></section></div>`;
    renderParameters(kind);
  }
  function setActiveTab(kind, focus = false) {
    tabs.forEach(tab => {
      const active = tab.dataset.preferencesTab === kind;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.preferencesPanel !== kind; });
  }
  function syncTrigger() {
    trigger.dataset.hasPreferences = String(hasSaved);
    trigger.title = hasSaved ? `视频：${modelLabel(saved.video.model)} · ${parameterLabel(saved.video.resolution)} · ${parameterLabel(saved.video.ratio)}\n图片：${modelLabel(saved.image.model)} · ${parameterLabel(saved.image.resolution)} · ${parameterLabel(saved.image.ratio)}` : preferencesHint;
  }
  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    draft = clone(saved);
    renderPanel('video');
    renderPanel('image');
    setActiveTab('video');
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('creation-preferences-open');
    tabs[0].focus();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-preferences-cancel]')) { dialog.close(); return; }
    const tab = event.target.closest('[data-preferences-tab]');
    if (tab) { setActiveTab(tab.dataset.preferencesTab); return; }
    const panel = event.target.closest('[data-preferences-panel]');
    const kind = panel?.dataset.preferencesPanel;
    const modelButton = event.target.closest('[data-preferences-model]');
    if (kind && modelButton) {
      draft[kind].model = modelButton.dataset.preferencesModel;
      // 2026-11-09 Product Design 改动逻辑：切换模型后先匹配清晰度，720p 切到 MiniMax H3 Max 时选中第一项 768p；1080p 匹配则保留。
      draft[kind].resolution = normalizeResolution(kind, draft[kind].model, draft[kind].resolution);
      panel.querySelectorAll('[data-preferences-model]').forEach(button => button.setAttribute('aria-pressed', String(button === modelButton)));
      renderParameters(kind);
      return;
    }
    const paramButton = event.target.closest('[data-preferences-param]');
    if (kind && paramButton) {
      const key = paramButton.dataset.preferencesParam;
      draft[kind][key] = paramButton.dataset.value;
      panel.querySelectorAll(`[data-preferences-param="${key}"]`).forEach(button => button.setAttribute('aria-pressed', String(button === paramButton)));
      return;
    }
    if (event.target.closest('[data-preferences-save]')) {
      saved = normalize(draft);
      hasSaved = true;
      let persisted = true;
      try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch (_) { persisted = false; }
      syncTrigger();
      window.dispatchEvent(new CustomEvent('vina:creation-preferences-saved', { detail: clone(saved) }));
      dialog.close();
      toast.textContent = persisted ? '模型偏好已保存' : '模型偏好已保存，本次会话有效';
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
    }
  });
  dialog.querySelector('[role="tablist"]').addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.indexOf(document.activeElement);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    setActiveTab(tabs[index].dataset.preferencesTab, true);
  });
  // 原生 dialog 负责模态焦点约束和 Escape；所有关闭路径统一清除草稿并还原触发按钮焦点。
  dialog.addEventListener('close', () => {
    draft = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('creation-preferences-open');
    trigger.focus();
  });
  window.vinaCreationPreferences = {
    get: () => clone(saved),
    // 仅已保存的偏好进入创作请求；明确允许用户当前输入覆盖偏好，避免与本次要求冲突。
    getPromptContext: () => hasSaved ? `创作偏好（本次有明确要求时优先遵循本次要求；智能选择表示根据创作需求自动匹配）：\n视频：${modelLabel(saved.video.model)}，清晰度 ${parameterLabel(saved.video.resolution)}，比例 ${parameterLabel(saved.video.ratio)}。\n图片：${modelLabel(saved.image.model)}，清晰度 ${parameterLabel(saved.image.resolution)}，比例 ${parameterLabel(saved.image.ratio)}。` : ''
  };
  syncTrigger();
})();
