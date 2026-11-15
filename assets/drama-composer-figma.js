/* 2026-10-01 Product Design 最新标注：删除输入栏三个参数代理和上传菜单。
 * 上传按钮继续由 app.js 原监听直接打开本地文件窗口；文件名显示在同一个按钮内。
 * 有文件时替换为 Figma 文档图标和删除叉号；空态文案按大纲/剧本阶段同步。
 * 2026-10-27 Product Design 改动逻辑：第二、第三步 AI 回复不再生成 VinaAI 品牌标签；
 * 初次请求、等待回复及历史恢复共用正文和选项卡，保留发送无障碍状态及上传/移除/生成业务。
 */
(() => {
  const workspace = document.querySelector('.script-workspace');
  const composer = workspace?.querySelector('.script-input');
  if (!composer) return;
  const upload = composer.querySelector('[data-script-chat-upload]');
  const fileLabel = composer.querySelector('[data-script-chat-file-name]');
  function syncUpload() {
    const hasFile = upload?.classList.contains('has-file');
    const icon = upload?.querySelector('img');
    const source = hasFile ? './assets/icons/drama-composer/file.svg' : './assets/icons/drama-composer/upload.svg';
    if (icon && icon.getAttribute('src') !== source) icon.setAttribute('src', source);
    const text = hasFile ? (fileLabel?.title || fileLabel?.textContent || '剧本文件') : '上传剧本';
    upload?.setAttribute('aria-label', hasFile ? `已上传剧本：${text}，点击替换文件` : '上传剧本');
    if (upload) upload.title = hasFile ? text : '上传剧本';
  }
  if (upload) new MutationObserver(syncUpload).observe(upload, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true, characterData: true });
  syncUpload();
  function syncStateCopy() {
    const episode = workspace.dataset.scriptStage === 'episode';
    const title = workspace.querySelector('[data-script-empty-title]');
    const text = episode ? '暂无剧本内容' : '暂无剧本大纲内容';
    if (title && title.textContent !== text) title.textContent = text;
    // 2026-10-27 性能修复：仅文案真正变化时写入，阶段恢复不重复触发正文监听。
    workspace.querySelectorAll('[data-script-state-next]').forEach(button => {
      const label = episode ? '下一步' : '生成分集剧本详情';
      if (button.textContent !== label) button.textContent = label;
    });
  }
  new MutationObserver(syncStateCopy).observe(workspace, { attributes: true, attributeFilter: ['data-script-stage'] });
  syncStateCopy();
  const conversation = workspace.querySelector('[data-script-conversation]');
  // 2026-10-27 Product Design 改动逻辑：旧模板、新 AI 回复及恢复的历史消息都可能带品牌头。
  // 在同一会话入口移除展示头，保留正文、确认卡及其原始事件；CSS 同时隐藏头部以避免首次插入时闪现。
  function syncReplyPresentation() {
    workspace.querySelectorAll('.script-ai-head').forEach(head => head.remove());
  }
  if (conversation) new MutationObserver(syncReplyPresentation).observe(conversation, { subtree: true, childList: true });
  syncReplyPresentation();
  const send = composer.querySelector('[data-script-send]');
  function syncSend() { send?.setAttribute('aria-disabled', String(send.disabled || send.classList.contains('is-locked'))); }
  if (send) new MutationObserver(syncSend).observe(send, { attributes: true, attributeFilter: ['disabled', 'class'] });
  syncSend();
})();
