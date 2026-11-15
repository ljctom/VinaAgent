/* 2026-10-30 Product Design：角色/短剧的失败状态、积分返还提示及重试按钮独立支持六语言。
 * 使用语义键直接同步当前语言，不依赖上次显示的文字；通用中英及阿语适配器跳过此范围。
 * 监听页面语言、动态克隆和状态重绘，只修改发生变化的文本与方向，避免循环刷新；生成和重试事件保持原样。
 */
(() => {
  const copies = {
    'zh-CN': { message:'生成失败，积分已返还', failed:'生成失败', retry:'重试', regenerate:'重新生成' },
    en: { message:'Generation failed. Credits have been refunded.', failed:'Generation failed', retry:'Retry', regenerate:'Regenerate' },
    ja: { message:'生成に失敗しました。ポイントは返還されました。', failed:'生成失敗', retry:'再試行', regenerate:'再生成' },
    fr: { message:'Échec de la génération. Les crédits ont été remboursés.', failed:'Échec de la génération', retry:'Réessayer', regenerate:'Régénérer' },
    ms: { message:'Penjanaan gagal. Kredit telah dikembalikan.', failed:'Penjanaan gagal', retry:'Cuba lagi', regenerate:'Jana semula' },
    ar: { message:'فشل الإنشاء. تمت إعادة النقاط.', failed:'فشل الإنشاء', retry:'إعادة المحاولة', regenerate:'إعادة الإنشاء' }
  };
  const scope = '[data-generation-failure-copy]';
  function sync() {
    const raw = document.documentElement.lang || 'zh-CN';
    const language = raw.startsWith('zh') ? 'zh-CN' : raw.split('-')[0];
    const copy = copies[language] || copies['zh-CN'];
    document.querySelectorAll(scope).forEach(node => {
      const label = copy[node.dataset.generationFailureCopy];
      if (!label) return;
      if (node.textContent !== label) node.textContent = label;
      const direction = language === 'ar' ? 'rtl' : 'ltr';
      if (node.getAttribute('dir') !== direction) node.setAttribute('dir', direction);
      if (node.matches('button') && node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
    });
  }
  function install() {
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; sync(); });
    };
    const relevant = node => {
      const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      return Boolean(element && (element.closest(scope) || element.querySelector(scope)));
    };
    new MutationObserver(schedule).observe(document.documentElement, { attributes:true, attributeFilter:['lang'] });
    new MutationObserver(records => {
      if (records.some(record => relevant(record.target) || Array.from(record.addedNodes).some(relevant))) schedule();
    }).observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['data-generation-failure-copy'] });
    document.addEventListener('vina:language-change', schedule);
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
