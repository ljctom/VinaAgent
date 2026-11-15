/* 2026-10-26 Product Design 展示逻辑：参照 UI 稿子补齐第四步资产图片的大图预览。
   点击/Enter/空格只读取当前图片和当前形象标题，在原生 dialog 中完整显示；
   关闭按钮、遮罩和 Esc 仅关闭预览并归还焦点，不修改图片、生成记录、音色或编辑草稿。
   沿用现有列表的点阵底板和图片节点，不复制图片层、不更换原预览背景、不引入缩放或生成业务逻辑。 */
(() => {
  const initialized = new WeakSet();
  let dialog = null;
  let origin = null;
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'asset-image-preview-dialog';
    dialog.setAttribute('aria-labelledby', 'assetImagePreviewTitle');
    dialog.innerHTML = '<header class="asset-image-preview-head"><h2 id="assetImagePreviewTitle">图片预览</h2><button type="button" data-image-preview-close aria-label="关闭图片预览" autofocus><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="asset-image-preview-full" role="img" aria-label="角色形象大图"></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('[data-image-preview-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.querySelector('.asset-image-preview-full').style.backgroundImage = '';
      if (origin?.isConnected) origin.focus({ preventScroll:true });
      origin = null;
    });
    return dialog;
  }
  // 2026-11-01 Product Design：出海转绘原图复用转绘图的同一个原生 dialog，
  // 读取 img 当前地址并固定标题为“原图”；普通短剧及转绘结果仍使用原名称与背景图逻辑。
  function attach(viewport, original = false) {
    if (initialized.has(viewport)) return;
    initialized.add(viewport);
    viewport.dataset.assetLightbox = ''; // 独立展示标记，保留原大图和点阵底板的样式。
    viewport.setAttribute('role', 'button');
    viewport.setAttribute('aria-haspopup', 'dialog');
    const imageCss = () => original
      ? (viewport.getAttribute('src') ? `url(${JSON.stringify(viewport.currentSrc || viewport.src)})` : '')
      : viewport.style.backgroundImage;
    const available = () => original
      ? Boolean(viewport.complete && viewport.naturalWidth > 0 && imageCss())
      : Boolean(viewport.style.backgroundImage && viewport.style.backgroundImage !== 'none' && !viewport.matches('.is-empty,.is-generating'));
    // 2026-11-02 Product Design：转绘图的 contain 背景可能在预览框内留白，仅给外框圆角无法裁切实际图片边缘。
    // 角色、场景和物品统一用同源 img 展示当前结果，实际图片四角为 4px；原背景地址继续供生成、历史与大图预览读取。
    // 图片层不接收点击，加载成功后才隐藏底层背景；加载失败、未生成和生成中恢复原有显示，不改变原业务状态。
    const roundedImage = !original && document.documentElement.classList.contains('redraw-embedded')
      ? document.createElement('img') : null;
    if (roundedImage) {
      roundedImage.className = 'redraw-rounded-result-image';
      roundedImage.alt = '';
      roundedImage.setAttribute('aria-hidden', 'true');
      roundedImage.draggable = false;
      roundedImage.addEventListener('load', sync);
      roundedImage.addEventListener('error', () => viewport.classList.remove('has-redraw-rounded-image'));
      viewport.append(roundedImage);
    }
    function sync() {
      const ready = available();
      if (roundedImage) {
        const imageUrl = ready ? imageCss().trim().match(/^url\((["']?)([\s\S]*)\1\)$/i)?.[2] : '';
        if (imageUrl) {
          if (roundedImage.getAttribute('src') !== imageUrl) roundedImage.src = imageUrl;
        } else if (roundedImage.hasAttribute('src')) {
          roundedImage.removeAttribute('src');
        }
        viewport.classList.toggle('has-redraw-rounded-image', Boolean(imageUrl && roundedImage.complete && roundedImage.naturalWidth > 0));
      }
      viewport.tabIndex = ready ? 0 : -1;
      viewport.setAttribute('aria-disabled', String(!ready));
      viewport.setAttribute('aria-label', original ? (ready ? '查看原图' : '原图暂不可预览') : (ready ? '查看形象大图' : '暂无可预览的形象图片'));
    }
    function open() {
      if (!available()) return;
      const modal = ensureDialog();
      const title = original ? '原图' : viewport.closest('.asset-preview-region')?.querySelector('[data-asset-preview-title]')?.textContent?.trim();
      modal.querySelector('#assetImagePreviewTitle').textContent = title || '图片预览';
      modal.querySelector('.asset-image-preview-full').style.backgroundImage = imageCss();
      modal.querySelector('.asset-image-preview-full').setAttribute('aria-label', title || '角色形象大图');
      origin = viewport;
      if (!modal.open) modal.showModal();
    }
    viewport.addEventListener('click', open);
    viewport.addEventListener('keydown', event => {
      if (event.target !== viewport || !['Enter',' '].includes(event.key)) return;
      event.preventDefault();
      open();
    });
    // 2026-11-01：原图切换、加载完成及加载失败时更新可预览状态；点击/Enter/空格共用原有打开入口。
    if (original) {
      viewport.addEventListener('load', sync);
      viewport.addEventListener('error', sync);
    }
    new MutationObserver(sync).observe(viewport, { attributes:true, attributeFilter:original ? ['src','srcset','class'] : ['style','class'] });
    sync();
  }
  function start() {
    const workspace = document.querySelector('.asset-workspace[data-view="asset-library"]');
    if (!workspace) return;
    const scan = () => {
      // 显式传递 false，避免 forEach 的索引被当成 original 参数，保持现有转绘图与普通短剧预览行为。
      workspace.querySelectorAll('.asset-preview-region [data-character-current]').forEach(viewport => attach(viewport));
      if (document.documentElement.classList.contains('redraw-embedded')) {
        workspace.querySelectorAll('.redraw-character-comparison [data-redraw-original-preview]').forEach(viewport => attach(viewport, true));
      }
    };
    new MutationObserver(scan).observe(workspace, { childList:true, subtree:true });
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
