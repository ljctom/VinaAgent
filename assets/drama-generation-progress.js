/* 2026-11-10 Product Design：短剧五处等待文案共用展示层。
 * 单个视频百分比固定按 600000ms（十分钟）计算，300000ms 即 50%；大纲/剧本显式传入三秒，其他环节仍按 120000ms（两分钟），与后端阶段/进度完全无关。
 * 原型各步骤既有几秒完成时间保持不变；本模块没有完成回调、不触发步骤切换，结果就绪由原业务立即 finish/sync(false)。
 * 达到对应展示时长的 100% 后只保持展示，仍须原任务完成才退出；离开页面不取消任务，也不重置已启动的时钟。
 */
(() => {
  const durationMs = 120000;
  // 2026-11-10 Product Design：仅单个视频的假百分比改为十分钟；不改任务开始时间、原型完成计时或其他生成环节。
  const videoDurationMs = 600000;
  const starts = new Map();
  const bindings = new Map();
  let timer = null;

  function progressAt(elapsedMs, totalMs = durationMs) {
    return Math.max(1, Math.min(100, Math.floor(Math.max(0, elapsedMs) * 100 / totalMs)));
  }

  function start(task) {
    if (!starts.has(task)) starts.set(task, Date.now());
    return starts.get(task);
  }

  function hide(host) {
    const binding = bindings.get(host);
    if (!binding) return;
    binding.copy.remove();
    host.classList.remove('has-vina-drama-progress');
    delete host.dataset.vinaDramaProgressLayout;
    bindings.delete(host);
    if (!bindings.size && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function finish(task) {
    starts.delete(task);
    for (const [host, binding] of bindings) {
      if (binding.task === task) hide(host);
    }
  }

  function render(binding) {
    const percent = progressAt(Date.now() - start(binding.task), binding.durationMs);
    const text = `${binding.title}...（${percent}%）`;
    if (binding.heading.textContent !== text) binding.heading.textContent = text;
  }

  function tick() {
    for (const [host, binding] of bindings) {
      // 节点移除仅卸载展示，不删除任务时钟；返回同一资产/片段可继续原百分比。
      if (!host.isConnected) hide(host);
      else render(binding);
    }
  }

  function sync(host, generating, title, task = host, options = {}) {
    // 2026-11-10：资产与视频编辑器也供转绘复用，本次文案仅安装到普通短剧，不改变转绘等待态。
    if (!host || document.documentElement.classList.contains('redraw-embedded')) return;
    if (!generating) {
      hide(host);
      finish(task);
      return;
    }
    // 2026-11-14 Product Design：分集原型传入独立任务的真实开始时间，切回该集时百分比继续推进；
    // 其他入口不传 startedAt，保留原有首次展示时钟，不影响资产与视频计时。
    if (Number.isFinite(options.startedAt)) starts.set(task, options.startedAt);
    start(task);
    let binding = bindings.get(host);
    if (binding && binding.task !== task) {
      hide(host);
      binding = null;
    }
    if (!binding) {
      // 内联资产编辑器可能从模板克隆 DOM；丢弃克隆的展示节点，防止出现重复文字。
      host.querySelectorAll(':scope > .vina-drama-generation-copy').forEach(copy => copy.remove());
      const copy = document.createElement('div');
      copy.className = 'vina-drama-generation-copy';
      copy.setAttribute('role', 'status');
      // 原等待容器已公告生成状态，逐次百分比不重复打断辅助阅读。
      copy.setAttribute('aria-live', 'off');
      const heading = document.createElement('strong');
      heading.className = 'vina-drama-generation-title';
      const hint = document.createElement('span');
      hint.className = 'vina-drama-generation-hint';
      hint.textContent = '离开此页面不会中断生成';
      copy.append(heading, hint);
      host.appendChild(copy);
      host.classList.add('has-vina-drama-progress');
      host.dataset.vinaDramaProgressLayout = options.overlay ? 'overlay' : 'inline';
      binding = { task, copy, heading, title };
      bindings.set(host, binding);
    }
    binding.title = title;
    // 2026-11-14 Product Design：大纲/剧本显式传入三秒，使百分比与实际等待一致；
    // 未传入有效时长的资产/视频保留原默认值，展示层仍不负责结束任务或切换步骤。
    binding.durationMs = Number.isFinite(options.durationMs) && options.durationMs > 0
      ? options.durationMs
      : options.kind === 'video' ? videoDurationMs : durationMs;
    render(binding);
    if (timer === null) timer = window.setInterval(tick, 100);
  }

  window.VinaDramaLoading = Object.freeze({ durationMs, videoDurationMs, progressAt, start, finish, sync });

  function installEpisodeStatus() {
    const workspace = document.querySelector('.episode-workspace[data-view="episode-video"]');
    const host = workspace?.querySelector('.episode-generating-state .asset-parsing-content');
    if (!host) return;
    // 第五步保留用户确认的独立主标题，去掉“请稍后”；前置等待和普通生成共用原 class 完成信号。
    // 只观察生成 class，离页的 hidden 属性不清零或取消任务；不观察每次百分比文字，避免反馈循环。
    const update = () => sync(host, workspace.classList.contains('is-generating-episode-scripts'), '正在生成分集脚本和提示词');
    new MutationObserver(update).observe(workspace, { attributes: true, attributeFilter: ['class'] });
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installEpisodeStatus, { once: true });
  else installEpisodeStatus();
})();
