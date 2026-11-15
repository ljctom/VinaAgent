/* 2026-10-28 Product Design 改动逻辑：直接移植「设计稿 1028」的审片标注交互代码。
   矩形、画笔、文字使用灰白虚线选框与白色四角锚点；箭头仅显示首尾锚点，支持分别拖动并跨越另一端调整方向。
   命中检测、悬停光标、拖动过程和操作提示共用同一套锚点位置；绘制及文字输入时隐藏选框，导出截图不包含选框或锚点。
   「完成」按钮采用设计稿品牌按钮标记；保留截帧、撤销、删除、取消、重新编辑、附件提交及历史版本只读逻辑。 */
/* 2026-09-23 Product Design：独立帧标注编辑器。画布坐标以截图为准，窗口缩放只改变显示比例；所有对象均可移动、四角缩放，并保留可撤销的对象数据。 */
(() => {
  'use strict';
  const video = document.getElementById('reviewVideo');
  const stage = document.getElementById('reviewVideoStage');
  const input = document.getElementById('reviewCommentInput');
  if (!video || !stage || !input) return;
  const panel = stage.closest('.review-viewer-panel');
  const submit = document.getElementById('reviewCommentSubmit');
  // 2026-09-23：内嵌原版 Lucide 图标，避免 file:// 的外部 mask 加载限制。
  const icons = {"undo-2": "<svg\n  class=\"lucide lucide-undo-2\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M9 14 4 9l5-5\" />\n  <path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\" />\n</svg>", "x": "<svg\n  class=\"lucide lucide-x\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M18 6 6 18\" />\n  <path d=\"m6 6 12 12\" />\n</svg>", "type": "<svg\n  class=\"lucide lucide-type\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <polyline points=\"4 7 4 4 20 4 20 7\" />\n  <line x1=\"9\" x2=\"15\" y1=\"20\" y2=\"20\" />\n  <line x1=\"12\" x2=\"12\" y1=\"4\" y2=\"20\" />\n</svg>", "square": "<svg\n  class=\"lucide lucide-square\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n</svg>", "pen-tool": "<svg\n  class=\"lucide lucide-pen-tool\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z\" />\n  <path d=\"m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18\" />\n  <path d=\"m2.3 2.3 7.286 7.286\" />\n  <circle cx=\"11\" cy=\"11\" r=\"2\" />\n</svg>", "pencil": "<svg\n  class=\"lucide lucide-pencil\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" />\n  <path d=\"m15 5 4 4\" />\n</svg>", "trash-2": "<svg\n  class=\"lucide lucide-trash-2\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 6h18\" />\n  <path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\" />\n  <path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\" />\n  <line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\" />\n  <line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\" />\n</svg>", "move-right": "<svg\n  class=\"lucide lucide-move-right\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M18 8L22 12L18 16\" />\n  <path d=\"M2 12H22\" />\n</svg>"};
  // 2026-09-23 Product Design：参考图入口复用 Lucide image-plus 原版图标，与标注入口保持一致。
  icons["image-plus"] = "<!-- @license lucide-static v0.468.0 - ISC -->\n<svg\n  class=\"lucide lucide-image-plus\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M16 5h6\" />\n  <path d=\"M19 2v6\" />\n  <path d=\"M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5\" />\n  <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" />\n  <circle cx=\"9\" cy=\"9\" r=\"2\" />\n</svg>\n";
  const icon = name => icons[name].replace("<svg", '<svg aria-hidden="true" class="review-annotation-icon"');
  const actions = document.createElement('div');
  actions.className = 'review-annotation-composer-actions';
  actions.innerHTML = `<button type="button" class="review-annotation-entry" aria-label="标注" title="标注" aria-pressed="false">${icon('pen-tool')}</button>`;
  input.after(actions);
  const entry = actions.querySelector('button');
  // 2026-09-23：上传入口放在标注左侧，使用本地图片选择器，允许多张参考图与标注并存。
  const upload = document.createElement('button');
  upload.type = 'button';
  upload.className = 'review-annotation-entry';
  upload.setAttribute('aria-label', '上传参考图');
  upload.title = '上传参考图';
  upload.innerHTML = icon('image-plus');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  fileInput.hidden = true;
  actions.prepend(upload);
  actions.append(fileInput);
  let references = [], loadingReferences = false;
  const attachments = document.createElement('div');
  attachments.className = 'review-annotation-attachments';
  const status = document.createElement('p');
  status.className = 'review-annotation-status';
  status.setAttribute('role', 'status');
  actions.after(status);
  const preview = document.createElement('div');
  preview.className = 'review-annotation-draft';
  preview.hidden = true;
  // 2026-09-23：缩略图不再显示底部说明行，仍可点击编辑并保留无障碍名称。
  preview.innerHTML = `<button type="button" aria-label="编辑截图标注"><img alt="待提交的截图标注"></button><button type="button" class="review-annotation-remove" aria-label="移除截图标注">${icon('x')}</button>`;
  // 2026-09-23 Product Design：缩略图、意见文本和底部操作共用一个输入框外壳，截图位于文字上方。
  const shell = document.createElement('div');
  shell.className = 'review-annotation-input-shell';
  input.before(shell);
  attachments.append(preview);
  shell.append(attachments, input, actions);
  actions.append(submit);
  shell.after(status);
  // 2026-09-23 Product Design 改动逻辑：当前时间置于标题下、输入框外壳上方，状态提示仍放在输入框后。
  const currentTime = document.getElementById('reviewCommentCurrentTime');
  if (currentTime) shell.before(currentTime);
  const surface = document.createElement('div');
  surface.className = 'review-annotation-surface';
  surface.hidden = true;
  surface.innerHTML = '<canvas tabindex="0" aria-label="截图标注画布，可绘制、选择并拖动标注；箭头可拖动首尾锚点，其他标注可用四角调整大小"></canvas><textarea class="review-annotation-text" aria-label="标注文字" placeholder="输入标注文字" hidden></textarea>';
  stage.append(surface);
  const canvas = surface.querySelector('canvas');
  const editor = surface.querySelector('textarea');
  const ctx = canvas.getContext('2d');
  const toolbar = document.createElement('div');
  toolbar.className = 'review-annotation-toolbar';
  toolbar.hidden = true;
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', '编辑截图标注');
  const toolInfo = [['rect','square','矩形工具'],['pen','pen-tool','画笔工具'],['arrow','move-right','箭头工具'],['text','type','文字工具'],['undo','undo-2','撤销 (Ctrl+Z)'],['delete','trash-2','删除选中标注 (Delete)']];
  toolbar.innerHTML = toolInfo.map(([id,name,label]) => `<button type="button" class="review-annotation-tool" data-tool="${id}" data-tooltip="${label}" aria-label="${label}">${icon(name)}</button>`).join('') + '<span class="review-annotation-divider" aria-hidden="true"></span><button type="button" class="review-annotation-cancel">取消</button><button type="button" class="review-annotation-done" data-button-variant="brand">完成</button>';
  stage.after(toolbar);
  let active = false, tool = 'pen', shapes = [], selected = null, history = [], gesture = null, draft = null, frame = null, frameUrl = '', time = 0, editState = null, session = 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  const chosen = () => shapes.find(s => s.id === selected);
  const snapshot = () => ({ shapes: clone(shapes), selected });
  const save = () => { history.push(snapshot()); if (history.length > 80) history.shift(); };
  const limit = (n, min, max) => Math.max(min, Math.min(max, n));
  const scale = () => canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
  const point = e => { const r = canvas.getBoundingClientRect(); return { x: limit((e.clientX-r.left)/r.width*canvas.width,0,canvas.width), y:limit((e.clientY-r.top)/r.height*canvas.height,0,canvas.height) }; };
  const id = () => `mark-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const corners = s => [[s.x,s.y],[s.x+s.w,s.y],[s.x+s.w,s.y+s.h],[s.x,s.y+s.h]];
  const handles = s => s.type === 'arrow'
    ? [s.points[0],s.points[s.points.length-1]].map(p=>[s.x+p.x*s.w,s.y+p.y*s.h])
    : corners(s);
  function updateTools() {
    toolbar.querySelectorAll('[data-tool]').forEach(b => {
      const name = b.dataset.tool;
      if (name === 'undo') b.disabled = !history.length;
      else if (name === 'delete') b.disabled = !chosen();
      else b.setAttribute('aria-pressed', String(name === tool));
    });
  }
  // 绘制函数也用于导出，选框和控制点仅出现在编辑界面，不写入截图。
  function drawShape(c,s) {
    c.save(); c.strokeStyle='#fa494d'; c.fillStyle='#fa494d'; c.lineWidth=3*canvas.width/1000; c.lineCap='round'; c.lineJoin='round';
    if(s.type==='rect') c.strokeRect(s.x,s.y,s.w,s.h);
    else if(s.type==='text') {
      const lines=s.lines||s.text.split('\n'); const font=s.h/(lines.length*1.25);
      c.font=`600 ${font}px Arial, "Microsoft YaHei", sans-serif`; c.textBaseline='top';
      const width=Math.max(1,...lines.map(l=>c.measureText(l).width));
      c.translate(s.x,s.y); c.scale(s.w/width,1);
      lines.forEach((line,i)=>c.fillText(line,0,i*font*1.25));
    } else {
      const pts=s.points.map(p=>({x:s.x+p.x*s.w,y:s.y+p.y*s.h}));
      c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)); c.stroke();
      if(s.type==='arrow' && pts.length>1) {
        const a=pts[0], b=pts[pts.length-1], angle=Math.atan2(b.y-a.y,b.x-a.x), len=16*canvas.width/1000;
        c.beginPath(); c.moveTo(b.x-len*Math.cos(angle-.5),b.y-len*Math.sin(angle-.5)); c.lineTo(b.x,b.y); c.lineTo(b.x-len*Math.cos(angle+.5),b.y-len*Math.sin(angle+.5)); c.stroke();
      }
    }
    c.restore();
  }
  function render() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(frame) ctx.drawImage(frame,0,0,canvas.width,canvas.height);
    shapes.forEach(s=>{ if(editState?.id!==s.id) drawShape(ctx,s); });
    const s=chosen();
    // 2026-09-23：所有绘图工具均在结束手势后才显示选框，文字输入期间也不显示对象选框。
    if(s && !editState && gesture?.mode!=='draw') {
      const k=scale(); ctx.save(); ctx.strokeStyle='#d4dce4'; ctx.lineWidth=1.3*k;
      if(s.type!=='arrow') {ctx.setLineDash([5*k,4*k]);ctx.strokeRect(s.x,s.y,s.w,s.h);ctx.setLineDash([]);}
      handles(s).forEach(([x,y])=>{ctx.fillStyle='#f5f7fa';ctx.fillRect(x-5*k,y-5*k,10*k,10*k);ctx.strokeStyle='#566474';ctx.strokeRect(x-5*k,y-5*k,10*k,10*k);});ctx.restore();
    }
    updateTools();
  }
  function fit() {
    if(!active) return;
    const r=stage.getBoundingClientRect(); const ratio=canvas.width/canvas.height;
    const w=Math.max(1,Math.min(r.width-12,(r.height-12)*ratio));
    surface.style.width=`${w}px`;surface.style.height=`${w/ratio}px`;
    if(editState) positionEditor();
    render();
  }
  // 2026-09-23 Product Design：输入时按实际内容高度展开，手动换行和自动折行均完整展示，不出现内部滚动条。
  function growEditor() {
    if(!editState) return;
    const s=chosen();if(!s)return;
    editor.style.height='auto';
    const height=Math.max(38,editor.scrollHeight+2);
    editor.style.height=`${height}px`;
    const displayHeight=canvas.getBoundingClientRect().height;
    editor.style.top=`${Math.max(0,Math.min(s.y/canvas.height*displayHeight,displayHeight-height))}px`;
    editor.scrollTop=0;
  }
  function positionEditor() {
    const s=chosen(); if(!s) return;
    editor.style.left=`${s.x/canvas.width*100}%`;
    editor.style.width=`${Math.min(100-s.x/canvas.width*100,Math.max(s.w/canvas.width*100,15))}%`;
    editor.style.fontSize=`${Math.max(14,s.h/(Math.max(1,(s.lines||s.text.split('\n')).length)*1.25)/scale())}px`;
    growEditor();
  }
  // 保存与导出共用折行结果，避免输入时多行、完成后又被横向挤成一行；超出整帧高度时等比缩小以保留全部内容。
  function wrapText(text,width) {
    return text.split('\n').flatMap(paragraph=>{
      const lines=[];let line='';
      for(const char of Array.from(paragraph)) {
        if(line && ctx.measureText(line+char).width>width) {lines.push(line);line=char;}
        else line+=char;
      }
      lines.push(line);return lines;
    });
  }
  function editText(s,isNew=false) {
    selected=s.id; editState={id:s.id, before:snapshot(), isNew}; editor.value=s.text; editor.hidden=false; positionEditor(); render();editor.focus();
  }
  function commitText(cancel=false) {
    if(!editState) return;
    const s=chosen(), state=editState;
    const textWidth=Math.max(1,(editor.clientWidth-4)*scale());
    const textFont=parseFloat(editor.style.fontSize)*scale();
    editState=null; editor.hidden=true;
    if(s) {
      if(cancel) {
        shapes=state.before.shapes; if(state.isNew) shapes=shapes.filter(item=>item.id!==s.id);
      } else if(!editor.value.trim()) shapes=shapes.filter(item=>item.id!==s.id);
      else {
        if(!state.isNew) history.push(state.before);
        s.text=editor.value.trim();
        const font=textFont;
        ctx.font=`600 ${font}px Arial, "Microsoft YaHei", sans-serif`;
        s.lines=wrapText(s.text,textWidth);
        s.w=Math.max(font,...s.lines.map(line=>ctx.measureText(line).width));
        s.h=s.lines.length*font*1.25;
        const fit=Math.min(1,canvas.width/s.w,canvas.height/s.h);
        s.w*=fit;s.h*=fit;
        s.x=Math.max(0,Math.min(s.x,canvas.width-s.w));
        s.y=Math.max(0,Math.min(s.y,canvas.height-s.h));
      }
    }
    render();
  }
  function undo() { commitText();const prev=history.pop(); if(prev){shapes=prev.shapes;selected=prev.selected;render();} }
  function removeSelected() { commitText();if(!chosen())return;save();shapes=shapes.filter(s=>s.id!==selected);selected=null;render(); }
  // 进入时按原播放器 cover 裁切截取可见帧，之后编辑区域使用等比显示，避免放大布局时标注错位。
  // 2026-09-24 改动逻辑：本地截图的视频副本只在脚本加载期间共享；取到编码后即清除全局数据与加载记录，避免多次截图长期保留 Base64。
  const localMediaLoads = new Map();
  function waitMedia(media,event,action) {
    return new Promise((resolve,reject)=>{
      const clear=()=>{clearTimeout(timer);media.removeEventListener(event,ready);media.removeEventListener('error',fail);};
      const ready=()=>{clear();resolve();},fail=()=>{clear();reject(new Error('视频帧加载失败'));};
      const timer=setTimeout(fail,15000);media.addEventListener(event,ready,{once:true});media.addEventListener('error',fail,{once:true});action();
    });
  }
  async function captureSource(original,at) {
    if(location.protocol!=='file:') return {media:original,release(){}};
    const name=new URL(original.currentSrc||original.src,location.href).pathname.split('/').pop();
    if(!localMediaLoads.has(name)) localMediaLoads.set(name,new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='./assets/review-capture-media/'+name+'.js';
      script.onload=()=>{
        script.remove();
        const encoded=window.reviewCaptureMedia?.[name];
        if(window.reviewCaptureMedia)delete window.reviewCaptureMedia[name];
        localMediaLoads.delete(name);
        if(encoded)resolve(encoded);else reject(new Error('缺少当前视频'));
      };
      script.onerror=()=>{
        script.remove();
        if(window.reviewCaptureMedia)delete window.reviewCaptureMedia[name];
        localMediaLoads.delete(name);
        reject(new Error('内置视频加载失败'));
      };
      document.head.append(script);
    }));
    const encoded=await localMediaLoads.get(name);
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));
    const media=document.createElement('video');media.muted=true;media.playsInline=true;media.preload='auto';
    const release=()=>{media.pause();media.removeAttribute('src');media.load();URL.revokeObjectURL(url);};
    try {
      await waitMedia(media,'loadeddata',()=>{media.src=url;media.load();});
      if(at>0) await waitMedia(media,'seeked',()=>{media.currentTime=Math.min(at,Math.max(0,media.duration-.001));});
      return {media,release};
    } catch(error){release();throw error;}
  }
  async function open(reopen=false) {
    if(active || loadingReferences || !window.reviewAnnotationContext?.canEdit()) return;
    video.pause(); status.textContent=''; const token=++session;
    try {
      if(reopen && draft) {
        const img=new Image();img.src=draft.frame;await img.decode();if(token!==session)return;
        frame=img;frameUrl=draft.frame;shapes=clone(draft.shapes);time=draft.time;
      } else {
        if(video.readyState<2 || !video.videoWidth) { status.textContent='视频画面加载完成后即可标注。';return; }
        // 2026-09-23：按视频原始比例截取完整帧；本地文件通过按需加载的内置媒体副本生成同源 Blob，避免污染 Canvas。
        const captureTime=video.currentTime, captureGlobalTime=window.reviewAnnotationContext.time();
        const source=await captureSource(video,captureTime);
        if(token!==session){source.release();return;}
        const shot=document.createElement('canvas');
        shot.width=Math.min(1600,source.media.videoWidth);
        shot.height=Math.max(1,Math.round(shot.width*source.media.videoHeight/source.media.videoWidth));
        try {
          shot.getContext('2d').drawImage(source.media,0,0,shot.width,shot.height);
          frameUrl=shot.toDataURL('image/jpeg',.92);
        } finally { source.release(); }
        frame=shot;shapes=[];time=captureGlobalTime;
      }
      canvas.width=frame.width;canvas.height=frame.height;history=[];selected=null;tool='pen';active=true;
      panel.classList.add('is-annotating');surface.hidden=false;toolbar.hidden=false;entry.setAttribute('aria-pressed','true');
      submit.disabled=true;upload.disabled=true;attachments.querySelectorAll('button').forEach(button=>button.disabled=true);status.textContent='点击工具绘制；拖动标注可移动，箭头拖动首尾锚点调整，其他标注拖动四角缩放，双击文字修改。';
      updateCursor();fit();canvas.focus();
    } catch(error) { if(token!==session)return;close();status.textContent='截图加载失败，请重试。'+(error.name==='SecurityError'?' 请通过项目本地服务打开页面。':'');console.error('审片截图失败',error); }
  }
  function close() {
    active=false;gesture=null;editState=null;editor.hidden=true;surface.hidden=true;toolbar.hidden=true;
    // 2026-09-23：退出或重置时同步恢复两个入口，避免读取图片中切换版本后标注按钮残留禁用。
    entry.disabled=input.disabled;upload.disabled=input.disabled;
    attachments.querySelectorAll('button').forEach(button=>button.disabled=input.disabled);
    panel.classList.remove('is-annotating');entry.setAttribute('aria-pressed','false');
    submit.disabled=!window.reviewAnnotationContext?.canEdit();
    status.textContent='';
  }
  function refreshDraft() { preview.hidden=!draft;if(draft)preview.querySelector('img').src=draft.image;else preview.querySelector('img').removeAttribute('src'); }
  function done() {
    commitText();
    const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
    const c=output.getContext('2d');c.drawImage(frame,0,0,output.width,output.height);shapes.forEach(s=>drawShape(c,s));
    draft={ image:output.toDataURL('image/jpeg',.9),frame:frameUrl,shapes:clone(shapes),time };
    close();refreshDraft();status.textContent='截图已添加，可填写意见后一起提交。';input.focus();
  }
  // 2026-09-23：提交、切集、切版本时清空全部附件；令牌使尚未读取完成的旧版本图片失效。
  function reset() { ++session;loadingReferences=false;close();draft=null;references=[];fileInput.value='';shapes=[];history=[];selected=null;frame=null;frameUrl='';refreshDraft();refreshReferences(); }
  function refreshReferences() {
    attachments.querySelectorAll('.review-reference-draft').forEach(item=>item.remove());
    references.forEach(reference=>{
      const item=document.createElement('div');
      item.className='review-annotation-draft review-reference-draft';
      const thumbnail=document.createElement('div');
      thumbnail.className='review-reference-thumbnail';
      const image=document.createElement('img');
      image.src=reference.image;image.alt=reference.name;
      thumbnail.append(image);
      const remove=document.createElement('button');
      remove.type='button';remove.className='review-annotation-remove';
      remove.setAttribute('aria-label', `移除参考图 ${reference.name}`);
      remove.innerHTML=icon('x');remove.disabled=input.disabled||active;
      remove.addEventListener('click',()=>{
        if(input.disabled||active)return;
        references=references.filter(item=>item!==reference);refreshReferences();status.textContent='';
      });
      item.append(thumbnail,remove);attachments.append(item);
    });
  }
  upload.addEventListener('click',()=>{
    if(input.disabled||active||loadingReferences)return;
    fileInput.click();
  });
  fileInput.addEventListener('change',async()=>{
    const files=Array.from(fileInput.files||[]);fileInput.value='';
    if(!files.length||input.disabled||active||loadingReferences)return;
    const token=session;
    loadingReferences=true;upload.disabled=true;entry.disabled=true;submit.disabled=true;
    status.textContent='正在读取参考图…';
    // 图片先读取并解码校验，使用数据 URL 随意见保留；取消选择不改变附件，单张失败不丢弃其他图片。
    const results=await Promise.allSettled(files.map(async file=>{
      if(!file.type.startsWith('image/'))throw new Error('请选择图片文件');
      const image=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.onabort=reject;reader.readAsDataURL(file);
      });
      const check=new Image();check.src=image;await check.decode();
      return {image,name:file.name};
    }));
    if(token!==session)return;
    loadingReferences=false;upload.disabled=input.disabled;entry.disabled=input.disabled;
    submit.disabled=!window.reviewAnnotationContext?.canEdit();
    if(input.disabled)return;
    references.push(...results.filter(result=>result.status==='fulfilled').map(result=>result.value));
    refreshReferences();
    status.textContent=results.some(result=>result.status==='rejected')?'部分文件不是可读取的图片，请重新选择。':'参考图已添加，可随意见一起提交。';
  });
  function hit(s,p) {
    const pad=8*scale();
    const inside = p.x>=s.x-pad && p.x<=s.x+s.w+pad && p.y>=s.y-pad && p.y<=s.y+s.h+pad;
    if (!inside) return false;
    // 2026-09-23：选中的对象整框可拖动；未选中矩形只命中边线，允许在大框内部继续添加文字和小框。
    if (s.id===selected || s.type==='text') return true;
    if (s.type==='rect') return Math.min(Math.abs(p.x-s.x),Math.abs(p.x-s.x-s.w),Math.abs(p.y-s.y),Math.abs(p.y-s.y-s.h))<=pad;
    const points=s.points.map(v=>({x:s.x+v.x*s.w,y:s.y+v.y*s.h}));
    return points.some((b,i)=>{
      if(!i) return Math.hypot(p.x-b.x,p.y-b.y)<=pad;
      const a=points[i-1],dx=b.x-a.x,dy=b.y-a.y;
      const t=limit(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
      return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=pad;
    });
  }
  // 2026-10-28 改动逻辑：悬停对象显示抓手、移动时显示抓紧；箭头首尾显示十字光标，其他对象四角显示对应方向的缩放光标。
  function updateCursor(p) {
    const s=chosen();
    const handle=gesture?.mode==='resize' ? gesture.handle : s && !editState && p ? handles(s).findIndex(([x,y])=>Math.hypot(p.x-x,p.y-y)<12*scale()) : -1;
    if(gesture?.mode==='move') canvas.style.cursor='grabbing';
    else if(gesture?.mode==='draw') canvas.style.cursor='crosshair';
    else if(handle>=0) canvas.style.cursor=s?.type==='arrow'?'crosshair':handle%2===0?'nwse-resize':'nesw-resize';
    else if(p && shapes.some(item=>hit(item,p))) canvas.style.cursor='grab';
    else canvas.style.cursor=tool==='text'?'text':'crosshair';
  }
  function addText(p) {
    save();const font=canvas.width*.025;
    const item={id:id(),type:'text',x:Math.min(p.x,canvas.width-font*8),y:Math.min(p.y,canvas.height-font*2),w:font*8,h:font*1.25,text:''};
    shapes.push(item);editText(item,true);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!active || e.button!==0 || gesture) return;
    // 2026-09-23：先阻止画布默认聚焦，避免新文字输入框刚获得焦点就失焦并删除空文字。
    e.preventDefault();
    commitText();const p=point(e),s=chosen();const handle=s?handles(s).findIndex(([x,y])=>Math.hypot(p.x-x,p.y-y)<12*scale()):-1;
    const target=handle>=0?s:[...shapes].reverse().find(item=>hit(item,p));
    const before=snapshot();
    if(target) {
      selected=target.id;save();gesture={mode:handle>=0?'resize':'move',start:p,original:clone(target),handle,before};
    } else if(tool==='text') {
      addText(p);updateCursor(p);return;
    } else {
      save();selected=id();shapes.push({id:selected,type:tool,x:p.x,y:p.y,w:1,h:1,points:[{x:0,y:0}]});gesture={mode:'draw',start:p,samples:[p],before};
    }
    canvas.setPointerCapture(e.pointerId);canvas.focus();updateCursor(p);render();
  });
  canvas.addEventListener('pointermove',e=>{
    const p=point(e);updateCursor(p);if(!gesture)return;const s=chosen(),g=gesture;if(!s)return;
    if(g.mode==='move') { s.x=limit(g.original.x+p.x-g.start.x,0,canvas.width-s.w);s.y=limit(g.original.y+p.y-g.start.y,0,canvas.height-s.h); }
    else if(g.mode==='resize' && s.type==='arrow') {
      // 2026-10-28 改动逻辑：箭头首尾独立移动，可跨越固定端点；重新计算包围盒和归一化坐标以保持箭头方向与命中位置一致。
      const ends=handles(g.original);ends[g.handle]=[p.x,p.y];
      s.x=Math.min(ends[0][0],ends[1][0]);s.y=Math.min(ends[0][1],ends[1][1]);
      s.w=Math.max(1,Math.abs(ends[1][0]-ends[0][0]));s.h=Math.max(1,Math.abs(ends[1][1]-ends[0][1]));
      s.points=ends.map(([x,y])=>({x:(x-s.x)/s.w,y:(y-s.y)/s.h}));
    }
    else if(g.mode==='resize') {
      const opposite=corners(g.original)[(g.handle+2)%4], left=g.handle===0||g.handle===3, top=g.handle<2, min=8*scale();
      let w=Math.max(min,left?opposite[0]-p.x:p.x-opposite[0]),h=Math.max(min,top?opposite[1]-p.y:p.y-opposite[1]);
      // 文字等比缩放使字号一起变化；图形、画笔和箭头可自由调整宽高。
      if(s.type==='text') {const factor=Math.max(w/g.original.w,h/g.original.h);w=g.original.w*factor;h=g.original.h*factor;const cap=Math.min(1,(left?opposite[0]:canvas.width-opposite[0])/w,(top?opposite[1]:canvas.height-opposite[1])/h);w*=cap;h*=cap;}
      s.w=Math.min(w,left?opposite[0]:canvas.width-opposite[0]);s.h=Math.min(h,top?opposite[1]:canvas.height-opposite[1]);s.x=left?opposite[0]-s.w:opposite[0];s.y=top?opposite[1]-s.h:opposite[1];
    } else {
      if(s.type==='pen')g.samples.push(p);else g.samples=[g.start,p];
      const xs=g.samples.map(v=>v.x),ys=g.samples.map(v=>v.y);s.x=Math.min(...xs);s.y=Math.min(...ys);s.w=Math.max(1,Math.max(...xs)-s.x);s.h=Math.max(1,Math.max(...ys)-s.y);s.points=g.samples.map(v=>({x:(v.x-s.x)/s.w,y:(v.y-s.y)/s.h}));
    }
    render();
  });
  function endGesture(cancel=false) {
    if(!gesture)return;const g=gesture,s=chosen();gesture=null;
    if(cancel || (g.mode==='draw' && s && Math.hypot(s.w,s.h)<5*scale())) {shapes=g.before.shapes;selected=g.before.selected;history.pop();}
    updateCursor();render();
  }
  canvas.addEventListener('pointerup',e=>{endGesture();updateCursor(point(e));});
  canvas.addEventListener('pointercancel',()=>endGesture(true));
  canvas.addEventListener('lostpointercapture',()=>endGesture());
  canvas.addEventListener('dblclick',e=>{const s=[...shapes].reverse().find(s=>s.type==='text'&&hit(s,point(e)));if(s)editText(s);});
  editor.addEventListener('input',growEditor);
  editor.addEventListener('blur',()=>commitText());
  editor.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();commitText(true);canvas.focus();}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();commitText();canvas.focus();}});
  toolbar.addEventListener('click',e=>{
    const button=e.target.closest('[data-tool]');if(!button)return;commitText();const name=button.dataset.tool;
    if(name==='undo')undo();else if(name==='delete')removeSelected();else {
      tool=name;selected=null;render();
      // 2026-09-23：文字工具点击即显示可输入区域；也可点画布重新定位，确认后可拖动文字。
      if(name==='text') {addText({x:canvas.width*.4,y:canvas.height*.45});updateCursor();return;}
    }
    updateCursor();canvas.focus();
  });
  toolbar.querySelector('.review-annotation-cancel').addEventListener('click',()=>{close();entry.focus();});
  toolbar.querySelector('.review-annotation-done').addEventListener('click',done);
  entry.addEventListener('click',()=>open(Boolean(draft)));
  preview.querySelector('button').addEventListener('click',()=>open(true));
  preview.querySelector('.review-annotation-remove').addEventListener('click',()=>{if(active)return;draft=null;refreshDraft();status.textContent='';});
  document.addEventListener('keydown',e=>{
    if(!active || /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
    else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSelected();}
    else if(e.key==='Escape'){selected=null;render();}
  });
  // 编辑期间禁止外部播放推进帧；版本状态变化时同步禁用入口，历史版本和已通过版本沿用原只读规则。
  video.addEventListener('play',()=>{if(active)video.pause();});
  const syncPermission=()=>{if(input.disabled)reset();entry.disabled=input.disabled||loadingReferences;upload.disabled=input.disabled||active||loadingReferences;attachments.querySelectorAll('button').forEach(button=>button.disabled=input.disabled||active);};
  new MutationObserver(syncPermission).observe(input,{attributes:true,attributeFilter:['disabled']});
  new ResizeObserver(fit).observe(stage);
  // 2026-09-23：参考图作为独立附件传给意见提交入口，读取中阻止提交不完整附件。
  window.reviewAnnotation={reset,getDraft:()=>draft,getReferences:()=>references.slice(),isEditing:()=>active||loadingReferences};
  syncPermission();
})();
