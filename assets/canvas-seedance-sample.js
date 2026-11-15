// 2026-11-09 Product Design 文案：tab、清晰度参数与生成按钮提示中，清晰度前统一增加空格。
/* 2026-11-09 Product Design 改动逻辑：样片模式独立保存最近完成的 480p 版本。
 * 480p 可反复编辑生成，1080p 请求冻结最新完成样片的媒体、参数和提示词；
 * 复用现有演示生成管线，不新增模型 API，演示素材本身不会被转码成 1080p。
 * tab 与提示输入属于同一节点浮层；正片提交不收起小面板，不覆盖样片编辑草稿。
 */
(function () {
  'use strict';
  var MODEL = 'Seedance 2.5 样片模式';
  function readSnapshot(node, key) {
    try { return JSON.parse(node.dataset[key] || 'null'); } catch (error) { return null; }
  }
  function isSample(node, params) {
    // 2026-11-09：名称统一加空格，同时兼容已创建节点保存的旧名称。
    var model = node && (params && params.model || node.dataset.paramModel);
    return Boolean(node && (model === MODEL || model === 'Seedance 2.5样片模式'));
  }
  function latestDraft(node) { return readSnapshot(node, 'seedanceLatestDraft'); }
  function finalRequest(node) {
    var draft = latestDraft(node);
    if (!draft || !draft.source || node.dataset.generationStatus === 'generating') return null;
    // 每次点击重新读取最近完成版本，禁止沿用上一次正片或尚未提交的输入框内容。
    return {
      type: 'video', prompt: draft.prompt,
      params: Object.assign({}, draft.params, { model: MODEL, resolution: '1080P' }),
      seedanceMode: 'final', seedanceDraftVersion: draft.version,
      referenceVideo: draft.source, referenceVideos: [draft.source],
      seedanceDraft: JSON.parse(JSON.stringify(draft))
    };
  }
  function saveDraft(node, request, result) {
    if (!result || !result.source) return;
    var previous = latestDraft(node);
    node.dataset.seedanceLatestDraft = JSON.stringify({
      version: (previous ? previous.version : 0) + 1,
      source: result.source, prompt: request.prompt || '',
      params: Object.assign({}, request.params, { model: MODEL, resolution: '样片 480p' })
    });
    node.dataset.seedanceActiveTab = 'draft';
    // 新样片完成后旧正片不再作为当前样片的结果显示。
    delete node.dataset.seedanceLatestFinal;
  }
  // 公共契约便于真实生成服务复用相同来源选择，也供无浏览器的逻辑检查使用。
  window.vinaSeedanceSampleMode = Object.freeze({ model: MODEL, latestDraft: latestDraft, finalRequest: finalRequest });

  function install() {
    if (document.getElementById('character-asset-canvas-theme')) return;
    var panel = document.getElementById('nodeGeneratePanel');
    var send = document.getElementById('nodeGenerateSend');
    if (!panel || !send || typeof setNodeGenerating !== 'function') return;
    var tabs = document.createElement('div');
    tabs.className = 'seedance-sample-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '样片与正片');
    tabs.innerHTML = '<button type="button" role="tab" id="seedanceDraftTab" data-seedance-tab="draft" aria-controls="seedanceDraftPanel">样片修改 480P</button><button type="button" role="tab" id="seedanceFinalTab" data-seedance-tab="final" aria-controls="seedanceFinalPanel">生成正片 1080P</button>';
    var card = document.createElement('div');
    card.className = 'seedance-final-card';
    card.id = 'seedanceFinalPanel';
    card.setAttribute('role', 'tabpanel');
    card.setAttribute('aria-labelledby', 'seedanceFinalTab');
    var label = document.createElement('span');
    // 2026-11-09 Product Design：正片面板上方固定两行确认说明，下方仅显示与480P相同的积分和箭头。
    label.className = 'seedance-final-description';
    var firstLine = document.createElement('span');
    firstLine.textContent = '确认 480P 视频无误后，';
    var secondLine = document.createElement('span');
    secondLine.textContent = '生成 1080P 高清视频';
    label.append(firstLine, secondLine);
    // 复制原积分按钮的图标与结构，样式直接复用同一 send-generate 类及已有图片资源。
    var finalButton = send.cloneNode(true);
    finalButton.id = 'seedanceFinalGenerate';
    finalButton.classList.add('seedance-final-generate');
    finalButton.replaceChildren();
    var points = document.createElement('img');
    points.src = new URL('./assets/images/canvas-points.svg', document.baseURI).href;
    points.alt = '';
    var cost = document.createElement('span');
    cost.className = 'seedance-final-cost';
    // 复用480P发送按钮已有的绿色圆形箭头结构，不保留可见“生成”文字。
    var circle = send.querySelector('.send-circle').cloneNode(true);
    finalButton.append(points, cost, circle);
    finalButton.setAttribute('aria-label', '生成 1080P 正片');
    card.append(label, finalButton);
    panel.append(tabs, card);
    var draftPanel = document.getElementById('nodePrompt');
    // 使用现有输入框作为样片 tab 的可访问面板，不移动原编辑器和上传控件。
    if (draftPanel) {
      draftPanel.setAttribute('data-seedance-draft-input', '');
      tabs.firstElementChild.setAttribute('aria-controls', draftPanel.id);
    }
    function selected() { return typeof selectedNode !== 'undefined' ? selectedNode : null; }
    function sync() {
      var node = selected();
      var draft = node && isSample(node) && latestDraft(node);
      var visible = Boolean(draft && !document.body.classList.contains('vina-direct-mode'));
      panel.classList.toggle('seedance-has-draft', visible);
      var finalMode = visible && node.dataset.seedanceActiveTab === 'final';
      panel.classList.toggle('seedance-final-mode', finalMode);
      tabs.hidden = !visible;
      card.hidden = !finalMode;
      tabs.querySelectorAll('[data-seedance-tab]').forEach(function (button) {
        var active = button.dataset.seedanceTab === (finalMode ? 'final' : 'draft');
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      if (!draft) return;
      var credits = window.getCanvasSeedanceSampleCost(draft.params, '1080P');
      cost.textContent = String(credits);
      finalButton.disabled = node.dataset.generationStatus === 'generating';
      finalButton.title = '生成 1080P 正片 · ' + credits + ' 积分';
      finalButton.setAttribute('aria-busy', String(finalButton.disabled));
    }
    var originalUpdate = updateFloatingNodeTools;
    updateFloatingNodeTools = function () {
      originalUpdate.apply(this, arguments);
      sync();
    };
    var originalRender = renderNodeParamControls;
    renderNodeParamControls = function () {
      var result = originalRender.apply(this, arguments);
      sync();
      return result;
    };
    // 2026-11-09：原提示词提交末尾会隐藏浮层；样片模式提交后同步恢复同一选中节点的输入框，生成中也允许继续编辑。
    var originalMarkGenerating = markNodeGeneratingFromPrompt;
    markNodeGeneratingFromPrompt = function (node) {
      var submittedNode = node || selected();
      var result = originalMarkGenerating.apply(this, arguments);
      if (isSample(submittedNode) && selected() === submittedNode) updateFloatingNodeTools();
      return result;
    };
    var originalGenerate = setNodeGenerating;
    setNodeGenerating = function (node, request, params) {
      if (!request || request.type !== 'video' || !isSample(node, params)) return originalGenerate.apply(this, arguments);
      // 同节点只允许一项任务，避免旧样片完成回调覆盖新样片或正片。
      if (node.__seedancePendingRequest && node.dataset.generationStatus === 'generating') return;
      params = Object.assign({}, getNodeParams(node), params);
      var mode = request.seedanceMode === 'final' ? 'final' : 'draft';
      params.model = MODEL;
      params.resolution = mode === 'final' ? '1080P' : '样片 480p';
      request.params = params;
      request.seedanceMode = mode;
      request.seedanceEditorDraft = node.dataset.nodePromptDraft;
      node.__seedancePendingRequest = request;
      delete node.dataset.generationFailure;
      // 确认卡传入的比例、时长和参考能力写入同一节点，后续480p编辑继续继承。
      Object.keys(params).forEach(function (key) {
        if (key !== 'resolution') node.dataset['param' + key.charAt(0).toUpperCase() + key.slice(1)] = params[key];
      });
      node.dataset.paramResolution = '样片 480p';
      if (mode === 'draft') {
        node.dataset.paramResolution = '样片 480p';
        node.dataset.seedanceActiveTab = 'draft';
      }
      node.dataset.generationCredits = String(window.getCanvasSeedanceSampleCost(params, params.resolution));
      var result = originalGenerate.call(this, node, request, params);
      sync();
      return result;
    };
    var originalComplete = completeCanvasDemoGeneration;
    completeCanvasDemoGeneration = function (node, request, result) {
      if (!request || !request.seedanceMode) return originalComplete.apply(this, arguments);
      if (!node || node.__seedancePendingRequest !== request || !node.isConnected || node.dataset.generationStatus !== 'generating') return;
      if (request.seedanceMode === 'final') {
        // 演示管线也严格取本次冻结的最新样片源；真实接口可以消费 referenceVideo 与 1080P 参数。
        result = Object.assign({}, result, { source: request.referenceVideo });
        node.dataset.seedanceLatestFinal = JSON.stringify({ source: result.source, draftVersion: request.seedanceDraftVersion });
      } else saveDraft(node, request, result);
      // 2026-11-09：输入框保持显示后，完成回调不覆盖等待期间继续输入的样片草稿。
      var editorDraftAtCompletion = node.dataset.nodePromptDraft;
      var value = originalComplete.call(this, node, request, result);
      if (request.seedanceMode === 'final') {
        node.dataset.nodePromptDraft = request.seedanceEditorDraft === undefined ? request.prompt : request.seedanceEditorDraft;
      } else if (editorDraftAtCompletion !== undefined && editorDraftAtCompletion !== request.prompt) {
        node.dataset.nodePromptDraft = editorDraftAtCompletion;
      }
      node.dataset.generatedMediaSource = result.source;
      node.dataset.seedanceOutputResolution = request.seedanceMode === 'final' ? '1080P' : '480P';
      node.__seedancePendingRequest = null;
      if (selected() === node) updateFloatingNodeTools();
      else sync();
      return value;
    };
    function showOutput(node, mode) {
      if (node.dataset.generationStatus === 'generating') return;
      var output = mode === 'draft' ? latestDraft(node) : readSnapshot(node, 'seedanceLatestFinal') || latestDraft(node);
      var video = node.querySelector('video.node-video');
      if (video && output && video.getAttribute('src') !== output.source) {
        video.pause();
        video.setAttribute('src', output.source);
        video.load();
      }
      if (output) node.dataset.generatedMediaSource = output.source;
    }
    function switchTab(mode) {
      var node = selected();
      if (!node || !isSample(node) || !latestDraft(node)) return;
      node.dataset.seedanceActiveTab = mode;
      closeNodeParamMenus();
      showOutput(node, mode);
      updateFloatingNodeTools();
    }
    tabs.addEventListener('click', function (event) {
      var button = event.target.closest('[data-seedance-tab]');
      if (button) { event.preventDefault(); event.stopPropagation(); switchTab(button.dataset.seedanceTab); }
    });
    tabs.addEventListener('keydown', function (event) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      var mode = event.key === 'Home' ? 'draft' : event.key === 'End' ? 'final'
        : event.target.dataset.seedanceTab === 'draft' ? 'final' : 'draft';
      switchTab(mode);
      tabs.querySelector('[data-seedance-tab="' + mode + '"]').focus();
    });
    finalButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var node = selected();
      var request = node && finalRequest(node);
      if (!request) return;
      // 直接走生成入口，避开原提示词按钮提交后收起浮层的逻辑。
      setNodeGenerating(node, request, request.params);
      updateFloatingNodeTools();
    });
    // 原样片按钮仍走既有提示词/引用同步；仅阻止生成中重复提交。
    window.addEventListener('click', function (event) {
      if (event.target.closest('#nodeGenerateSend') && isSample(selected()) && selected().dataset.generationStatus === 'generating') {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    document.addEventListener('vina:canvas-generation-sync', sync);
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
