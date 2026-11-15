/* 2026-10-27 Product Design 改动逻辑：
 * 资产页全量生成、确认修改及首次下一步使用六语言短文案；原按钮、显隐、禁用与点击事件继续复用。
 * 仅更新生成按钮的文案 span，不替换积分节点；费用变化同步翻译无障碍说明。
 * 通用中英/阿语适配器排除此范围；按已知文案识别流程状态，语言往返与业务重绘后仍可恢复。
 * 未知状态保留业务文案；只在内容变化时写入，避免 MutationObserver 重复触发。
 */
(() => {
  const copies = {
    'zh-CN': { all: '全量生成', confirm: '确认修改', next: '下一步', cost: n => `消耗 ${n} 积分` },
    en: { all: 'Generate all', confirm: 'Confirm', next: 'Next', cost: n => `${n} credits` },
    ja: { all: '一括生成', confirm: '確定', next: '次へ', cost: n => `${n} ポイント` },
    fr: { all: 'Tout générer', confirm: 'Confirmer', next: 'Suivant', cost: n => `${n} crédits` },
    ms: { all: 'Jana semua', confirm: 'Sahkan', next: 'Seterusnya', cost: n => `${n} kredit` },
    ar: { all: 'إنشاء الكل', confirm: 'تأكيد', next: 'التالي', cost: n => `${n} نقطة` }
  };
  // 2026-11-04 Product Design：图片已生成的角色按音色绑定状态显示六语言文案；语义键随侧栏克隆保留，避免缓存旧译文。
  // 2026-11-04 Product Design：只精简六语言未绑音色状态文案，保留图片完成与无音色两层信息，使小屏沿用原字号和原布局也可单行显示；不调整字号或样式。
  // 2026-11-04 Product Design：生成中六语言文案统一保留三个半角句点，不改字号、布局及任务状态。
  const generationCopies = {
    'zh-CN': { promptGenerating: '提示词生成中...', generating: '生成中...', generated: '已生成', generatedWithoutVoice: '已生成，未绑音色' },
    en: { promptGenerating: 'Writing prompt...', generating: 'Generating...', generated: 'Generated', generatedWithoutVoice: 'Ready · No voice' },
    ja: { promptGenerating: 'プロンプト生成中...', generating: '生成中...', generated: '生成済み', generatedWithoutVoice: '生成済・音声なし' },
    fr: { promptGenerating: 'Prompt en cours...', generating: 'Génération...', generated: 'Généré', generatedWithoutVoice: 'Prêt · Sans voix' },
    ms: { promptGenerating: 'Menjana arahan...', generating: 'Menjana...', generated: 'Telah dijana', generatedWithoutVoice: 'Siap · Tiada suara' },
    ar: { promptGenerating: 'جارٍ إعداد الوصف...', generating: 'جارٍ الإنشاء...', generated: 'تم الإنشاء', generatedWithoutVoice: 'جاهز · بلا صوت' }
  };
  const generationScope = '[data-character-generation-copy]';
  const scope = '#assetBatchOpen, #characterGenerateAll, .asset-stage-actions .asset-next';
  const states = new Map([['Confirm changes', 'confirm']]);
  Object.values(copies).forEach(copy => {
    states.set(copy.confirm, 'confirm');
    states.set(copy.next, 'next');
  });
  const setAttr = (node, name, value) => {
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  };
  function sync() {
    const raw = document.documentElement.lang || 'zh-CN';
    const lang = raw.startsWith('zh') ? 'zh-CN' : raw.split('-')[0];
    const copy = copies[lang] || copies['zh-CN'];
    const generationCopy = generationCopies[lang] || generationCopies['zh-CN'];
    document.querySelectorAll(generationScope).forEach(node => {
      const label = generationCopy[node.dataset.characterGenerationCopy];
      if (!label) return;
      if (node.textContent !== label) node.textContent = label;
      setAttr(node, 'lang', generationCopies[lang] ? lang : 'zh-CN');
      setAttr(node, 'dir', lang === 'ar' ? 'rtl' : 'ltr');
      // 2026-11-05：等待标签和资产行的无障碍说明随六语言同步更新。
      if (node.dataset.characterGenerationCopy === 'promptGenerating') {
        const row = node.closest('.asset-browser-row');
        if (row) setAttr(row, 'aria-label', `${row.dataset.assetFullName} · ${label}`);
      }
    });
    document.querySelectorAll(scope).forEach(button => {
      const generate = button.matches('#assetBatchOpen, #characterGenerateAll');
      const state = generate ? 'all' : states.get(button.textContent.trim());
      if (!state) return;
      const label = generate ? button.querySelector(':scope > span:first-child') : button;
      if (!label) return;
      if (label.textContent !== copy[state]) label.textContent = copy[state];
      const cost = button.querySelector('[data-asset-generate-cost]')?.textContent.trim() || '0';
      setAttr(button, 'aria-label', generate ? `${copy.all}, ${copy.cost(cost)}` : copy[state]);
      setAttr(button, 'title', copy[state]);
      setAttr(button, 'lang', copies[lang] ? lang : 'zh-CN');
      // 局部阿语阅读方向随文案切换；积分保持数字原值，不参与业务计算。
      setAttr(button, 'dir', lang === 'ar' ? 'rtl' : 'ltr');
    });
  }
  function install() {
    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; sync(); });
    };
    const relevant = node => {
      const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      return el && (el.closest(`${scope}, ${generationScope}`) || el.querySelector(`${scope}, ${generationScope}`));
    };
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    new MutationObserver(records => {
      if (records.some(record => relevant(record.target) || Array.from(record.addedNodes).some(relevant))) schedule();
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'data-character-generation-copy'] });
    document.addEventListener('vina:language-change', schedule);
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
