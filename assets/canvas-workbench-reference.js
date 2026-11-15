// 2026-11-09 文案调整：样片模型名称在 2.5 后增加一个空格，与模型目录保持一致。
/* 2026-11-03 Product Design 改动说明：此文件只同步画布 UI 的本地模型图标和浮层坐标。
 * 模型缩略图取自用户提供的来画页面；保留既有参数、积分和请求逻辑。
 * 2026-11-03：全能创作移除 Happyhorse、Kling 对非会员开放；仅非会员点击其余会员模型整行时进入套餐。
 * 不修改节点数据、不替换模型控件或短剧资产画布。
 * 2026-11-03：左侧仅用户指定的底部操作行采用图标态，其余 Agent 内容保持原样。
 * 2026-11-03 修正：图标地址使用完整 URL；会员钻石保留独立结构，非会员点击会员模型整行均进入现有套餐页。
 */
(function () {
  function install() {
    if (document.getElementById('character-asset-canvas-theme')) return;
    var workspace = document.querySelector('.workspace');
    var stage = document.getElementById('stage');
    var panel = document.getElementById('nodeGeneratePanel');
    var actionBar = document.getElementById('nodeActionBar');
    var modelMenu = document.getElementById('nodeModelMenu');
    var modelLabel = document.getElementById('nodeModelLabel');
    var modelTrigger = document.getElementById('nodeModelTrigger');
    if (!workspace || !stage || !panel) return;
    document.documentElement.classList.add('vina-canvas-ui-reference');

    // 2026-11-08 Product Design：ego 实测来画参考页后，全部全能创作项目共用同一发送渲染。
    // 40px 按钮 / 24px 内嵌箭头，空输入或锁定置灰，有内容变品牌绿；画布/故事板不分支。
    // 只读取原 disabled、草稿、附件和任务状态，不替换按钮、不改提交/停止监听器或短剧资产画布。
    function installUnifiedChatSend() {
      var composer = document.querySelector('.chat .composer');
      if (!composer) return;
      var arrowSource = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCc+PHBhdGggZD0nbTE3LjcxIDkuODgtNC4zLTQuMjlhMiAyIDAgMCAwLTIuODIgMEw2LjI5IDkuODhhMSAxIDAgMCAwIDEuNDIgMS40MUwxMSA4djExYTEgMSAwIDEgMCAyIDBWOGwzLjI5IDMuMjlhMSAxIDAgMSAwIDEuNDItMS40MVonIGZpbGw9JyMwODBEMTInLz48L3N2Zz4=';
      // 2026-11-08：ego 读取 AiCanvasChatInputArea 原停止图标，绿色圆按钮内为 12px 圆角方块。
      var stopSource = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEyIiByeD0iMS41IiBmaWxsPSIjMDgwRDEyIi8+PC9zdmc+';
      function syncSend() {
        var button = composer.querySelector('#sendBtn');
        if (!button) return;
        if (!button.classList.contains('vina-creation-send-ui')) button.classList.add('vina-creation-send-ui');
        var locked = composer.classList.contains('vina-collaboration-chat-locked') || document.body.classList.contains('vina-example-readonly');
        var stopping = button.classList.contains('vina-reply-stop') || button.dataset.replyAction === 'stop';
        var editor = composer.querySelector('.canvas-chat-reference-editor');
        var native = composer.querySelector('#prompt');
        var text = String(editor ? editor.textContent : native?.value || '').replace(/\u200b/g, '').trim();
        var references = composer.classList.contains('has-chat-images') || Boolean(composer.querySelector('.canvas-chat-image-card, .selected-node-tray.active .selected-node-chip:not([data-canvas-empty-reference]), .reference-strip.active'));
        var state = locked ? 'locked' : stopping ? 'stop' : button.disabled || (!text && !references) ? 'disabled' : 'ready';
        if (button.getAttribute('data-vina-send-state') !== state) button.setAttribute('data-vina-send-state', state);
        var icon = button.querySelector('.vina-creation-send-icon');
        if (!icon) {
          icon = document.createElement('img');
          icon.className = 'vina-creation-send-icon';
          icon.src = arrowSource;
          icon.alt = '';
          icon.draggable = false;
          icon.setAttribute('aria-hidden', 'true');
          button.appendChild(icon);
        }
        // 同一个内嵌图片在发送/停止间切换，隔离旧停止 SVG 填充与伪元素；不更改真实任务状态。
        var source = state === 'stop' ? stopSource : arrowSource;
        if (icon.getAttribute('src') !== source) icon.src = source;
      }
      // 原回复与规划器会重写 innerHTML，观察后幂等补齐图标；只写不同状态，避免观察器循环。
      new MutationObserver(syncSend).observe(composer, {
        childList: true, characterData: true, subtree: true,
        attributes: true, attributeFilter: ['class', 'disabled', 'data-reply-action']
      });
      composer.addEventListener('input', syncSend);
      composer.addEventListener('change', syncSend);
      new MutationObserver(syncSend).observe(document.body, { attributes: true, attributeFilter: ['class'] });
      syncSend();
    }
    installUnifiedChatSend();


    // 2026-11-07 Product Design：右侧全部工具按钮共用即时提示，只添加展示事件，不拦截业务点击。
    // 不使用 setTimeout、requestAnimationFrame 或过渡延迟；pointerover/focusin 内同步显示并定位。
    function installSidebarHoverTips() {
      var toolbar = document.querySelector('.agent-localbar .toolbar');
      if (!toolbar) return;
      var tip = document.createElement('div');
      tip.className = 'vina-canvas-sidebar-hover-tip';
      tip.id = 'vinaCanvasSidebarHoverTip';
      tip.setAttribute('role', 'tooltip');
      tip.hidden = true;
      document.body.appendChild(tip);
      var active = null;
      var savedTitle = null;
      var savedDescription = null;
      function hide() {
        if (active) {
          // 恢复同一个按钮的原始 title/辅助描述，不覆盖期间由语言切换等代码更新的 title。
          if (savedTitle !== null && !active.hasAttribute('title')) active.setAttribute('title', savedTitle);
          if (savedDescription === null) active.removeAttribute('aria-describedby');
          else active.setAttribute('aria-describedby', savedDescription);
        }
        active = null;
        savedTitle = null;
        savedDescription = null;
        tip.hidden = true;
      }
      function show(button) {
        if (document.body.classList.contains('vina-direct-mode') || button === active) return;
        hide();
        var label = button.dataset.addNode === 'video' ? '新增视频节点'
          : button.dataset.addNode === 'image' ? '新增图片节点'
          : button.id === 'assetLibraryBtn' ? '打开资产库'
          : button.id === 'historyBtn' ? '查看历史'
          : button.id === 'canvasLocalMediaToolbarUpload' ? '上传资源'
          : button.getAttribute('aria-label') || button.getAttribute('title');
        if (!label) return;
        active = button;
        savedTitle = button.getAttribute('title');
        savedDescription = button.getAttribute('aria-describedby');
        button.removeAttribute('title');
        button.setAttribute('aria-describedby', [savedDescription, tip.id].filter(Boolean).join(' '));
        var arabic = window.VinaArabic || window.parent.VinaArabic;
        if (arabic && typeof arabic.renderText === 'function') arabic.renderText(tip, label);
        else tip.textContent = label;
        tip.hidden = false;
        var rect = button.getBoundingClientRect();
        var size = tip.getBoundingClientRect();
        tip.style.left = Math.max(8, rect.left - size.width - 8) + 'px';
        tip.style.top = Math.max(8, Math.min(window.innerHeight - size.height - 8, rect.top + (rect.height - size.height) / 2)) + 'px';
      }
      function getButton(event) {
        var target = event.target;
        var button = target && target.closest ? target.closest('.icon-btn') : null;
        return button && toolbar.contains(button) ? button : null;
      }
      toolbar.addEventListener('pointerover', function (event) {
        var button = getButton(event);
        if (button) show(button);
      });
      toolbar.addEventListener('pointerout', function (event) {
        if (active && !active.contains(event.relatedTarget)) hide();
      });
      toolbar.addEventListener('focusin', function (event) {
        var button = getButton(event);
        if (button) show(button);
      });
      toolbar.addEventListener('focusout', hide);
      toolbar.addEventListener('pointerdown', hide);
      document.addEventListener('keydown', function (event) { if (event.key === 'Escape') hide(); });
      document.addEventListener('scroll', hide, true);
      window.addEventListener('resize', hide);
      window.addEventListener('blur', hide);
      new MutationObserver(hide).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    installSidebarHoverTips();

    // 2026-11-07 Product Design 文案逻辑：只同步来画参考页存在的右键菜单条目，音乐、文本等本地独有项保持原文。
    // 保留原 button、data-*、节点类型和所有监听器；仅更新名称/说明文字，不移动或删除任何菜单项。
    function syncContextMenuCopy() {
      if (document.body.classList.contains('vina-direct-mode')) return;
      var menu = document.getElementById('nodeTypeMenu');
      if (!menu) return;
      var arabic = window.VinaArabic || window.parent.VinaArabic;
      function sourceText(element) {
        return arabic && typeof arabic.sourceText === 'function' ? arabic.sourceText(element) : element.textContent;
      }
      function updateText(selector, text) {
        var element = menu.querySelector(selector);
        if (!element || sourceText(element).trim() === text) return;
        // 复用现有语言展示接口，避免阿语开启时反复写回中文引发翻译循环。
        if (arabic && typeof arabic.renderText === 'function') arabic.renderText(element, text);
        else element.textContent = text;
      }
      updateText('button[data-type="image"] .node-type-sub', '海报、产品图、概念图');
      updateText('button[data-type="video"] .node-type-sub', '短片、镜头、动态分镜');
      updateText('.fake-upload .node-type-sub', '本地图片、视频、音频资源');
      updateText('[data-resource-action="history"] .node-type-sub', '查看过往生成内容');
      updateText('[data-resource-action="library"] .node-type-label', '素材库');
      updateText('[data-resource-action="library"] .node-type-sub', '导入已有图片与视频');
      // 合成剪辑只移除用户指定的“自动”二字；保留当前名称其他文字及选中多项时的动态说明。
      var composer = menu.querySelector('[data-libtv-composer-action] .node-type-label');
      if (composer) updateText('[data-libtv-composer-action] .node-type-label', sourceText(composer).replace(/自动/g, '').trim());
    }

    // 仅按已有模型名匹配图标，不新增、重排或替换可选模型，也不更改选中的模型值。
    var sourceLogos = {
      // 2026-11-03：音乐沿用原 Mureka 配置，模型图标复用已有音符资源。
      'Mureka v9.5': './assets/canvas-ui-reference/music.svg',
      'MiniMax H3': './assets/canvas-ui-reference/minimax-h3.png',
      'MiniMax H3 Fast': './assets/canvas-ui-reference/minimax-h3-fast.png',
      'Seedance 2.5': './assets/canvas-ui-reference/seedance-25.png',
      // 2026-11-09：样片模型复用2.5官方图标，不增加会员钻石。
      'Seedance 2.5 样片模式': './assets/canvas-ui-reference/seedance-25.png',
      'Seedance 2.0': './assets/canvas-ui-reference/seedance-20.png',
      'Seedance 2.0 fast': './assets/canvas-ui-reference/seedance-20-fast.png',
      'Seedance 2.0 mini': './assets/canvas-ui-reference/seedance-20-mini.png',
      'VinaAnime 1.0': './assets/canvas-ui-reference/vinaanime-10.png',
      'Wan 3.0': './assets/canvas-ui-reference/wan-30.png',
      'Kling v3 Omni': './assets/images/model-kling.png',
      'Seedream 5.0 lite': './assets/images/model-seedance.png',
      'Gpt Image 2': './assets/images/model-gpt.png',
      'Nano Banana 2': './assets/images/model-banana.png',
      'Nano Banana pro': './assets/images/model-banana.png'
    };
    function applyLogo(element, model) {
      var source = sourceLogos[model];
      if (!element) return;
      if (!source) {
        if (element.hasAttribute('data-ui-model-logo')) {
          element.removeAttribute('data-ui-model-logo');
          element.style.removeProperty('--vina-model-logo');
        }
        return;
      }
      // 2026-11-03 资源修正：自定义属性中的相对 URL 会按消费它的 CSS 文件解析，
      // 原 ./assets/... 因此被误拼为 /assets/assets/...；以嵌入页面 baseURI 生成完整 URL。
      source = new URL(source, document.baseURI).href;
      if (element.getAttribute('data-ui-model-logo') === source) return;
      element.setAttribute('data-ui-model-logo', source);
      element.style.setProperty('--vina-model-logo', 'url("' + source + '")');
    }
    function syncLogos() {
      if (modelMenu) modelMenu.querySelectorAll('[data-node-param-key="model"]').forEach(function (option) {
        applyLogo(option.querySelector('.model-icon'), option.getAttribute('data-node-param-value'));
      });
      if (modelLabel) applyLogo(modelTrigger, modelLabel.textContent.trim());
    }
    // 2026-11-03 会员规则说明：以下“点击模型整行进入套餐页”仅针对非会员。
    // Kling v3 Omni 非会员可直接选择，不显示钻石；其余带钻石模型对会员仍沿用原选择逻辑。
    // 2026-11-09 Product Design：确认卡与画布共用会员模型判定；各自菜单首项沿用原免费规则，Kling 始终免会员限制。
    function canvasModelNeedsMembership(option) {
      if (!option) return false;
      var menu = option.closest('#nodeModelMenu, .generation-param-controls .model-menu');
      if (!menu) return false;
      var value = String(option.getAttribute('data-node-param-value') || option.getAttribute('data-generation-param-value') || '').trim();
      // 2026-11-12：Wan 3.0 是画布和确认卡的免会员默认模型，资格独立于菜单顺序。
      if (['wan 3.0', 'kling v3 omni', 'seedance 2.5 样片模式'].includes(value.toLowerCase())) return false;
      var options = Array.from(menu.querySelectorAll('[data-node-param-key="model"], [data-generation-param-key="model"]'));
      return options.indexOf(option) > 0;
    }
    function canvasHasMembership() {
      var host = window;
      try {
        if (window.parent && window.parent.document) host = window.parent;
      } catch (error) { /* 跨源独立画布继续读取当前窗口的共享会话状态。 */ }
      try {
        // 2026-11-12：实时读取父页当前账号，团队版各档位均可使用会员模型，个人版继续读取个人资格。
        if (host.document.querySelector('.global-account.is-team-account')) return true;
        if (typeof host.vinaMembershipEligibility === 'function') {
          var eligibility = host.vinaMembershipEligibility('personal');
          if (eligibility && typeof eligibility.active === 'boolean') return eligibility.active;
        }
        var subscription = host.vinaPersonalMembershipState && host.vinaPersonalMembershipState.read();
        if (!subscription) {
          subscription = JSON.parse(window.sessionStorage.getItem('vina-personal-membership-subscription') || 'null');
        }
        if (subscription && subscription.plan) {
          var plan = String(subscription.plan).trim().toUpperCase();
          return ['FREE', '免费版', '免费', '非会员'].indexOf(plan) < 0;
        }
        // 与现有个人会员卡保持一致，兼容已有个人等级标签。
        var tier = host.document.querySelector('.profile-popover-personal-tier');
        var label = tier ? tier.textContent.trim().toUpperCase() : '';
        return Boolean(label && ['FREE', '免费版', '免费', '非会员'].indexOf(label) < 0);
      } catch (error) {
        return false;
      }
    }
    // 2026-11-07 Product Design：非会员点击会员模型立即进入个人订阅页，不再等待画布 Toast。
    // 提示原因交给会员页，在全屏 dialog 内显示公共 Toast 外观，避免被宿主弹窗遮住。
    function openCanvasMembershipPlans() {
      var host = window;
      try { if (window.parent && window.parent.document) host = window.parent; } catch (error) { /* 使用独立画布入口。 */ }
      if (typeof host.openVinaMembershipPage === 'function') {
        host.openVinaMembershipPage('personal', window.frameElement || modelTrigger, { notice: 'model-membership-required' });
        return;
      }
      // 独立画布没有全屏会员入口时，直接导航并让目标页消费提示标记。
      var destination = new URL('./membership.html', document.baseURI);
      // 2026-11-12：独立画布跳转时也让会员页沿用当前语言。
      destination.searchParams.set('lang', host.vinaPageLanguage?.get() || host.document.documentElement.lang || 'zh-CN');
      destination.searchParams.set('notice', 'model-membership-required');
      window.top.location.href = destination.href;
    }
    // 2026-11-09 Product Design：向确认卡公开同一判定和订阅入口，避免两处资格状态、免费模型或跳转规则分叉。
    window.vinaCanvasModelMembership = Object.freeze({
      needsMembership: canvasModelNeedsMembership,
      hasMembership: canvasHasMembership,
      openPlans: openCanvasMembershipPlans
    });
    // 非会员点击带会员标识的模型整行（图标、名称、副标题、空白处或钻石）立即打开会员套餐，由会员页提示。
    // 在 window 捕获阶段拦截，先于原 document 参数缓存和模型选择，避免非会员点击后偷偷切换模型。
    window.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      // 2026-11-09：确认卡模型整行也在同一个 window 捕获入口拦截，先于 document 原参数缓存，非会员不写入受限模型。
      var option = target.closest('#nodeModelMenu [data-node-param-key="model"], .generation-param-controls .model-menu [data-generation-param-key="model"]');
      var badge = target.closest('.canvas-model-membership-link');
      if (!option && badge && modelMenu && modelMenu.contains(badge)) option = badge.__vinaModelOption;
      if (!option) return;
      // 免费模型与已有会员继续原模型选择逻辑；非会员不会写入受限模型值。
      if (!canvasModelNeedsMembership(option) || canvasHasMembership()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // 确认卡 top layer 菜单先收起，再打开原订阅页面；保留卡片提示词与原选中模型，返回后可继续操作。
      var card = option.closest('.generation-card');
      if (card) {
        if (typeof closeGenerationParamMenus === 'function') closeGenerationParamMenus(card);
        card.querySelectorAll('.node-param-menu[popover]').forEach(function (menu) {
          if (menu.matches(':popover-open')) menu.hidePopover();
        });
      }
      openCanvasMembershipPlans();
    }, true);

    // 绿色钻石仅作现有会员要求的视觉标识；独立链接避免在模型 button 内嵌套交互控件。
    function syncMembershipBadges() {
      if (!modelMenu || !modelMenu.offsetWidth) return;
      var options = Array.from(modelMenu.querySelectorAll('[data-node-param-key="model"]'));
      modelMenu.querySelectorAll('.canvas-model-membership-link').forEach(function (link) {
        if (options.indexOf(link.__vinaModelOption) < 0 || !canvasModelNeedsMembership(link.__vinaModelOption)) link.remove();
      });
      var menuRect = modelMenu.getBoundingClientRect();
      options.forEach(function (option) {
        if (!canvasModelNeedsMembership(option)) return;
        var name = option.querySelector('.model-name');
        if (!name) return;
        var link = Array.from(modelMenu.querySelectorAll('.canvas-model-membership-link')).find(function (item) {
          return item.__vinaModelOption === option;
        });
        if (!link) {
          link = document.createElement('a');
          link.className = 'canvas-model-membership-link';
          link.href = new URL('./membership.html', document.baseURI).href;
          link.target = '_top';
          link.__vinaModelOption = option;
          link.setAttribute('aria-label', name.textContent.trim() + '需要会员，非会员点击查看会员套餐');
          link.title = '需要会员；非会员点击查看套餐';
          link.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            // 非会员由前面的捕获监听器进入套餐；会员点击钻石也按点击模型整行处理，正常选择模型。
            if (canvasHasMembership() && option.isConnected) option.click();
            else if (!canvasHasMembership()) openCanvasMembershipPlans();
          });
          modelMenu.appendChild(link);
        }
        var nameRect = name.getBoundingClientRect();
        setPixel(link, 'left', nameRect.right - menuRect.left + modelMenu.scrollLeft - modelMenu.clientLeft + 5);
        setPixel(link, 'top', nameRect.top - menuRect.top + modelMenu.scrollTop - modelMenu.clientTop + (nameRect.height - 20) / 2);
      });
    }
    // 2026-11-03 Product Design：底部按钮仅隐藏可见标签，保留当前 Skill、风格和模式的辅助名称。
    // 只读取既有标签设置悬停说明，不替换或修改任何点击处理器。
    function syncChatActionDescriptions() {
      [
        ['canvasSkillTrigger', 'canvasSelectedSkillLabel', '选择 Skill'],
        ['canvasStyleTrigger', 'canvasSelectedStyleLabel', '选择风格'],
        ['autoModeTrigger', 'autoModeLabel', '生成模式']
      ].forEach(function (item) {
        var button = document.getElementById(item[0]);
        var label = document.getElementById(item[1]);
        if (!button) return;
        var current = label ? label.textContent.trim() : '';
        var description = item[2] + (current ? '：' + current : '');
        if (button.getAttribute('aria-label') !== description) button.setAttribute('aria-label', description);
        if (button.title !== description) button.title = description;
      });
    }
    // 2026-11-03 Product Design：左侧素材行只展示已经生成或已有实际媒体的选中节点。
    // 仅标记缩略图和容器的可见性，不改 selectedNodes、画布选中态、引用数据或发送逻辑。
    function selectedNodeHasMedia(node) {
      if (!node || !node.isConnected) return false;
      // 2026-11-05 Product Design：文本也是可添加到对话的参考素材，不能因没有媒体缩略图而隐藏；其他节点继续原可用媒体判断。
      if (node.classList.contains('vina-markdown-node')) return true;
      var thumb = node.querySelector('.thumb');
      if (!thumb) return false;
      var status = String(node.dataset.generationStatus || '').toLowerCase();
      // 空节点的默认图标也是背景图片，先排除占位/生成中/失败态，避免把图标当成实际素材。
      if (thumb.classList.contains('blank') || thumb.classList.contains('generating')
        || thumb.classList.contains('failed') || node.classList.contains('generating')
        || status === 'generating' || status === 'uploading' || status === 'failed'
        || node.dataset.generationFailure) return false;
      if (status === 'completed') return true;
      if (String(node.dataset.generatedMediaSource || '').trim()) return true;
      var media = Array.from(thumb.querySelectorAll('img, video, audio'));
      if (media.some(function (element) {
        if (String(element.getAttribute('src') || '').trim()) return true;
        return Array.from(element.querySelectorAll('source[src]')).some(function (source) {
          return Boolean(String(source.getAttribute('src') || '').trim());
        });
      })) return true;
      // 原项目图片及资产库图片可能仅使用 CSS 背景，继续识别真实图片地址；音乐装饰封面不作为素材依据。
      var type = String(node.dataset.nodeType || node.dataset.generationType || '').toLowerCase();
      if (type === 'image' || thumb.classList.contains('image') || thumb.classList.contains('portrait-thumb')) {
        var background = thumb.style.backgroundImage || getComputedStyle(thumb).backgroundImage;
        return /url\(/i.test(background || '');
      }
      return false;
    }
    // 2026-11-07 Product Design 修复：清空引用按钮移到原 composer 表面，避开横向素材托盘裁切。
    // 移动原按钮对象而非克隆，保留其 ID、原 clearSelection 监听器以及其他模式的引用同步事件。
    function ensureChatReferenceClearButton() {
      var button = document.getElementById('selectedNodeClear');
      var surface = document.querySelector('.chat .composer');
      if (!button || !surface) return;
      if (button.parentElement !== surface) surface.appendChild(button);
      if (!button.querySelector('.canvas-agent-clear-reference-icon')) {
        // 使用 ego 捕获的原始 SVG 图像，以 data URL 内嵌，兼容本地 file 页面并避免外部 mask 加载失败。
        var icon = document.createElement('img');
        icon.className = 'canvas-agent-clear-reference-icon';
        icon.src = 'data:image/svg+xml;base64,PCEtLSAyMDI2LTExLTA3IFByb2R1Y3QgRGVzaWdu77ya5p2l6IeqIGVnbyDlj4LogIPpobXnmoTmuIXnqbrlvJXnlKjlm77moIfvvIzku4Xmm7/mjaLmjInpkq7lpJbop4LjgIIgLS0+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBmaWxsPSIjOUFBNkIyIiB2aWV3Qm94PSIwIDAgMjQgMjAiIGZvY3VzYWJsZT0iZmFsc2UiIGFyaWEtaGlkZGVuPSJ0cnVlIj48cGF0aCBkPSJNMTkuMDAxIDBIOS45NTdhNSA1IDAgMCAwLTMuOTQ2IDEuOTMxTC4yMTEgOS4zODZhMSAxIDAgMCAwIDAgMS4yMjhsNS44IDcuNDU1QTUgNSAwIDAgMCA5Ljk1NyAyMGg5LjA0NEE1LjAwNiA1LjAwNiAwIDAgMCAyNCAxNVY1YTUuMDA2IDUuMDA2IDAgMCAwLTQuOTk5LTVabTMgMTVhMyAzIDAgMCAxLTMgM0g5Ljk1N2EzIDMgMCAwIDEtMi4zNjgtMS4xNThMMi4yNjggMTBsNS4zMjEtNi44NDJBMyAzIDAgMCAxIDkuOTU3IDJoOS4wNDRhMyAzIDAgMCAxIDMgM3YxMFptLTQuNzkzLTYuNzkzTDE1LjQxNSAxMGwxLjc5MyAxLjc5M2ExIDEgMCAwIDEtMS40MTQgMS40MTRsLTEuNzkzLTEuNzkzLTEuNzkzIDEuNzkzYTEgMSAwIDAgMS0xLjQxNC0xLjQxNEwxMi41ODcgMTBsLTEuNzkzLTEuNzkzYTEgMSAwIDAgMSAxLjQxNC0xLjQxNGwxLjc5MyAxLjc5MyAxLjc5My0xLjc5M2ExIDEgMCAwIDEgMS40MTQgMS40MTRaIj48L3BhdGg+PC9zdmc+';
        icon.alt = '';
        icon.draggable = false;
        icon.setAttribute('aria-hidden', 'true');
        button.replaceChildren(icon);
      }
      if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', '清空全部节点引用');
    }
    function syncSelectedReferenceVisibility() {
      ensureChatReferenceClearButton();
      var row = document.getElementById('canvasChatReferenceRow');
      var tray = document.getElementById('selectedNodeTray');
      var list = document.getElementById('selectedNodeList');
      if (!list) return;
      var visibleCount = 0;
      list.querySelectorAll('[data-selected-node-id]').forEach(function (chip) {
        var node = document.getElementById(chip.dataset.selectedNodeId || '');
        // 2026-11-05 Product Design：文本引用直接使用与历史记录同款的文档图片，替代本地页面可能无法加载的 CSS mask；缩略图和悬停预览都居中显示。
        var textReference = Boolean(node?.classList.contains('vina-markdown-node'));
        chip.toggleAttribute('data-canvas-text-reference', textReference);
        if (textReference) {
          chip.querySelectorAll('.selected-node-preview, .selected-node-popover-preview').forEach(function (preview) {
            // 托盘重绘后按需补图标，已有图标不重复创建，避免 MutationObserver 循环触发。
            if (preview.querySelector('img.vina-md-reference-icon')) return;
            var image = document.createElement('img');
            image.className = 'vina-md-reference-icon';
            image.src = new URL('./assets/icons/script-file.svg', document.baseURI).href;
            image.alt = '文本';
            image.draggable = false;
            preview.replaceChildren(image);
          });
        }
        var visible = selectedNodeHasMedia(node);
        chip.toggleAttribute('data-canvas-empty-reference', !visible);
        if (visible) visibleCount += 1;
      });
      if (tray) tray.toggleAttribute('data-canvas-no-media', visibleCount === 0);
      // 对话输入区直接上传的附件沿用原显示；多选时只隐藏空节点，保留其他已生成/上传的素材。
      if (row) {
        var uploaded = row.querySelector('.canvas-chat-image-strip .canvas-chat-image-card');
        row.toggleAttribute('data-canvas-no-media', visibleCount === 0 && !uploaded);
      }
    }
    function setPixel(element, key, value) {
      var pixel = Math.round(value * 100) / 100 + 'px';
      if (element.style[key] !== pixel) element.style[key] = pixel;
    }
    // 2026-11-07 Product Design 展示逻辑：复用既有选中类型给图片/视频浮层加局部样式标记。
    // 合成剪辑只是新增同一业务入口，点击转发给原菜单按钮，不复制或更改创建/剪辑逻辑。
    function syncMediaNodePresentation() {
      var selected = stage.querySelectorAll('.node.selected');
      var node = selected.length === 1 ? selected[0] : null;
      var thumb = node && node.querySelector('.thumb');
      var media = Boolean(thumb && !node.classList.contains('vina-markdown-node')
        && !node.classList.contains('clip-remake-node') && !node.classList.contains('libtv-composer-node')
        && (thumb.classList.contains('image') || thumb.classList.contains('video')
          || thumb.classList.contains('portrait-thumb') || node.dataset.nodeType === 'image'
          || node.dataset.nodeType === 'video'));
      [panel, actionBar].forEach(function (element) {
        if (element && element.classList.contains('vina-node-media-ui') !== media) element.classList.toggle('vina-node-media-ui', media);
      });
      if (!actionBar) return;
      var remake = actionBar.querySelector('[data-clip-remake]');
      if (remake && !actionBar.querySelector('.canvas-node-composition-button')) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'canvas-node-composition-button';
        button.setAttribute('aria-label', '合成剪辑');
        button.title = '合成剪辑';
        var image = document.createElement('img');
        image.src = new URL('./assets/canvas-ui-reference/menu-composition.svg', document.baseURI).href;
        image.alt = '';
        var label = document.createElement('span');
        label.textContent = '合成剪辑';
        button.append(image, label);
        button.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          var original = document.querySelector('#nodeTypeMenu [data-libtv-composer-action]');
          if (original) original.click();
        });
        remake.insertAdjacentElement('afterend', button);
      }
    }
    function placePanel() {
      if (document.body.classList.contains('vina-direct-mode') || !panel.classList.contains('active')) return;
      var selected = stage.querySelectorAll('.node.selected');
      if (selected.length !== 1 || !panel.offsetWidth) return;
      var node = selected[0];
      var media = node.querySelector('.thumb') || node;
      var nodeRect = media.getBoundingClientRect();
      var workspaceRect = workspace.getBoundingClientRect();
      var center = nodeRect.left - workspaceRect.left + nodeRect.width / 2;
      var margin = 18;
      // 浮层坐标使用实际呈现宽高，避免旧 620px 常量使参考页 698px 面板偏离节点中心。
      var left = Math.max(margin, Math.min(workspace.clientWidth - panel.offsetWidth - margin, center - panel.offsetWidth / 2));
      // 2026-11-09：样片生成后为两项tab预留54px，正片窄面板继续按实际宽高居中。
      var sampleGap = panel.classList.contains('seedance-has-draft') ? 54 : 0;
      var top = Math.max(margin + sampleGap, Math.min(workspace.clientHeight - panel.offsetHeight - margin, nodeRect.bottom - workspaceRect.top + 16 + sampleGap));
      setPixel(panel, 'left', left);
      setPixel(panel, 'top', top);
      // 2026-11-07 Product Design：已生成媒体工具条底边距节点 36px；空节点保留原 92px 顶部偏移。
      // 使用实际浮层宽高同步居中，跟随缩放、平移、展开和容器调整，只写展示坐标。
      if (actionBar && actionBar.classList.contains('active')
        && (actionBar.classList.contains('pending-asset-mode') || actionBar.classList.contains('vina-node-media-ui'))) {
        setPixel(actionBar, 'left', Math.max(12, Math.min(workspace.clientWidth - actionBar.offsetWidth - 12, center - actionBar.offsetWidth / 2)));
        var offset = actionBar.classList.contains('pending-asset-mode') ? 92 : actionBar.offsetHeight + 36;
        setPixel(actionBar, 'top', Math.max(12, nodeRect.top - workspaceRect.top - offset));
      }
    }
    var pending = 0;
    function schedule() {
      if (pending) return;
      pending = requestAnimationFrame(function () {
        pending = 0;
        syncLogos();
        syncContextMenuCopy();
        syncMediaNodePresentation();
        placePanel();
        syncMembershipBadges();
        syncChatActionDescriptions();
        syncSelectedReferenceVisibility();
      });
    }
    // 只读取原渲染结果：菜单重绘、节点缩放/平移、模式切换和容器尺寸变化后同步展示。
    // 2026-11-07：菜单打开、分支切换或原代码动态刷新说明后，再同步已确认的公共文案。
    // 修改前先比较原文，避免同样文字重复写入触发 MutationObserver 循环。
    var contextMenu = document.getElementById('nodeTypeMenu');
    if (contextMenu) new MutationObserver(schedule).observe(contextMenu, {
      childList: true, characterData: true, subtree: true,
      attributes: true, attributeFilter: ['style', 'data-mode']
    });
    var menuObserver = new MutationObserver(schedule);
    if (modelMenu) menuObserver.observe(modelMenu, { childList: true, subtree: true });
    if (modelLabel) menuObserver.observe(modelLabel, { childList: true, characterData: true, subtree: true });
    var chatActions = document.querySelector('.composer-left-actions');
    if (chatActions) menuObserver.observe(chatActions, { childList: true, characterData: true, subtree: true });
    // 菜单开关只改变原分组的 class；在展开后测量钻石位置，字体加载完成后再同步一次。
    var paramControls = document.getElementById('nodeParamControls');
    if (paramControls) menuObserver.observe(paramControls, { attributes: true, attributeFilter: ['class'], subtree: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    // 2026-11-07：视频进度条内部变化不改变节点几何，不再因每次播放进度更新重算浮层。
    // 节点选中、平移缩放、媒体替换和生成状态等变化继续触发原同步。
    var stageObserver = new MutationObserver(function (records) {
      var relevant = records.some(function (record) {
        var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        return !target || !target.closest('.video-player, .vina-video-node-controls');
      });
      if (relevant) schedule();
    });
    stageObserver.observe(stage, { attributes: true, attributeFilter: ['class', 'style', 'src', 'poster', 'data-generation-status', 'data-generation-failure', 'data-generated-media-source'], childList: true, subtree: true });
    // 原托盘重绘后，在浏览器绘制前同步显隐；生成完成、上传回填及附件增删时也由原 DOM 变化触发。
    var composer = document.querySelector('.chat .composer');
    if (composer) new MutationObserver(function () {
      syncSelectedReferenceVisibility();
    }).observe(composer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    syncSelectedReferenceVisibility();
    // 2026-11-07 闪动修复：原定位器与参考 UI 使用不同尺寸/间距；每次原浮层更新后，
    // 在 MutationObserver 的同一轮微任务中同步最终坐标，避免把旧坐标绘制一帧后再跳回参考位置。
    // placePanel 的 setPixel 仅在坐标变化时写入，因此自身观察回调会收敛，不形成定位循环。
    var modeObserver = new MutationObserver(function () {
      syncMediaNodePresentation();
      placePanel();
      schedule();
    });
    modeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    modeObserver.observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });
    // 2026-11-07：监听原工具条延迟安装的按钮，确保合成入口在重拍入口就绪后接入。
    if (actionBar) modeObserver.observe(actionBar, { attributes: true, attributeFilter: ['class'], childList: true });
    var dimensions = new ResizeObserver(schedule);
    dimensions.observe(workspace);
    dimensions.observe(panel);
    if (actionBar) dimensions.observe(actionBar);
    window.addEventListener('resize', schedule);
    var stylesheet = document.querySelector('link[data-canvas-workbench-reference]');
    if (stylesheet) stylesheet.addEventListener('load', schedule, { once: true });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
