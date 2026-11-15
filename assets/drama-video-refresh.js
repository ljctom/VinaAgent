/* 2026-10-29 改动逻辑：将最新剧本文字转换为第五步提示词和九列分镜；旧视频先归档，
 * 新草稿不携带旧视频/封面。此模块只处理数据，不调用付费生成接口，便于独立验证归档与失败回滚。 */
(function (scope) {
  'use strict';
  const snapshotKeys = ['prompt','duration','meta','cover','videoSrc','videoPoster','videoCoverTime','videoModel','videoQuality','videoRatio','referenceState','storyboardRows','storyboardChanged','lastRemakeSegments','remakeModel','remakeResolution'];
  function versions(clip) {
    try { const items = JSON.parse(clip.historyVersions || '[]'); return Array.isArray(items) ? items : []; }
    catch (_) { throw new Error('视频历史记录无法读取，请稍后重试'); }
  }
  function archiveClip(clip, fallbackVideo = '') {
    const saved = { ...clip };
    saved.historyShotId ||= `shot-${crypto.randomUUID()}`;
    const history = versions(saved);
    // 生成快照已有记录时直接保留，禁止把用户后来编辑的提示词重写到旧视频版本。
    if ((saved.generationState || 'generated') === 'generated' && !history.length) {
      const snapshot = Object.fromEntries(snapshotKeys.filter(key => saved[key] !== undefined).map(key => [key, saved[key]]));
      snapshot.videoSrc ||= fallbackVideo;
      if (snapshot.videoSrc) {
        const entry = { id: `video-${crypto.randomUUID()}`, number: 1, createdAt: new Date().toISOString(), snapshot };
        history.push(entry);
        saved.historyVersionId = entry.id;
      }
    }
    saved.historyVersions = JSON.stringify(history);
    return saved;
  }
  function sceneRows(scene, summary, assets) {
    const lines = (scene.lines || []).map(String).filter(line => line.trim() && !/^Duration\s*:/i.test(line));
    const people = lines.filter(line => /^人物[\s:：]/.test(line)).map(line => line.replace(/^人物[\s:：]+/, '')).join('、');
    const body = lines.filter(line => !/^人物[\s:：]/.test(line));
    if (!body.length) return [];
    return body.map((line, index) => {
      const dialogue = /^\(dialogue\)/.test(line) || (!/^\(action\)/.test(line) && /^[^:：]{1,24}[:：]/.test(line));
      const seconds = Math.min(15, Math.max(1, Number((line.match(/\((\d+)s\)\s*$/) || [])[1]) || 3));
      const text = line.replace(/^\((?:action|dialogue)\)\s*/, '').replace(/\s*\(\d+s\)\s*$/, '').trim();
      const matchingScene = assets.find(asset => asset.type === 'scene' && `${summary}\n${lines.join('\n')}`.includes(asset.name));
      return [String(index + 1).padStart(2, '0'), String(seconds), scene.location || matchingScene?.name || '按本场剧本场景', dialogue ? '中近景' : '中景', '保持动作与视线连续', dialogue ? (people ? `${people}，按对白作出自然反应。` : '按对白作出自然反应。') : text, dialogue ? text : '—', '沿用当前资产与画风，保持光影连续', dialogue ? '对白清晰，环境声自然' : '按画面动作保留环境声'];
    });
  }
  function buildEpisode(input, previousClips = [], previousArchive = [], fallbackVideo = '') {
    if (!input.title || !input.summary?.trim()) throw new Error('请先补全各集大纲，再更新视频提示词');
    const assets = input.assets || [];
    let scenes = (input.scenes || []).filter(scene => (scene.lines || []).some(line => String(line).trim()));
    if (!scenes.length) {
      const beats = String(input.beats || '').split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])|\n+/u).map(line => line.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]/u, '').trim()).filter(Boolean);
      scenes = [{ id: `${input.episodeId}-outline`, lines: beats.length ? beats : [input.summary] }];
    }
    const chunks = [];
    scenes.forEach((scene, sceneIndex) => {
      const rows = sceneRows(scene, input.summary, assets);
      let current = [], duration = 0, part = 0;
      const flush = () => { if (current.length) chunks.push({ sourceKey: `${scene.id || sceneIndex}:${part++}`, rows: current, duration }); current = []; duration = 0; };
      rows.forEach(row => { if (duration + Number(row[1]) > 15) flush(); current.push(row); duration += Number(row[1]); });
      flush();
    });
    if (!chunks.length) throw new Error('当前剧本没有可转换的分场内容');
    const old = previousClips.map(clip => archiveClip(clip, fallbackVideo));
    const used = new Set();
    const clips = chunks.map((chunk, index) => {
      let previous = old.find(clip => clip.scriptSourceKey === chunk.sourceKey && !used.has(clip));
      // 旧原型没有分场标识时仅做首次迁移；后续依靠稳定分场标识保留归属，删除的片段进入独立归档。
      previous ||= old[index] && !old[index].scriptSourceKey && !used.has(old[index]) ? old[index] : null;
      if (previous) used.add(previous);
      const relatedAssets = assets.filter(asset => `${input.summary}\n${chunk.rows.flat().join('\n')}`.includes(asset.name));
      const references = relatedAssets.map(asset => ({ html: asset.html }));
      let elapsed = 0;
      const rows = chunk.rows.map((row, rowIndex) => [String(rowIndex + 1).padStart(2, '0'), ...row.slice(1)]);
      const prompt = [`${input.title} · 片段 ${String(index + 1).padStart(2, '0')}`, `本集大纲：${input.summary}`, input.story ? `故事背景：${input.story}` : '', input.style ? `画风：${input.style}` : '', relatedAssets.length ? `参考资产：${relatedAssets.map(asset => '@' + asset.name).join('、')}` : '', ...rows.map(row => { const from = elapsed; elapsed += Number(row[1]); return `${from}–${elapsed}s：场景：${row[2]}；景别：${row[3]}；运镜：${row[4]}；画面：${row[5]}${row[6] !== '—' ? `；对白：${row[6]}` : ''}；光影：${row[7]}；音效：${row[8]}。`; })].filter(Boolean).join('\n\n');
      return { title: `片段 ${String(index + 1).padStart(2, '0')}`, duration: `${chunk.duration}s`, meta: `时长 ${chunk.duration}s ｜ 场景：${rows[0][2]}`, prompt, generationState: 'pending', historyShotId: previous?.historyShotId || `shot-${crypto.randomUUID()}`, historyVersions: previous?.historyVersions || '[]', historyVersionId: '', videoModel: previous?.videoModel || input.videoModel || 'Seedance 2.5', videoQuality: previous?.videoQuality || input.videoQuality || '720p', videoRatio: previous?.videoRatio || input.ratio || '16:9', referenceState: JSON.stringify(references), storyboardRows: JSON.stringify(rows), storyboardChanged: 'false', scriptSourceKey: chunk.sourceKey, scriptRevision: input.revision };
    });
    const archive = new Map(previousArchive.map(clip => [clip.historyShotId, clip]));
    old.filter(clip => !used.has(clip) && versions(clip).length).forEach(clip => archive.set(clip.historyShotId, clip));
    return { clips, archivedClips: [...archive.values()], hasHistory: old.some(clip => versions(clip).length) || archive.size > 0 };
  }
  const api = { snapshotKeys, versions, archiveClip, buildEpisode };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.VinaDramaVideoRefresh = api;
})(globalThis);
