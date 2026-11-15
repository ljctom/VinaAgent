/* 2026-11-09 Product Design：全能创作所有生成预览统一复用短剧绿色柔光动效。
 * 仅添加展示层，不改生成任务、计时或结果；角色资产画布及短剧分集不安装。
 * 覆盖普通媒体、重拍/局部重绘、Markdown文本以及故事板中央预览。
 */
(function () {
  function install() {
    if (document.getElementById('character-asset-canvas-theme')) return;
    var stage = document.getElementById('stage');
    if (!stage || !document.querySelector('.workspace')) return;
    document.documentElement.classList.add('vina-creation-loading-enabled');
    var targets = '.node .thumb.generating, .vina-direct-placeholder.is-generating, .vina-md-request-generating .vina-md-preview, .canvas-chat-generation-card.is-generating .canvas-chat-generation-preview';
    function labelFor(element) {
      var node = element.closest('.node');
      var type = node && (node.dataset.generationType || node.dataset.nodeType);
      if (element.closest('.vina-markdown-node')) type = 'text';
      return type === 'video' ? '视频' : type === 'music' || type === 'audio' ? '音频' : type === 'image' ? '图片' : type === 'text' ? '文本' : '内容';
    }
    function sync() {
      document.querySelectorAll('.vina-creation-loading-surface').forEach(function (surface) {
        if (!surface.parentElement || !surface.parentElement.matches(targets)) surface.remove();
      });
      document.querySelectorAll(targets).forEach(function (element) {
        if (element.querySelector(':scope > .vina-creation-loading-surface')) return;
        var surface = document.createElement('div');
        surface.className = 'vina-creation-loading-surface';
        if (element.matches('.vina-direct-placeholder')) surface.classList.add('is-storyboard');
        surface.setAttribute('role', 'status');
        surface.setAttribute('aria-live', 'polite');
        var copy = document.createElement('div');
        copy.className = 'vina-creation-loading-copy';
        var title = document.createElement('strong');
        title.textContent = '生成中';
        var hint = document.createElement('span');
        hint.textContent = labelFor(element) + '生成中，请稍后…';
        copy.append(title, hint);
        surface.appendChild(copy);
        element.appendChild(surface);
      });
    }
    // 只观察任务状态和结构，不观察动画样式/每帧百分比文本，避免播放时反复重建展示层。
    var scheduled = false;
    new MutationObserver(function (records) {
      if (scheduled || !records.some(function (record) {
        var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        return !target || !target.closest('.vina-creation-loading-surface, .video-player, .vina-video-node-controls');
      })) return;
      scheduled = true;
      queueMicrotask(function () { scheduled = false; sync(); });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
