// 2026-10-25 Product Design：生成模式补充简短 ar 文案；现有五语言内容和 enabled 状态判定不变。
/* 2026-10-14 Product Design / 多语言改动逻辑：
 * 首页与全能创作的生成模式共用五语言词典，标题、副标题及无障碍提示跟随页面语言。
 * 2026-10-14 文案调整逻辑：四种外语副标题精简为生成前确认、自动规划生成的短句，配合样式最多显示两行。
 * 同源 iframe 监听父页面 html.lang；菜单移至 body、模式切换或重新渲染时仍同步。
 * 模式值与事件沿用原控件，按 enabled 状态翻译按钮，不用译文参与业务判定。
 * 仅在文案变化时写入，避免观察器循环；角色资产专用画布不接入此翻译。
 */
(() => {
  const copies = {
    'zh-CN': {
      manual: '手动确认', automatic: '自动生成',
      manualDesc: 'Agent在执行生成前都会寻求您的确认',
      automaticDesc: 'Agent会自主规划生成任务并自动执行',
      current: '当前模式：', choose: '选择 Agent 生成模式'
    },
    ar: {
      manual: 'يدوي', automatic: 'تلقائي',
      manualDesc: 'تأكيد قبل الإنشاء', automaticDesc: 'تخطيط وإنشاء تلقائي',
      current: 'الوضع: ', choose: 'اختيار وضع الإنشاء'
    },
    en: {
      manual: 'Manual', automatic: 'Auto Generate',
      manualDesc: 'Agent asks before generating',
      automaticDesc: 'Agent plans and generates automatically',
      current: 'Current mode: ', choose: 'Choose Agent generation mode'
    },
    ja: {
      manual: '手動確認', automatic: '自動生成',
      manualDesc: 'Agentが生成前に確認を求めます',
      automaticDesc: 'Agentが計画から生成まで自動実行',
      current: '現在のモード：', choose: 'Agentの生成モードを選択'
    },
    fr: {
      manual: 'Confirmation manuelle', automatic: 'Génération automatique',
      manualDesc: 'L’Agent demande votre accord',
      automaticDesc: 'L’Agent planifie et génère automatiquement',
      current: 'Mode actuel : ', choose: 'Choisir le mode de génération de l’Agent'
    },
    ms: {
      manual: 'Pengesahan manual', automatic: 'Jana automatik',
      manualDesc: 'Agent meminta pengesahan dahulu',
      automaticDesc: 'Agent merancang dan menjana secara automatik',
      current: 'Mod semasa: ', choose: 'Pilih mod penjanaan Agent'
    }
  };
  const scope = '.home-generation-mode, .home-generation-mode-menu, .auto-mode-control, .auto-mode-menu';

  function install() {
    if (document.getElementById('character-asset-canvas-theme')) return;
    let languageRoot = document.documentElement;
    try { languageRoot = window.parent.document.documentElement; }
    catch (_) { /* 独立或非同源画布使用自身页面语言。 */ }
    let pending = false;

    function sync() {
      const value = languageRoot.lang || 'zh-CN';
      const normalized = value.startsWith('zh') ? 'zh-CN' : value.split('-')[0];
      const copy = copies[normalized] || copies['zh-CN'];
      let changed = false;
      const setText = (node, text) => {
        if (node && node.textContent !== text) { node.textContent = text; changed = true; }
      };
      const setLabel = (node, text) => {
        if (node && node.getAttribute('aria-label') !== text) node.setAttribute('aria-label', text);
      };
      document.querySelectorAll('[data-home-generation-mode], [data-auto-mode]').forEach(option => {
        const automatic = option.dataset.homeGenerationMode === 'automatic' || option.dataset.autoMode === 'on';
        setText(option.querySelector('.home-generation-mode-title, .auto-mode-title'), automatic ? copy.automatic : copy.manual);
        setText(option.querySelector('.home-generation-mode-desc, .auto-mode-desc'), automatic ? copy.automaticDesc : copy.manualDesc);
      });
      [['homeGenerationMode', 'homeGenerationModeLabel'], ['autoMode', 'autoModeLabel']].forEach(([prefix, labelId]) => {
        const control = document.getElementById(prefix + 'Control');
        if (!control) return;
        const title = control.classList.contains('enabled') ? copy.automatic : copy.manual;
        setText(document.getElementById(labelId), title);
        setLabel(document.getElementById(prefix + 'Trigger'), copy.current + title);
        setLabel(document.getElementById(prefix + 'Menu'), copy.choose);
      });
      // 长译文改变菜单高度后，复用既有 resize 定位流程重新避让视口边缘。
      if (changed) window.dispatchEvent(new Event('resize'));
    }

    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; sync(); });
    }
    const relevant = node => {
      const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      return element && (element.closest(scope) || element.querySelector(scope));
    };
    new MutationObserver(schedule).observe(languageRoot, { attributes: true, attributeFilter: ['lang'] });
    // 动态画布只响应模式控件相关变化，避免每条 Agent 消息都扫描菜单。
    new MutationObserver(records => {
      if (records.some(record => relevant(record.target) || Array.from(record.addedNodes).some(relevant))) schedule();
    }).observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'aria-label']
    });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
