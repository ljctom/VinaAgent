/* 2026-08-03 改动逻辑：画布 Agent 先生成结构化规划，再按依赖顺序执行节点；规划在每次画布会话重置的 JSON 会话文件中维护。 */
(function () {
  const PLAN_FILE_NAME = 'canvas-agent-plan.json';
  const PLAN_STORAGE_KEY = 'vina-canvas-agent-plan.json';
  const PLAN_VERSION = 1;
  // 2026-08-16 改动逻辑：要求 summary 固定为规划 JSON 的首字段，流式响应可以在完整 steps 返回前提取并展示第一段可读文字。
  const PLANNER_SYSTEM_PROMPT = [
    '你是 VinaAI 全能画布的任务规划 Agent。你的工作不是直接生成内容，而是把用户需求拆成可由画布逐步执行的生成计划。',
    '输出只允许是一个 JSON 对象，不要 Markdown、代码块、解释或思考过程。',
    '当前用户需求是唯一要执行的目标。最近对话只用于理解“刚才”“这两张”“它们”等指代，禁止沿用或重复执行上一条已经完成的需求。',
    'JSON 必须包含 summary、finalGoal、steps，并严格按 summary、finalGoal、steps 的字段顺序输出，summary 必须是第一个字段。',
    'summary 必须用“好的，我将会”开头，用一到两句话向用户说明本次大概规划。',
    'steps 是数组，每个元素必须严格按 id、type、title、prompt、dependsOn 的字段顺序输出。',
    'type 只允许 image、video、music；id 使用 step-1、step-2 的连续格式；dependsOn 只能引用排在当前步骤之前的步骤 id。',
    '每一个生成素材必须独立成为一个步骤。用户要几张不同图片，就拆成几个 image 步骤，禁止把多张图片合并到一个步骤。',
    '如果最终视频需要参考图，先为每张必要参考图创建独立 image 步骤，再创建 video 步骤，并让 video.dependsOn 列出所有参考图步骤。',
    '当前画布上下文可能包含最近已经生成但未被用户选中的图片节点。用户说“刚才的图”“这两张图”“前面生成的图”“它们”时，必须直接复用这些已有节点，不要重复规划参考图，只规划后续视频。',
    '你会收到“节点引用意图 Agent 结论”；是否复用旧节点及具体节点 ID 必须以该语义结论为唯一依据，不得自行通过关键词重新选择。',
    '当节点引用意图结论的 intentMode 为 modify 时，当前任务必须继承所引用节点的媒体类型，只创建一个新的衍生结果节点，并把旧节点作为内容参考；不得退化为无参考的文生图或文生视频，也不得覆盖旧节点。',
    '只生成真正必要的参考图。若用户明确要生成广告、宣传片或 TVC，必须固定规划 3 个独立 image 步骤，标题依次为“商品图”“角色图”“场景图”，并让每个后续 video 步骤同时依赖这三张图。其他需求若明确给出参考图数量或主体，必须严格遵守；若未指定但视频需要角色和产品一致性，通常规划 2 张参考图。',
    '每个 prompt 必须是可直接送入对应生成模型的中文提示词，包含主体、环境、风格、构图或镜头、质量重点；后续步骤的 prompt 要明确如何使用上游参考。',
    '单个视频步骤的时长不得超过 15 秒。用户要求的视频总时长超过 15 秒时，必须先生成角色参考图或商品参考图，再拆成多个视频步骤；每段最多 15 秒，每个视频步骤都只能依赖参考图片步骤，禁止依赖或连接前一段视频，最后交给系统自动合片。',
    '除超过 15 秒必须拆分视频的情况外，步骤总数控制在 1 到 6 个。单张图片、15 秒以内的单段视频或单首音乐的明确需求只规划 1 步，不要擅自增加参考图。',
    '示例：用户要“生成汽车广告”，应输出商品图、角色图、场景图三个 image 步骤，再输出同时依赖前三步的 video 步骤。'
  ].join('\n');
  // 2026-08-26 改动逻辑：规划前先判断需求是否已清晰；未明确且没有“直接生成”意图时，一次性返回全部待确认问题，交给现有翻页决策卡展示。
  const CLARIFICATION_GATE_SYSTEM_PROMPT = [
    '你是 VinaAI 的需求确认 Agent。你只判断当前需求是否已足够清晰，不得规划、执行或生成内容。',
    '如果已经明确到可以安全规划，只输出：{"kind":"ready"}。',
    '如果还存在会明显改变结果的多个合理方向，只输出 confirmation_batch JSON，不要 Markdown、代码块或额外说明。',
    '需要确认时格式固定为：{"kind":"confirmation_batch","intro":"一句简短说明","questions":[{"id":"稳定英文或拼音标识","title":"问题标题","type":"single或multiple或text","required":true,"minSelections":1,"maxSelections":1,"placeholder":"输入提示","options":[{"label":"选项标题","description":"简短说明"}]}]}。',
    '所有必须确认的问题必须在同一个 questions 数组中一次性返回；每个选择题提供 2 到 6 个可执行选项，优先把推荐项放在第一个。',
    '每个问题必须有具体、可直接回答的标题；禁止创建标题为“请确认以下信息”、“补充说明”、“其他信息”或同类泛化文案的空白文本题。',
    '当需求涉及广告、视频、短片、动画、影片或 TVC，且用户没有说明时长时，必须增加一道时长单选题，选项固定为“15秒以内”、“15到30秒”、“30秒到1分钟”、“1分钟以上”。',
    // 2026-08-28 改动逻辑：用户已用数字或“半分钟”等自然语言说明时长时，确认 Agent 必须自行理解并禁止重复追问。
    '用户已经说明具体时长、时长范围或“半分钟”等等价表达时，必须直接使用该时长，禁止再返回任何时长问题。',
    '“我要做一个创意广告”、“做个视频”这类只有类型而没有主体、用途、风格或关键内容的请求属于不清晰。',
    '不要追问对结果影响很小的细节，不要重复询问用户已经说明的信息。'
  ].join('\n');
  const REFERENCE_INTENT_SYSTEM_PROMPT = [
    '你是 VinaAI 画布的节点引用意图 Agent。你的唯一任务是在本次生成开始前，理解用户是否要复用当前画布已经生成的节点，以及具体复用哪些节点。',
    '必须基于完整语义、最近对话和候选节点的编号、内容标记、标题、提示词判断，禁止只按关键词、角色名或固定句式匹配。',
    '用户可能用编号、别名、代词、顺序、内容描述或“刚才那些”等方式引用节点；你需要结合候选节点信息消解指代。',
    '若用户是在提出全新的独立生成需求，不需要旧节点，needsPreviousNodes 必须为 false，nodeIds 必须为空数组。',
    '若用户说“修改、改成、换成、调整、保持主体、背景换色”等延续性指令，且没有明确说新建、另外生成或从零生成，应判断是否在修改最近一次生成结果；是的话优先选择最近完成且媒体类型匹配的一条节点。',
    '若需要旧节点，nodeIds 只能填写候选列表中真实存在的 id，按用户提及或期望连接的顺序排列，不得猜测不存在的节点。',
    '输出只允许一个 JSON 对象，不要 Markdown、解释或思考过程。',
    'JSON 格式固定为：{"needsPreviousNodes":true或false,"nodeIds":["node-id"],"reason":"一句简短判断依据"}。'
  ].join('\n');
  const FINAL_SYSTEM_PROMPT = [
    '你是 VinaAI 全能画布的任务总结 Agent。',
    '根据已完成的规划和节点清单，用中文给用户一个简短总回复。',
    '必须明确最终目标已经完成，并概括生成了哪些素材以及它们如何连接。',
    '不要输出思考过程、JSON、Markdown 标题或新的待确认问题，控制在 80 字以内。'
  ].join('\n');
  const VIDEO_COMPOSITION_SYSTEM_PROMPT = [
    '你是 VinaAI 视频合片决策 Agent。你会收到用户最终目标和本轮已经生成的多个视频步骤。',
    '判断这些视频是否是同一个最终成片的分段、镜头或章节；只有用户需要保留多个独立视频时才不合片。',
    '若需要合片，必须根据叙事逻辑、时间发展、镜头承接、开场到收尾关系决定播放顺序，不可只机械照抄输入顺序。',
    'orderedStepIds 必须包含输入中的每个视频步骤 id，且每个 id 恰好出现一次。',
    '输出只允许 JSON：{"shouldCompose":true或false,"orderedStepIds":["step-id"],"reason":"一句排序依据"}，不要 Markdown 或解释。'
  ].join('\n');

  let activePlan = null;
  let planSequence = 0;
  let installed = false;
  let finalizing = false;
  let plannerStopRequested = false;
  let plannerSendButtonSnapshot = null;

  function getPlannerSendButton() {
    return document.getElementById('sendBtn');
  }

  function rememberPlannerSendButton(button) {
    if (!button || plannerSendButtonSnapshot) return;
    plannerSendButtonSnapshot = {
      markup: button.innerHTML,
      title: button.title || '发送',
      ariaLabel: button.getAttribute('aria-label') || '发送'
    };
    // 2026-08-16 修复逻辑：把原发送图标保存在按钮实例上，回复停止桥接若晚于规划器安装仍能恢复正确图标。
    button.__vinaReplyOriginalMarkup = plannerSendButtonSnapshot.markup;
  }

  function renderPlannerStopButton(button) {
    if (!button) return;
    rememberPlannerSendButton(button);
    // 2026-08-16 修复逻辑：规划器直接保证同一发送按钮呈现停止态；即使回复停止桥接晚装或缺失，AI 整轮完成前也不会退回发送箭头。
    button.disabled = false;
    button.classList.add('vina-reply-stop');
    button.dataset.replyAction = 'stop';
    button.title = '停止回复';
    button.setAttribute('aria-label', '停止 AI 回复');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<i data-lucide="square"></i>';
    if (typeof iconRefresh === 'function') iconRefresh();
  }

  function restorePlannerSendButton(button) {
    if (!button || !plannerSendButtonSnapshot) return;
    button.classList.remove('vina-reply-stop');
    delete button.dataset.replyAction;
    button.title = plannerSendButtonSnapshot.title;
    button.setAttribute('aria-label', plannerSendButtonSnapshot.ariaLabel);
    button.removeAttribute('aria-pressed');
    button.innerHTML = plannerSendButtonSnapshot.markup;
  }

  function setPlannerStopAvailable(enabled) {
    const button = getPlannerSendButton();
    rememberPlannerSendButton(button);
    const hasReplyStopBridge = typeof window.vinaSetPersistentReplyStop === 'function';
    // 2026-08-16 改动逻辑：桥接可用时继续复用其文字流中止能力；规划器同时兜底按钮外观，保证初始化时序不影响可见状态。
    if (hasReplyStopBridge) window.vinaSetPersistentReplyStop(enabled);
    if (enabled) renderPlannerStopButton(button);
    else if (!hasReplyStopBridge) {
      restorePlannerSendButton(button);
      if (typeof setSending === 'function') setSending(false);
    }
  }

  function stopPlanFromFallbackButton(event) {
    const button = event.currentTarget;
    if (button?.dataset.replyAction !== 'stop' || typeof window.vinaSetPersistentReplyStop === 'function') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    // 2026-08-16 修复逻辑：桥接尚未安装时由规划器发出同一停止事件，确保兜底按钮不仅可见，也能终止本轮后续回复与规划步骤。
    window.dispatchEvent(new CustomEvent('vina:stop-ai-reply', { detail: { source: 'planner-fallback' } }));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function emptyPlan(reason) {
    return {
      version: PLAN_VERSION,
      fileName: PLAN_FILE_NAME,
      sessionId: `canvas-session-${Date.now()}-${++planSequence}`,
      request: '',
      summary: '',
      finalGoal: '',
      status: 'idle',
      // 2026-08-06 改动逻辑：新建或重置的 Agent 规划默认采用自动生成模式，避免直接进入画布时回落到逐步手动确认。
      mode: 'automatic',
      resetReason: reason || 'session-reset',
      steps: [],
      progress: { completed: 0, total: 0 },
      finalReply: '',
      updatedAt: nowIso()
    };
  }

  function updateProgress(plan) {
    const completed = plan.steps.filter(step => step.status === 'completed').length;
    plan.progress = { completed, total: plan.steps.length };
    plan.updatedAt = nowIso();
  }

  function writePlanFile(plan) {
    updateProgress(plan);
    activePlan = plan;
    const json = JSON.stringify(plan, null, 2);
    try {
      sessionStorage.setItem(PLAN_STORAGE_KEY, json);
    } catch (error) {
      // Session storage can be unavailable in restricted previews; the in-memory File remains authoritative for the current canvas session.
    }
    // 2026-08-03 改动逻辑：对外暴露真实 File 对象，便于调试或后续上传；其内容与当前规划进度始终同步。
    try {
      window.__vinaCanvasAgentPlanFile = new File([json], PLAN_FILE_NAME, { type: 'application/json', lastModified: Date.now() });
    } catch (error) {
      window.__vinaCanvasAgentPlanFile = { name: PLAN_FILE_NAME, type: 'application/json', text: async () => json };
    }
    window.__vinaCanvasAgentPlan = plan;
  }

  function resetPlanFile(reason) {
    finalizing = false;
    plannerStopRequested = false;
    setPlannerStopAvailable(false);
    writePlanFile(emptyPlan(reason));
  }

  function cleanJsonText(text) {
    const raw = String(text || '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
    return raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  }

  function chineseNumber(value) {
    const map = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
    return Number(value) || map[value] || 1;
  }

  function isExplicitNewGenerationIntent(request) {
    return /(?:新建|新生成|全新|另外|另一个|另一张|另一条|新的一个|新的一张|新的一条|从零|不参考|不要参考|完全重新|重新从头|独立生成|重新生成(?:一|1)?(?:个|张|条|段)|再(?:新)?生成(?:一|1)?(?:个|张|条|段))/i.test(String(request || ''));
  }

  function isModificationIntent(request) {
    const text = String(request || '').trim();
    if (!text || isExplicitNewGenerationIntent(text)) return false;
    // 2026-08-14 改动逻辑：短追问中的修改、替换、保留和局部调节词代表延续上一条结果；明确“新建/另外生成”始终优先视为独立生成。
    return /(?:修改|改成|改为|换成|换为|调整|微调|优化|润色|修一下|重做刚才|变成|变为|替换|去掉|移除|删掉|增加|加上|保持|保留|沿用|继续用|基于刚才|参考刚才|放大|缩小|调亮|调暗|改背景|换背景|换颜色|换风格|换服装|换动作|换镜头)/i.test(text);
  }

  function nodeGeneratedMediaType(node) {
    const raw = String(node?.dataset?.nodeType || node?.dataset?.generationType || node?.dataset?.vinaContentType || '').toLowerCase();
    if (/^(image|video|music)$/.test(raw)) return raw;
    if (typeof getNodeMediaType === 'function') {
      const resolved = String(getNodeMediaType(node) || '').toLowerCase();
      if (/^(image|video|music)$/.test(resolved)) return resolved;
    }
    return 'image';
  }

  function inferRequestedMediaType(request, sourceNode) {
    const text = String(request || '');
    if (/视频|短片|动画|影片|镜头|TVC|video|clip|movie/i.test(text)) return 'video';
    if (/音乐|歌曲|配乐|音频|BGM|music|audio|song/i.test(text)) return 'music';
    if (/图片|图像|照片|海报|插画|封面|image|photo|picture|poster/i.test(text)) return 'image';
    return sourceNode ? nodeGeneratedMediaType(sourceNode) : '';
  }

  function getCompletedImageNodes() {
    return Array.from(document.querySelectorAll('.node[data-node-type="image"]')).filter(node => {
      if (!node.isConnected || node.dataset.generationStatus !== 'completed') return false;
      const thumb = node.querySelector('.thumb');
      if (!thumb) return false;
      const background = thumb.style.backgroundImage || getComputedStyle(thumb).backgroundImage;
      // 2026-08-04 改动逻辑：文字摘要卡同样代表已完成图片，不能因没有真实 background-image 被引用扫描排除；内容标记或摘要卡类任一存在即可进入后续节点引用。
      return Boolean(node.dataset.vinaContentMark || thumb.classList.contains('vina-generation-summary-card') || thumb.querySelector('img, canvas, picture') || (background && background !== 'none'));
    });
  }

  function getNodeContextTitle(node) {
    return String(node?.dataset.vinaContentMark || node?.dataset.vinaPlanTitle || node?.querySelector('.node-type')?.textContent || node?.id || '图片节点').trim();
  }

  function getNodeSearchText(node) {
    return [
      getNodeContextTitle(node),
      node?.dataset.vinaContentMark,
      node?.dataset.assetPrompt,
      node?.dataset.generationPrompt
    ].filter(Boolean).join(' ');
  }

  function getNodeTitleKeyword(node) {
    return getNodeContextTitle(node)
      .replace(/^(生成|制作|创建)/, '')
      .replace(/(参考)?图片|参考图|图像|照片|素材|节点/g, '')
      .replace(/[\s·:：,，。]/g, '')
      .trim();
  }

  function getNodeReferenceSubject(node) {
    const raw = String(node?.dataset.vinaContentMark || node?.dataset.vinaPlanTitle || '')
      .replace(/^(?:图片|视频|音乐)\d+·/, '')
      .trim();
    const subject = raw.split(/(?:人物|角色|参考图片|参考图|图片|图像|照片|视频|短片|动画|影片|·|，|。)/)[0]
      .replace(/^(生成|制作|创建)/, '')
      .replace(/\s+/g, '')
      .trim();
    return Array.from(subject).slice(0, 8).join('');
  }

  function requestExplicitlyNamesNode(node, request) {
    const text = String(request || '');
    const nodeText = getNodeSearchText(node);
    const subject = getNodeReferenceSubject(node);
    if (subject.length >= 2 && text.includes(subject)) return true;
    const aliasGroups = [
      /孙悟空|悟空|猴王|大师兄/i,
      /唐僧|唐三藏|师傅|师父/i,
      /猪八戒|八戒|二师兄/i,
      /沙僧|沙和尚|三师弟/i,
      /猫|猫咪|小猫|cat/i,
      /狗|狗狗|小狗|犬|dog/i,
      /汽车|轿车|跑车|车辆|SUV|car/i
    ];
    return aliasGroups.some(pattern => pattern.test(text) && pattern.test(nodeText));
  }

  function findContentMatchedNodes(nodes, request) {
    const text = String(request || '');
    const subjectPatterns = [
      /孙悟空|悟空|猴王|大师兄/i,
      /唐僧|唐三藏|师傅|师父/i,
      /猪八戒|八戒|二师兄/i,
      /沙僧|沙和尚|三师弟/i,
      /猫|猫咪|小猫|cat/i,
      /狗|狗狗|小狗|犬|dog/i,
      /汽车|轿车|跑车|车辆|新能源车|SUV|car/i,
      /人物|角色|人像|模特|男士|男人|女士|女人|person|character|portrait/i,
      /产品|商品|包装|设备|机器|product/i,
      /场景|环境|建筑|室内|户外|scene/i
    ];
    return nodes.filter(node => {
      const nodeText = getNodeSearchText(node);
      const keyword = getNodeTitleKeyword(node);
      const referenceSubject = getNodeReferenceSubject(node);
      // 2026-08-04 改动逻辑：优先用节点短标记中的主体词做精确匹配，并补充西游记角色别名；“孙悟空和师傅”可分别命中孙悟空与唐僧节点，不再依赖泛化“人物”词。
      if (referenceSubject.length >= 2 && text.includes(referenceSubject)) return true;
      if (keyword.length >= 2 && text.includes(keyword)) return true;
      return subjectPatterns.some(pattern => pattern.test(text) && pattern.test(nodeText));
    });
  }

  function resolveOrdinalNodes(nodes, request) {
    const text = String(request || '');
    const indexMap = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
    const resolveIndexes = values => [...new Set(values)]
      .map(value => Number(value) || indexMap[value] || 0)
      .filter(value => value > 0)
      .map(value => nodes.find(node => Number(node.dataset.vinaContentOrdinal) === value) || nodes[value - 1])
      .filter(Boolean);
    const ordinalMatches = [...text.matchAll(/第\s*([1-6一二两三四五六])\s*(?:张|号)?/g)].map(match => match[1]);
    if (ordinalMatches.length) return resolveIndexes(ordinalMatches);
    // 2026-08-04 改动逻辑：支持“用 1 和 2 图片”“参考 1、3 图”等自然编号表达；仅在引用动词到“图片/图/节点”的局部片段中提取数字，避免把视频时长或生成数量误判为节点序号。
    const listReference = text.match(/(?:用|使用|拿|把|根据|参考|选取|选择)\s*([^。！？]{0,36}?)(?:图片|参考图|图像|图|节点)/);
    if (listReference) {
      const listMatches = [...listReference[1].matchAll(/(?:第\s*)?([1-6一二两三四五六])\s*(?:张|号)?/g)].map(match => match[1]);
      const resolved = resolveIndexes(listMatches);
      if (resolved.length) return resolved;
    }
    if (/最后\s*一张/.test(text)) return nodes.slice(-1);
    const frontMatch = text.match(/前\s*([1-6一二两三四五六])\s*张/);
    if (frontMatch) return nodes.slice(0, chineseNumber(frontMatch[1]));
    const backMatch = text.match(/(?:后|最后)\s*([1-6一二两三四五六])\s*张/);
    if (backMatch) return nodes.slice(-chineseNumber(backMatch[1]));
    return [];
  }

  function getRecentGeneratedNodesContext() {
    const nodes = getCompletedImageNodes().slice(-6);
    if (!nodes.length) return '';
    // 2026-08-03 改动逻辑：即使用户没有选中节点，也把最近已完成图片的 ID、标题和提示词提供给规划模型，支持“刚才两张图”等上下文指代。
    return [
      '最近已生成且可直接复用的图片节点（未选中也有效）：',
      ...nodes.map((node, index) => `${index + 1}. ${node.id} / ${getNodeContextTitle(node)} / ${node.dataset.assetPrompt || node.dataset.generationPrompt || '已生成图片'}`)
    ].join('\n');
  }

  function getGeneratedNodeCandidates() {
    return Array.from(document.querySelectorAll('.node[data-generation-status="completed"]'))
      .filter(node => node.isConnected && node.id && /^(image|video|music)$/.test(nodeGeneratedMediaType(node)))
      .map((node, domIndex) => ({
        node,
        domIndex,
        sequence: Number(node.dataset.vinaTaskSubmitSequence || node.dataset.vinaDirectSequence || node.dataset.vinaContentOrdinal || 0)
      }))
      // 2026-08-14 改动逻辑：最近结果按真实任务提交序号排序，序号缺失时再沿用 DOM 创建顺序，保证“修改刚才的”稳定指向最新记录。
      .sort((left, right) => left.sequence - right.sequence || left.domIndex - right.domIndex)
      .map(item => item.node)
      .slice(-12);
  }

  async function resolveReferenceIntentWithModel(request, recentContext) {
    const candidates = getGeneratedNodeCandidates();
    const modificationIntent = isModificationIntent(request);
    const emptyIntent = { needsPreviousNodes: false, nodeIds: [], reason: '当前没有需要复用的已生成节点', intentMode: modificationIntent ? 'modify' : 'new', inferredType: '' };
    if (!candidates.length) return emptyIntent;
    const candidatePayload = candidates.map((node, index) => ({
      order: index + 1,
      id: node.id,
      type: node.dataset.nodeType || node.dataset.vinaContentType || '',
      mark: node.dataset.vinaContentMark || '',
      title: getNodeContextTitle(node),
      prompt: node.dataset.assetPrompt || node.dataset.generationPrompt || ''
    }));
    const userContent = [
      '当前用户需求：' + String(request || '').trim(),
      '最近对话：' + String(recentContext || '').slice(-1600),
      '当前画布候选节点：' + JSON.stringify(candidatePayload),
      '请先判断本次生成是否在语义上需要复用候选节点，再返回规定 JSON。'
    ].join('\n\n');
    try {
      const response = await callMiniMax([
        { role: 'system', content: REFERENCE_INTENT_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ], 0.1);
      const parsed = JSON.parse(cleanJsonText(response));
      const candidateIds = new Set(candidates.map(node => node.id));
      const nodeIds = Array.isArray(parsed.nodeIds)
        ? [...new Set(parsed.nodeIds.map(String))].filter(id => candidateIds.has(id))
        : [];
      // 2026-08-14 改动逻辑：模型未识别出短修改指令时，本地语义兜底自动选择最新的同类型结果；明确新建意图不会进入此分支。
      if (modificationIntent && !nodeIds.length) {
        const explicitType = inferRequestedMediaType(request, null);
        const matchingCandidates = explicitType ? candidates.filter(node => nodeGeneratedMediaType(node) === explicitType) : candidates;
        const latest = matchingCandidates.at(-1) || candidates.at(-1);
        if (latest) nodeIds.push(latest.id);
      }
      const needsPreviousNodes = (parsed.needsPreviousNodes === true || modificationIntent) && nodeIds.length > 0;
      const primaryNode = needsPreviousNodes ? document.getElementById(nodeIds.at(-1)) : null;
      // 2026-08-04 改动逻辑：旧节点引用完全以独立意图 Agent 返回的有效节点 ID 为准；模型未确认、返回未知 ID 或调用失败时都视为不引用，不再回退关键词匹配。
      return {
        needsPreviousNodes,
        nodeIds: needsPreviousNodes ? nodeIds : [],
        reason: modificationIntent && parsed.needsPreviousNodes !== true
          ? '检测到延续性修改指令，自动参考最近完成的同类型结果'
          : String(parsed.reason || '').trim(),
        intentMode: modificationIntent ? 'modify' : 'new',
        inferredType: modificationIntent ? inferRequestedMediaType(request, primaryNode) : '',
        candidateCount: candidates.length
      };
    } catch (error) {
      if (modificationIntent) {
        const explicitType = inferRequestedMediaType(request, null);
        const matchingCandidates = explicitType ? candidates.filter(node => nodeGeneratedMediaType(node) === explicitType) : candidates;
        const latest = matchingCandidates.at(-1) || candidates.at(-1);
        if (latest) return {
          needsPreviousNodes: true,
          nodeIds: [latest.id],
          reason: '引用意图服务不可用，已按修改语义参考最近完成的同类型结果',
          intentMode: 'modify',
          inferredType: inferRequestedMediaType(request, latest),
          candidateCount: candidates.length,
          fallback: true
        };
      }
      return {
        ...emptyIntent,
        reason: '节点引用意图判断失败，本次不自动引用旧节点',
        error: String(error?.message || error || 'unknown error')
      };
    }
  }

  function resolveExistingImageReferences(request) {
    const text = String(request || '');
    const wantsVideo = /视频|短片|动画|影片|镜头|TVC|video|clip|movie/i.test(text);
    if (!wantsVideo) return [];
    const allNodes = getCompletedImageNodes();
    if (!allNodes.length) return [];
    const latestSessionId = [...allNodes].reverse().find(node => node.dataset.vinaPlanSessionId)?.dataset.vinaPlanSessionId || '';
    const latestSessionNodes = latestSessionId
      ? allNodes.filter(node => node.dataset.vinaPlanSessionId === latestSessionId)
      : allNodes;
    const contentMatchedNodes = findContentMatchedNodes(latestSessionNodes, text);
    const explicitlyNamedNodes = contentMatchedNodes.filter(node => requestExplicitlyNamesNode(node, text));
    const refersToExisting = /刚才|刚生成|之前|前面|上面|上述|已生成|生成好|最近|这(?:两|几|些|个|张)|那(?:两|几|些|个|张)|它们|这些|那些|第\s*[1-6一二两三四五六]\s*张|最后\s*(?:一|[1-6一二两三四五六])\s*张|前\s*[1-6一二两三四五六]\s*张/i.test(text)
      || /(?:用|使用|拿|把|根据|参考|选取|选择)\s*[^。！？]{0,36}(?:[1-6一二两三四五六])\s*(?:张|号)?[^。！？]{0,20}(?:图片|参考图|图像|图|节点)/.test(text)
      || (contentMatchedNodes.length > 0 && /(?:的)?(?:图片|参考图|图像|图|节点)[，,\s]*(?:来|去|并|然后)?(?:生成|制作|创建).{0,12}(?:视频|短片|动画|影片)/.test(text))
      || explicitlyNamedNodes.length > 0
      || (/(?:根据|使用|用|拿|把|结合|基于|参考)/.test(text) && contentMatchedNodes.length > 0);
    if (!refersToExisting) return [];

    const ordinalNodes = resolveOrdinalNodes(latestSessionNodes, text);
    if (ordinalNodes.length) return ordinalNodes;
    // 2026-08-04 改动逻辑：第二轮及后续视频请求只要明确点名已有主体（如“对猪八戒和孙悟空，生成视频”），直接返回这些节点并连线；泛称“人物视频”不会命中此分支。
    if (explicitlyNamedNodes.length) return explicitlyNamedNodes;
    if (contentMatchedNodes.length) return contentMatchedNodes;
    const countMatch = text.match(/([1-6一二两三四五六])\s*(?:张|个)(?:图片|图|参考图|节点)?/);
    const requestedCount = countMatch ? chineseNumber(countMatch[1]) : latestSessionNodes.length;
    // 2026-08-03 改动逻辑：节点选择优先级为明确顺序、内容主题、数量、最近一轮全部节点，避免“第一张”或“猫咪图”被错误解析为最后生成的图片。
    return latestSessionNodes.slice(-Math.max(1, Math.min(requestedCount, latestSessionNodes.length)));
  }

  function attachExistingNodeReferences(steps, referenceIntent, request) {
    const contextNodes = referenceIntent?.needsPreviousNodes
      ? (referenceIntent.nodeIds || []).map(nodeId => document.getElementById(nodeId)).filter(node => node?.isConnected)
      : [];
    if (!contextNodes.length) return;
    // 2026-08-04 改动逻辑：意图 Agent 选中的旧节点同时适用于图片修改和视频生成；单张图片改背景、改风格等衍生图片也写入 contextNodeIds，从源图片连线到新图片。
    const modificationMode = referenceIntent?.intentMode === 'modify';
    steps.filter(step => {
      if (modificationMode) return step.type === referenceIntent.inferredType;
      if (step.type === 'image') return true;
      // 2026-08-06 改动逻辑：广告需求中，旧画布节点只用于生成新的三张参考图；视频只直接引用商品图、角色图和场景图。
      return step.type === 'video' && !isAdvertisementRequest(request);
    }).forEach(step => {
      step.contextNodeIds = contextNodes.map(node => node.id);
      step.contextNodeTitles = contextNodes.map(getNodeContextTitle);
      if (modificationMode) {
        const sourceNode = contextNodes.at(-1);
        const typeLabel = step.type === 'video' ? '视频' : step.type === 'music' ? '音频' : '图片';
        step.derivationMode = 'modify';
        step.title = `修改${getNodeContextTitle(sourceNode) || typeLabel}`;
        // 2026-08-14 改动逻辑：修改任务把上一条结果声明为唯一内容参考，并要求保留未被用户点名修改的主体、构图和风格，避免退回纯文本生成。
        step.prompt = `以上一条已生成${typeLabel}“${getNodeContextTitle(sourceNode)}”作为内容参考，在保留用户未要求改变的主体、构图、动作、镜头和视觉风格的前提下完成修改：${String(request || '').trim()}。输出新的${typeLabel}结果，不覆盖原记录。`;
        return;
      }
      // 图片步骤保留规划模型生成的修改提示词，只补充来源节点关系；视频步骤继续统一生成参考图提示词和标题。
      if (step.type === 'image') return;
      const ordinalLabels = ['一', '二', '三', '四', '五', '六'];
      const referenceText = contextNodes.map((node, index) => (index === 0 ? '参考图' : '图') + (ordinalLabels[index] || index + 1));
      const referencePhrase = referenceText.length === 1
        ? referenceText[0]
        : referenceText.slice(0, -1).join('、') + '和' + referenceText[referenceText.length - 1];
      const subjects = contextNodes.map(getNodeReferenceSubject).filter(Boolean);
      const subjectText = subjects.length ? subjects.join('和') : '参考图内容';
      // 2026-08-04 改动逻辑：意图 Agent 确认引用节点后同步改写视频标题和最终模型提示词；提示词、节点面板与画布连线统一使用模型返回的精确节点顺序。
      var durationSegment = String(step.prompt || '').match(/本段时长\s*\d+(?:\.\d+)?\s*秒[\s\S]*/)?.[0] || '';
      // 2026-08-06 改动逻辑：复用旧参考图时只替换素材引用前缀，保留超过 15 秒任务已经写入的分段时长、段落序号和前后镜头衔接要求。
      if (!durationSegment) step.title = Array.from(subjectText + '视频').slice(0, 12).join('');
      step.prompt = referencePhrase + '，生成一个' + subjectText + '的视频。' + (durationSegment ? ' ' + durationSegment : '');
    });
  }

  function describePlanStep(step, index) {
    const typeLabels = { image: '图片', video: '视频', music: '音乐' };
    const promptSegments = String(step.prompt || '')
      .replace(/\s+/g, ' ')
      .replace(/(?:参考|引用)\s*node-\d+/gi, '')
      .split(/[：:，,。！？；;\n]/)
      .map(item => item.trim())
      .filter(Boolean);
    if (promptSegments.length > 1 && /(?:参考图|图片|图像|视频|短片|音乐|音频)$/.test(promptSegments[0])) promptSegments.shift();
    // 2026-08-03 改动逻辑：规划清单只取第一个完整分句，不再按字符截断，确保没有省略号也不会出现半截词语。
    const content = promptSegments[0] || '';
    const rawTitle = String(step.title || typeLabels[step.type] || '素材').trim().replace(/^(生成|制作|创建)/, '');
    const contextText = step.derivationMode === 'modify'
      ? `参考上一条${typeLabels[step.type]}结果进行修改`
      : step.contextNodeIds?.length
      ? `复用刚才 ${step.contextNodeIds.length} 条已有结果`
      : step.type === 'video' && step.dependsOn?.length
        ? `复用前面 ${step.dependsOn.length} 张参考图`
      : content || rawTitle;
    return `${index + 1}. ${rawTitle}：${contextText}`;
  }

  function buildPlanIntroduction(steps) {
    // 2026-08-03 改动逻辑：规划说明改为逐行编号短清单，每步只保留标题和约 20 字的核心画面，减少大段提示词造成的阅读负担。
    const stepDescriptions = steps.map(describePlanStep);
    return `好的，我将会：\n${stepDescriptions.join('\n')}\n\n每个节点完成后再继续下一步。`;
  }

  function decodePartialJsonString(rawValue) {
    const source = String(rawValue || '');
    let decoded = '';
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (character !== '\\') {
        decoded += character;
        continue;
      }
      const escapeType = source[index + 1];
      if (!escapeType) break;
      if (escapeType === 'u') {
        const unicodeValue = source.slice(index + 2, index + 6);
        if (!/^[0-9a-f]{4}$/i.test(unicodeValue)) break;
        decoded += String.fromCharCode(Number.parseInt(unicodeValue, 16));
        index += 5;
        continue;
      }
      const escapeMap = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
      decoded += Object.prototype.hasOwnProperty.call(escapeMap, escapeType) ? escapeMap[escapeType] : escapeType;
      index += 1;
    }
    return decoded;
  }

  function extractStreamingPlanSummary(partialResponse) {
    const source = String(partialResponse || '');
    const summaryField = source.match(/"summary"\s*:\s*"/);
    if (!summaryField || typeof summaryField.index !== 'number') return '';
    const valueStart = summaryField.index + summaryField[0].length;
    let rawValue = '';
    for (let index = valueStart; index < source.length; index += 1) {
      const character = source[index];
      if (character === '"') {
        let slashCount = 0;
        for (let cursor = index - 1; cursor >= valueStart && source[cursor] === '\\'; cursor -= 1) slashCount += 1;
        if (slashCount % 2 === 0) break;
      }
      rawValue += character;
    }
    return decodePartialJsonString(rawValue).trimStart();
  }

  function extractStreamingJsonStringField(sourceValue, fieldName) {
    const source = String(sourceValue || '');
    const field = source.match(new RegExp(`"${fieldName}"\\s*:\\s*"`));
    if (!field || typeof field.index !== 'number') return '';
    const valueStart = field.index + field[0].length;
    let rawValue = '';
    for (let index = valueStart; index < source.length; index += 1) {
      const character = source[index];
      if (character === '"') {
        let slashCount = 0;
        for (let cursor = index - 1; cursor >= valueStart && source[cursor] === '\\'; cursor -= 1) slashCount += 1;
        if (slashCount % 2 === 0) break;
      }
      rawValue += character;
    }
    return decodePartialJsonString(rawValue).trimStart();
  }

  function extractStreamingPlanSteps(partialResponse) {
    const source = String(partialResponse || '');
    const stepsField = source.match(/"steps"\s*:\s*\[/);
    if (!stepsField || typeof stepsField.index !== 'number') return [];
    const listStart = stepsField.index + stepsField[0].length;
    const steps = [];
    let objectStart = -1;
    let objectDepth = 0;
    let inString = false;
    let escaped = false;
    for (let index = listStart; index < source.length; index += 1) {
      const character = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === '{') {
        if (objectDepth === 0) objectStart = index;
        objectDepth += 1;
        continue;
      }
      if (character === '}' && objectDepth > 0) {
        objectDepth -= 1;
        if (objectDepth === 0 && objectStart >= 0) {
          try {
            steps.push(JSON.parse(source.slice(objectStart, index + 1)));
          } catch {
            // 流式对象若暂时不完整，保留前面已解析步骤并等待下一次增量。
          }
          objectStart = -1;
        }
      }
    }
    if (objectDepth > 0 && objectStart >= 0) {
      const partialStep = source.slice(objectStart);
      const title = extractStreamingJsonStringField(partialStep, 'title');
      const prompt = extractStreamingJsonStringField(partialStep, 'prompt');
      const type = extractStreamingJsonStringField(partialStep, 'type');
      if (title) steps.push({ type, title, prompt, dependsOn: [] });
    }
    return steps;
  }

  function buildStreamingPlanIntroduction(partialResponse) {
    const steps = extractStreamingPlanSteps(partialResponse);
    if (steps.length) return `好的，我将会：\n${steps.map(describePlanStep).join('\n')}`;
    return extractStreamingPlanSummary(partialResponse);
  }

  function fallbackPlanForRequest(request) {
    const text = String(request || '');
    const wantsVideo = /视频|短片|动画|影片|TVC|video|clip/i.test(text);
    const wantsMusic = /音乐|歌曲|配乐|音频|BGM|music|audio/i.test(text);
    const explicitSubjects = [
      { pattern: /汽车|轿车|跑车|车辆|新能源车|SUV|car/i, title: '汽车参考图', prompt: '一辆具有高级品牌质感的汽车，三分之四侧前方视角，车身线条清晰，商业广告摄影，干净背景，真实材质与高质量细节。' },
      { pattern: /人物|角色|人像|模特|男士|女士|学生|person|character|portrait/i, title: '人物参考图', prompt: '符合用户设定的人物全身参考图，正面自然站姿，服装与身份特征清晰，干净背景，写实商业摄影，高质量细节。' },
      { pattern: /猫|猫咪|小猫|cat|kitten/i, title: '猫咪参考图', prompt: '一只可爱的猫咪，主体完整清晰，自然姿态，柔和真实光线，干净背景，写实摄影，毛发细节丰富。' }
    ].filter(item => item.pattern.test(text));
    const countMatch = text.match(/([1-6一二两三四五六])\s*张(?:不同)?(?:的)?(?:参考)?图/);
    const requestedImageCount = countMatch ? chineseNumber(countMatch[1]) : explicitSubjects.length;
    const needsReferences = wantsVideo && /参考图|先.*图|根据.*图|用.*图|连线/i.test(text);
    const steps = [];

    if (needsReferences) {
      const references = explicitSubjects.length ? explicitSubjects : Array.from({ length: Math.max(2, requestedImageCount || 2) }, (_, index) => ({
        title: `参考图 ${index + 1}`,
        prompt: `围绕用户需求制作第 ${index + 1} 张关键参考图，主体和视觉信息清晰，风格统一，构图完整，高质量细节。`
      }));
      references.slice(0, 5).forEach((item, index) => {
        steps.push({ id: `step-${index + 1}`, type: 'image', title: item.title, prompt: item.prompt, dependsOn: [] });
      });
      steps.push({
        id: `step-${steps.length + 1}`,
        type: 'video',
        title: '最终视频',
        prompt: `使用前面生成的 ${steps.length} 张参考图共同生成用户要求的视频，保持主体外观一致，镜头运动自然，节奏清晰，画面连贯，商业成片质感。`,
        dependsOn: steps.map(step => step.id)
      });
    } else if (requestedImageCount > 1 && !wantsVideo) {
      Array.from({ length: Math.min(6, requestedImageCount) }, (_, index) => {
        const subject = explicitSubjects[index] || explicitSubjects[0];
        steps.push({
          id: `step-${index + 1}`,
          type: 'image',
          title: subject?.title || `图片 ${index + 1}`,
          prompt: subject?.prompt || `根据用户需求生成第 ${index + 1} 张差异化图片，主体清晰，构图完整，风格统一，高质量细节。`,
          dependsOn: []
        });
      });
    } else {
      const type = wantsMusic ? 'music' : wantsVideo ? 'video' : 'image';
      steps.push({
        id: 'step-1',
        type,
        title: type === 'video' ? '视频' : type === 'music' ? '音乐' : '图片',
        prompt: text,
        dependsOn: []
      });
    }
    return {
      summary: `好的，我将会按 ${steps.length} 个步骤完成这次创作，并在每个素材完成后继续下一步。`,
      finalGoal: text,
      steps
    };
  }

  function requestedVideoDurationSeconds(request) {
    const text = String(request || '');
    if (/半\s*(?:分钟|分)/.test(text)) return 30;
    const minuteSecondMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:分钟|分)\s*(\d+(?:\.\d+)?)\s*秒/);
    if (minuteSecondMatch) return Math.round(Number(minuteSecondMatch[1]) * 60 + Number(minuteSecondMatch[2]));
    const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:分钟|分)/);
    if (minuteMatch) return Math.round(Number(minuteMatch[1]) * 60);
    const chineseMinuteMatch = text.match(/([一二两三四五六七八九十])\s*(?:分钟|分)/);
    if (chineseMinuteMatch) {
      const values = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      return values[chineseMinuteMatch[1]] * 60;
    }
    const secondMatch = text.match(/(\d+(?:\.\d+)?)\s*秒/);
    return secondMatch ? Math.round(Number(secondMatch[1])) : 0;
  }

  /* 2026-08-06 改动逻辑：超过 15 秒的长视频必须先建立角色或商品参考图；所有分段并列引用图片，视频之间不建立前后依赖或连线。 */
  function enforceVideoDurationSegments(sourceSteps, request) {
    const totalSeconds = requestedVideoDurationSeconds(request);
    if (totalSeconds <= 15) return { steps: sourceSteps, totalSeconds, forced: false };
    const videoSteps = sourceSteps.filter(step => step?.type === 'video');
    if (!videoSteps.length) return { steps: sourceSteps, totalSeconds, forced: false };
    const segmentCount = Math.ceil(totalSeconds / 15);
    const imageSteps = sourceSteps.filter(step => step?.type === 'image').map((step,index) => ({
      ...step,
      id: String(step.id || `duration-reference-${index + 1}`)
    }));
    if (!imageSteps.length) {
      const productRequest = /商品|产品|品牌|广告|TVC|汽车|车辆|手机|电脑|家电|服装|鞋|包|食品|饮料|美妆|护肤|珠宝|手表/i.test(String(request || ''));
      imageSteps.push({
        id: 'duration-reference-1',
        type: 'image',
        title: productRequest ? '商品参考图' : '角色参考图',
        prompt: productRequest
          ? `根据用户需求“${String(request || '').trim()}”生成核心商品参考图，商品主体完整清晰，造型、材质、颜色和品牌视觉明确，干净背景，商业摄影，高质量细节，供后续所有视频分段统一引用。`
          : `根据用户需求“${String(request || '').trim()}”生成核心角色参考图，角色正面完整清晰，五官、发型、服装和身份特征明确，干净背景，写实高质量细节，供后续所有视频分段统一引用。`,
        dependsOn: []
      });
    }
    const referenceIds = imageSteps.map(step => step.id);
    const remainingSteps = sourceSteps.filter(step => step?.type !== 'video' && step?.type !== 'image');
    const templates = videoSteps.length ? videoSteps : [{ type: 'video', title: '视频', prompt: String(request || ''), dependsOn: [] }];
    const segments = Array.from({ length: segmentCount }, (_, index) => {
      const template = templates[Math.min(index,templates.length - 1)];
      const segmentSeconds = Math.min(15,totalSeconds-index*15);
      return {
        ...template,
        id: `duration-video-${index + 1}`,
        type: 'video',
        title: `最终视频第 ${index + 1} 段`,
        prompt: `${String(template.prompt || request).replace(/(?:总)?时长[^，。；]*[，。；]?/g,'')} 本段时长 ${segmentSeconds} 秒，是完整视频的第 ${index + 1}/${segmentCount} 段；仅使用前面生成的角色或商品参考图作为视觉输入，不引用任何前一段视频；保持主体、造型、场景和视觉风格一致，${index === 0 ? '建立清晰开场' : index === segmentCount - 1 ? '按整体叙事完成结尾' : '为下一段保留自然连续的动作方向'}。`,
        dependsOn: referenceIds
      };
    });
    return { steps: [...imageSteps,...segments,...remainingSteps], totalSeconds, forced: true };
  }

  function isAdvertisementRequest(request) {
    // 2026-08-06 改动逻辑：统一识别所有广告类需求，不再只对汽车广告应用固定参考图规则。
    return /广告|宣传片|宣传视频|品牌片|TVC|commercial|advertisement|advertising/i.test(String(request || ''));
  }

  function ensureAdvertisementReferenceSteps(sourceSteps, request) {
    if (!isAdvertisementRequest(request)) return sourceSteps;
    const requestText = String(request || '').trim();
    const referenceSteps = [
      {
        id: 'advertisement-product-reference',
        type: 'image',
        title: '商品图',
        prompt: `根据广告需求“${requestText}”生成商品参考图，核心商品完整清晰，造型、材质、色彩和品牌特征明确，干净背景，高级商业摄影，供后续所有广告视频统一引用。`,
        dependsOn: []
      },
      {
        id: 'advertisement-character-reference',
        type: 'image',
        title: '角色图',
        prompt: `根据广告需求“${requestText}”生成角色参考图，角色形象、五官、发型、服装和气质完整清晰，干净背景，写实广告摄影，供后续所有广告视频统一引用。`,
        dependsOn: []
      },
      {
        id: 'advertisement-scene-reference',
        type: 'image',
        title: '场景图',
        prompt: `根据广告需求“${requestText}”生成场景参考图，完整展示广告发生的核心环境、空间布局、光线、色调和品牌氛围，电影级商业画面，供后续所有广告视频统一引用。`,
        dependsOn: []
      }
    ];
    const referenceIds = referenceSteps.map(step => step.id);
    const sourceVideoSteps = sourceSteps.filter(step => step?.type === 'video');
    const videoConcepts = [
      {
        title: '汽车品牌广告视频',
        prompt: `根据广告需求“${requestText}”制作第一段 15 秒汽车品牌 TVC：银黑色概念汽车在雪原岩洞公路与电影级道路环境中高速行驶，突出流线车身、红色尾灯、速度感和高级品牌气质；同时参考商品图、角色图和场景图，镜头完整、节奏利落、商业成片质感。`
      },
      {
        title: '微型工人创意广告视频',
        prompt: `根据广告需求“${requestText}”制作第二段 15 秒微观世界创意广告：迷你工人把食物变成热闹施工现场，组装汉堡、维护玉米工厂，在爆米花爆破后搭建披萨城市；微距镜头、浅景深、精细模型质感，同时参考商品图、角色图和场景图，与第一段共同组成完整广告。`
      }
    ];
    /* 2026-08-07 改动逻辑：只要用户需求属于广告，视频部分固定为两个互不重复的 15 秒创意：第一段汽车 TVC、第二段微型工人食物施工；两段都继续连接商品图、角色图和场景图并进入最终合片。 */
    const advertisementVideos = videoConcepts.map((concept,index) => ({
      ...(sourceVideoSteps[index] || sourceVideoSteps[sourceVideoSteps.length - 1] || {}),
      id: `advertisement-video-${index + 1}`,
      type: 'video',
      title: concept.title,
      prompt: concept.prompt,
      dependsOn: referenceIds
    }));
    const remainingSteps = [
      ...advertisementVideos,
      ...sourceSteps.filter(step => step?.type !== 'image' && step?.type !== 'video').map(step => ({ ...step, dependsOn: [] }))
    ];
    return [...referenceSteps,...remainingSteps];
  }

  function isCarAdvertisementRequest(request) {
    const text = String(request || '');
    const hasCar = /汽车|轿车|跑车|车辆|新能源车|越野车|SUV|automobile|\bcar\b/i.test(text);
    const hasAdvertisement = /广告|宣传片|宣传视频|品牌片|TVC|commercial|advertisement/i.test(text);
    // 2026-08-03 改动逻辑：只要需求同时涉及汽车和广告就进入固定规划，即使用户只说“半分钟汽车广告”而没有“生成/制作”等动词也不能直接跳到视频。
    return hasCar && hasAdvertisement;
  }

  function getCarAdvertisementVideoCount(request) {
    const text = String(request || '');
    const explicitCount = text.match(/([1-6一二两三四五六])\s*(?:个|段|条|支|部)\s*(?:视频|短片|广告片|影片|片段)/);
    if (explicitCount) return Math.min(6, chineseNumber(explicitCount[1]));
    if (/半\s*(?:分钟|分)/.test(text)) return 2;
    const minuteMatch = text.match(/([1-2一二两])\s*(?:分钟|分)/);
    if (minuteMatch) return Math.min(6, chineseNumber(minuteMatch[1]) * 4);
    const secondMatch = text.match(/(\d{1,2})\s*秒/);
    if (secondMatch) return Math.max(1, Math.min(6, Math.ceil(Number(secondMatch[1]) / 15)));
    // 2026-08-04 改动逻辑：用户只提出“汽车广告”且没有指定视频数量或时长时，默认生成两个视频；显式数量和时长仍优先按用户要求计算。
    return 2;
  }

  function carAdvertisementPlan(request) {
    const videoCount = getCarAdvertisementVideoCount(request);
    const videoFocus = [
      '外观与姿态展示',
      '驾驶体验与品牌氛围',
      '内饰细节与智能科技',
      '道路性能与动态镜头',
      '生活方式与人物互动',
      '品牌收尾与核心卖点'
    ];
    // 2026-08-06 改动逻辑：汽车广告固定生成商品、角色和场景三张图；每个视频共同引用三图，未指定数量时仍默认生成两个视频。
    const videoSteps = Array.from({ length: videoCount }, (_, index) => ({
      id: `step-${index + 4}`,
      type: 'video',
      title: videoCount > 1 ? `汽车广告第 ${index + 1} 段（${videoFocus[index]}）` : '汽车品牌广告视频',
      prompt: `同时使用前面生成的商品图、角色图和场景图制作汽车品牌广告第 ${index + 1} 段，时长约 15 秒，主题为“${videoFocus[index]}”，保持人物外貌、服装、车辆造型和场景风格一致，镜头与其他段落自然衔接，节奏高级，电影级商业成片质感。`,
      dependsOn: ['step-1', 'step-2', 'step-3']
    }));
    return {
      summary: '',
      finalGoal: String(request || '').trim(),
      specialPlan: 'car-advertisement',
      steps: [
        {
          id: 'step-1',
          type: 'image',
          title: '商品图',
          prompt: '一辆具有高级品牌质感的银黑色豪华汽车，三分之四侧前方视角，车身线条与轮毂清晰，干净背景，电影级灯光与真实金属反射，写实汽车广告摄影，高质量细节。',
          dependsOn: []
        },
        {
          id: 'step-2',
          type: 'image',
          title: '角色图',
          prompt: '一位气质专业、自信沉稳的亚洲商务男士，身穿剪裁合体的深色西装，人物正面半身肖像，五官与服装细节清晰，干净浅色背景，柔和商业摄影光线，写实品牌广告风格，高质量细节。',
          dependsOn: []
        },
        {
          id: 'step-3',
          type: 'image',
          title: '场景图',
          prompt: '湿润的现代城市夜间公路，道路线条清晰，远处建筑灯光与路面反射形成高级汽车品牌氛围，无人无车，低机位广角构图，电影级商业广告光影，写实高质量细节。',
          dependsOn: []
        },
        ...videoSteps
      ]
    };
  }

  function planMatchesCurrentRequest(sourceSteps, request, referenceIntent) {
    const text = String(request || '');
    const wantsVideo = /视频|短片|动画|影片|镜头|TVC|video|clip|movie/i.test(text);
    const reusesPreviousNodes = referenceIntent?.needsPreviousNodes && referenceIntent.nodeIds?.length;
    // 2026-08-04 改动逻辑：是否把“图片”理解为既有输入，只读取意图 Agent 的语义结论；本地媒体类型校验不再自行判断引用对象。
    const wantsImage = /图片|图像|照片|海报|插画|封面|参考图|image|photo|picture|poster/i.test(text) && !reusesPreviousNodes;
    const wantsMusic = /音乐|歌曲|配乐|音频|BGM|music|audio|song/i.test(text);
    const requestedTypes = [wantsImage && 'image', wantsVideo && 'video', wantsMusic && 'music'].filter(Boolean);
    if (!requestedTypes.length) return true;
    const plannedTypes = new Set((sourceSteps || []).map(step => step?.type));
    if (requestedTypes.length === 1 && requestedTypes[0] === 'image') return plannedTypes.size === 1 && plannedTypes.has('image');
    if (requestedTypes.length === 1 && requestedTypes[0] === 'music') return plannedTypes.size === 1 && plannedTypes.has('music');
    if (requestedTypes.length === 1 && requestedTypes[0] === 'video') return plannedTypes.has('video') && !plannedTypes.has('music');
    return requestedTypes.every(type => plannedTypes.has(type));
  }

  function normalizePlan(rawPlan, request, referenceIntent) {
    const fallback = fallbackPlanForRequest(request);
    const source = rawPlan && typeof rawPlan === 'object' ? rawPlan : fallback;
    let sourceSteps = Array.isArray(source.steps) && source.steps.length ? source.steps : fallback.steps;
    // 2026-08-03 改动逻辑：长对话中模型若沿用上一轮媒体类型，立即改用当前请求的保底规划，避免“生成图片”被错误执行为上一轮视频。
    if (!planMatchesCurrentRequest(sourceSteps, request, referenceIntent)) sourceSteps = fallback.steps;
    const reusesPreviousNodes = referenceIntent?.needsPreviousNodes && referenceIntent.nodeIds?.length;
    const modificationMode = reusesPreviousNodes && referenceIntent?.intentMode === 'modify';
    if (modificationMode) {
      const inferredType = /^(image|video|music)$/.test(referenceIntent.inferredType) ? referenceIntent.inferredType : 'image';
      const matchingStep = sourceSteps.find(step => step?.type === inferredType);
      // 2026-08-14 改动逻辑：延续性修改固定为单个同类型衍生节点；即使规划模型误判媒体类型，也不会新建无参考的其他类型任务。
      sourceSteps = [{
        ...(matchingStep || {}),
        id: 'modify-step-1',
        type: inferredType,
        title: matchingStep?.title || `修改${inferredType === 'video' ? '视频' : inferredType === 'music' ? '音频' : '图片'}`,
        prompt: String(request || '').trim(),
        dependsOn: []
      }];
    }
    if (reusesPreviousNodes && /视频|短片|动画|影片|镜头|TVC|video|clip|movie/i.test(request)) {
      const videoOnlySteps = sourceSteps.filter(step => step?.type === 'video');
      // 2026-08-04 改动逻辑：意图 Agent 确认复用旧节点后，删除规划模型可能重复创建的参考图步骤；只保留视频步骤并由 contextNodeIds 连接已选节点。
      sourceSteps = (videoOnlySteps.length ? videoOnlySteps : [{
        type: 'video',
        title: '引用图片生成视频',
        prompt: String(request || '').trim(),
        dependsOn: []
      }]).map(step => ({ ...step, dependsOn: [] }));
    }
    // 2026-08-14 改动逻辑：上下文修改保持为单个同类型衍生节点，不套用新建长视频时的“先造参考图再拆段”规则，避免修改任务丢失上一条来源。
    const durationRule = modificationMode
      ? { steps: sourceSteps, totalSeconds: requestedVideoDurationSeconds(request), forced: false }
      : enforceVideoDurationSegments(sourceSteps,request);
    sourceSteps = durationRule.steps;
    // 2026-08-06 改动逻辑：长视频拆段完成后再标准化广告参考图，保证最终始终恰好三张图，且所有视频全部共同引用。
    if (!modificationMode) sourceSteps = ensureAdvertisementReferenceSteps(sourceSteps,request);
    const validTypes = new Set(['image', 'video', 'music']);
    // 2026-08-06 改动逻辑：步骤重编号前先建立旧 ID 到新 ID 的映射，确保强制插入参考图后，每个视频仍准确依赖图片而不会丢失连线。
    const normalizedIdBySourceId = new Map(sourceSteps.map((step,index) => [String(step?.id || `source-step-${index + 1}`),`step-${index + 1}`]));
    const knownIds = new Set();
    const steps = sourceSteps.map((rawStep, index) => {
      const id = `step-${index + 1}`;
      const type = validTypes.has(rawStep.type) ? rawStep.type : 'image';
      const dependsOn = Array.isArray(rawStep.dependsOn)
        ? rawStep.dependsOn.map(dependency => normalizedIdBySourceId.get(String(dependency))).filter(dependency => dependency && knownIds.has(dependency))
        : [];
      knownIds.add(id);
      return {
        id,
        type,
        title: String(rawStep.title || `${type === 'image' ? '图片' : type === 'video' ? '视频' : '音乐'} ${index + 1}`).trim(),
        prompt: String(rawStep.prompt || request).trim(),
        dependsOn,
        contextNodeIds: [],
        contextNodeTitles: [],
        derivationMode: modificationMode ? 'modify' : '',
        resolvedSourceNodeIds: [],
        status: 'pending',
        nodeId: '',
        startedAt: '',
        completedAt: '',
        contentMark: '',
        error: ''
      };
    });
    attachExistingNodeReferences(steps, referenceIntent, request);
    if (durationRule.forced) {
      // 2026-08-06 改动逻辑：长视频分段只接受本轮生成的参考图片连线；旧画布素材如需复用先用于生成参考图，不再直接连接第二、第三段视频。
      steps.filter(step => step.type === 'video').forEach(step => {
        step.contextNodeIds = [];
        step.contextNodeTitles = [];
        step.dependsOn = step.dependsOn.filter(dependencyId => steps.find(candidate => candidate.id === dependencyId)?.type === 'image');
      });
    }
    // 2026-08-03 改动逻辑：展示规划时使用结构化步骤生成的摘要，确保第一张图、第二张图或后续视频的内容都会在执行前告知用户。
    const summary = buildPlanIntroduction(steps);
    return {
      version: PLAN_VERSION,
      fileName: PLAN_FILE_NAME,
      sessionId: `canvas-session-${Date.now()}-${++planSequence}`,
      request: String(request || '').trim(),
      summary,
      finalGoal: String(request || '').trim(),
      status: 'planned',
      mode: typeof autoModeEnabled !== 'undefined' && autoModeEnabled ? 'automatic' : 'manual',
      referenceIntent: referenceIntent || { needsPreviousNodes: false, nodeIds: [], reason: '' },
      // 2026-08-06 改动逻辑：把强制拆分信息写进规划状态，最终阶段无需再次猜测用户意图，超过 15 秒必定进入自动合片。
      requestedVideoDuration: durationRule.totalSeconds,
      forceFinalComposition: durationRule.forced,
      steps,
      progress: { completed: 0, total: steps.length },
      finalReply: '',
      updatedAt: nowIso()
    };
  }

  async function createPlanWithModel(request, recentContext, onPlanDelta) {
    const referenceIntent = await resolveReferenceIntentWithModel(request, recentContext);
    if (isCarAdvertisementRequest(request) && referenceIntent.intentMode !== 'modify') {
      // 2026-08-03 改动逻辑：汽车广告需求命中确定性规划，确保任何模型输出波动都不会跳过人物图、汽车图或双图连线。
      const plan = normalizePlan(carAdvertisementPlan(request), request, referenceIntent);
      plan.specialPlan = 'car-advertisement';
      return plan;
    }
    const canvasContext = typeof getCanvasContext === 'function' ? getCanvasContext() : '';
    const recentNodeContext = getRecentGeneratedNodesContext();
    const needsConversationContext = /刚才|刚生成|之前|前面|上面|上述|已生成|生成好|最近|这(?:两|几|些|个|张)|那(?:两|几|些|个|张)|它们|这些|那些|第\s*[1-6一二两三四五六]\s*张|最后\s*(?:一|[1-6一二两三四五六])\s*张/i.test(request);
    const boundedRecentContext = needsConversationContext ? String(recentContext || '').slice(-1200) : '';
    const userContent = [
      `用户需求：${request}`,
      canvasContext ? `当前画布上下文：\n${canvasContext}` : '',
      recentNodeContext,
      '节点引用意图 Agent 结论：' + JSON.stringify(referenceIntent),
      boundedRecentContext ? `最近对话（仅用于解析指代）：\n${boundedRecentContext}` : '',
      `必须只规划这条当前需求：${request}`
    ].filter(Boolean).join('\n\n');
    try {
      const response = await callMiniMax([
        { role: 'system', content: PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ], 0.2, {
        stream: true,
        // 2026-08-16 改动逻辑：规划模型仍返回完整 JSON 供最终解析；summary 和 steps 的增量会持续转换为用户可读清单，避免最终结果整段跳出。
        onDelta: partialResponse => {
          const visiblePlan = buildStreamingPlanIntroduction(partialResponse);
          if (visiblePlan) onPlanDelta?.(visiblePlan);
        }
      });
      return normalizePlan(JSON.parse(cleanJsonText(response)), request, referenceIntent);
    } catch (error) {
      // 2026-08-03 改动逻辑：模型规划不可用时仍按相同 JSON 结构生成保底计划，避免自动模式停在“正在思考”。
      const fallback = normalizePlan(fallbackPlanForRequest(request), request, referenceIntent);
      fallback.plannerFallback = true;
      fallback.plannerError = String(error?.message || error || 'unknown error');
      return fallback;
    }
  }

  function hasDirectGenerationIntent(request) {
    // 2026-08-26 改动逻辑：用户明确要求直接、立即或按默认方案生成时跳过需求确认闸门，保留原有快速执行体验。
    return /(?:直接|立即|马上|现在就)(?:开始|生成|制作|创建|做)|(?:无需|不用|不必)(?:确认|询问|再问)|按(?:默认|你的建议)(?:方案)?(?:直接)?(?:生成|做)|direct(?:ly)?\s+(?:generate|create|make)/i.test(String(request || ''));
  }

  function isConfirmationBatchAnswer(request) {
    return /^我已一次性确认全部信息：/i.test(String(request || '').trim());
  }

  function fallbackClarificationBatch(request) {
    // 2026-08-26 改动逻辑：需求判断服务暂时不可用时也不冒然开始规划，改为让用户选择先补充方向或授权使用默认方案。
    return {
      kind: 'confirmation_batch',
      intro: '这个需求还有多个可能方向，请先确认再开始规划。',
      originalRequest: String(request || '').trim(),
      questions: [{
        id: 'next_action',
        title: '你希望我如何继续？',
        type: 'single',
        required: true,
        minSelections: 1,
        maxSelections: 1,
        placeholder: '输入其他推进方式',
        options: [
          { label: '先确认创意方向', description: '补充主体、用途和偏好后再规划。' },
          { label: '使用默认方案直接生成', description: '由 Agent 自动补齐缺失信息并继续。' }
        ]
      }, {
        id: 'key_requirements',
        title: '还有哪些核心要求？',
        type: 'text',
        required: false,
        minSelections: 1,
        maxSelections: 1,
        placeholder: '可选：补充主体、受众、风格、时长或其他限制',
        options: []
      }]
    };
  }

  function requestNeedsDurationConfirmation(request) {
    const text = String(request || '').trim();
    const isVideoCreation = /(?:广告|视频|短片|动画|影片|TVC|video|clip|movie|animation)/i.test(text);
    const hasDuration = /(?:\d+(?:\.\d+)?|[一二两三四五六七八九十半]+)\s*(?:秒钟?|分钟)|(?:15|30|60)\s*(?:s|sec|min)|(?:十五|三十|六十)秒|一分钟/i.test(text);
    return isVideoCreation && !hasDuration;
  }

  function isDurationConfirmationQuestion(question) {
    const signature = [question?.id, question?.title, question?.placeholder]
      .map(value => String(value || ''))
      .join(' ');
    return /duration|video[_-]?length|time[_-]?length|shichang|时长|多少秒|多少分钟/i.test(signature);
  }

  function ensureDurationConfirmation(decision, request) {
    if (!requestNeedsDurationConfirmation(request)) {
      if (decision?.kind !== 'confirmation_batch' || !Array.isArray(decision.questions)) return decision;
      const remainingQuestions = decision.questions.filter(question => !isDurationConfirmationQuestion(question));
      // 2026-08-28 改动逻辑：当前需求已包含时长时，本地层强制过滤模型误返的时长题；若没有其他必要问题则直接进入规划。
      if (!remainingQuestions.length) return { kind: 'ready' };
      decision.questions = remainingQuestions;
      return decision;
    }
    const durationQuestion = {
      id: 'duration',
      title: '希望成片时长是多少？',
      type: 'single',
      required: true,
      minSelections: 1,
      maxSelections: 1,
      placeholder: '输入其他选项',
      options: [
        { label: '15秒以内', description: '适合单镜头短视频或精简广告。' },
        { label: '15到30秒', description: '适合常规短视频广告。' },
        { label: '30秒到1分钟', description: '适合完整叙事或多卖点展示。' },
        { label: '1分钟以上', description: '适合长叙事、讲解或多章节内容。' }
      ]
    };
    const nextDecision = decision?.kind === 'confirmation_batch'
      ? decision
      : {
          kind: 'confirmation_batch',
          intro: '开始规划前，请先确认成片时长。',
          originalRequest: String(request || '').trim(),
          questions: []
        };
    if (!Array.isArray(nextDecision.questions)) nextDecision.questions = [];
    const alreadyHasDuration = nextDecision.questions.some(isDurationConfirmationQuestion);
    // 2026-08-26 改动逻辑：本地二次保障视频类需求的时长问题，即使模型误判为 ready 或漏问，也会展示四档时长选项后才能规划。
    if (!alreadyHasDuration) nextDecision.questions.push(durationQuestion);
    return nextDecision;
  }

  async function getClarificationDecision(request, recentContext) {
    const userContent = [
      `当前用户需求：${String(request || '').trim()}`,
      String(recentContext || '').trim() ? `最近对话（仅用于理解已说明的信息）：\n${String(recentContext).slice(-1600)}` : '',
      '请判断现在能否开始规划。'
    ].filter(Boolean).join('\n\n');
    try {
      const response = await callMiniMax([
        { role: 'system', content: CLARIFICATION_GATE_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ], 0.1);
      const parsed = JSON.parse(cleanJsonText(response));
      if (parsed?.kind === 'confirmation_batch' && Array.isArray(parsed.questions) && parsed.questions.length) {
        parsed.originalRequest = String(request || '').trim();
        return ensureDurationConfirmation(parsed, request);
      }
      return ensureDurationConfirmation({ kind: 'ready' }, request);
    } catch (error) {
      return ensureDurationConfirmation(fallbackClarificationBatch(request), request);
    }
  }

  function buildConfirmedPlanningRequest(request, recentContext) {
    if (!isConfirmationBatchAnswer(request)) return String(request || '').trim();
    // 2026-08-26 改动逻辑：决策卡整批提交后，把原始需求与所有答案合并成同一份规划约束，避免只根据选项文字生成。
    return `请根据以下原始需求和整批确认结果开始规划：\n${String(recentContext || '').slice(-2200)}\n${String(request || '').trim()}`;
  }

  function shouldCreatePlan(text) {
    const value = String(text || '').trim();
    if (!value) return false;
    if (typeof isConfirmText === 'function' && isConfirmText(value) && !isConfirmationBatchAnswer(value)) return false;
    if (typeof isCancelText === 'function' && isCancelText(value)) return false;
    // 2026-08-14 改动逻辑：没有重复“生成”二字的短修改追问也进入规划 Agent，由上下文意图判断决定引用上一条记录还是独立新建。
    return isConfirmationBatchAnswer(value) || /(生成|制作|创建|做一|做个|画一|绘制|参考图|图片|图像|海报|视频|短片|动画|影片|音乐|歌曲|配乐|音频|TVC|修改|改成|改为|换成|换为|调整|微调|优化|润色|替换|去掉|移除|保持|保留|沿用|放大|缩小|调亮|调暗|generate|create|make|image|video|music)/i.test(value);
  }

  function streamPlannerMessage(message, text) {
    const characters = Array.from(String(text || ''));
    if (!message || !characters.length) return Promise.resolve();
    message.classList.remove('thinking');
    message.textContent = '';
    // 2026-08-04 改动逻辑：规划 JSON 解析完成后不再一次性替换占位文案；将面向用户的结构化规划摘要按字符增量写入同一消息，恢复规划模式的流式阅读反馈。
    return new Promise(resolve => {
      let index = 0;
      let timer = 0;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener('vina:stop-ai-reply', stopStreamingReply);
        resolve();
      };
      const stopStreamingReply = () => {
        // 2026-08-16 改动逻辑：停止 AI 回复时冻结已显示的规划文字并立即结束逐字动画；Promise 正常完成，使后续图片和视频生成步骤继续执行。
        if (!message.textContent.trim()) message.textContent = '已停止回复';
        finish();
      };
      const appendNextChunk = () => {
        if (typeof window.vinaIsAiReplyStopped === 'function' && window.vinaIsAiReplyStopped()) {
          stopStreamingReply();
          return;
        }
        if (!message.isConnected) {
          finish();
          return;
        }
        index = Math.min(characters.length, index + 2);
        message.textContent = characters.slice(0, index).join('');
        if (typeof messages !== 'undefined' && messages) messages.scrollTop = messages.scrollHeight;
        if (index >= characters.length) {
          finish();
          return;
        }
        timer = window.setTimeout(appendNextChunk, 24);
      };
      window.addEventListener('vina:stop-ai-reply', stopStreamingReply);
      appendNextChunk();
    });
  }

  function addStreamingPlannerStatus(text, className = '') {
    const message = addMessage('ai', String(text || ''), className || 'thinking');
    // 2026-08-16 改动逻辑：执行与进度状态采用非阻塞逐字输出；节点生成立即开始，不再等待状态文字动画结束。
    void streamPlannerMessage(message, text);
    return message;
  }

  function getStepById(stepId) {
    return activePlan?.steps.find(step => step.id === stepId) || null;
  }

  function dependenciesCompleted(step) {
    return step.dependsOn.every(stepId => getStepById(stepId)?.status === 'completed');
  }

  // 2026-08-13 修复逻辑：直接生成模式会隐藏画布 DOM，此时 offsetLeft/offsetTop/offsetWidth/offsetHeight 可能全部为 0；规划布局改为优先读取节点已写入的画布坐标，并用稳定节点尺寸补齐隐藏态测量。
  function stablePlanNodeBounds(node) {
    const styleLeft = Number.parseFloat(node?.style?.left);
    const styleTop = Number.parseFloat(node?.style?.top);
    const styleWidth = Number.parseFloat(node?.style?.width);
    const styleHeight = Number.parseFloat(node?.style?.height);
    const left = Number.isFinite(styleLeft) ? styleLeft : Number(node?.offsetLeft) || 0;
    const top = Number.isFinite(styleTop) ? styleTop : Number(node?.offsetTop) || 0;
    const width = Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : Number(node?.offsetWidth) || 260;
    const height = Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : Number(node?.offsetHeight) || 284;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  function findOpenPlanPosition(baseLeft, baseTop) {
    const occupiedNodes = Array.from(document.querySelectorAll('.node')).filter(node => node.isConnected);
    const candidateWidth = 260;
    const candidateHeight = 284;
    const gap = 32;
    const collides = (left, top) => occupiedNodes.some(node => {
      const bounds = stablePlanNodeBounds(node);
      return left < bounds.right + gap
        && left + candidateWidth > bounds.left - gap
        && top < bounds.bottom + gap
        && top + candidateHeight > bounds.top - gap;
    });
    for (let column = 0; column < 12; column += 1) {
      const left = baseLeft + column * 390;
      if (!collides(left, baseTop)) return { left, top: baseTop };
    }
    return { left: baseLeft, top: baseTop + 340 };
  }

  /* 2026-08-06 改动逻辑：多段视频锁定第一段所在列并只向下寻找空位，第二段位于第一段下方，后续片段依次纵向排列。 */
  function findOpenVerticalVideoPosition(left,baseTop) {
    const occupiedNodes = Array.from(document.querySelectorAll('.node')).filter(node => node.isConnected);
    const candidateWidth = 260;
    const candidateHeight = 284;
    const gap = 32;
    const collides = top => occupiedNodes.some(node => {
      const bounds = stablePlanNodeBounds(node);
      return left < bounds.right + gap
        && left + candidateWidth > bounds.left - gap
        && top < bounds.bottom + gap
        && top + candidateHeight > bounds.top - gap;
    });
    for (let row = 0; row < 24; row += 1) {
      const top = baseTop + row * 340;
      if (!collides(top)) return { left, top };
    }
    return { left, top: baseTop + 24 * 340 };
  }

  function calculateStepLayout(step) {
    const index = activePlan.steps.indexOf(step);
    const dependencySteps = step.dependsOn.map(getStepById).filter(Boolean);
    const plannedDependencyNodes = dependencySteps.map(item => document.getElementById(item.nodeId)).filter(Boolean);
    const contextNodes = (step.contextNodeIds || []).map(nodeId => document.getElementById(nodeId)).filter(Boolean);
    const dependencyNodes = [...new Map([...plannedDependencyNodes, ...contextNodes].map(node => [node.id, node])).values()];
    const depth = dependencySteps.length
      ? Math.max(...dependencySteps.map(item => Number(item.layoutDepth) || 0)) + 1
      : dependencyNodes.length ? 1 : 0;
    step.layoutDepth = depth;
    const sameDepthBefore = activePlan.steps.slice(0, index).filter(item => Number(item.layoutDepth) === depth).length;
    // 2026-08-03 改动逻辑：跨轮次引用旧节点时按来源节点的真实位置把新视频放到最右侧，避免与旧图片重叠而产生“替换节点”的错觉。
    const dependencyBounds = dependencyNodes.map(stablePlanNodeBounds);
    const baseLeft = dependencyNodes.length
      ? Math.max(...dependencyBounds.map(bounds => bounds.right)) + 150
      : 680 + depth * 390;
    const baseTop = Math.max(100, dependencyNodes.length
      ? Math.round(dependencyBounds.reduce((sum, bounds) => sum + bounds.top + bounds.height / 2, 0) / dependencyBounds.length - 142)
      : 220 + sameDepthBefore * 340);
    const previousVideoStep = step.type === 'video'
      ? activePlan.steps.slice(0,index).filter(item => item.type === 'video' && item.nodeId).at(-1)
      : null;
    const previousVideoNode = previousVideoStep ? document.getElementById(previousVideoStep.nodeId) : null;
    if (previousVideoNode?.isConnected) {
      const previousVideoBounds = stablePlanNodeBounds(previousVideoNode);
      // 2026-08-06 改动逻辑：后续视频不再使用横向空位扫描，直接继承上一段横坐标并从其底部向下排列。
      return {
        ...findOpenVerticalVideoPosition(previousVideoBounds.left,previousVideoBounds.bottom + 56),
        dependencyNodes
      };
    }
    // 2026-08-03 改动逻辑：连续生成衍生节点或开始新规划时扫描画布占位，自动向右寻找空位，避免新节点覆盖图片或与已有视频重叠。
    const position = findOpenPlanPosition(baseLeft, baseTop);
    return { ...position, dependencyNodes };
  }

  function createRequestForStep(step) {
    generationRequestCount += 1;
    return {
      id: `generation-${generationRequestCount}`,
      type: step.type,
      prompt: step.prompt,
      replyText: `规划步骤 ${activePlan.steps.indexOf(step) + 1}/${activePlan.steps.length}：${step.title}，请确认生成。`,
      __vinaPlanStepId: step.id,
      __vinaPlanSessionId: activePlan.sessionId,
      // 2026-08-14 改动逻辑：请求显式携带修改模式与来源节点，供生成链路区分参考生成和纯文本生成。
      __vinaDerivationMode: step.derivationMode || '',
      __vinaReferenceNodeIds: (step.contextNodeIds || []).slice()
    };
  }

  function startPlanStep(step, request, params) {
    if (!step || step.status === 'running' || step.status === 'completed') return null;
    const layout = calculateStepLayout(step);
    // 2026-08-03 改动逻辑：规划步骤始终创建独立的新节点；上下文图片只作为连线来源，绝不把视频生成状态写回或替换到旧图片节点。
    const node = createTypedNode(step.type, { x: layout.left + 120, y: layout.top + 88 }, null, null, true);
    if (!node) throw new Error(`无法创建${step.title}节点`);
    node.style.left = `${layout.left}px`;
    node.style.top = `${layout.top}px`;
    node.dataset.vinaPlanSessionId = activePlan.sessionId;
    node.dataset.vinaPlanStepId = step.id;
    node.dataset.vinaPlanTitle = step.title;
    node.dataset.vinaPlanDepth = String(step.layoutDepth || 0);
    node.dataset.vinaGenerationIntent = step.derivationMode === 'modify' ? 'reference-edit' : 'new-generation';
    node.dataset.vinaReferenceNodeIds = (step.contextNodeIds || []).join(',');
    layout.dependencyNodes.forEach(sourceNode => makeEdge(sourceNode, node, 'right', 'left'));
    step.resolvedSourceNodeIds = layout.dependencyNodes.map(sourceNode => sourceNode.id);
    step.status = 'running';
    step.nodeId = node.id;
    step.startedAt = nowIso();
    activePlan.status = 'running';
    writePlanFile(activePlan);
    setNodeGenerating(node, request, params || getGenerationDefaults(generationConfig[step.type]));
    // 2026-08-13 修复逻辑：规划器在生成节点完成类型、状态和提交序号写入后显式通知直接生成视图，视频任务无需切换模式就会立即进入历史。
    document.dispatchEvent(new CustomEvent('vina:canvas-generation-sync', {
      detail: { reason: 'submitted', nodeId: node.id, type: step.type }
    }));
    selectNode(node);
    updateEdges();
    return node;
  }

  function presentManualStep(step) {
    if (!step || step.status !== 'pending') return;
    const request = createRequestForStep(step);
    step.status = 'awaiting_confirmation';
    writePlanFile(activePlan);
    addGenerationConfirmCard(request);
  }

  function nextReadyStep() {
    return activePlan?.steps.find(step => step.status === 'pending' && dependenciesCompleted(step)) || null;
  }

  function continuePlan() {
    if (!activePlan || !['planned', 'running'].includes(activePlan.status)) return;
    // 2026-08-16 修复逻辑：每次准备提交下一节点前同时检查本轮内存标记与规划文件标记，手动、自动模式停止后都不得继续执行。
    if (plannerStopRequested || activePlan.stopRequested) return;
    if (activePlan.steps.some(step => ['running', 'awaiting_confirmation'].includes(step.status))) return;
    const next = nextReadyStep();
    if (next) {
      if (activePlan.mode === 'automatic') {
        const request = createRequestForStep(next);
        addStreamingPlannerStatus(`正在执行规划步骤 ${activePlan.steps.indexOf(next) + 1}/${activePlan.steps.length}：${next.title}。`);
        startPlanStep(next, request, getGenerationDefaults(generationConfig[next.type]));
      } else {
        presentManualStep(next);
      }
      return;
    }
    if (activePlan.steps.every(step => step.status === 'completed')) finalizePlan();
  }

  function fallbackCompositionDecision(plan, videoSteps) {
    const goal = String(plan?.finalGoal || plan?.request || '');
    const explicitlyIndependent = /分别(?:导出|保留)|独立(?:视频|成片)|不要(?:合成|拼接)|无需(?:合成|拼接)|各自成片/i.test(goal);
    const requestsOneFinalVideo = /合成|拼接|成片|完整视频|最终视频|一条.{0,12}(?:视频|短片|广告|TVC)|一个.{0,12}(?:视频|短片|广告|TVC)|整支.{0,8}(?:视频|广告|TVC)/i.test(goal);
    return {
      shouldCompose: Boolean(plan?.forceFinalComposition) || (!explicitlyIndependent && (requestsOneFinalVideo || plan?.specialPlan === 'car-advertisement')),
      orderedStepIds: videoSteps.map(step => step.id),
      reason: '按 Agent 规划中的镜头叙事顺序排列'
    };
  }

  async function decideVideoComposition(plan, videoSteps) {
    const fallback = fallbackCompositionDecision(plan, videoSteps);
    const stepContext = videoSteps.map(step => ({
      id: step.id,
      title: step.title,
      prompt: step.prompt,
      dependsOn: step.dependsOn,
      nodeId: step.nodeId
    }));
    try {
      const response = await callMiniMax([
        { role: 'system', content: VIDEO_COMPOSITION_SYSTEM_PROMPT },
        { role: 'user', content: `用户最终目标：${plan.finalGoal}\n\n视频步骤：${JSON.stringify(stepContext)}` }
      ], 0.1);
      const parsed = JSON.parse(cleanJsonText(response));
      const validIds = new Set(videoSteps.map(step => step.id));
      const ordered = Array.isArray(parsed.orderedStepIds)
        ? [...new Set(parsed.orderedStepIds.map(String))].filter(id => validIds.has(id))
        : [];
      videoSteps.forEach(step => { if (!ordered.includes(step.id)) ordered.push(step.id); });
      return {
        // 2026-08-06 改动逻辑：超过 15 秒的任务由系统硬规则覆盖模型判断，多个分段必须合成为用户要求的一个最终视频。
        shouldCompose: Boolean(plan?.forceFinalComposition) || parsed.shouldCompose === true,
        orderedStepIds: ordered,
        reason: String(parsed.reason || fallback.reason).slice(0, 120)
      };
    } catch (error) {
      return fallback;
    }
  }

  /* 2026-08-06 改动逻辑：自动规划完成且产出多个视频时，由合片决策 Agent 判断是否需要最终成片并决定镜头先后；需要时自动创建视频合成节点、依次连线并顺序铺入时间轴。 */
  async function createAutomaticFinalComposition(plan) {
    if (!plan || plan.mode !== 'automatic' || plannerStopRequested || plan.stopRequested) return null;
    const videoSteps = plan.steps.filter(step => step.type === 'video' && step.status === 'completed' && step.nodeId);
    if (videoSteps.length < 2) return null;
    const decision = await decideVideoComposition(plan, videoSteps);
    // 2026-08-16 改动逻辑：合片决策模型等待期间若收到停止信号，返回后立即丢弃决策，不创建节点、不连线也不追加文字回复。
    if (plannerStopRequested || plan.stopRequested) return null;
    plan.finalComposition = {
      required: decision.shouldCompose,
      orderedStepIds: decision.orderedStepIds,
      reason: decision.reason,
      nodeId: '',
      createdAt: ''
    };
    if (!decision.shouldCompose) {
      writePlanFile(plan);
      return null;
    }
    const stepMap = new Map(videoSteps.map(step => [step.id,step]));
    const orderedSteps = decision.orderedStepIds.map(id => stepMap.get(id)).filter(Boolean);
    const orderedNodes = orderedSteps.map(step => document.getElementById(step.nodeId)).filter(node => node?.isConnected);
    if (orderedNodes.length < 2 || typeof window.vinaCreateOrderedVideoComposer !== 'function') {
      plan.finalComposition.error = 'video-composer-unavailable';
      writePlanFile(plan);
      return null;
    }
    if (plannerStopRequested || plan.stopRequested) return null;
    addMessage('ai', `多个视频片段已生成，正在按“${decision.reason}”自动连线并拼接。`);
    const compositionTitle = `视频合成 ${orderedNodes.length}`;
    const composer = window.vinaCreateOrderedVideoComposer(orderedNodes, {
      sessionId: plan.sessionId,
      title: compositionTitle
    });
    if (!composer) {
      plan.finalComposition.error = 'video-composer-create-failed';
      writePlanFile(plan);
      return null;
    }
    plan.finalComposition.nodeId = composer.id;
    plan.finalComposition.createdAt = nowIso();
    plan.finalComposition.orderedNodeIds = orderedNodes.map(node => node.id);
    writePlanFile(plan);
    // 2026-08-08 改动逻辑：自动规划在创建并连好视频合成节点后即结束，不再自动导出或追加“导出的最终成片”；用户需要成片时由剪辑器内的导出按钮主动触发。
    return composer;
  }

  async function finalizePlan() {
    if (!activePlan || finalizing || activePlan.status === 'completed') return;
    if (plannerStopRequested || activePlan.stopRequested) return;
    finalizing = true;
    activePlan.status = 'summarizing';
    writePlanFile(activePlan);
    const thinking = addMessage('ai', '正在汇总本次规划结果...', 'thinking');
    await createAutomaticFinalComposition(activePlan);
    if (plannerStopRequested || activePlan.stopRequested) {
      // 2026-08-16 改动逻辑：停止发生在合片判断期间时，不再继续生成总结文字或覆盖 stopped 状态。
      finalizing = false;
      activePlan.status = 'stopped';
      writePlanFile(activePlan);
      setPlannerStopAvailable(false);
      return;
    }
    let completedText = activePlan.steps.map((step, index) => {
      const sourceText = step.resolvedSourceNodeIds?.length ? `，引用节点 ${step.resolvedSourceNodeIds.join('、')}` : '';
      return `${index + 1}. ${step.title}（${step.type}，节点 ${step.nodeId}${sourceText}）`;
    }).join('\n');
    if (activePlan.finalComposition?.nodeId) {
      completedText += `\n最终合片：节点 ${activePlan.finalComposition.nodeId}，视频顺序 ${activePlan.finalComposition.orderedStepIds.join(' → ')}，依据：${activePlan.finalComposition.reason}`;
    }
    let finalReply = '';
    let finalReplyStreamed = false;
    try {
      finalReply = await callMiniMax([
        { role: 'system', content: FINAL_SYSTEM_PROMPT },
        { role: 'user', content: `用户最终目标：${activePlan.finalGoal}\n\n已完成步骤：\n${completedText}` }
      ], 0.2, {
        stream: true,
        onDelta: partial => {
          const nextText = String(partial || '');
          if (!nextText) return;
          finalReplyStreamed = true;
          thinking.classList.remove('thinking');
          thinking.textContent = nextText;
          if (typeof messages !== 'undefined' && messages) messages.scrollTop = messages.scrollHeight;
        }
      });
    } catch (error) {
      const connectedCount = document.querySelectorAll('.edge:not(.preview)[data-from][data-to]').length;
      finalReply = `已按规划完成全部 ${activePlan.steps.length} 个生成步骤，共生成 ${activePlan.steps.length} 个素材节点${connectedCount ? `并建立 ${connectedCount} 条参考连线` : ''}，最终内容已在画布中。`;
    }
    if (plannerStopRequested || activePlan.stopRequested) {
      // 2026-08-16 改动逻辑：最终文字流被停止后保留已显示文字，不再执行保底逐字输出，也不再写回“已完成”状态。
      finalizing = false;
      activePlan.status = 'stopped';
      writePlanFile(activePlan);
      setPlannerStopAvailable(false);
      return;
    }
    // 2026-08-04 改动逻辑：最终汇总优先直接展示模型流式增量；接口未返回增量或进入保底回复时，仍用同一逐字函数输出，避免结果突然整段跳出。
    if (finalReplyStreamed) {
      thinking.classList.remove('thinking');
      thinking.textContent = finalReply;
    } else {
      await streamPlannerMessage(thinking, finalReply);
    }
    activePlan.status = 'completed';
    activePlan.finalReply = finalReply;
    activePlan.completedAt = nowIso();
    writePlanFile(activePlan);
    finalizing = false;
    // 2026-08-16 改动逻辑：规划全部完成并结束总结回复后，停止按钮才恢复为普通发送按钮。
    setPlannerStopAvailable(false);
    if (typeof setSending === 'function') setSending(false);
  }

  function applyGeneratedContentMark(node, step) {
    if (!node || !step || !activePlan) return;
    const sameTypeSteps = activePlan.steps.filter(item => item.type === step.type);
    const ordinal = Math.max(1, sameTypeSteps.indexOf(step) + 1);
    const typeLabel = step.type === 'video' ? '视频' : step.type === 'music' ? '音乐' : '图片';
    const prefix = typeLabel + ordinal + '·';
    const cleanTitle = String(step.title || '')
      .replace(/^(生成|制作|创建)/, '')
      .replace(/(?:参考)?(?:图片|图像|照片|素材|视频|短片|动画|影片|音乐|歌曲|配乐|音频)$/, '')
      .replace(/\s+/g, '')
      .trim();
    const promptDetail = String(step.prompt || '')
      .replace(/\s+/g, ' ')
      .split(/[，。；：,.;:!?！？]/)
      .map(item => item.trim())
      .find(Boolean) || '';
    let detail = cleanTitle || promptDetail || typeLabel + '内容';
    if (cleanTitle && promptDetail && !promptDetail.includes(cleanTitle)) detail += '·' + promptDetail;
    const availableLength = Math.max(1, 14 - Array.from(prefix).length);
    const mark = prefix + Array.from(detail.replace(/\s+/g, '')).slice(0, availableLength).join('');
    // 2026-08-04 改动逻辑：每个对话 Agent 生成节点完成后写入可见短标记、素材类型和同类型序号；标记同时保存到规划 JSON，供后续自然语言按编号或内容直接引用。
    node.dataset.vinaContentMark = mark;
    node.dataset.vinaContentType = step.type;
    node.dataset.vinaContentOrdinal = String(ordinal);
    node.dataset.vinaContentSessionId = activePlan.sessionId;
    step.contentMark = mark;
    const titleNode = node.querySelector('.node-type');
    if (titleNode?.lastChild) titleNode.lastChild.textContent = mark;
  }

  function markPlanStepCompleted(node) {
    if (!activePlan || node.dataset.vinaPlanSessionId !== activePlan.sessionId) return;
    const step = getStepById(node.dataset.vinaPlanStepId);
    if (!step || step.status !== 'running') return;
    step.status = 'completed';
    step.completedAt = nowIso();
    applyGeneratedContentMark(node, step);
    writePlanFile(activePlan);
    if (plannerStopRequested || activePlan.stopRequested) {
      // 2026-08-16 改动逻辑：停止不会取消正在运行的图片/视频请求；当前结果正常落库后结束本轮规划，跳过后续生成、合片和总结回复。
      activePlan.status = 'stopped';
      activePlan.stoppedAt = activePlan.stoppedAt || nowIso();
      writePlanFile(activePlan);
      setPlannerStopAvailable(false);
      return;
    }
    const remaining = activePlan.steps.filter(item => item.status !== 'completed').length;
    if (remaining) addStreamingPlannerStatus(`规划进度 ${activePlan.progress.completed}/${activePlan.progress.total}：${step.title}已完成，继续执行下一步。`);
    // 2026-08-03 改动逻辑：节点完成后用微任务立即调度下一步，避免后台标签页把短定时器节流成数秒或一分钟；当前节点仍须先进入 completed 才会继续。
    queueMicrotask(continuePlan);
  }

  function markPlanStepFailed(node) {
    if (!activePlan || node.dataset.vinaPlanSessionId !== activePlan.sessionId) return;
    const step = getStepById(node.dataset.vinaPlanStepId);
    if (!step || !['running', 'awaiting_confirmation'].includes(step.status)) return;
    step.status = 'failed';
    step.error = node.dataset.generationFailure || 'generation-failed';
    if (plannerStopRequested || activePlan.stopRequested) {
      // 2026-08-16 改动逻辑：用户已经要求停止后续流程时，即使当前后台生成失败也只收束任务，不再追加失败回复或触发下一步。
      activePlan.status = 'stopped';
      activePlan.stoppedAt = activePlan.stoppedAt || nowIso();
      writePlanFile(activePlan);
      setPlannerStopAvailable(false);
      return;
    }
    activePlan.status = 'failed';
    writePlanFile(activePlan);
    addMessage('ai', `规划在“${step.title}”步骤生成失败，已停止后续自动执行。修改需求后可以重新规划。`, 'error');
    setPlannerStopAvailable(false);
    if (typeof setSending === 'function') setSending(false);
  }

  function stopCurrentPlan() {
    plannerStopRequested = true;
    const runningStep = activePlan?.steps?.find(step => step.status === 'running') || null;
    if (activePlan && !['idle', 'completed', 'failed', 'stopped'].includes(activePlan.status)) {
      // 2026-08-16 修复逻辑：文字阶段停止时取消全部未开始步骤；媒体生成阶段仅保留 running 步骤，当前请求不 abort，其他步骤统一取消。
      activePlan.stopRequested = true;
      activePlan.stoppedAt = nowIso();
      activePlan.steps.forEach(step => {
        if (!['pending', 'awaiting_confirmation'].includes(step.status)) return;
        step.status = 'canceled';
        step.canceledReason = 'user-stopped-plan';
      });
      activePlan.status = runningStep ? 'stopping' : 'stopped';
      writePlanFile(activePlan);
    }
    // 2026-08-16 改动逻辑：点击后立即恢复普通发送入口；后台仅剩当前已提交的媒体生成，不会再追加文字消息。
    setPlannerStopAvailable(false);
  }

  function observePlanNodes() {
    const root = document.getElementById('stage') || document.body;
    new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        const node = mutation.target?.closest?.('.node') || (mutation.target?.classList?.contains('node') ? mutation.target : null);
        if (!node?.dataset.vinaPlanStepId) return;
        if (node.dataset.generationFailure) markPlanStepFailed(node);
        else if (node.dataset.generationStatus === 'completed') markPlanStepCompleted(node);
      });
    }).observe(root, { subtree: true, attributes: true, attributeFilter: ['data-generation-status', 'data-generation-failure', 'class'] });
  }

  function installPlanner() {
    if (installed || typeof submitPrompt !== 'function' || typeof callMiniMax !== 'function') return;
    installed = true;
    // 2026-08-16 修复逻辑：捕获阶段仅在停止桥接缺失时接管点击；桥接稍后就绪后自动让回原中止逻辑，避免重复派发停止事件。
    getPlannerSendButton()?.addEventListener('click', stopPlanFromFallbackButton, true);
    resetPlanFile('canvas-session-start');

    const originalSubmitPrompt = submitPrompt;
    submitPrompt = async function submitPromptWithPlanning(text) {
      const value = String(text || promptInput?.value || '').trim();
      if (!shouldCreatePlan(value)) return originalSubmitPrompt(text);
      // 2026-08-16 改动逻辑：每次新请求建立独立停止状态，并从规划开始到结束持续持有停止按钮，手动和自动模式行为一致。
      plannerStopRequested = false;
      const recentContext = typeof getRecentConversationText === 'function' ? getRecentConversationText() : '';
      if (promptInput) promptInput.value = '';
      addMessage('user', value);
      const thinking = addMessage('ai', hasDirectGenerationIntent(value) || isConfirmationBatchAnswer(value) ? '正在规划执行步骤...' : '正在确认需求...', 'thinking');
      setSending(true);
      setPlannerStopAvailable(true);
      try {
        // 2026-08-26 改动逻辑：未明确说“直接生成”的新请求先经过清晰度判断；需要用户决策时立即收束本轮，不创建规划或生成节点。
        if (!hasDirectGenerationIntent(value) && !isConfirmationBatchAnswer(value)) {
          const decision = await getClarificationDecision(value, recentContext);
          if (decision.kind === 'confirmation_batch') {
            const serializedDecision = JSON.stringify(decision);
            thinking.classList.remove('thinking');
            thinking.textContent = serializedDecision;
            if (typeof window.renderConfirmationBatchReply === 'function') {
              window.renderConfirmationBatchReply(thinking, serializedDecision);
            }
            setPlannerStopAvailable(false);
            return;
          }
          thinking.textContent = '正在规划执行步骤...';
        }
        const planningRequest = buildConfirmedPlanningRequest(value, recentContext);
        const plan = await createPlanWithModel(planningRequest, recentContext, partialPlan => {
          if (plannerStopRequested || !thinking?.isConnected) return;
          // 2026-08-16 改动逻辑：持续展示从 JSON 增量解码出的摘要和步骤清单，不把协议字段、引号或转义符暴露给用户。
          thinking.classList.remove('thinking');
          thinking.textContent = partialPlan;
          if (typeof messages !== 'undefined' && messages) messages.scrollTop = messages.scrollHeight;
        });
        if (plannerStopRequested) {
          // 2026-08-16 修复逻辑：意图或规划模型返回前已经点击停止时，直接把新计划收束为 stopped，禁止流式摘要和首个生成步骤启动。
          plan.stopRequested = true;
          plan.status = 'stopped';
          plan.stoppedAt = nowIso();
          plan.steps.forEach(step => {
            step.status = 'canceled';
            step.canceledReason = 'user-stopped-during-planning';
          });
          writePlanFile(plan);
          thinking.classList.remove('thinking');
          return;
        }
        writePlanFile(plan);
        // 2026-08-16 改动逻辑：完整规划到达后直接用结构化步骤清单收束流式首段，不再把同一内容二次逐字播放并延迟首个生成节点。
        thinking.classList.remove('thinking');
        thinking.textContent = plan.summary;
        if (!plannerStopRequested && !plan.stopRequested) queueMicrotask(continuePlan);
      } catch (error) {
        thinking.classList.remove('thinking');
        if (!plannerStopRequested) {
          thinking.classList.add('error');
          thinking.textContent = `规划失败：${error?.message || '请稍后再试。'}`;
          // 2026-08-16 改动逻辑：真实规划失败已没有可继续的步骤，释放持久停止入口；用户主动停止时则不追加失败文字。
          setPlannerStopAvailable(false);
        }
      } finally {
        // 2026-08-16 修复逻辑：允许底层结束本次文字 sending；规划器持有的持久停止状态会在任务仍活动时立即重新显示停止按钮。
        setSending(false);
        promptInput?.focus();
      }
    };

    const originalApprovePendingGeneration = approvePendingGeneration;
    approvePendingGeneration = function approvePlannedGeneration(request = pendingGeneration) {
      if (!request?.__vinaPlanStepId || request.__vinaPlanSessionId !== activePlan?.sessionId) {
        return originalApprovePendingGeneration(request);
      }
      const step = getStepById(request.__vinaPlanStepId);
      if (!step || step.status !== 'awaiting_confirmation') return;
      syncGenerationRequestPrompt(request);
      const params = request.card
        ? collectGenerationParams(request.card)
        : getGenerationDefaults(generationConfig[request.type]);
      request.status = 'approved';
      request.params = params;
      disableGenerationCard(request.card);
      addMessage('ai', `${generationConfig[request.type].label}已在画布上生成中，请稍等片刻查看结果。`);
      step.status = 'pending';
      startPlanStep(step, request, params);
      pendingGeneration = null;
    };

    const originalCancelPendingGeneration = cancelPendingGeneration;
    cancelPendingGeneration = function cancelPlannedGeneration(request = pendingGeneration) {
      if (request?.__vinaPlanStepId && request.__vinaPlanSessionId === activePlan?.sessionId) {
        const step = getStepById(request.__vinaPlanStepId);
        if (step) step.status = 'canceled';
        activePlan.status = 'canceled';
        writePlanFile(activePlan);
        setPlannerStopAvailable(false);
      }
      return originalCancelPendingGeneration(request);
    };

    observePlanNodes();
    // 2026-08-16 改动逻辑：回复停止事件在媒体生成阶段转为“当前生成完成后停止”，不终止后台图片、视频或音乐请求。
    window.addEventListener('vina:stop-ai-reply', stopCurrentPlan);
    window.addEventListener('message', event => {
      if (event.source !== window.parent) return;
      const type = event.data?.type;
      if (['vina-canvas-reset-minimax-context', 'vina-canvas-new-project', 'vina-canvas-start-from-home'].includes(type)) {
        resetPlanFile(type);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPlanner, { once: true });
  else installPlanner();
})();
