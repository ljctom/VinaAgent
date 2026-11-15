// 2026-10-25 Product Design 阿语适配：注册独立 ShadowRoot 的局部翻译与 RTL，预设/参数的 data 值和原状态保存逻辑不变；阿语搜索同时匹配译名，提示气泡使用译文。
// 2026-10-22 Product Design 改动逻辑：仅迁移 UI 稿短剧第一步的布局、弹窗、预设与图片。
// 红框中的说明文字、已选数量和底部编辑栏不再生成，改用整卡点击或 Enter/空格编辑，标签仍可删除。
// 样式挂载于 Shadow DOM，数据写回原设定状态，“下一步”仍点击原确认按钮进入原有后续流程。
// V19 uses the existing project state and the existing outline confirmation flow.
(function installV19(){
 if(!window.__VINA_APP_READY){window.addEventListener('vina-app-ready',installV19,{once:true});return}
 if(!splitDramaFlow||!scriptSetupModal||window.vinaStep1V19)return;
 // 2026-10-27 Product Design 改动逻辑：目标国家默认值由页面语言决定；仅未手动保存且没有项目历史设定时自动跟随语言。
 // 英语与阿语分别采用美国、沙特阿拉伯作为默认市场，国家仍以规范中文值进入既有保存和 Agent 请求链路。
 function defaultTargetCountry(){
  const locale=(window.vinaPageLanguage?.get()||window.document.documentElement.lang||'zh-CN').replace(/_/g,'-').toLowerCase().split('-')[0];
  return {zh:'中国',en:'美国',ja:'日本',fr:'法国',ms:'马来西亚',ar:'沙特阿拉伯'}[locale]||'中国';
 }
 const mount=document.createElement('div');mount.id='vinaStep1V19';
 // 2026-10-22：先挂载和初始化新界面，成功后才添加隐藏原表单的 has-v19，避免初始化中断时留下空白。
 scriptSetupModal.append(mount);
 scriptSetupModal.removeAttribute('aria-labelledby');scriptSetupModal.setAttribute('aria-label','第一步设定');
// Approved V19 controls, mounted with isolated styles in the complete HTML.
(function(){
 const host=window.document.getElementById('vinaStep1V19');
 const document=host.attachShadow({mode:'open'});
 document.append(window.document.getElementById('vina-step1-v19-template').content.cloneNode(true));
 // 2026-10-24 Product Design：仅在短剧第一步加载 UI稿1024 的中性灰蓝选中态、弹窗排版、白色保存按钮及语言图片样式。
 // 2026-10-27 Product Design：刷新 Shadow DOM 样式缓存，加载 UI 稿 1027 的右下角纯文字下一步按钮。
 // 2026-10-27 Product Design 改动逻辑：刷新第一步 Shadow DOM 样式缓存，加载设计稿的圆角胶囊按钮和文字选项。
 const modelStyles=window.document.createElement('link');modelStyles.rel='stylesheet';modelStyles.href='./assets/step1-v19-model-menu.css?v=20261111-drama-membership-diamond';document.append(modelStyles);

const presets=[{"id": "cultivation", "name": "玄幻修仙逆袭", "color": "139,170,165", "style": "classic-costume", "genres": ["仙侠玄幻"], "audiences": ["男频"], "roles": ["小人物", "修士", "天才"], "eras": ["架空", "古代"], "hooks": ["器物金手指", "收集升级", "扮猪吃虎"], "tones": ["热血燃爽", "励志成长"], "structures": ["英雄旅程"]}, {"id": "career", "name": "现实职场成长", "color": "143,161,184", "style": "modern-short-drama", "genres": ["职场商战"], "audiences": ["泛人群"], "roles": ["打工人", "专业型", "不完美成长型"], "eras": ["现代"], "hooks": ["亲历行业细节", "真实成长", "普通人的处境"], "tones": ["励志成长", "轻松治愈"], "structures": ["三幕式"]}, {"id": "survival", "name": "末世生存基建", "color": "153,172,149", "style": "blade-runner", "genres": ["求生冒险", "科幻机甲"], "audiences": ["男频", "泛人群"], "roles": ["小人物", "专业型", "双强"], "eras": ["末世", "近未来"], "hooks": ["基建生存", "收集升级", "系统傍身"], "tones": ["紧张刺激", "热血燃爽"], "structures": ["英雄旅程", "单元结构"]}, {"id": "heritage", "name": "非遗国潮视觉", "color": "158,175,170", "style": "zhang-yimou", "genres": ["奇幻脑洞", "年代情感"], "audiences": ["泛人群", "出海"], "roles": ["专业型", "教师"], "eras": ["现代", "古代"], "hooks": ["文化元素新用", "风格混搭", "视觉奇观"], "tones": ["轻松治愈", "励志成长"], "structures": ["交叉结构"]}, {"id": "romance", "name": "古代女频甜宠", "color": "179,154,172", "style": "beautiful-costume", "genres": ["古言宫廷", "轻喜剧"], "audiences": ["女频"], "roles": ["王妃", "王爷", "女强", "忠犬"], "eras": ["古代", "架空"], "hooks": ["先婚后爱", "契约婚姻", "欢喜冤家"], "tones": ["甜宠温暖", "轻喜欢脱"], "structures": ["三幕式"]}, {"id": "mystery", "name": "规则怪谈悬疑", "color": "157,154,181", "style": "david-lynch", "genres": ["恐怖灵异", "悬疑刑侦"], "audiences": ["泛人群"], "roles": ["小人物", "警探", "腹黑"], "eras": ["现代", "平行世界"], "hooks": ["规则禁忌", "单元解谜", "时间循环"], "tones": ["悬疑压迫", "紧张刺激"], "structures": ["环形结构", "单元结构"]}, {"id": "revenge", "name": "重生复仇爽剧", "color": "163,156,176", "style": "modern-kdrama", "genres": ["现言都市", "职场商战"], "audiences": ["女频"], "roles": ["女强", "黑莲花", "大小姐"], "eras": ["现代"], "hooks": ["重生复仇", "隐藏身份", "马甲大佬"], "tones": ["热血燃爽", "紧张刺激"], "structures": ["非线性结构"]}, {"id": "family", "name": "仙门团宠日常", "color": "157,176,164", "style": "beautiful-costume", "genres": ["仙侠玄幻", "轻喜剧"], "audiences": ["女频", "泛人群"], "roles": ["福宝", "修士", "忠犬"], "eras": ["架空"], "hooks": ["团宠被爱", "欢喜冤家", "双向救赎"], "tones": ["轻松治愈", "甜宠温暖", "轻喜欢脱"], "structures": ["单元结构"]}];
const styleNames={'classic-costume':'经典古装','modern-short-drama':'现代短剧','blade-runner':'银翼杀手','zhang-yimou':'张艺谋风格','beautiful-costume':'美型古装','david-lynch':'大卫林奇','modern-kdrama':'现代韩剧'};
const fields=[['style','画风','▧',Object.values(styleNames),true],['genres','题材','▤',['仙侠玄幻','现言都市','职场商战','求生冒险','科幻机甲','奇幻脑洞','年代情感','古言宫廷','轻喜剧','恐怖灵异','悬疑刑侦']],['audiences','目标受众','◎',['男频','女频','泛人群','出海']],['roles','角色设定','♙',['小人物','修士','天才','打工人','专业型','不完美成长型','双强','教师','王妃','王爷','女强','忠犬','警探','腹黑','黑莲花','大小姐','福宝']],['eras','时代背景','◷',['古代','架空','现代','末世','近未来','平行世界']],['hooks','核心看点','⌁',['器物金手指','收集升级','扮猪吃虎','亲历行业细节','真实成长','普通人的处境','基建生存','系统傍身','文化元素新用','风格混搭','视觉奇观','先婚后爱','契约婚姻','欢喜冤家','规则禁忌','单元解谜','时间循环','重生复仇','隐藏身份','马甲大佬','团宠被爱','双向救赎']],['tones','情绪基调','☷',['热血燃爽','励志成长','轻松治愈','紧张刺激','甜宠温暖','轻喜欢脱','悬疑压迫']],['structures','剧本结构','▦',['英雄旅程','三幕式','五幕式','单元结构','交叉结构','环形结构','非线性结构','平行结构']]];
// 2026-11-12：视频参数沿用短剧的 Wan 3.0 默认值，图片参数独立初始化。
const specs=[['集数','▦',['6 集','8 集','10 集','12 集','24 集'],'10 集'],['图片参数','▣',['Seedance 2.5','Seedance 2.0','Veo 3.1'],window.vinaSetupVideoModels.defaultModel],['视频参数','□',['9:16, 720p','9:16, 1080p','16:9, 720p','16:9, 1080p'],'9:16, 720p'],['目标国家','◎',['中国','美国','日本','韩国'],defaultTargetCountry()]];
// 2026-10-22 Product Design 改动逻辑：两个规格入口分别编辑图片和视频；视频仍使用原 specs 索引保存，
// 图片通过独立快照保存模型、清晰度和比例，避免修改图片时覆盖视频及原有后续流程。
const defaultImageParameters={model:'Gpt Image 2.5 Flare',resolution:'2K',ratio:'9:16'};
let imageParameters={...defaultImageParameters};
// 2026-10-27：单独保存国家来源，其他设定的编辑不会把自动国家误判为手动选择；旧项目缺失来源时按已保存值保留。
let countrySource='default';
let state=Object.fromEntries(fields.map(([key])=>[key,[]])),activePreset=null,modified=false,editing=null,draft=[],presetBaseline=null;
const $=id=>document.getElementById(id);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cloneState=()=>Object.fromEntries(fields.map(([k])=>[k,[...state[k]]]));
function applyPreset(id){
 if(activePreset===id){state=presetBaseline;activePreset=null;presetBaseline=null;modified=false;render();document.querySelector('[data-preset="'+id+'"]').focus();notify('已取消预设，保留自主设定');return}
 if(!activePreset)presetBaseline=cloneState();
 const p=presets.find(p=>p.id===id);activePreset=id;modified=false;fields.forEach(([key])=>state[key]=key==='style'?[styleNames[p.style]]:[...p[key]]);render();document.querySelector('[data-preset="'+id+'"]').focus();
}
function setField(key,values){state[key]=[...values];if(activePreset){presetBaseline[key]=[...values];modified=true}}
const step1IconPaths={"episodes": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"/><path d=\"M8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4M8 12h8\"/>", "model": "<path d=\"m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z M4 7.5l8 4.5 8-4.5M12 12v9M8 5.25l8 4.5\"/>", "parameters": "<path d=\"M4 6h5M13 6h7M4 12h9M17 12h3M4 18h2M10 18h10\"/><rect x=\"9\" y=\"4\" width=\"4\" height=\"4\" rx=\"1\"/><rect x=\"13\" y=\"10\" width=\"4\" height=\"4\" rx=\"1\"/><rect x=\"6\" y=\"16\" width=\"4\" height=\"4\" rx=\"1\"/>", "country": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9Z\"/>", "style": "<path d=\"M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.8 1.8 0 0 1 1.4-2.9H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z\"/><circle cx=\"7.5\" cy=\"10\" r=\".7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"10\" cy=\"6.8\" r=\".7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.5\" cy=\"7\" r=\".7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"17.2\" cy=\"10.3\" r=\".7\" fill=\"currentColor\" stroke=\"none\"/>", "genres": "<path d=\"m4 3 7 1.5L18 3v15.5L11 20l-7-1.5V3Z M11 4.5V20M18 7h3v14l-7 1\"/><path d=\"m6.5 8 2 .4M6.5 12l2 .4M13.5 8l2-.4M13.5 12l2-.4\"/>", "audiences": "<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4.6V20\"/>", "roles": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/><circle cx=\"12\" cy=\"9\" r=\"3\"/><path d=\"M7 18a5 5 0 0 1 10 0\"/>", "eras": "<path d=\"M6 3h12M6 21h12M7 3v3c0 3 2 4 5 6-3 2-5 3-5 6v3M17 3v3c0 3-2 4-5 6 3 2 5 3 5 6v3M8 7h8M8 18h8\"/>", "hooks": "<path d=\"M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M12 7l1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5L12 7Z\"/>", "tones": "<path d=\"M3 5h12v7a6 6 0 0 1-12 0V5Z M15 4h6v10a6 6 0 0 1-6 6M6 9h1M11 9h1M6 13q3 3 6 0M18 8h1M17 15q1-2 3-2\"/>", "structures": "<rect x=\"8\" y=\"3\" width=\"8\" height=\"5\" rx=\"1.5\"/><path d=\"M12 8v4M5 16v-4h14v4\"/><rect x=\"2\" y=\"16\" width=\"6\" height=\"5\" rx=\"1.5\"/><rect x=\"16\" y=\"16\" width=\"6\" height=\"5\" rx=\"1.5\"/>"};
const step1Icon=key=>`<svg class="step1-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${step1IconPaths[key]}</svg>`;
// 2026-10-22 Product Design 改动逻辑：两个媒体摘要都已切为单行时，收起整栏为第三行预留的空白。
// 按 CSS 实际排列结果判断；窗口或容器尺寸变化、资源加载和重新渲染时同步，窄屏两行恢复原高度。
function syncSpecDensity(){
 const summaries=[...document.querySelectorAll('#specs .spec-media-values')];
 $('specs').classList.toggle('compact-specs',summaries.length===2&&summaries.every(node=>window.getComputedStyle(node).display==='flex'));
}
new ResizeObserver(()=>window.requestAnimationFrame(syncSpecDensity)).observe($('specs'));
modelStyles.addEventListener('load',syncSpecDensity);
// 2026-10-24 Product Design 改动逻辑：复用全站 html.lang 作为图片语言来源。
// 中文（含 zh-CN/zh-TW）沿用原图；所有非中文语言使用 UI稿1024 的八张国际版图片。
// 只更新背景 CSS 变量，不调用 render、提交或重置，不影响选中预设、项目状态及弹窗草稿。
function presetImageLanguage(){
 const locale=(window.document.documentElement.lang||'zh').trim().replace(/_/g,'-');
 return !locale||/^zh(?:-|$)/i.test(locale)?'zh':'en';
}
// 2026-11-07 资源压缩逻辑：中文八张预设改用每张小于 100000 字节的渐进 JPG，保留原图内容和比例；按需缩小像素尺寸。
// 仅切换中文图片扩展名，family 映射、语言切换和预设状态不变；其他大 PNG 无损压缩，原路径、尺寸、透明度与像素保持不变。
function presetImageUrl(id){
 return presetImageLanguage()==='zh'
  ? `./assets/images/drama-presets-v3/${id==='family'?'family-clear-v2':id}.jpg`
  : `./assets/images/drama-presets-en/${id}.jpg`;
}
function syncPresetImages(){
 host.dataset.presetLanguage=presetImageLanguage();
 document.querySelectorAll('[data-preset]').forEach(card=>card.style.setProperty('--preset-image',`url('${presetImageUrl(card.dataset.preset)}')`));
}
new MutationObserver(syncPresetImages).observe(window.document.documentElement,{attributes:true,attributeFilter:['lang']});
syncPresetImages();
function renderView(){
 // 2026-10-22 Product Design 改动逻辑：预设选中角标只显示勾选图标，移除已应用/已微调文字；选中边框、aria-pressed 和预设微调状态继续沿用。
 $('presets').innerHTML=presets.map(p=>`<button class="preset ${activePreset===p.id?'active':''}" data-preset="${p.id}" aria-pressed="${activePreset===p.id}" style="--preset-image:url('${presetImageUrl(p.id)}')"><span class="preset-scene" aria-hidden="true"></span><span class="preset-title-mask" aria-hidden="true"></span><span>${p.name}</span>${activePreset===p.id?'<span class="mark" aria-hidden="true">✓</span>':''}</button>`).join('');
 // 2026-10-22 Product Design：预设区右侧提示已移除，不再写入该节点。
 // 2026-10-22 Product Design：图片/视频的模型与比例、清晰度包在独立响应式容器中；可用空间足够时以短竖线分隔并排，较窄时自动恢复两行。
 // 2026-10-24 Product Design：第一步图片参数摘要只显示模型与清晰度，移除图片比例展示；视频摘要保留比例。
 $('specs').innerHTML=specs.map((s,i)=>{const media=i===1?imageParameters:i===2?{model:specs[1][3],ratio:specs[2][3].split(',')[0].trim(),resolution:specs[2][3].split(',')[1].trim()}:null;return `<button class="spec" data-spec="${i}" aria-haspopup="dialog"><span class="icon">${step1Icon(['episodes','model','parameters','country'][i])}</span><span class="spec-copy"><small>${s[0]}</small>${media?`<span class="spec-media-values"><strong>${esc(media.model)}</strong><span class="spec-media-meta">${i===1?'':esc(media.ratio)+' · '}${esc(media.resolution)}</span></span>`:`<strong>${esc(s[3])}</strong>`}</span><span class="chevron">⌄</span></button>`}).join('');
 window.requestAnimationFrame(syncSpecDensity);
 // 2026-11-03 Product Design 改动逻辑：创作设定标题旁固定说明 Agent 的大纲创作用途，移除已设定数量和自动匹配数量的计算及空状态分支。
 $('count').textContent='Agent 将结合故事内容与创作设定，为你生成大纲';
 // 2026-10-22：不渲染说明及底栏，卡片标题、标签、空态和整卡编辑入口沿用 UI 稿。
 $('grid').innerHTML=fields.map(([key,label])=>{const values=state[key]||[];return `<article class="card ${values.length?'':'automatic'}" data-card-edit="${key}" tabindex="0" aria-label="${values.length?'编辑':'选择'}${label}" aria-haspopup="dialog"><div class="card-top"><span class="card-icon">${step1Icon(key)}</span><span class="card-heading-copy"><span class="card-title">${label}</span></span></div><div class="card-content">${values.length?'<div class="tags">'+values.map((v,i)=>`<span class="tag">${esc(v)}<button type="button" data-remove="${key}" data-index="${i}" aria-label="移除${esc(v)}">×</button></span>`).join('')+'</div>':'<div class="auto-note">根据故事内容自动匹配</div>'}</div></article>`}).join('');
}
const styleCatalog=[{"name": "现代短剧", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-01.jpg"}, {"name": "美型古装", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-02.jpg"}, {"name": "经典古装", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-03.jpg"}, {"name": "院线电影风", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-04.jpg"}, {"name": "张艺谋风格", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-05.jpg"}, {"name": "欧洲史诗风格", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-06.jpg"}, {"name": "银翼杀手风格", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-07.jpg"}, {"name": "权力的游戏", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-08.jpg"}, {"name": "剧情犯罪", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-09.jpg"}, {"name": "现代韩剧风", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-10.jpg"}, {"name": "黑泽明风格", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-11.jpg"}, {"name": "诺兰风格", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-12.jpg"}, {"name": "昆汀·塔伦蒂诺风格", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-13.jpg"}, {"name": "大卫·林奇风格", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-14.jpg"}, {"name": "韦斯·安德森风格", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-15.jpg"}, {"name": "王家卫风格", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-16.jpg"}, {"name": "邵氏武侠", "category": "AI真人剧", "image": "./assets/images/step1-v19-styles/live-17.jpg"}, {"name": "通用3D", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-01.jpg"}, {"name": "玄幻仙侠3D", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-02.jpg"}, {"name": "现代都市2D", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-03.jpg"}, {"name": "古风仙侠2D", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-04.jpg"}, {"name": "废土游戏CG", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-05.jpg"}, {"name": "Q版3D", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-06.jpg"}, {"name": "方块世界", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-07.jpg"}, {"name": "粘土玩具", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-08.jpg"}, {"name": "欧美3D CG", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-09.jpg"}, {"name": "韩系都市条漫", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-10.jpg"}, {"name": "罪城游戏插画", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-11.jpg"}, {"name": "三渲二", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-12.jpg"}, {"name": "2D国风漫剧", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-13.jpg"}, {"name": "3D乙游", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-14.jpg"}, {"name": "3D国创仙侠", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-15.jpg"}, {"name": "像素农场", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-16.jpg"}, {"name": "西部荒野游戏CG", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-17.jpg"}, {"name": "双城蒸汽朋克", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-18.jpg"}, {"name": "卡通小人3D", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-19.jpg"}, {"name": "颗粒复古手绘", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-20.jpg"}, {"name": "燕云十六州", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-21.jpg"}, {"name": "油画三渲二", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-22.jpg"}, {"name": "美式3D", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-23.jpg"}, {"name": "黑白水墨", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-24.jpg"}, {"name": "彩色水墨", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-25.jpg"}, {"name": "羊毛毡风格", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-26.jpg"}, {"name": "黏土定格", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-27.jpg"}, {"name": "惊悚怪谈风", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-28.jpg"}, {"name": "韩漫风格", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-29.jpg"}, {"name": "次世代三渲二", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-30.jpg"}, {"name": "吉卜力", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-31.jpg"}, {"name": "高燃战斗番", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-32.jpg"}, {"name": "赛博朋克", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-33.jpg"}, {"name": "克苏鲁风", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-34.jpg"}, {"name": "伊藤润二风", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-35.jpg"}, {"name": "日本复古动画", "category": "AI漫剧", "image": "./assets/images/step1-v19-styles/comic-36.jpg"}];
const modelCatalog=[{"name": "Seedance 2.5", "description": "最强视频模型，人物质感更真实", "seconds": 30}, {"name": "Wan 3.0", "description": "30s完整叙事，全能参考一体创作", "seconds": 30}, {"name": "MiniMax H3 Max", "description": "高性价比全模态，兼顾品质与成本", "seconds": 15}, {"name": "MiniMax H3", "description": "全模态生成编辑，音画控制更精准", "seconds": 15}, {"name": "MiniMax H3 Fast", "description": "极致速度生成，批量创作更高效", "seconds": 15}, {"name": "Seedance 2.0", "description": "原生音画生成，导演级运镜", "seconds": 15}, {"name": "Seedance 2.0 fast", "description": "旗舰能力加速，出片更高效", "seconds": 15}, {"name": "Seedance 2.0 mini", "description": "轻量低成本，批量创作更省", "seconds": 15}, {"name": "Kling V3 Omni", "description": "多模态生成编辑，创作更可控", "seconds": 15}];
// 2026-10-22：图片模型名称和副标题逐项采用图四；视频继续使用上方现有目录的名称及副标题。
const imageModelCatalog=[
 {name:'Gpt Image 2.5 Flare',description:'专业图像模型，生成与编辑更快速',icon:'gpt'},
 {name:'Gpt Image 2.5 Sunburst',description:'最强图像模型，画质与精细编辑更强',icon:'gpt'},
 {name:'Gpt Image 2',description:'优质图像模型，生成与编辑更稳定',icon:'gpt'},
 {name:'Nano Banana 2',description:'生成更快，多图一致性更稳',icon:'banana'},
 {name:'Nano Banana pro',description:'专业设计更强，文字排版更准',icon:'banana'},
 {name:'Seedream 5.0 lite',description:'光影细腻，高质生图更轻快',icon:'seedance'}
];
const isMediaEditor=()=>editing?.spec===1||editing?.spec===2;
const imageResolutions=model=>model==='Seedream 5.0 lite'?['2K','3K']:['1K','2K','4K'];
let pickerQuery='',pickerTab='全部',parameterDraft={},episodeValid=true;
// 2026-10-22 Product Design：自定义集数点击添加后才进入上方网格并单选点亮；
// 自定义目录使用弹窗副本，保存后随项目恢复，取消时丢弃本次添加。
const commonEpisodeOptions=[1,3,6,8,10,12,16,20,24,30,40,60];
let customEpisodeOptions=[],draftEpisodeOptions=[];
// 2026-10-22 Product Design 改动逻辑：自定义选项目录与选中值分别保存；弹窗使用目录副本，
// 添加后立即进入上方网格并选中，取消不提交，保存后取消选中仍可再次选择，且目录随项目快照恢复。
let customOptions=Object.fromEntries(fields.map(([key])=>[key,[]])),draftCustomOptions=[];
const cloneCustomOptions=()=>Object.fromEntries(fields.map(([key])=>[key,[...customOptions[key]]]));
// 2026-10-22 Product Design 改动逻辑：仅当选项文字实际溢出时显示完整文字浮层；
// 原生 popover 在顶层展示，避免被弹窗滚动区裁切，默认位于选项下方，并支持键盘焦点。
const optionTooltip=window.document.createElement('div');optionTooltip.id='creationOptionTooltip';
optionTooltip.className='creation-option-tooltip';optionTooltip.setAttribute('popover','manual');
optionTooltip.setAttribute('role','tooltip');$('editor').append(optionTooltip);
let tooltipOption=null;
function hideOptionTooltip(){
 if(optionTooltip.matches(':popover-open'))optionTooltip.hidePopover();
 tooltipOption?.removeAttribute('aria-describedby');tooltipOption=null;
}
function showOptionTooltip(button){
 hideOptionTooltip();
 const label=button?.querySelector('strong');
 if(!label||label.scrollWidth<=label.clientWidth)return;
 tooltipOption=button;optionTooltip.textContent=window.VinaArabic?.active?window.VinaArabic.translate(button.dataset.option):button.dataset.option;
 button.setAttribute('aria-describedby',optionTooltip.id);optionTooltip.showPopover();
 const rect=button.getBoundingClientRect(),tip=optionTooltip.getBoundingClientRect();
 const viewWidth=window.document.documentElement.clientWidth,viewHeight=window.innerHeight;
 optionTooltip.style.left=Math.max(12,Math.min(rect.left,viewWidth-tip.width-12))+'px';
 optionTooltip.style.top=Math.max(12,Math.min(rect.bottom+8,viewHeight-tip.height-12))+'px';
}
$('options').addEventListener('pointerover',event=>{
 const button=event.target.closest('[data-option]');
 if(button&&!button.contains(event.relatedTarget))showOptionTooltip(button);
});
$('options').addEventListener('pointerout',event=>{
 const button=event.target.closest('[data-option]');
 if(button&&!button.contains(event.relatedTarget))hideOptionTooltip();
});
$('options').addEventListener('focusin',event=>showOptionTooltip(event.target.closest('[data-option]')));
$('options').addEventListener('focusout',hideOptionTooltip);
$('editor').querySelector('.dialog-body').addEventListener('scroll',hideOptionTooltip,{passive:true});
$('editor').addEventListener('close',hideOptionTooltip);
window.addEventListener('resize',hideOptionTooltip);
const countries=[['中国','CN','亚洲'],['美国','US','美洲'],['日本','JP','亚洲'],['韩国','KR','亚洲'],['英国','GB','欧洲'],['法国','FR','欧洲'],['德国','DE','欧洲'],['加拿大','CA','美洲'],['巴西','BR','美洲'],['印度','IN','亚洲'],['印度尼西亚','ID','亚洲'],['泰国','TH','亚洲'],['越南','VN','亚洲'],['马来西亚','MY','亚洲'],['沙特阿拉伯','SA','亚洲'],['菲律宾','PH','亚洲'],['澳大利亚','AU','大洋洲']];
const descriptions={'男频':'面向男性观众的爽感与成长叙事','女频':'面向女性观众的情感与人物关系','泛人群':'适合更广泛的观众群体','出海':'面向海外观众的故事表达','英雄旅程':'启程、试炼与归来，推进主角成长','三幕式':'建立冲突、升级对抗、收束结局','五幕式':'铺垫、上升、高潮、回落与结局','单元结构':'每个单元独立成篇，主线持续推进','交叉结构':'多条故事线交替推进与汇合','环形结构':'以呼应开场的结尾形成闭环','非线性结构':'打破时间顺序，逐步揭示真相','平行结构':'多条叙事线并行展开'};
const fieldGroups={genres:{'都市现实':['现言都市','职场商战','年代情感'],'古装幻想':['仙侠玄幻','古言宫廷','奇幻脑洞'],'悬疑冒险':['求生冒险','科幻机甲','恐怖灵异','悬疑刑侦'],'轻松喜剧':['轻喜剧']},roles:{'人物身份':['小人物','修士','打工人','教师','王妃','王爷','警探','大小姐'],'人物特质':['天才','专业型','不完美成长型','女强','忠犬','腹黑','黑莲花'],'关系与定位':['双强','福宝']},eras:{'现实时代':['古代','现代'],'架空世界':['架空','末世','近未来','平行世界']},hooks:{'成长爽点':['器物金手指','收集升级','扮猪吃虎','真实成长','系统傍身','基建生存'],'情感关系':['先婚后爱','契约婚姻','欢喜冤家','团宠被爱','双向救赎'],'悬念反转':['规则禁忌','单元解谜','时间循环','重生复仇','隐藏身份','马甲大佬'],'现实与视觉':['亲历行业细节','普通人的处境','文化元素新用','风格混搭','视觉奇观']},tones:{'轻松温暖':['轻松治愈','甜宠温暖','轻喜欢脱'],'热血成长':['热血燃爽','励志成长'],'紧张悬疑':['紧张刺激','悬疑压迫']}};
// 2026-10-28 Product Design：选择画风仅提供 AI真人剧、AI漫剧；移除自定义 Tab 和描述输入，其他设定的自定义功能保持原逻辑。
function openEdit(key,isSpec){
 editing=isSpec?{spec:Number(key)}:{key};draft=isSpec?[specs[key][3]]:[...state[key]];pickerQuery='';pickerTab=key==='style'?(styleCatalog.find(s=>s.name===draft[0])?.category||'AI真人剧'):'全部';episodeValid=true;
 // 2026-10-28：旧项目的自由描述不再作为可保存画风，打开时仅保留目录内预设，等待用户重新选择。
 if(!isSpec&&key==='style')draft=draft.filter(value=>styleCatalog.some(style=>style.name===value));
 draftEpisodeOptions=isSpec&&Number(key)===0?[...new Set([...customEpisodeOptions,parseInt(draft[0])])].filter(n=>Number.isInteger(n)&&n>=1&&n<=100&&!commonEpisodeOptions.includes(n)):[];
 // 2026-10-22：打开任一媒体弹窗时复制完整草稿，所有选择先留在弹窗内，保存后才提交。
 if(isSpec&&Number(key)===1)parameterDraft={...imageParameters};
 if(isSpec&&Number(key)===2){const [ratio,resolution]=specs[2][3].split(', ');parameterDraft={model:specs[1][3],ratio,resolution}}
 // 2026-10-22：每次打开从当前项目复制已保存目录，兼容旧快照中只有选中值的自定义内容。
 draftCustomOptions=isSpec?[]:[...new Set([...customOptions[key],...draft.filter(value=>!fields.find(field=>field[0]===key)[3].includes(value))])];
 const title=isSpec?specs[key][0]:fields.find(f=>f[0]===key)[1];$('editorTitle').textContent=isSpec?'设置'+title:'选择'+title;
 // 2026-10-22 Product Design：其余七个创作弹窗移除标题下说明；画风及成片规格继续使用现有说明。
 $('editorHint').hidden=!isSpec&&key!=='style';
 if($('editorHint').hidden)$('editor').removeAttribute('aria-describedby');else $('editor').setAttribute('aria-describedby','editorHint');
 // 2026-10-24 Product Design：图片弹窗移除比例选择后，同步说明文字；其他弹窗说明不变。
 $('editorHint').textContent=isSpec?['选择常用集数，或输入自定义集数','选择图片模型和清晰度','选择视频模型、清晰度和比例','选择本次短剧面向的国家或地区'][key]:key==='style'?'选择一种预设画风':key==='audiences'?'可选择多个受众方向':'可选择多个选项，也可补充自定义内容';
 $('editor').classList.toggle('episodes-editor',isSpec&&Number(key)===0);$('editor').classList.toggle('model-editor',isSpec&&Number(key)===1);$('editor').classList.toggle('parameters-editor',isSpec&&Number(key)===2);$('editor').classList.toggle('country-editor',isSpec&&Number(key)===3);$('editor').classList.toggle('creation-editor',!isSpec);$('editor').classList.toggle('style-editor',!isSpec&&key==='style');$('editor').classList.toggle('audiences-editor',!isSpec&&key==='audiences');$('editor').classList.toggle('wide',key==='style');
 $('editor').classList.toggle('media-parameters-editor',isSpec&&(Number(key)===1||Number(key)===2));
 $('customArea').innerHTML=isSpec&&Number(key)===0?`<div class="custom-row"><label for="episodeInput">自定义集数</label><div class="input-wrap"><input id="episodeInput" type="number" min="1" max="100" step="1" placeholder="输入 1–100" aria-label="自定义集数" aria-describedby="episodeError"><span>集</span></div><button type="button" class="secondary" id="addEpisode">添加</button></div><div id="episodeError" class="error" role="status"></div>`:!isSpec&&key!=='style'?`<div class="custom-row"><label for="customInput">自定义${title}</label><div class="input-wrap"><input id="customInput" maxlength="60" placeholder="${key==='style'?'描述你希望的画面风格':'输入未列出的'+title}" aria-label="自定义${title}"></div>${key==='style'?'':'<button type="button" class="secondary" id="addCustom">添加</button>'}</div><div class="error" id="customError" role="status"></div>`:'';
 $('pickerTabs').innerHTML=key==='style'?'<div class="filter-tabs" role="tablist" aria-label="画风分类">'+['AI真人剧','AI漫剧'].map(tab=>`<button type="button" class="filter-tab" role="tab" data-style-tab="${tab}" aria-selected="${pickerTab===tab}" aria-controls="${tab==='自定义'?'customArea':'options'}">${tab}</button>`).join('')+'</div>':'';
 if(key==='style'&&pickerTab==='自定义'&&draft.length)$('customInput').value=draft[0];
 renderOptions();$('editor').showModal();
}
function choice(v,extra='',className=''){return `<button class="choice ${className}" data-option="${esc(v)}" aria-pressed="${draft.includes(v)}">${editing.key&&editing.key!=='style'?'':'<span class="check" aria-hidden="true">✓</span>'}<strong>${esc(v)}</strong>${extra}</button>`}
function renderOptions(){
 hideOptionTooltip();
 let content='';const i=editing.spec,key=editing.key;
 if(i===0){const opts=[...new Set([...commonEpisodeOptions,...draftEpisodeOptions])];content='<div class="picker-label">常用集数</div><div class="choice-grid episodes">'+opts.map(n=>`<button class="choice" data-option="${n} 集" aria-pressed="${draft.includes(n+' 集')}">${n} 集</button>`).join('')+'</div>'}
 // 2026-10-22 Product Design：图片和视频共用黑色双栏结构，左侧模型及副标题；图片右侧仅清晰度，视频右侧保留清晰度和比例；
 // 不生成偏好 Tab 或时长选择控件；视频模型名称旁展示目录中的时长标签。比例图标复用已有 SVG 资源，参数选中态按 UI稿1024 使用中性灰蓝底色。
 else if(i===1||i===2){
  // 2026-10-23 Product Design：仅视频模型在名称右侧展示目录 seconds 对应的时长标签，与首页模型列表保持一致，不新增时长选择逻辑。
  const catalog=i===1?imageModelCatalog:modelCatalog;
  const resolutions=i===1?imageResolutions(parameterDraft.model):[...new Set(['720p','1080p','4K',...(['480p','2K'].includes(parameterDraft.resolution)?[parameterDraft.resolution]:[])])];
  // 2026-10-24 Product Design：比例区仅在视频参数（i===2）渲染，图片参数不生成比例标题、图标或按钮。
  // 保留图片历史快照的 ratio 字段以兼容原保存/恢复链路，不改模型、清晰度、视频比例及后续流程。
  const ratios=[['16:9',30,18],['4:3',26,20],['1:1',23,23],['3:4',20,26],['9:16',17,29]];
  content='<div class="media-parameters-layout"><section class="media-models" aria-labelledby="mediaModelHeading"><div class="picker-label" id="mediaModelHeading">模型</div><div class="choice-grid models">'+catalog.map(m=>{
   const icon=m.icon||(m.name.startsWith('Seedance')?'seedance':m.name.startsWith('MiniMax')?'minimax':m.name.startsWith('Kling')?'kling':'wan');
   // 2026-11-11 Product Design：视频模型沿用短剧会员名单，钻石紧跟原时长标签。
   const badge=i===2?window.vinaDramaModelMembership.badgeMarkup(m.name):'';
   return `<button type="button" class="choice model-choice" data-media-model="${esc(m.name)}" aria-pressed="${parameterDraft.model===m.name}"><span class="model-icon"><img src="./assets/icons/models/${icon}.svg" alt=""></span><span class="model-copy"><span class="model-name-row"><strong>${esc(m.name)}</strong>${i===2?`<span class="model-duration-tag">${m.seconds}秒</span>`:''}${badge}</span><span class="model-description">${esc(m.description)}</span></span></button>`;
  }).join('')+'</div></section><section class="media-picture-parameters" aria-label="画面参数"><div class="parameters-block"><div class="picker-label" id="mediaResolutionHeading">清晰度</div><div class="choice-grid resolutions" role="group" aria-labelledby="mediaResolutionHeading">'+resolutions.map(v=>`<button type="button" class="choice" data-param="resolution" data-value="${v}" aria-pressed="${parameterDraft.resolution===v}"><strong>${v}</strong></button>`).join('')+'</div></div>'+(i===2?'<div class="parameters-block"><div class="picker-label" id="mediaRatioHeading">比例</div><div class="choice-grid ratios" role="group" aria-labelledby="mediaRatioHeading">'+ratios.map(([v,w,h])=>`<button type="button" class="choice ratio-choice" data-param="ratio" data-value="${v}" aria-pressed="${parameterDraft.ratio===v}"><span class="ratio-icon-wrap" aria-hidden="true"><img src="./assets/icons/drama-composer/ratio.svg" width="${w}" height="${h}" alt=""></span><strong>${v}</strong></button>`).join('')+'</div></div>':'')+'</section></div>';
 }
 else if(i===3){const list=countries.filter(([n,c,r])=>(pickerTab==='全部'||pickerTab===r)&&(n+c+' '+(window.VinaArabic?.active?window.VinaArabic.translate(n):'')).toLowerCase().includes(pickerQuery.toLowerCase()));content='<div class="choice-grid">'+list.map(([n,c])=>`<button class="choice country-choice" data-option="${esc(n)}" aria-pressed="${draft.includes(n)}"><strong>${esc(n)}</strong></button>`).join('')+'</div>';if(!list.length)content='<div class="empty-search">没有匹配的国家或地区</div>'}
 else if(key==='style'){const list=styleCatalog.filter(s=>s.category===pickerTab);content=pickerTab==='自定义'?'':'<div class="style-grid">'+list.map(s=>`<button class="choice style-choice" data-option="${esc(s.name)}" aria-pressed="${draft.includes(s.name)}"><img src="${s.image}" alt="${esc(s.name)}画风预览"><strong>${esc(s.name)}</strong><span class="check">✓</span></button>`).join('')+'</div>'}
 // 2026-10-22 Product Design：七个创作弹窗统一移除“多选”标记；自定义项与预置项合并去重后使用同一网格和选中态。
 else{let values=fields.find(f=>f[0]===key)[3];if(pickerTab!=='全部')values=fieldGroups[key]?.[pickerTab]||values;values=[...new Set([...values,...draftCustomOptions])].filter(v=>(v+' '+(window.VinaArabic?.active?window.VinaArabic.translate(v):'')).includes(pickerQuery));content='<div class="picker-label">'+(pickerTab==='全部'?'全部选项':pickerTab)+'</div><div class="choice-grid">'+values.map(v=>choice(v)).join('')+'</div>';if(!values.length)content='<div class="empty-search">没有匹配选项，可在下方自定义</div>'}
 $('options').innerHTML=content;$('customArea').hidden=key==='style';updateConfirm();
}
// 2026-10-23 Product Design：图片参数和视频参数弹窗的保存按钮统一显示“保存设定”，沿用原有保存及禁用逻辑。
function updateConfirm(){$('confirm').textContent='保存设定';$('confirm').disabled=editing.spec===0&&!episodeValid}

$('pickerTabs').onclick=e=>{const tab=e.target.closest('[data-style-tab]');if(!tab)return;pickerTab=tab.dataset.styleTab;$('pickerTabs').querySelectorAll('[data-style-tab]').forEach(button=>button.setAttribute('aria-selected',String(button===tab)));renderOptions();if(pickerTab==='自定义')$('customInput').focus()};

$('presets').onclick=e=>{const b=e.target.closest('[data-preset]');if(b)applyPreset(b.dataset.preset)};
$('grid').onclick=e=>{const remove=e.target.closest('[data-remove]');if(remove){const key=remove.dataset.remove;setField(key,state[key].filter((_,i)=>i!==Number(remove.dataset.index)));render();document.querySelector('[data-card-edit="'+key+'"]').focus();return}const card=e.target.closest('[data-card-edit]');if(card)openEdit(card.dataset.cardEdit,false)};
$('grid').onkeydown=e=>{if(e.target.matches('[data-card-edit]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openEdit(e.target.dataset.cardEdit,false)}};
$('specs').onclick=e=>{const b=e.target.closest('[data-spec]');if(b)openEdit(b.dataset.spec,true)};
// 2026-10-22：模型与右侧参数独立单选，点击后弹窗保持展开，并恢复焦点供键盘连续操作。
$('options').onclick=e=>{
 const model=e.target.closest('[data-media-model]');
 if(model){
  // 2026-11-11：订阅页覆盖参数弹窗，非会员点击后保留已选模型和未保存的参数，关闭订阅页后可继续编辑。
  if(editing.spec===2&&window.vinaDramaModelMembership.openPlansIfRequired(model.dataset.mediaModel,model))return;
  parameterDraft.model=model.dataset.mediaModel;
  if(editing.spec===1&&!imageResolutions(parameterDraft.model).includes(parameterDraft.resolution))parameterDraft.resolution='2K';
  renderOptions();
  document.querySelector('[data-media-model="'+CSS.escape(parameterDraft.model)+'"]')?.focus();
  return;
 }
 const param=e.target.closest('[data-param]');if(param){const {param:key,value}=param.dataset;parameterDraft[key]=value;renderOptions();document.querySelector('[data-param="'+key+'"][data-value="'+CSS.escape(value)+'"]')?.focus();return}const b=e.target.closest('[data-option]');if(!b)return;const v=b.dataset.option;if(editing.spec!==undefined){draft=[v];if(editing.spec===0){episodeValid=true;$('episodeInput').value='';$('episodeError').textContent=''}}else if(editing.key==='style')draft=draft.includes(v)?[]:[v];else draft=draft.includes(v)?draft.filter(x=>x!==v):[...draft,v];renderOptions();document.querySelector('[data-option="'+CSS.escape(v)+'"]')?.focus()
};
// 2026-10-22：添加同时更新临时目录及选中值；重复文字直接点亮已有项，清空输入后仍可继续添加。
function addCustom(){const input=$('customInput'),v=input.value.trim();if(!v){$('customError').textContent='请先输入内容';input.focus();return}if(!fields.find(field=>field[0]===editing.key)[3].includes(v))draftCustomOptions=[...new Set([...draftCustomOptions,v])];draft=[...new Set([...draft,v])];input.value='';$('customError').textContent='';renderOptions();input.focus()}
// 2026-10-22：添加集数校验 1–100 的整数，重复值直接选中已有选项；输入本身不再更改选中集数。
function addEpisode(){
 const input=$('episodeInput'),n=Number(input.value);
 if(input.value.trim()===''||!Number.isInteger(n)||n<1||n>100){$('episodeError').textContent='请输入 1–100 之间的整数';input.focus();return}
 if(!commonEpisodeOptions.includes(n))draftEpisodeOptions=[...new Set([...draftEpisodeOptions,n])];
 draft=[n+' 集'];episodeValid=true;input.value='';$('episodeError').textContent='';renderOptions();input.focus();
}
$('customArea').onclick=e=>{if(e.target.closest('#addEpisode'))addEpisode();else if(e.target.closest('#addCustom'))addCustom()};
$('customArea').onkeydown=e=>{if(e.target.id==='episodeInput'&&e.key==='Enter'){e.preventDefault();addEpisode();return}if(e.target.id==='customInput'&&e.key==='Enter'){e.preventDefault();if(editing.key==='style')$('confirm').click();else addCustom()}};
$('customArea').oninput=e=>{if(e.target.id==='customInput'){$('customError').textContent='';return}if(e.target.id==='episodeInput')$('episodeError').textContent=''};
// 2026-10-22：保存图片只写图片快照；保存视频同时提交其模型、清晰度及比例，继续兼容原 specs 保存链路。
$('confirm').onclick=()=>{if(editing.spec===0&&!episodeValid)return;if(editing.key){
 // 2026-10-22：画风自定义移除“使用”按钮，保存时直接读取当前描述；其他创作项同时提交自定义目录与选中值。
 if(editing.key==='style'&&pickerTab==='自定义'){const description=$('customInput').value.trim();draft=description?[description]:[]}
 if(editing.key!=='style')customOptions[editing.key]=[...draftCustomOptions];
 setField(editing.key,draft);
}else if(editing.spec===0){customEpisodeOptions=[...draftEpisodeOptions];specs[0][3]=draft[0]}else if(editing.spec===1)imageParameters={...parameterDraft};else if(editing.spec===2){specs[1][3]=parameterDraft.model;specs[2][3]=parameterDraft.ratio+', '+parameterDraft.resolution}else {
 // 2026-10-27：只有点击国家弹窗的保存按钮才固定手动国家；取消、关闭与 Escape 不改变来源。
 specs[editing.spec][3]=draft[0];countrySource='manual';
}$('editor').close();render();restorePickerFocus()};
function restorePickerFocus(){(editing.key?document.querySelector('[data-card-edit="'+editing.key+'"]'):document.querySelector('[data-spec="'+editing.spec+'"]'))?.focus()}
$('close').onclick=$('cancel').onclick=()=>$('editor').close();
$('editor').addEventListener('close',restorePickerFocus);
// 2026-10-22：点击遮罩、关闭、取消及原生 Escape 都只关闭弹窗，不提交当前草稿。
$('editor').addEventListener('click',e=>{if(e.target!==$('editor'))return;const r=$('editor').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('editor').close()});

// 2026-10-22 Product Design：移除清空全部选项入口及其事件绑定，避免访问已删除的按钮。
let timer;function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,2600)}

function snapshot(){return {countrySource,state:cloneState(),customOptions:cloneCustomOptions(),customEpisodeOptions:[...customEpisodeOptions],specs:specs.map(s=>s[3]),imageParameters:{...imageParameters},activePreset,modified,presetBaseline:presetBaseline?Object.fromEntries(Object.entries(presetBaseline).map(([k,v])=>[k,[...v]])):null}}
let hydrated=false;
function render(){renderView();if(hydrated)window.vinaStep1V19Changed?.(snapshot())}
window.vinaStep1V19={root:document,getSnapshot:snapshot,syncDefaultCountry(){
 // 2026-10-27：语言切换只更新自动国家；国家弹窗未改动的草稿同步新默认值，已点选但未保存的草稿保留。
 // 2026-10-27：首次确认后立即保护已保存的项目国家，无需等重新进入设定页再锁定来源。
 if(countrySource!=='default'||readSplitDramaSetup())return;
 const previous=specs[3][3],country=defaultTargetCountry();
 if(previous===country)return;
 specs[3][3]=country;
 if($('editor').open&&editing?.spec===3){if(draft[0]===previous)draft=[country];renderOptions()}
 render();
},load(data){
 if($('editor').open)$('editor').close();
 state=Object.fromEntries(fields.map(([k])=>[k,[...(data.state[k]||[])]]));
 // 2026-10-22：自定义目录按当前项目重新构建，避免跨项目混用，并兼容旧项目已选中的自定义值。
 customOptions=Object.fromEntries(fields.map(([key,,,values])=>[key,[...new Set([...(data.customOptions?.[key]||[]),...state[key].filter(value=>!values.includes(value))])]]));
 specs.forEach((s,i)=>s[3]=data.specs[i]);
 // 2026-10-27：恢复默认来源时重新读取当前语言；手动国家和旧项目已有国家保持原值。
 countrySource=data.countrySource||'saved';
 if(countrySource==='default')specs[3][3]=defaultTargetCountry();
 // 2026-10-22：恢复当前项目的自定义集数，并将旧项目已保存的非常用集数补入选项。
 customEpisodeOptions=[...new Set([...(data.customEpisodeOptions||[]),parseInt(data.specs[0])])].filter(n=>Number.isInteger(n)&&n>=1&&n<=100&&!commonEpisodeOptions.includes(n));
 // 2026-10-22：旧项目未保存图片参数时补齐默认值；返回第一步和重新打开项目时恢复图片独立快照。
 imageParameters={...defaultImageParameters,...data.imageParameters};
 activePreset=data.activePreset||null;modified=!!data.modified;
 presetBaseline=data.presetBaseline?Object.fromEntries(fields.map(([k])=>[k,[...(data.presetBaseline[k]||[])]])):null;
 if(activePreset&&!presetBaseline)presetBaseline=Object.fromEntries(fields.map(([k])=>[k,[]]));
 hydrated=true;render();
},setActionState(busy,completed){
 // 2026-10-22 Product Design 改动逻辑：确认进入后续步骤后隐藏新版按钮及底部容器，并禁用按钮；
 // 状态取自当前项目流程，不取决于设定是否被修改，切换到尚未确认的新项目时恢复首次入口。
 const next=$('nextStep');next.hidden=completed;next.disabled=busy||completed;
 next.parentElement.style.display=completed?'none':'';
},focusNext(){if(!$('nextStep').hidden&&!$('nextStep').disabled)$('nextStep').focus()}};
$('nextStep').onclick=()=>window.vinaStep1V19Confirm?.();
// 2026-10-22：安装时先渲染默认预设、规格和创作卡片，项目数据随后在进入第一步时同步。
renderView();

})();
 const ui=window.vinaStep1V19;
 window.VinaArabic?.attach(ui.root);
 const drafts=new Map();let projectKey=null,wasOpen=false,syncing=false;
 const aliases={'银翼杀手':'银翼杀手风格','大卫林奇':'大卫·林奇风格','现代韩剧':'现代韩剧风'};
 function styleCard(name){return Array.from(scriptSetupStyleCards).find(card=>{
  const label=card.dataset.scriptSetupStyleName||'';
  return label===name||label===aliases[name]||label.replace(/风格$/,'')===(aliases[name]||name).replace(/风格$/,'');
 })}
 function apply(data){
  const name=data.state.style[0]||'',card=styleCard(name);
  const isCustom=!!name&&!card;
  const draft={styleId:card?.dataset.scriptSetupStyle||(isCustom?'custom':''),styleName:name||'未选择',
   model:data.specs[1],quality:data.specs[2].split(',')[1].trim(),count:parseInt(data.specs[0]),
   ratio:data.specs[2].split(',')[0].trim(),language:data.specs[3],customDescription:isCustom?name:'',
   genres:[...data.state.genres],customGenre:'',customGenreEnabled:false,preset:data.activePreset||'',
   ...Object.fromEntries(['audiences','roles','eras','hooks','tones','structures'].map(k=>[k,[...data.state[k]]]))};
  // 2026-10-22：同步原自定义输入框，避免原提交函数读取旧内容覆盖新版弹窗里的画风描述。
  if(scriptSetupCustomInput)scriptSetupCustomInput.value=draft.customDescription;
  applyScriptDetailSetupDraft(draft);
  // 2026-10-22：图片参数同步到项目设定节点并随 v19 快照保存，不写入视频模型、比例或清晰度字段。
  if(scriptSetupPanel&&data.imageParameters){scriptSetupPanel.dataset.setupImageModel=data.imageParameters.model;scriptSetupPanel.dataset.setupImageQuality=data.imageParameters.resolution;scriptSetupPanel.dataset.setupImageRatio=data.imageParameters.ratio;}
  selectedScriptStyleId=draft.styleId;
  activeScriptStyleCategory=isCustom?'custom':(card?.dataset.scriptSetupStyleCategory||'live');
  setScriptSetupCategory(activeScriptStyleCategory);
  applyScriptSetupSelectValue(draft.ratio,scriptSetupRatio,scriptSetupRatioLabel,scriptSetupRatioOptions,'scriptSetupRatioOption',scriptSetupRatioControl,scriptSetupRatioPopover,scriptSetupRatioToggle);
  applyScriptSetupSelectValue(draft.language,scriptSetupLanguage,scriptSetupLanguageLabel,scriptSetupLanguageOptions,'scriptSetupLanguageOption',scriptSetupLanguageControl,scriptSetupLanguagePopover,scriptSetupLanguageToggle);
  commitScriptSetupValues();
 }
 function fromNative(cached){
  const genres=[...scriptSetupGenreState.genres];
  if(scriptSetupGenreState.customGenreEnabled&&scriptSetupGenreState.customGenre)genres.push(scriptSetupGenreState.customGenre);
  const name=selectedScriptStyleId==='custom'?customScriptStyleDescription:selectedScriptSetupStyleName;
  const state={style:name&&name!=='未选择'?[name]:[],genres,
   ...Object.fromEntries(['audiences','roles','eras','hooks','tones','structures'].map(k=>[k,[...scriptSetupChoiceState[k]]]))};
  // 2026-10-22：只在确有历史快照时读取预设微调信息，首次进入使用默认状态。
  const samePreset=!!cached&&cached.activePreset===(activeScriptPreset||null);
  // 2026-10-27：每个项目独立判断国家来源；新项目不继承上个项目的国家，已有项目快照优先保留。
  const saved=readSplitDramaSetup();
  const countrySource=saved?'saved':(cached?.countrySource||(cached?'saved':'default'));
  const country=countrySource==='default'?defaultTargetCountry():(cached?.specs?.[3]||scriptSetupLanguage?.value||defaultTargetCountry());
  return {state,countrySource,specs:[(selectedEpisodeCount||10)+' 集',getSetupVideoModel(),(scriptSetupRatio?.value||'9:16')+', '+(getSetupVideoQuality()==='4k'?'4K':getSetupVideoQuality()),country],
   // 2026-10-22：原生视频设定仍为视频来源，图片从当前项目缓存或已保存快照独立恢复。
   imageParameters:cached?.imageParameters,
   // 2026-10-22：返回第一步或重新打开项目时携带自定义目录，已取消选中的自定义项也可再次选择。
   customOptions:cached?.customOptions,
   // 2026-10-22：自定义集数目录随项目缓存恢复。
   customEpisodeOptions:cached?.customEpisodeOptions,
   activePreset:activeScriptPreset||null,modified:samePreset?cached.modified:false,presetBaseline:samePreset?cached.presetBaseline:null};
 }
 window.vinaStep1V19Changed=data=>{drafts.set(splitDramaSetupKey(),data);apply(data)};
 // 2026-10-27 Product Design 修复逻辑：新版“下一步”仅按当前项目的最远步骤判断是否已确认，
 // 不把旧确认按钮的 hidden 展示状态当作完成标记，避免切换到新项目时沿用旧隐藏状态。
 // 已推进的项目返回设定仍隐藏按钮，并继续拦截重复提交；未确认项目恢复右下角首次推进入口。
 function setupCompleted(){return dramaFurthestStep>1}
 function syncActionState(){ui.setActionState(scriptAgentBusy,setupCompleted())}
 window.vinaStep1V19Confirm=()=>{
  if(scriptAgentBusy||setupCompleted())return;
  apply(ui.getSnapshot());
  // Reuse native commit, project persistence, request context and stage transitions.
  scriptSetupConfirm.click();
  syncActionState();
 };
 function sync(){
  if(syncing)return;
  const key=splitDramaSetupKey();
  const open=!scriptWorkspace.hidden&&scriptWorkspace.dataset.setupPage==='true'&&!scriptSetupModal.hidden;
  if(open&&(!wasOpen||projectKey!==key)){
   const cached=drafts.get(key)||readSplitDramaSetup()?.v19;
   projectKey=key;wasOpen=true;syncing=true;try{ui.load(fromNative(cached))}finally{syncing=false}
  }
  // 2026-10-22：离开第一步时关闭其顶层弹窗，避免覆盖后续步骤。
  if(!open&&wasOpen){const editor=ui.root.getElementById('editor');if(editor.open)editor.close()}
  syncActionState();
  wasOpen=open;
 }
 new MutationObserver(sync).observe(scriptWorkspace,{attributes:true,attributeFilter:['hidden','data-setup-page']});
 new MutationObserver(sync).observe(scriptSetupModal,{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(syncActionState).observe(scriptSetupConfirm,{attributes:true,attributeFilter:['disabled','hidden']});
 // 2026-10-27：复用全站语言事件，仅同步当前打开的项目；关闭后再次进入时由 load 按当前语言补齐默认值。
 window.document.addEventListener('vina:language-change',()=>{
  if(wasOpen&&projectKey===splitDramaSetupKey())ui.syncDefaultCountry();
 });
 window.addEventListener('vina-view-changed',sync);
 sync();
 // 2026-10-22：模板、默认内容、原流程同步和事件全部就绪后，才切换到新版第一步。
 scriptSetupModal.classList.add('has-v19');
})();
