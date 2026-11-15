// 2026-11-12：会员页接收宿主语言并原位更新文案，保留套餐、周期、筛选和弹窗状态。
// 只翻译显示文本和辅助属性，避免改写业务 ID、订单数据或充值选项。
(() => {
  const root = document.documentElement;
  const query = new URLSearchParams(location.search);
  const embedded = window.parent !== window && query.get('embedded') === 'membership-modal';
  const locales = ['en', 'ja', 'fr', 'ms'];
  const supported = new Set(['zh-CN', ...locales, 'ar']);
  const token = /\{([a-z]+\d*)\}/g;
  const han = /[\u3400-\u9fff]/;
  const fragments = {
    n: '[0-9][0-9,]*(?:\\.[0-9]+)?',
    // 2026-11-14：V 点支付结果使用本地化金额占位符，保留原有模板翻译器。
    amount: '[¥￥][0-9][0-9,]*(?:\\.[0-9]+)?',
    date: '[0-9]{4}-[0-9]{2}-[0-9]{2}',
    audience: '个人|团队',
    account: '个人账户|团队账户',
    plan: '标准版|进阶版|专业版|豪华版',
    cycle: '月付|年付',
    time: '变动时间|交易时间|下单时间',
    record: '#[A-Za-z0-9]+',
    text: '.+?',
  };
  const escapePattern = text => text.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
  const messages = new Map();
  const templates = [];
  window.vinaMembershipCopy.forEach(([source, ...translations]) => {
    if (!source.includes('{')) {
      messages.set(source, translations);
      return;
    }
    let expression = '^';
    let cursor = 0;
    for (const match of source.matchAll(token)) {
      const name = match[1];
      const fragment = fragments[name.replace(/\d+$/, '')];
      expression += escapePattern(source.slice(cursor, match.index)) + '(?<' + name + '>' + fragment + ')';
      cursor = match.index + match[0].length;
    }
    expression += escapePattern(source.slice(cursor)) + '$';
    templates.push({ pattern: new RegExp(expression, 'u'), translations });
  });

  let language = 'zh-CN';
  let requestedLanguage = query.get('lang') || language;
  let started = false;
  const textSources = new WeakMap();
  const attrSources = new WeakMap();
  const attributes = ['aria-label', 'title', 'alt', 'placeholder', 'data-tooltip-text'];
  const ignored = 'script, style, svg, noscript, code, pre, [translate="no"], .vm-digit-stack, [data-vm-countdown]';

  function translate(source, localeIndex) {
    if (localeIndex < 0 || !han.test(source)) return source;
    const exact = messages.get(source);
    if (exact) return exact[localeIndex];
    for (const { pattern, translations } of templates) {
      const match = pattern.exec(source);
      if (match) return translations[localeIndex].replace(token, (_, name) => translate(match.groups[name], localeIndex));
    }
    return source;
  }

  function localizedValue(current, previous, localeIndex) {
    // 新渲染的中文文案覆盖旧缓存；回切时只恢复本脚本写过的译文。
    const source = previous?.localized === current ? previous.source : current;
    const trimmed = source.trim();
    const translated = translate(trimmed, localeIndex);
    if (translated === trimmed) return { source, localized: source };
    const start = source.indexOf(trimmed);
    return { source, localized: source.slice(0, start) + translated + source.slice(start + trimmed.length) };
  }

  function updateText(node, localeIndex) {
    const { source, localized } = localizedValue(node.data, textSources.get(node), localeIndex);
    if (localized === source) textSources.delete(node);
    else textSources.set(node, { source, localized });
    if (localized !== node.data) node.data = localized;
  }

  function updateAttributes(element, localeIndex) {
    let originals = attrSources.get(element);
    for (const name of attributes) {
      const current = element.getAttribute(name);
      if (current === null) {
        originals?.delete(name);
        continue;
      }
      if (!originals?.has(name) && !han.test(current)) continue;
      const result = localizedValue(current, originals?.get(name), localeIndex);
      if (result.localized === result.source) originals?.delete(name);
      else {
        if (!originals) {
          originals = new Map();
          attrSources.set(element, originals);
        }
        originals.set(name, result);
      }
      if (result.localized !== current) element.setAttribute(name, result.localized);
    }
  }

  function localize(subtree, localeIndex) {
    if (!subtree.isConnected) return;
    if (subtree.nodeType === Node.TEXT_NODE) {
      if (!subtree.parentElement?.closest(ignored)) updateText(subtree, localeIndex);
      return;
    }
    if (subtree.nodeType !== Node.ELEMENT_NODE || subtree.closest(ignored)) return;
    const walker = document.createTreeWalker(subtree, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.nodeType === Node.ELEMENT_NODE && node.matches(ignored)
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let node = subtree;
    do {
      if (node.nodeType === Node.TEXT_NODE) updateText(node, localeIndex);
      else updateAttributes(node, localeIndex);
      node = walker.nextNode();
    } while (node);
  }

  const observer = new MutationObserver(records => {
    const localeIndex = locales.indexOf(language);
    if (localeIndex < 0) return;
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach(node => localize(node, localeIndex));
      } else if (record.type === 'characterData') {
        localize(record.target, localeIndex);
      } else if (record.target.isConnected && !record.target.closest(ignored)) {
        updateAttributes(record.target, localeIndex);
      }
    }
  });

  function setLanguage(next) {
    requestedLanguage = supported.has(next) ? next : 'zh-CN';
    if (!started || language === requestedLanguage) return;
    const localeIndex = locales.indexOf(requestedLanguage);
    // 由既有阿语脚本先恢复其源文本。四种新译文启用时隔离两套 DOM 写入。
    document.dispatchEvent(new CustomEvent('vina:before-language-change', { detail: { language: requestedLanguage } }));
    observer.disconnect();
    language = requestedLanguage;
    if (localeIndex >= 0) root.dataset.vinaI18n = 'off';
    root.lang = language;
    root.toggleAttribute('data-vm-localized', localeIndex >= 0);
    localize(document.body, localeIndex);
    document.title = translate('会员方案 - VinaAI', localeIndex);
    if (localeIndex < 0) delete root.dataset.vinaI18n;
    else observer.observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes,
    });
    document.dispatchEvent(new CustomEvent('vina:language-change', { detail: { language } }));
    if (embedded) {
      window.parent.postMessage({
        channel: 'vina-membership-overlay', type: 'label', label: translate('会员方案', localeIndex),
      }, '*');
    }
  }

  window.vinaMembershipI18n = { setLanguage };
  document.addEventListener('DOMContentLoaded', () => {
    started = true;
    setLanguage(requestedLanguage);
  }, { once: true });
})();
