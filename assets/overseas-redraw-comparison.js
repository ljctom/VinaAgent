// 2026-11-01 Product Design：仅出海转绘实例创建原片段/新片段对比，不向普通短剧插入节点或接管媒体。
(() => {
  if (!document.documentElement.classList.contains('redraw-embedded')) return;
  window.vinaCreateRedrawComparison = ({ getSource, getShots, getActiveShot, getMode, nextShot, restoreGenerated }) => {
    const preview = document.getElementById('detailPreview');
    const generated = document.getElementById('detailVideo');
    const wrap = preview?.parentElement;
    if (!wrap || !generated) return null;
    const playButton = document.getElementById('detailPlayBtn');
    const range = document.getElementById('detailTimelineRange');
    const fullscreen = document.getElementById('detailFullscreenButton');
    const progress = document.getElementById('detailProgress');
    const time = document.getElementById('detailVideoTime');
    const tabs = document.createElement('div');
    tabs.className = 'redraw-comparison-tabs';
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', '原片段与新片段对比');
    tabs.innerHTML = '<button type="button" data-redraw-compare="original" aria-pressed="false">原片段</button><button type="button" data-redraw-compare="generated" aria-pressed="true">新片段</button>';
    const original = document.createElement('video');
    original.className = 'redraw-original-video';
    original.muted = true;
    original.playsInline = true;
    original.preload = 'metadata';
    original.hidden = true;
    original.setAttribute('aria-label', '当前分镜对应的原视频片段');
    const status = document.createElement('span');
    status.className = 'redraw-original-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    wrap.classList.add('redraw-comparison-wrap');
    wrap.prepend(tabs);
    preview.append(original, status);
    let mode = 'generated';
    let shot = null;
    let sourceKey = '';
    let start = 0;
    let duration = 0;
    let pendingTime = 0;
    let failed = false;
    let ending = false;
    const isOriginal = () => mode === 'original';
    const seconds = value => Math.max(0, Number(String(value || '').replace(/[^\d.]/g, '')) || 0);
    const clock = value => {
      const n = Math.max(0, Math.floor(value || 0));
      return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    };
    const length = () => Number.isFinite(original.duration) ? Math.max(0, Math.min(duration, original.duration - start)) : duration;
    const localTime = () => Math.max(0, Math.min(length(), original.currentTime - start));
    const uiTime = (current, total) => {
      const percent = total ? Math.min(100, current / total * 100) : 0;
      progress?.style.setProperty('--progress', `${percent}%`);
      if (range) range.value = String(percent);
      if (time) time.textContent = `${clock(current)} / ${clock(total)}`;
    };
    function syncControls() {
      if (!isOriginal()) return;
      const unavailable = failed || !original.getAttribute('src') || !length();
      [playButton, range, fullscreen].forEach(control => { if (control) control.disabled = unavailable; });
      status.hidden = !unavailable;
      status.textContent = failed ? '原视频暂时无法播放，请重新上传' : '当前片段没有可对比的原视频';
    }
    function seekLocal(value) {
      pendingTime = Math.max(0, Math.min(length(), value));
      if (original.readyState >= 1) {
        try { original.currentTime = start + pendingTime; } catch { /* 元数据未就绪时由 loadedmetadata 重试。 */ }
      }
      if (isOriginal()) uiTime(pendingTime, length());
    }
    // 原片使用独立 video，不修改新片段的 src、生成状态、历史或下载素材。
    // 首次按原有分镜时长记录原视频区间，随后改时长/重排仍保留原区间，按稳定分集 ID 选择上传的视频。
    function sync() {
      const cards = Array.from(getShots());
      let offset = 0;
      cards.forEach(card => {
        if (card.dataset.redrawSourceStart === undefined) card.dataset.redrawSourceStart = String(offset);
        if (card.dataset.redrawSourceDuration === undefined) card.dataset.redrawSourceDuration = String(seconds(card.dataset.duration));
        offset = Number(card.dataset.redrawSourceStart) + Number(card.dataset.redrawSourceDuration);
      });
      const active = getActiveShot();
      const source = getSource();
      const nextStart = Number(active?.dataset.redrawSourceStart) || 0;
      const nextDuration = Number(active?.dataset.redrawSourceDuration) || 0;
      const key = `${source?.id || ''}:${source?.src || ''}:${nextStart}:${nextDuration}`;
      const changed = shot !== active || key !== sourceKey;
      if (changed) {
        original.pause();
        shot = active;
        sourceKey = key;
        start = nextStart;
        duration = nextDuration;
        pendingTime = 0;
        failed = false;
        ending = false;
      }
      if (isOriginal()) {
        generated.pause();
        if (source?.src && original.getAttribute('src') !== source.src) {
          original.src = source.src;
          original.load();
        } else if (!source?.src && original.hasAttribute('src')) {
          original.removeAttribute('src');
          original.load();
        }
        if (changed) seekLocal(0);
        syncControls();
      }
    }
    function pause() {
      original.pause();
      if (isOriginal()) setPlayIcon(false);
    }
    function play() {
      if (!isOriginal()) return;
      sync();
      if (failed || !length() || !original.getAttribute('src')) return;
      if (localTime() >= length() - 0.04) seekLocal(0);
      const key = sourceKey;
      original.play().then(() => {
        // 2026-11-01：切集后忽略旧请求的完成/失败回调，防止迟到回调暂停新一集或覆盖其播放图标。
        if (key !== sourceKey) return;
        if (!isOriginal()) original.pause();
        else setPlayIcon(!original.paused);
      }).catch(() => { if (isOriginal() && key === sourceKey) setPlayIcon(false); });
    }
    function finish() {
      if (!isOriginal() || ending) return;
      ending = true;
      pause();
      if (getMode() === 'loop' && length() > 0) {
        seekLocal(0);
        play();
      } else {
        uiTime(length(), length());
        nextShot();
      }
    }
    function select(next) {
      if (next === mode) return;
      const relative = isOriginal() ? (length() ? localTime() / length() : 0) : (seconds(getActiveShot()?.dataset.duration) ? generated.currentTime / seconds(getActiveShot()?.dataset.duration) : 0);
      generated.pause();
      pause();
      mode = next;
      ending = false;
      original.hidden = !isOriginal();
      preview.classList.toggle('redraw-comparing-original', isOriginal());
      tabs.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.redrawCompare === mode)));
      setPlayIcon(false);
      if (isOriginal()) {
        sync();
        seekLocal(relative * length());
      } else {
        status.hidden = true;
        restoreGenerated();
        const total = seconds(getActiveShot()?.dataset.duration);
        // 返回新片段仅恢复其自己的进度，不把原视频的全局时间写入生成结果。
        uiTime(Math.min(total, generated.currentTime || 0), total);
      }
    }
    tabs.addEventListener('click', event => {
      const button = event.target.closest('[data-redraw-compare]');
      if (button) select(button.dataset.redrawCompare);
    });
    original.addEventListener('loadedmetadata', () => { if (isOriginal()) { seekLocal(pendingTime); syncControls(); } });
    original.addEventListener('play', () => { if (isOriginal()) { ending = false; setPlayIcon(true); } else original.pause(); });
    original.addEventListener('pause', () => { if (isOriginal()) setPlayIcon(false); });
    original.addEventListener('timeupdate', () => {
      if (!isOriginal()) return;
      uiTime(localTime(), length());
      if (!original.paused && original.currentTime >= start + length() - 0.02) finish();
    });
    original.addEventListener('ended', finish);
    original.addEventListener('error', () => { if (isOriginal() && original.hasAttribute('src')) { failed = true; pause(); syncControls(); } });
    window.addEventListener('vina-view-changed', event => { if (event.detail.target !== 'episode-detail') pause(); else sync(); });
    const workspace = preview.closest('[data-view="episode-detail"]');
    new MutationObserver(() => { if (workspace.dataset.episodeVideoMode === 'canvas') pause(); }).observe(workspace, { attributes: true, attributeFilter: ['data-episode-video-mode'] });
    window.addEventListener('pagehide', pause);
    return { isOriginal, getVideo: () => isOriginal() ? original : generated, sync, syncControls, play, pause, seek(percent) { ending = false; seekLocal(length() * Math.max(0, Math.min(100, percent)) / 100); } };
  };
})();
