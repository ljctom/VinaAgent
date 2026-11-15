// 2026-10-25 Product Design：确认卡新增 ar 按钮；Arabic 状态纳入 knownStates，往返切换及已确认状态可恢复，点击仍使用原 data 指令。
/* 2026-10-12 Product Design / 多语言改动逻辑：
 * 仅翻译全能创作确认卡的跳过、继续和已确认按钮；不翻译用户输入、AI 正文或预置项目数据。
 * 通过同源父页面的 html.lang 同步中文、英文、日语、法语及马来语；动态出现的新卡与已有卡同步更新。
 * 点击行为继续由原 data-confirmation-* 入口处理，跳过仍发送中文规范指令，避免译文影响直接生成判定。
 * 2026-11-03 修正展示逻辑：操作按钮固定为 14px，宽度随文字撑开；窄栏由 CSS 换行承载完整译文。
 * 避免自动宽度与字号测量互相影响，导致按钮越变越窄、文字持续缩小；翻译与点击行为不变。
 */
(() => {
  const labels = {
    "zh-CN": { skip: "跳过，直接生成", continue: "继续", confirmed: "已确认" },
    ar: { skip: "تجاوز وإنشاء", continue: "متابعة", confirmed: "مؤكد" },
    en: { skip: "Skip & generate", continue: "Continue", confirmed: "Confirmed" },
    ja: { skip: "スキップして生成", continue: "続ける", confirmed: "確認済み" },
    fr: { skip: "Ignorer et générer", continue: "Continuer", confirmed: "Confirmé" },
    ms: { skip: "Langkau & jana", continue: "Teruskan", confirmed: "Disahkan" }
  };
  const selector = '.creative-skip, [data-confirmation-continue]';
  const knownStates = new Map();
  Object.values(labels).forEach(copy => {
    knownStates.set(copy.continue, 'continue');
    knownStates.set(copy.confirmed, 'confirmed');
  });

  function install() {
    if (document.getElementById('character-asset-canvas-theme')) return;
    let parentRoot = document.documentElement;
    try { parentRoot = window.parent.document.documentElement; } catch (_) { /* 非同源宿主使用当前画布语言。 */ }
    let scheduled = false;
    const observed = new WeakSet();

    function currentLanguage() {
      const value = parentRoot.lang || 'zh-CN';
      const normalized = value.startsWith('zh') ? 'zh-CN' : value.split('-')[0];
      return Object.prototype.hasOwnProperty.call(labels, normalized) ? normalized : 'zh-CN';
    }

    function fitButton(button) {
      if (!button.isConnected) { resizeObserver?.unobserve(button); return; }
      // 2026-11-03：恢复曾被缩小的行内字号；按钮不再依赖自身宽度计算字号，避免 ResizeObserver 反复缩字。
      const nextSize = '14px';
      if (button.style.getPropertyValue('font-size') !== nextSize) button.style.setProperty('font-size', nextSize, 'important');
    }

    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
      entries.forEach(entry => fitButton(entry.target));
    }) : null;

    function syncButtons() {
      const lang = currentLanguage();
      const copy = labels[lang];
      document.querySelectorAll(selector).forEach(button => {
        const state = button.classList.contains('creative-skip') ? 'skip' : knownStates.get(button.textContent.trim());
        // 未知业务状态保持原有文案，例如失败、提交中等，不强行替换为“继续”。
        if (!state) return;
        const text = copy[state];
        if (button.textContent !== text) button.textContent = text;
        if (button.getAttribute('aria-label') !== text) button.setAttribute('aria-label', text);
        if (button.getAttribute('title') !== text) button.setAttribute('title', text);
        if (button.getAttribute('lang') !== lang) button.setAttribute('lang', lang);
        if (resizeObserver && !observed.has(button)) { observed.add(button); resizeObserver.observe(button); }
        fitButton(button);
      });
    }

    function scheduleSync() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; syncButtons(); });
    }

    new MutationObserver(scheduleSync).observe(parentRoot, { attributes: true, attributeFilter: ['lang'] });
    new MutationObserver(scheduleSync).observe(document.getElementById('messages') || document.body, {
      childList: true, subtree: true, characterData: true
    });
    window.addEventListener('resize', scheduleSync);
    if (document.fonts) {
      document.fonts.ready.then(scheduleSync);
      document.fonts.addEventListener('loadingdone', scheduleSync);
    }
    syncButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
