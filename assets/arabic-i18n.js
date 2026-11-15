/* 2026-10-25 Product Design / 阿拉伯语改动逻辑：
 * 仅 ar 激活；html 保持 LTR 结构；阿语主侧栏和短剧第四/五步通过局部 CSS 镜像布局，画布与媒体坐标保持原方向。
 * 2026-10-25 完整适配：接入 Shadow DOM；内置剧本、角色、示例消息与标题按词典翻译。
 * 用户输入值和 data 业务值不改；可编辑正文发生真实输入后停止替换，并保留用户编辑结果。
 * 文本原文和属性逐节点保存；退出 ar 先恢复，再交回既有五语言逻辑，动态重绘和同源 iframe 同步处理。
 * 2026-10-25 性能修复：仅在当前控件激活时恢复该控件原文，操作后只同步该局部；不在按下、拖动或普通按键时重译整页。
 * 动态记录先收集再暂停观察器；属性变更只处理属性，重复/嵌套节点合并，原文读取不依赖整页恢复。
 * Arabic 仅在文本叶节点、表格单元格与输入框使用 RTL/auto；数字、URL、模型、媒体与坐标保持原方向。
 */
(() => {
  'use strict';
  if (window.VinaArabic) return;
  try {
    if (window.parent !== window && window.parent.VinaArabic) {
      window.parent.VinaArabic.attach(document);
      return;
    }
  } catch (_) { /* 非同源宿主保持本页独立。 */ }

  const dictionary = window.VinaArabicCopy;
  if (!dictionary) return;
  // 2026-10-25 Product Design 缓存逻辑：加载首页精选示例标题/分类靠右的新样式，翻译及其他 RTL 规则继续复用。
  // 2026-10-25 Product Design 缓存逻辑：同步短剧第四/五步局部镜像，沿用其他页面的语言与显隐状态。
  // 2026-10-26 Product Design 缓存逻辑：加载短剧及全能创作右侧 Agent 分栏，其他语言沿用原布局。
  const cssUrl = new URL('arabic.css?v=20261026-agent-panel-right', document.currentScript.src).href;
  const texts = Object.assign(Object.create(null), dictionary.texts);
  const englishSources = Object.assign(Object.create(null), dictionary.englishSources);
  const compact = new Map(dictionary.compact.map(item => [item.source, item]));
  const compactByShort = new Map(dictionary.compact.map(item => [item.short, item]));
  // 词典只读：缓存重复文案与模板结果，避免每次局部刷新重新匹配全部规则。
  const translationCache = new Map();
  const controllers = new Map();
  const frames = new Map();
  let enabled = false;

  // 内置正文也需要本地化；只有技术内容、用户明确编辑的内容和输入值跳过。
  const ignored = 'script,style,noscript,svg,math,code,pre,textarea,[translate="no"],[data-vina-i18n="off"],[data-page-language],[data-user-content],[data-vina-user-edited]';

  // 生成模式和确认按钮已有独立多语言状态机；只给它们新增 ar，不由通用观察器竞争写入。
  // 2026-10-27 Product Design：全量生成及资产流程按钮由独立六语言适配器管理，阿语切入/恢复时均不竞争写入。
  // 2026-10-30：失败提示及按钮已有独立六语言翻译，阿语切入和恢复时均跳过该范围。
  // 2026-11-04 Product Design：生成成功和音色绑定提示由资产六语言适配器管理，阿语切入或恢复时不覆盖。
  const ownedByOtherI18n = '[data-character-generation-copy],[data-generation-failure-copy],#assetBatchOpen,#characterGenerateAll,.asset-stage-actions .asset-next,.home-generation-mode,.home-generation-mode-menu,.auto-mode-control,.auto-mode-menu,.creative-skip,[data-confirmation-continue]';
  const uiInMessage = 'button,input,select,[role="button"],.generation-card,.creative-direction-card,.confirmation-batch-card,.creative-direction-options,.confirmation-card,.drama-outline-card,.thinking';
  const textTags = /^(SPAN|P|H[1-6]|SMALL|STRONG|EM|B|I|LABEL|LEGEND|OPTION|TD|TH|BUTTON|A|SUMMARY|DIV|LI)$/;
  const numberField = /(?:code|captcha|phone|mobile|email|url|duration|count|quota|amount|credit|resolution|ratio)/i;
  const isolate = value => '\u2068' + value + '\u2069';
  const normalize = value => value.replace(/\s+/g, ' ').trim();

  function translate(value) {
    if (typeof value !== 'string') return value;
    if (translationCache.has(value)) return translationCache.get(value);
    const result = translateValue(value);
    if (value.length <= 512) {
      if (translationCache.size >= 4096) translationCache.clear();
      translationCache.set(value, result);
    }
    return result;
  }
  function translateValue(value) {
    if (typeof value !== 'string') return value;
    const source = value.trim();
    let result = texts[source] || texts[normalize(source)];
    if (!result && englishSources[source]) result = texts[englishSources[source]];
    if (result) return value.replace(source, result);
    let match;
    // 演示分镜的时长/镜头/场景按可见分隔符逐段翻译，数值保持原样。
    if (source.includes(' ｜ ')) {
      const parts = source.split(' ｜ '), localized = parts.map(translate);
      if (localized.some((part, index) => part !== parts[index])) return value.replace(source, localized.join(' · '));
    }
    if ((match = source.match(/^时长\s*(\d+)s$/))) return value.replace(source, `المدة ${isolate(match[1])} ث`);
    if (source.includes('\n')) {
      const lines = source.split('\n'), localized = lines.map(translate);
      if (localized.some((line, index) => line !== lines[index])) return value.replace(source, localized.join('\n'));
    }
    // 2026-10-25：完整词典未命中时补齐标签末尾冒号、@引用显示和已知形象后缀；不拆翻未知用户名称/文件路径。
    if (!result && source.startsWith('@') && texts[source.slice(1)]) result = '@' + texts[source.slice(1)];
    if (!result && (match = source.match(/^([^：:]+)[：:]\s*$/)) && texts[match[1]]) result = texts[match[1]] + ':';
    if (!result && source.includes('-')) {
      const parts = source.split('-');
      if (parts.every(part => texts[part])) result = parts.map(part => texts[part]).join(' · ');
    }
    if (result) return value.replace(source, result);
    if (!result && (match = source.match(/^(\d+)\s*秒$/))) result = `${isolate(match[1])} ث`;
    else if ((match = source.match(/^(?:第\s*)?(\d+)\s*集$/))) result = `حلقة ${isolate(match[1])}`;
    else if ((match = source.match(/^共\s*(\d+)\s*集$/))) result = `الحلقات: ${isolate(match[1])}`;
    else if ((match = source.match(/^第\s*(\d+)\s*集\s*([：:·].+)$/))) result = `حلقة ${isolate(match[1])}: ${translate(match[2].replace(/^[：:·]\s*/, ''))}`;
    else if ((match = source.match(/^(片段|分镜)\s*(\d+)(.*)$/))) result = `${match[1] === '片段' ? 'مقطع' : 'لقطة'} ${isolate(match[2])}${match[3]}`;
    else if ((match = source.match(/^(\d+)\s*\/\s*页$/))) result = `${isolate(match[1])} / صفحة`;
    else if ((match = source.match(/^已选\s*(\d+)\s*人$/))) result = `المحدد: ${isolate(match[1])}`;
    else if ((match = source.match(/^(\d+)\s*条$/))) result = `الملاحظات: ${isolate(match[1])}`;
    else if ((match = source.match(/^至多\s*(\d+)\s*项$/))) result = `حتى ${isolate(match[1])}`;
    else if ((match = source.match(/^(\d+)\s*个(角色|场景|物品|形象)(.*)$/))) result = `${translate(match[2])}: ${isolate(match[1])}${translate(match[3])}`;
    else if ((match = source.match(/^(图片历史|视频历史)\s*\((\d+)\)$/))) result = `${match[1] === '图片历史' ? 'الصور' : 'الفيديو'} (${isolate(match[2])})`;
    else if ((match = source.match(/^(已生成分镜片段|已生成完成集数|已审核通过集数)\s*(\d+\/\d+)$/))) result = `${texts[match[1]]} ${isolate(match[2])}`;
    else if ((match = source.match(/^(.+?)，至多选择\s*(\d+)\s*项$/)) && texts[match[1]]) result = `${texts[match[1]]}، حتى ${isolate(match[2])}`;
    else if ((match = source.match(/^(.+?)风格预览$/))) {
      const name = texts[match[1]] || texts[match[1] + '风格'];
      if (name) result = `معاينة ${name}`;
    }
    else if ((match = source.match(/^(.*?)，?消耗\s*(\d+)\s*积分$/))) {
      const action = texts[match[1]] || ({'更新人物站位图':'تحديث مواقع الشخصيات','提交片段重拍':'إعادة تصوير','生成分镜预览图':'إنشاء معاينة المشاهد'})[match[1]];
      if (action) result = `${action} · ${isolate(match[2])} نقطة`;
    }
    else if ((match = source.match(/^需要消耗\s*(\d+)\s*积分$/))) result = `${isolate(match[1])} نقطة`;
    else if ((match = source.match(/^当前时间\s*(\d{2}:\d{2}(?::\d{2})?)$/))) result = `الوقت ${isolate(match[1])}`;
    else if ((match = source.match(/^团队ID[:：]\s*(.+)$/))) result = `معرّف الفريق: ${isolate(match[1])}`;
    else if ((match = source.match(/^团队总共剩余可分配积分[:：]\s*([\d,]+)$/))) result = `المتاح للتوزيع: ${isolate(match[1])}`;
    else if ((match = source.match(/^验证码\s+(.+)$/))) result = `رمز التحقق ${isolate(match[1])}`;
    else if ((match = source.match(/^创建于\s+(.+)$/))) result = `أُنشئ في ${isolate(match[1])}`;
    else if ((match = source.match(/^(.+)头像(?:，点击编辑团队资料)?$/))) result = `صورة ${isolate(match[1])}`;
    else if ((match = source.match(/^播放第\s*(\d+)\s*集[：:].+$/))) result = `تشغيل الحلقة ${isolate(match[1])}`;
    else if ((match = source.match(/^(删除|移除)\s*(.+?)(参考图|音色)$/))) result = `${match[1] === '删除' ? 'حذف' : 'إزالة'} ${match[3] === '音色' ? 'صوت' : 'مرجع'} ${isolate(match[2])}`;
    else if ((match = source.match(/^(取消收藏|收藏|删除)(.+)$/))) result = `${texts[match[1]]} ${translate(match[2]) === match[2] ? isolate(match[2]) : translate(match[2])}`;
    else if ((match = source.match(/^(关闭|选择|添加|移除|编辑)(.+)$/)) && texts[match[2]]) result = `${({'关闭':'إغلاق','选择':'اختيار','添加':'إضافة','移除':'إزالة','编辑':'تعديل'})[match[1]]} ${texts[match[2]]}`;
    else if ((match = source.match(/^(\d{4})年\s*(\d+)月\s*(\d+)日$/))) result = isolate(`${match[1]}/${match[2]}/${match[3]}`);
    else if ((match = source.match(/^(\d{4})年\s*(\d+)月$/))) result = isolate(`${match[1]}/${match[2]}`);
    else if ((match = source.match(/^([^：:]+)[：:]\s*(.+)$/)) && texts[match[1]]) result = `${texts[match[1]]}: ${translate(match[2])}`;
    else if ((match = source.match(/^(\S+)\s{2,}(.+)$/)) && texts[match[1]]) result = `${texts[match[1]]}: ${translate(match[2])}`;
    else if ((match = source.match(/^[·•]\s*(.+)$/))) { const inner = translate(match[1]); if (inner !== match[1]) result = '• ' + inner; }
    else if ((match = source.match(/^(\d+)岁$/))) result = `${isolate(match[1])} عامًا`;
    else if ((match = source.match(/^第\s*(\d+)\s*场$/))) result = `المشهد ${isolate(match[1])}`;
    else if ((match = source.match(/^来自 EP(\d+) 的尾钩$/))) result = `من ختام الحلقة ${isolate(match[1])}`;
    else if ((match = source.match(/^插入到第\s*(\d+)\s*(集|场)(前|后)$/))) result = `إدراج ${match[3] === '前' ? 'قبل' : 'بعد'} ${match[2] === '集' ? 'الحلقة' : 'المشهد'} ${isolate(match[1])}`;
    else if ((match = source.match(/^形象\s*(\d+)$/))) result = `المظهر ${isolate(match[1])}`;
    else if ((match = source.match(/^\/\s*8\s*项\s*·\s*(\d+)\s*项自动匹配$/))) result = `/8 · تلقائي ${isolate(match[1])}`;
    else if ((match = source.match(/^已设定\s*(\d+)\s*\/\s*8\s*项\s*·\s*(\d+)\s*项自动匹配$/))) result = `المحدد ${isolate(match[1])}/8 · تلقائي ${isolate(match[2])}`;
    else if ((match = source.match(/^(设置|自定义|输入未列出的)(.+)$/)) && texts[match[2]]) result = `${({'设置':'إعداد','自定义':'تخصيص','输入未列出的':'إضافة'})[match[1]]} ${texts[match[2]]}`;
    else if (source.includes(' · ')) {
      const parts = source.split(' · ').map(translate);
      if (parts.some((part, i) => part !== source.split(' · ')[i])) result = parts.join(' · ');
    } else if (/[、,，]/.test(source)) {
      const parts = source.split(/[、,，]\s*/);
      if (parts.every(part => texts[part])) result = parts.map(part => texts[part]).join('، ');
    }
    return result ? value.replace(source, result) : value;
  }

  function readMap(element, attribute) {
    try { return JSON.parse(element.getAttribute(attribute) || '{}'); }
    catch (_) { return {}; }
  }

  function attach(scope) {
    const shadow = scope?.nodeType === 11 && !!scope.host;
    const doc = shadow ? scope.ownerDocument : scope;
    const contentRoot = shadow ? scope : doc?.body;
    if (!contentRoot || controllers.has(scope)) return;
    const scopeElement = shadow ? scope.host : doc.documentElement;
    const queryRoot = shadow ? scope : doc;
    const view = doc.defaultView;
    // 2026-10-26 Product Design：桌面端 Agent 分栏整体镜像后不再单独平移标题；
    // 窄屏保留原胶囊定位算法。rect 已包含上次平移，计算时先减去旧值。
    let headerShift = 0, headerObserver, headerFrame = 0;
    function positionCanvasHeader() {
      headerFrame = 0;
      const header = !shadow && doc.querySelector('body:not(:has(#character-asset-canvas-theme)) .chat > .chat-head');
      if (!active || !header) return;
      const rect = header.getBoundingClientRect();
      if (!rect.width) return;
      const mirroredPanel = view.innerWidth > 760 && header.closest('.content-frame');
      const next = mirroredPanel ? 0 : Math.max(0, view.innerWidth - (view.innerWidth <= 760 ? 12 : 24) - (rect.right - headerShift));
      if (Math.abs(next - headerShift) > 0.5) {
        headerShift = next;
        scopeElement.style.setProperty('--vina-ar-header-shift', next + 'px');
      }
    }
    function scheduleHeader() {
      if (!headerFrame) headerFrame = view.requestAnimationFrame(positionCanvasHeader);
    }
    function syncCanvasHeader(value) {
      if (shadow) return;
      if (value) {
        const header = doc.querySelector('body:not(:has(#character-asset-canvas-theme)) .chat > .chat-head');
        if (!header) return;
        view.addEventListener('resize', scheduleHeader);
        if (view.ResizeObserver && !headerObserver) {
          headerObserver = new view.ResizeObserver(scheduleHeader);
          headerObserver.observe(header);
          if (header.parentElement) headerObserver.observe(header.parentElement);
        }
        scheduleHeader();
      } else {
        view.removeEventListener('resize', scheduleHeader);
        headerObserver?.disconnect(); headerObserver = null;
        if (headerFrame) view.cancelAnimationFrame(headerFrame);
        headerFrame = 0; headerShift = 0;
        scopeElement.style.removeProperty('--vina-ar-header-shift');
        if (!scopeElement.getAttribute('style')) scopeElement.removeAttribute('style');
      }
    }
    const textRecords = new Map();
    const attrRecords = new Map();
    const valueRecords = new Map();
    const userInputs = new WeakSet();
    const elementRecords = new Map();
    let active = false, scheduled = false, guarding = false, originalLang, originalDir;
    const pendingRoots = new Set();
    const pendingAttributes = new Set();
    const pendingControls = new Set();
    let cleanupNeeded = false;
    function collect(records) {
      for (const record of records) {
        if (record.type === 'childList') {
          if (record.removedNodes.length) cleanupNeeded = true;
          record.addedNodes.forEach(node => { discover(node); if (active) pendingRoots.add(node); });
        } else if (active && record.type === 'attributes') pendingAttributes.add(record.target);
        else if (active) pendingRoots.add(record.target);
      }
      if (active && (pendingRoots.size || pendingAttributes.size)) schedule();
    }
    const observer = new view.MutationObserver(collect);
    const observe = () => observer.observe(contentRoot, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['placeholder','aria-label','title','alt','data-tooltip','data-placeholder']
    });
    // 暂停前取出业务更新，防止微任务先运行而丢失同一次点击创建的弹窗或 iframe。
    function pause(callback) {
      collect(observer.takeRecords());
      observer.disconnect();
      try { callback(); } finally { observe(); }
    }
    function setAttribute(element, name, value) {
      if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    }
    function remember(element) {
      if (!elementRecords.has(element)) elementRecords.set(element, {
        dir: element.hasAttribute('data-vina-ar-dir-source') ? readMap(element, 'data-vina-ar-dir-source').dir : element.getAttribute('dir')
      });
      return elementRecords.get(element);
    }
    function direction(element, value) {
      if (elementRecords.has(element) && element.getAttribute('dir') === value && element.dataset.vinaArDirection === value) return;
      const before = remember(element);
      setAttribute(element, 'data-vina-ar-dir-source', JSON.stringify(before));
      setAttribute(element, 'dir', value);
      setAttribute(element, 'data-vina-ar-direction', value);
    }
    function protectedElement(element) {
      return !element || !!element.closest(ignored) || !!element.closest(ownedByOtherI18n);
    }
    function protectedText(element) {
      const userBubble = element?.closest('.msg.user,.script-user-bubble,.episode-agent-message.user');
      if (userBubble && !['一个关于高中的科幻悬疑故事','在剧本中增加反转内容','请给我想个剧本创意'].includes(element.textContent.trim())) return true;
      const namedProject = element?.closest('.project-title,.project-name,.script-back-title');
      if (namedProject && !['西部世界','星辉高中','产品发布视频画布','未命名画布','未命名短剧','未命名项目','链接生视频','多选确认卡','海边重逢'].includes(element.textContent.trim())) return true;
      if (element?.closest('[data-script-chat-upload].has-file [data-script-chat-file-name]')) return true;
      return protectedElement(element);
    }
    function markText(element) {
      const hasOnlyInlineChildren = Array.from(element.children).every(child => /^(SPAN|B|STRONG|EM|SMALL|BR|IMG)$/.test(child.tagName));
      if (textTags.test(element.tagName) && (element.childElementCount === 0 || /^(P|TD|TH|LABEL|H[1-6])$/.test(element.tagName) && hasOnlyInlineChildren)) {
        direction(element, 'rtl');
        setAttribute(element, 'data-vina-ar-copy', '');
      }
    }
    function applyText(node) {
      const element = node.parentElement;
      let record = textRecords.get(node);
      // 已经显示正确译文时不再解析原文标记、搜索祖先或写入方向属性。
      if (record && node.nodeValue === record.output) return;
      if (!node.nodeValue.trim()) return;
      if (element?.closest(ownedByOtherI18n)) {
        const copy = compact.get(node.nodeValue.trim()) || compactByShort.get(node.nodeValue.trim());
        if (copy && (!element.hasAttribute('title') || element.hasAttribute('data-vina-ar-tooltip'))) {
          remember(element); setAttribute(element, 'data-vina-ar-tooltip', '');
          if (element.getAttribute('title') !== copy.full) element.setAttribute('title', copy.full);
        }
        return;
      }
      const voiceReference = element?.matches('.detail-reference-name') && /^音色[：:]/.test(node.nodeValue);
      if ((!voiceReference && protectedText(element)) || !node.nodeValue.trim()) return;
      const index = Array.prototype.indexOf.call(element.childNodes, node);
      const sources = readMap(element, 'data-vina-ar-text-source');
      let source = node.nodeValue;
      if (record && source === record.output) source = record.source;
      else if (!record && typeof sources[index] === 'string' && source === translate(sources[index])) source = sources[index];
      const output = translate(source);
      if (output === source) {
        // 业务将旧标签改为未知内容时，不用旧译文覆盖新状态。
        if (record || typeof sources[index] === 'string') {
          textRecords.delete(node); delete sources[index];
          if (element.hasAttribute('data-vina-ar-copy')) direction(element, 'auto');
          if (element.hasAttribute('data-vina-ar-tooltip')) { element.removeAttribute('title'); element.removeAttribute('data-vina-ar-tooltip'); }
        }
        if (Object.keys(sources).length) setAttribute(element, 'data-vina-ar-text-source', JSON.stringify(sources));
        else element.removeAttribute('data-vina-ar-text-source');
        return;
      }
      record = { source, output };
      textRecords.set(node, record);
      sources[index] = source;
      setAttribute(element, 'data-vina-ar-text-source', JSON.stringify(sources));
      if (node.nodeValue !== output) node.nodeValue = output;
      markText(element);
      if (element.tagName === 'TITLE') direction(element, 'rtl');
      // 短按钮保留完整语义的悬停提示；不改变原有 title 的业务值。
      const shorter = compact.get(source.trim());
      if (shorter && (!element.hasAttribute('title') || element.hasAttribute('data-vina-ar-tooltip'))) {
        remember(element);
        setAttribute(element, 'data-vina-ar-tooltip', '');
        if (element.getAttribute('title') !== shorter.full) element.setAttribute('title', shorter.full);
      } else if (!shorter && element.hasAttribute('data-vina-ar-tooltip')) {
        element.removeAttribute('title'); element.removeAttribute('data-vina-ar-tooltip');
      }
    }
    function applyAttributes(element) {
      if (!element.matches || element.closest('script,style,svg,[translate="no"],[data-vina-i18n="off"],[data-page-language]') || element.closest(ownedByOtherI18n)) return;
      let records = attrRecords.get(element);
      const sources = readMap(element, 'data-vina-ar-attr-source');
      ['placeholder','aria-label','title','alt','data-tooltip','data-placeholder'].forEach(name => {
        if (!element.hasAttribute(name) || name === 'title' && element.hasAttribute('data-vina-ar-tooltip')) return;
        let source = element.getAttribute(name);
        const previous = records?.[name];
        if (previous && source === previous.output) source = previous.source;
        else if (!previous && typeof sources[name] === 'string' && source === translate(sources[name])) source = sources[name];
        const output = translate(source);
        if (output === source) { if (records) delete records[name]; delete sources[name]; return; }
        if (!records) { records = {}; attrRecords.set(element, records); }
        records[name] = { source, output };
        sources[name] = source;
        if (element.getAttribute(name) !== output) element.setAttribute(name, output);
      });
      if (Object.keys(sources).length) setAttribute(element, 'data-vina-ar-attr-source', JSON.stringify(sources));
      else element.removeAttribute('data-vina-ar-attr-source');
      // 仅本地化未编辑的内置音色示例值；用户键入内容与所有业务参数值保持不变。
      if (element.matches('textarea') && element.closest('.drama-voice-field') && !userInputs.has(element)) {
        const previous = valueRecords.get(element);
        const source = previous?.source ?? element.defaultValue;
        const output = translate(source);
        if (source && output !== source && (element.value === source || element.value === previous?.output)) {
          valueRecords.set(element, { source, output });
          if (element.value !== output) element.value = output;
        }
      }
      // 输入值按内容识别方向。邮箱/地址/时长等技术数据始终 LTR。
      if (element.matches('input:not([type="hidden"]):not([type="file"]),textarea,[contenteditable]:not([contenteditable="false"])')) {
        if (!element.hasAttribute('data-vina-i18n') || element.dataset.vinaI18n !== 'off') {
          const fixed = /^(email|url|tel|number|range|date|time|datetime-local|password)$/.test(element.type || '') || numberField.test(element.id + ' ' + element.name) || /^(SKILL\.md|https?:)/.test(element.getAttribute('placeholder') || '');
          direction(element, fixed ? 'ltr' : 'auto');
          setAttribute(element, 'data-vina-ar-input', '');
        }
      }
      if (element.matches('[contenteditable="true"],.editable-content,.card-copy,.episode-outline-copy,.script-scene-line-copy,.script-scene-card-body,.script-story-summary,.script-world-building')) direction(element, 'auto');
      if (element.matches('.msg.ai') && element.childElementCount === 0) direction(element, 'auto');
      if (element.matches('.msg.user,.script-user-bubble,.script-ai-text,.episode-agent-message-text,.project-title,.episode-name,.detail-prompt-input,.generation-prompt,.generation-prompt-text,.confirmation-batch-option-label,.confirmation-batch-option-description,.detail-mention-token,.script-mention-token,.node-mention,.mention-chip')) direction(element, 'auto');
    }
    function walk(root) {
      if (!root || !root.isConnected && root !== contentRoot) return;
      if (root.nodeType === 11) { Array.from(root.childNodes).forEach(walk); return; }
      if (root.nodeType === 3) { applyText(root); return; }
      if (root.shadowRoot) attach(root.shadowRoot);
      if (root.nodeType !== 1 || root.matches('script,style,noscript,svg,math')) return;
      applyAttributes(root);
      // 使用快照遍历，不替换 innerHTML，也不拆开阿拉伯字符，保留控件和监听器。
      Array.from(root.childNodes).forEach(walk);
    }
    function cleanup() {
      for (const node of textRecords.keys()) if (!node.isConnected) textRecords.delete(node);
      for (const element of attrRecords.keys()) if (!element.isConnected) attrRecords.delete(element);
      for (const element of elementRecords.keys()) if (!element.isConnected) elementRecords.delete(element);
      for (const element of valueRecords.keys()) if (!element.isConnected) valueRecords.delete(element);
    }
    function sync(all = false) {
      if (!active || guarding) return;
      collect(observer.takeRecords());
      scheduled = false;
      const roots = all ? [contentRoot] : Array.from(pendingRoots).filter(root => {
        // 同批更新同时包含父子节点时，只遍历父节点一次。
        for (let parent = root.parentNode; parent; parent = parent.parentNode) if (pendingRoots.has(parent)) return false;
        return true;
      });
      const attributes = all ? [] : Array.from(pendingAttributes);
      pendingRoots.clear(); pendingAttributes.clear();
      if (all) discover(contentRoot);
      if (roots.length || attributes.length) pause(() => {
        roots.forEach(walk);
        attributes.forEach(element => { if (element.isConnected) applyAttributes(element); });
      });
      // 只在业务移除节点后清理记录，不因普通按钮点击遍历全部翻译缓存。
      if (cleanupNeeded) { cleanup(); cleanupNeeded = false; }
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      // 以短任务合并动态重绘，让既有观察器先完成摘要；隐藏 iframe 同样能同步，避免微任务相互写入。
      view.setTimeout(() => { scheduled = false; sync(); }, 16);
    }
    function restoreValues() {
      valueRecords.forEach((record, element) => { if (element.value === record.output && !userInputs.has(element)) element.value = record.source; });
      textRecords.forEach((record, node) => {
        if (node.isConnected && node.nodeValue === record.output) node.nodeValue = record.source;
      });
      // 克隆节点会携带原文标记，退出语言或处理点击时也恢复尚未来得及被观察器登记的副本。
      queryRoot.querySelectorAll('[data-vina-ar-text-source]').forEach(element => {
        Object.entries(readMap(element, 'data-vina-ar-text-source')).forEach(([index, source]) => {
          const node = element.childNodes[Number(index)];
          if (node?.nodeType === 3 && !textRecords.has(node) && node.nodeValue === translate(source)) node.nodeValue = source;
        });
      });
      queryRoot.querySelectorAll('[data-vina-ar-attr-source]').forEach(element => {
        if (attrRecords.has(element)) return;
        Object.entries(readMap(element, 'data-vina-ar-attr-source')).forEach(([name, source]) => {
          if (element.getAttribute(name) === translate(source)) element.setAttribute(name, source);
        });
      });
      attrRecords.forEach((records, element) => {
        if (!element.isConnected) return;
        Object.entries(records).forEach(([name, record]) => {
          if (element.getAttribute(name) === record.output) element.setAttribute(name, record.source);
        });
      });
    }
    function restore() {
      if (!active) return;
      active = false; guarding = false;
      syncCanvasHeader(false);
      pendingRoots.clear(); pendingAttributes.clear(); pendingControls.clear();
      pause(() => {
        restoreValues();
        queryRoot.querySelectorAll('[data-vina-ar-dir-source]').forEach(remember);
        elementRecords.forEach((record, element) => {
          if (element.dataset.vinaArDirection === element.getAttribute('dir')) {
            if (record.dir == null) element.removeAttribute('dir');
            else element.setAttribute('dir', record.dir);
          }
          if (element.hasAttribute('data-vina-ar-tooltip')) element.removeAttribute('title');
          ['data-vina-ar-copy','data-vina-ar-direction','data-vina-ar-dir-source','data-vina-ar-input','data-vina-ar-tooltip'].forEach(name => element.removeAttribute(name));
        });
        queryRoot.querySelectorAll('[data-vina-ar-text-source],[data-vina-ar-attr-source]').forEach(element => {
          element.removeAttribute('data-vina-ar-text-source');
          element.removeAttribute('data-vina-ar-attr-source');
        });
        scopeElement.removeAttribute('data-vina-ar');
        if (scopeElement.getAttribute('dir') === 'ltr') {
          if (originalDir == null) scopeElement.removeAttribute('dir');
          else scopeElement.setAttribute('dir', originalDir);
        }
        // 主页面语言由既有切换器负责；子文档仅恢复自己的原语言。
        if ((shadow || doc !== document) && scopeElement.lang === 'ar') {
          if (originalLang == null) scopeElement.removeAttribute('lang');
          else scopeElement.setAttribute('lang', originalLang);
        }
      });
      textRecords.clear(); attrRecords.clear(); elementRecords.clear(); valueRecords.clear();
    }
    function activate() {
      if (active) { sync(true); syncCanvasHeader(true); return; }
      active = true;
      originalLang = scopeElement.getAttribute('lang');
      originalDir = scopeElement.getAttribute('dir');
      scopeElement.dataset.vinaAr = '';
      scopeElement.setAttribute('dir', 'ltr');
      if (shadow || doc !== document) scopeElement.lang = 'ar';
      if (!queryRoot.querySelector('#vina-arabic-styles')) {
        const link = doc.createElement('link');
        link.id = 'vina-arabic-styles'; link.rel = 'stylesheet';
        // 2026-10-26 缓存逻辑：Shadow DOM 同步刷新设定页镜像版本；两个样式表都由阿语标记控制生效。
        link.href = shadow ? new URL('arabic-shadow.css?v=20261026-rtl-components', cssUrl).href : cssUrl;
        (shadow ? scope : doc.head).append(link);
      }
      sync(true);
      syncCanvasHeader(true);
    }
    // 兼容旧控件读取自身 textContent：只还原命中的按钮/选项，其他页面译文保持不动。
    // 依赖跨控件数据的业务直接调用 sourceText；无需先恢复整个页面再读取。
    function restoreControl(root) {
      function visit(node) {
        if (node.nodeType === 3) {
          const record = textRecords.get(node);
          if (record && node.nodeValue === record.output) node.nodeValue = record.source;
          return;
        }
        if (node.nodeType !== 1 || node.matches('script,style,noscript,svg,math')) return;
        const sources = readMap(node, 'data-vina-ar-text-source');
        Object.entries(sources).forEach(([index, source]) => {
          const child = node.childNodes[Number(index)];
          if (child?.nodeType === 3 && !textRecords.has(child) && child.nodeValue === translate(source)) child.nodeValue = source;
        });
        const records = attrRecords.get(node);
        if (records) Object.entries(records).forEach(([name, record]) => {
          if (node.getAttribute(name) === record.output) node.setAttribute(name, record.source);
        });
        Array.from(node.childNodes).forEach(visit);
      }
      visit(root);
    }
    function canonicalEvent(event) {
      if (!active) return;
      const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
      if (!target) return;
      // Tab/Escape、输入、滚轮和拖动不触发翻译兼容工作；键盘只处理控件激活。
      if (event.type === 'keydown' && (!['Enter', ' '].includes(event.key) || target.matches('input,textarea,[contenteditable]:not([contenteditable="false"])'))) return;
      const control = target.closest('button,summary,a,[role="button"],[role="option"],select');
      if (!control || control.closest('[data-page-language]') || control.closest(ownedByOtherI18n)) return;
      pendingControls.add(control);
      if (guarding) { pause(() => restoreControl(control)); return; }
      guarding = true;
      pause(() => restoreControl(control));
      queueMicrotask(() => {
        guarding = false;
        if (!active) { pendingControls.clear(); return; }
        pendingControls.forEach(element => { if (element.isConnected) pendingRoots.add(element); });
        pendingControls.clear();
        sync();
      });
    }
    function userEdited(event) {
      const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
      if (target?.matches('input,textarea')) { userInputs.add(target); valueRecords.delete(target); }
      const editable = target?.closest('[contenteditable="true"],[data-editable-content]');
      if (!editable) return;
      // 只放弃真正改动文字的原文快照；角色卡中未编辑的字段标题仍能切回原语言。
      function keepUserText(node) {
        if (node.nodeType !== 3) { Array.from(node.childNodes).forEach(keepUserText); return; }
        const record = textRecords.get(node);
        if (record && node.nodeValue === record.output || !node.nodeValue.trim()) return;
        const element = node.parentElement;
        if (!element) return;
        textRecords.delete(node);
        element.setAttribute('data-vina-user-edited', '');
        const sources = readMap(element, 'data-vina-ar-text-source');
        delete sources[Array.prototype.indexOf.call(element.childNodes, node)];
        if (Object.keys(sources).length) setAttribute(element, 'data-vina-ar-text-source', JSON.stringify(sources));
        else element.removeAttribute('data-vina-ar-text-source');
      }
      keepUserText(editable);
    }
    queryRoot.addEventListener('input', userEdited, true);
    const canonicalEvents = ['click','change','keydown'];
    canonicalEvents.forEach(type => queryRoot.addEventListener(type, canonicalEvent, true));
    controllers.set(scope, {
      activate, restore,
      presentationMutation(record) {
        if (record.type !== 'characterData') return false;
        const text = textRecords.get(record.target);
        return !!text && (record.target.nodeValue === text.output || guarding && record.target.nodeValue === text.source);
      },
      sourceAttribute(element, name) {
        const value = element.getAttribute(name), record = attrRecords.get(element)?.[name];
        return record && [record.source, record.output].includes(value) ? record.source : value;
      },
      renderText(element, source) {
        // 只同步当前提示文字，避免复制显示译文后失去原文记录；清理替换掉的本地文字节点。
        pause(() => {
          function forget(node) { if (node.nodeType === 3) textRecords.delete(node); else Array.from(node.childNodes).forEach(forget); }
          Array.from(element.childNodes).forEach(forget);
          element.textContent = source;
          if (active) walk(element);
        });
      },
      displayText(node) {
        if (node.nodeType === 3) {
          const record = textRecords.get(node);
          return record && [record.source, record.output].includes(node.nodeValue) ? record.output : node.nodeValue;
        }
        return Array.from(node.childNodes).map(child => this.displayText(child)).join('');
      },
      sourceText(node) {
        if (node.nodeType === 3) {
          const record = textRecords.get(node);
          return record && node.nodeValue === record.output ? record.source : node.nodeValue;
        }
        return Array.from(node.childNodes).map(child => this.sourceText(child)).join('');
      },
      dispose() {
        syncCanvasHeader(false);
        observer.disconnect();
        queryRoot.removeEventListener('input', userEdited, true);
        canonicalEvents.forEach(type => queryRoot.removeEventListener(type, canonicalEvent, true));
        controllers.delete(scope);
      }
    });
    observe();
    discover(contentRoot);
    if (enabled) activate();
  }

  function loadFrame(frame) {
    try {
      const doc = frame.contentDocument;
      const previous = frames.get(frame)?.doc;
      if (previous && previous !== doc) controllers.get(previous)?.dispose();
      if (doc?.body) { frames.get(frame).doc = doc; attach(doc); }
    } catch (_) { /* 不读取非同源页面。 */ }
  }
  function discover(root) {
    if (![1,11].includes(root.nodeType)) return;
    if (root.shadowRoot) attach(root.shadowRoot);
    root.querySelectorAll('#vinaStep1V19,[data-vina-i18n-shadow]').forEach(host => { if (host.shadowRoot) attach(host.shadowRoot); });
    const found = root.nodeType === 1 && root.matches('iframe') ? [root] : Array.from(root.querySelectorAll('iframe'));
    found.forEach(frame => {
      if (!frames.has(frame)) {
        const listener = () => loadFrame(frame);
        frames.set(frame, { listener, doc: null });
        frame.addEventListener('load', listener);
      }
      loadFrame(frame);
    });
    frames.forEach((record, frame) => {
      if (frame.isConnected) return;
      frame.removeEventListener('load', record.listener);
      if (record.doc) controllers.get(record.doc)?.dispose();
      frames.delete(frame);
    });
  }
  function setEnabled(value) {
    enabled = value;
    controllers.forEach(controller => value ? controller.activate() : controller.restore());
  }
  window.VinaArabic = {
    translate, attach,
    // 2026-10-25：提示浮层读取规范属性、局部同步本地化，避免 tooltip 搬走 title 后残留阿语。
    sourceAttribute(node, name) {
      return node ? (controllers.get(node.getRootNode()) || controllers.get(node.ownerDocument))?.sourceAttribute(node, name) ?? node.getAttribute(name) : null;
    },
    renderText(node, source) {
      const controller = node && (controllers.get(node.getRootNode()) || controllers.get(node.ownerDocument));
      if (controller) controller.renderText(node, source); else if (node) node.textContent = source;
    },
    // 2026-10-25：编辑框显示本地化值；未修改或取消时提交源值，真实编辑则原样提交，防止仅切语言污染业务名称。
    editSnapshot(node) {
      const controller = node && (controllers.get(node.getRootNode()) || controllers.get(node.ownerDocument));
      return { source: controller?.sourceText(node) ?? node?.textContent ?? '', display: enabled ? controller?.displayText(node) ?? node?.textContent ?? '' : node?.textContent ?? '' };
    },
    resolveEdit(snapshot, value) {
      return snapshot && value.trim() === snapshot.display.trim() ? snapshot.source : value;
    },
    sourceHtml(node) {
      if (!node) return '';
      const clone = node.cloneNode(true);
      [clone, ...clone.querySelectorAll('*')].forEach(element => {
        Object.entries(readMap(element, 'data-vina-ar-text-source')).forEach(([index, source]) => {
          const text = element.childNodes[Number(index)];
          if (text?.nodeType === 3 && text.nodeValue === translate(source)) text.nodeValue = source;
        });
        Object.entries(readMap(element, 'data-vina-ar-attr-source')).forEach(([name, source]) => {
          if (element.getAttribute(name) === translate(source)) element.setAttribute(name, source);
        });
        if (element.hasAttribute('data-vina-ar-dir-source')) {
          const original = readMap(element, 'data-vina-ar-dir-source').dir;
          if (original == null) element.removeAttribute('dir'); else element.setAttribute('dir', original);
        }
        if (element.hasAttribute('data-vina-ar-tooltip')) element.removeAttribute('title');
        for (const attr of Array.from(element.attributes)) if (attr.name.startsWith('data-vina-ar-')) element.removeAttribute(attr.name);
      });
      return clone.innerHTML;
    },
    languageHint() { return enabled ? '\n界面语言为阿拉伯语。面向用户的回复、问题、选项、标题、角色描述、剧本正文和提示词使用简洁自然的现代标准阿拉伯语。保留 JSON 字段名、action/type/id、模型名、URL、素材编号与内部协议值，不翻译用户上传文件名；用户明确指定其他创作语言时服从用户。此条语言要求优先于其他提示中的中文措辞示例。' : ''; },
    sourceText(node) { return node ? (controllers.get(node.getRootNode()) || controllers.get(node.ownerDocument))?.sourceText(node) ?? node.textContent ?? '' : ''; },
    isPresentationMutation(record) { return (controllers.get(record.target.getRootNode()) || controllers.get(record.target.ownerDocument))?.presentationMutation(record) || false; },
    get active() { return enabled; }
  };
  document.addEventListener('vina:before-language-change', () => {
    if (enabled) setEnabled(false);
  });
  document.addEventListener('vina:language-change', event => setEnabled(event.detail.language === 'ar'));
  // 仅 ar 下将语言传到独立套餐/3D 页面；中文默认、其他语言和生成参数不写入存储。
  document.addEventListener('click', event => {
    if (!enabled) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && /\/(?:membership\.html|3d-creation\/3d\.html|index\.html)$/.test(url.pathname)) {
      url.searchParams.set('lang', 'ar');
      const originalHref = link.getAttribute('href');
      link.href = url.href;
      setTimeout(() => { if (link.isConnected) link.setAttribute('href', originalHref); }, 0);
    }
  }, true);
  function start() {
    attach(document);
    const requested = new URLSearchParams(location.search).get('lang') === 'ar';
    if (requested && window.vinaPageLanguage) window.vinaPageLanguage.set('ar');
    else if (requested) { document.documentElement.lang = 'ar'; setEnabled(true); }
    else setEnabled(document.documentElement.lang === 'ar');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
