/* 2026-11-14 Product Design 原型专用逻辑：每个项目、每一集独立记录 pending / generating / ready。
 * 为了演示逐集完成，只有第 3、5 集预置为 pending；点击切换到该集后才启动三秒计时，其余集预置为 ready。
 * 正式产品应由后台任务状态逐集驱动，不能以点击作为实际生成触发条件，也不能使用此演示计时器判断真实完成。
 * 2026-11-14 真实产品进度约定：同一项目同一轮剧本生成共用一套进度与开始时间，不按当前查看的集数重新计时；
 * 无论切到哪一集（例如第 4 集或第 6 集），同一时刻展示的生成进度一致，切集仅改变当前查看的内容。
 * 各集是否完成仍分别控制集数置灰、可查看状态及下一步是否可用；共享进度不表示所有集同时完成。
 * 下方第 3、5 集独立三秒计时仅为原型展示特例，不代表正式产品应给每集建立独立进度条。
 * 离开当前集或项目不取消已开始的任务；再次查看不重复生成，整批重新生成时才重置本项目状态。
 */
(() => {
  const projects = new Map();
  const demoEpisodes = new Set([2, 4]);
  const notify = (project, index) => window.dispatchEvent(new CustomEvent('vina-script-episode-generation-change', { detail: { project, index } }));

  function ensure(project, indices = []) {
    if (!projects.has(project)) projects.set(project, new Map());
    const episodes = projects.get(project);
    for (const index of indices) {
      if (!episodes.has(index)) episodes.set(index, { status: demoEpisodes.has(index) ? 'pending' : 'ready', startedAt: null, timer: null });
    }
    return episodes;
  }

  function status(project, index) {
    return ensure(project, [index]).get(index).status;
  }

  function allReady(project, indices) {
    return indices.length > 0 && indices.every(index => status(project, index) === 'ready');
  }

  // 2026-11-14：切回仍在生成的分集时沿用原开始时间，百分比不能重新从 1% 起算。
  function startedAt(project, index) {
    return ensure(project, [index]).get(index).startedAt;
  }

  function reset(project, indices) {
    const previous = projects.get(project);
    previous?.forEach(episode => window.clearTimeout(episode.timer));
    projects.delete(project);
    ensure(project, indices);
    notify(project, null);
  }

  function start(project, index, durationMs = 3000) {
    const episodes = ensure(project, [index]);
    const episode = episodes.get(index);
    if (episode.status !== 'pending') return false;
    episode.status = 'generating';
    episode.startedAt = Date.now();
    episode.timer = window.setTimeout(() => {
      // 已重置的旧任务即使晚到也不能将新一轮任务标记完成。
      if (projects.get(project) !== episodes || episodes.get(index) !== episode) return;
      episode.status = 'ready';
      episode.timer = null;
      notify(project, index);
    }, durationMs);
    notify(project, index);
    return true;
  }

  window.VinaScriptEpisodes = Object.freeze({ ensure, status, startedAt, allReady, reset, start });
})();
