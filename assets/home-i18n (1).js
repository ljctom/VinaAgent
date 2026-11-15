/* 2026-09-20 改动逻辑：首页及 Skill 弹窗使用运行时中英文字典；默认简体中文，切换时同步处理后续动态渲染的 Skill 列表、项目卡和详情表单。 */
(() => {
  const TEXT = new Map(Object.entries({
    // 2026-09-28 改动逻辑：侧边栏中文名称改为“技能市场”，语言切换时仍对应英文 Skill Market。
    "技能市场":"Skill Market",
    "首页":"Home","项目":"Projects","资产库":"Assets","模板":"Templates","3D创作":"3D Creation","邀请有礼":"Invite & Earn","会员等级":"Membership","升级":"Upgrade","V点余额":"V Points Balance","充值":"Top Up","团队管理":"Team Management","我的订单":"My Orders","邀请码":"Invitation Code","退出登录":"Sign Out","页面语言：简体中文":"Page language: English",
    "用 VinaAI":"Use VinaAI","创作":"Create","短剧":"Short Drama","广告":"Ads","Agent，将创意变成片":"Agent to turn ideas into videos","技能":"Skills","风格":"Style","手动确认":"Manual","自动生成":"Auto Generate","灵感":"Inspire","Agent在执行生成前都会寻求您的确认":"The Agent asks for confirmation before generating","Agent会自主规划生成任务并自动执行":"The Agent plans and runs generation automatically",
    "精选 Skills：":"Featured Skills:","广告营销":"Advertising","创意/社媒":"Creative / Social","创意社媒":"Creative / Social","MG 动画":"MG Animation","MG动画":"MG Animation","数字人":"Digital Human","更多 Skill":"More Skills","我的项目":"My Projects","全部项目":"All Projects","活动":"Events","短剧项目":"Drama Project","默认短剧项目":"Default Drama Project","精选 Skill":"Featured","收藏":"Favorites","我的":"Mine","创建 Skill":"Create Skill","全部":"All",
    "上传剧本":"Upload Script","上传视频":"Upload Video","上传附件":"Upload Attachment","自定义":"Custom","痛点反转广告":"Pain-Point Reversal Ad","URL 生广告视频":"URL-to-Ad Video","电子数码广告":"Consumer Electronics Ad","美妆个护广告":"Beauty & Personal Care Ad","服装广告":"Fashion Ad","剧情TVC广告":"Story-driven TVC Ad","高端品牌TVC广告":"Premium Brand TVC Ad","萌宠自拍":"Pet Selfie","搞笑故事":"Comedy Story","沉浸式手持跟拍镜头":"Immersive Handheld Follow Shot","第一人称 FPV 穿越视角":"First-person FPV Fly-through",
    "企业品牌宣传类":"Corporate Brand Promotion","产品服务营销类":"Product & Service Marketing","知识科普解读类":"Knowledge Explainer","教育培训课程类":"Education & Training","政务公共服务类":"Public Services","商品营销口播":"Product Marketing Presenter","个人IP口播":"Personal IP Presenter","企业宣传讲解":"Corporate Presenter","教育培训讲解":"Education Presenter","政务服务播报":"Public Service Presenter","我的视频创作 Skill":"My Video Creation Skill",
    "Skill 详情":"Skill Details","开始创作":"Start Creating","生成同款视频":"Create Similar Video","参考链接":"Reference Link","商品图片":"Product Images","创作素材":"Creative Assets","上传图片":"Upload Images","上传素材":"Upload Assets","商品卖点&要求":"Product Benefits & Requirements","创作要求":"Creative Requirements","其他要求":"Other Requirements","参考视频":"Reference Video","上传参考视频":"Upload Reference Video","悬停预览":"Hover to Preview","生成时长":"Duration","输入你的想法":"Describe Your Idea","目标平台":"Target Platform","比例/档位":"Ratio / Tier","图内文字语言":"On-image Language","销售地区":"Sales Region","图片比例":"Image Ratio","目标市场":"Target Market","适配平台":"Platform",
    "默认":"Default","英文":"English","英语":"English","中文":"Chinese","俄语":"Russian","西班牙语":"Spanish","德语":"German","美国":"United States","英国":"United Kingdom","日本":"Japan","德国":"Germany","法国":"France","亚马逊":"Amazon","抖音":"Douyin","淘宝":"Taobao","15 秒以内":"Under 15 sec","30-1分钟":"30 sec-1 min","1 分钟以上":"Over 1 min","请输入自定义内容":"Enter a custom value","请填入想要参考的网页链接":"Paste a webpage URL to reference","清晰的白底图效果最佳，支持多角度":"Clear white-background images work best; multiple angles supported","产品图、场景图、功能细节图等":"Product, scene, and feature-detail images","可上传成片或竞品视频，用于参考镜头节奏与画面表达":"Upload a finished or competitor video for pacing and visual reference"
  }));
  // 2026-09-22 改动逻辑：补齐浮层分类、空态、无障碍提示及全部内置 Skill 说明；自建内容保留用户原文。
  Object.entries({
  "根据创作目标整理视频方向、内容结构与镜头表达，快速形成可继续编辑的视频创作方案。": "Organize your video direction, content structure, and shots around your creative goal to quickly develop an editable video plan.",
  "为电商产品视频提供内容与广告形式指导：先呈现一个具体的顾客困扰，再将产品定位为解决方案。适用于通过与基础痛点状态形成对比，最能体现产品价值的场景。": "Guide the content and format of ecommerce product videos: introduce a specific customer problem, then position the product as the solution. Ideal for showing product value through a clear before-and-after contrast.",
  "根据商品链接提取产品信息与可用素材，快速生成适合电商投放的广告视频。": "Extract product information and available assets from a product URL to quickly create an ad video for ecommerce campaigns.",
  "为消费电子、数码小工具、手机配件、穿戴设备、充电器、相机、音频设备和互联产品创建高转化 AI 视频提示词，让功能、交互、连接和性能测试在镜头中真实运行。": "Create high-converting AI video prompts for consumer electronics, gadgets, phone accessories, wearables, chargers, cameras, audio gear, and connected products. Show features, interactions, connectivity, and performance tests working on camera.",
  "为美容和个人护理产品创建高转化 AI 视频提示词，清楚呈现涂抹过程、产品质地、可见结果、自信与购买价值，同时保持声明安全合规。": "Create high-converting AI video prompts for beauty and personal care products. Clearly show application, texture, visible results, confidence, and purchase value while keeping claims safe and compliant.",
  "为服装、塑身衣、内衣、家居服、上衣、短裤、连衣裙和多件套创建高转化 AI 视频提示词，让版型、轮廓、面料表现、穿搭自信和社会认同可见。": "Create high-converting AI video prompts for clothing, shapewear, underwear, loungewear, tops, shorts, dresses, and sets. Make fit, silhouette, fabric, styling confidence, and social proof visible.",
  "根据产品图、品牌资料、服务内容和卖点，策划并生成具有完整人物、冲突、转折和情绪价值的剧情 TVC 广告片，可输出创意概念、人物设定、剧情脚本、分镜和 AI 视频提示词。": "Plan and generate story-driven TV commercials from product images, brand materials, services, and selling points. Develop characters, conflict, twists, and emotional value, with creative concepts, character profiles, scripts, storyboards, and AI video prompts.",
  "面向高奢时尚、运动、汽车和 3C 品牌，策划具有国际大牌调性的情绪 TVC 全球广告宣传片。": "Plan emotionally engaging global TV commercials with a premium international brand aesthetic for luxury fashion, sports, automotive, and consumer technology brands.",
  "创作拟人萌宠博主自媒体视频，将猫、狗、兔子、仓鼠、鸟类等动物塑造成具有固定人设、穿搭、声音和拍摄习惯的短视频博主。": "Create anthropomorphic pet influencer videos, turning cats, dogs, rabbits, hamsters, birds, and other animals into creators with consistent personalities, outfits, voices, and filming habits.",
  "创作搞笑故事视频，通过误会、身份反转、因果升级、冷幽默、道具反转或规则漏洞制造笑点。": "Create funny story videos using misunderstandings, identity reversals, escalating consequences, dry humor, prop twists, or loopholes to deliver the laughs.",
  "适用于短视频、微电影和 Vlog 等真人叙事创作，通过呼吸感手持与跟拍运镜生成音画同步短片，增强镜头代入、情绪张力和真实质感。": "Create live-action narratives for short videos, short films, and vlogs. Use natural handheld and follow-camera movement to produce synchronized audiovisual scenes with immersion, emotional tension, and realism.",
  "以 FPV 穿越机第一人称视角为核心，模拟俯冲、贴地穿隙、螺旋环绕和急速穿梭等动态运镜，生成具有速度感、空间穿透感和沉浸感的视频。": "Create immersive first-person FPV drone videos with dives, low-altitude gap flying, spiral orbits, and rapid fly-throughs for a strong sense of speed and space.",
  "把企业是谁、做什么、为什么值得信任以及下一步行动讲清楚，形成专业、可信、有品牌辨识度的企业 MG 宣传视频。": "Explain who a company is, what it does, why it is trustworthy, and what to do next in a professional, credible motion graphics brand video.",
  "把产品或服务的核心卖点、使用场景、用户收益和行动引导转化为清晰有吸引力的 MG 营销视频。": "Turn product or service benefits, use cases, customer value, and calls to action into clear, engaging motion graphics marketing videos.",
  "把抽象知识、复杂概念和专业信息拆解成易理解的结构，通过图标、信息图和 MG 动效完成清晰讲解。": "Break abstract knowledge, complex concepts, and technical information into understandable structures, explained clearly with icons, infographics, and motion graphics.",
  "把课程目标、知识结构、教学步骤和重点内容转化为节奏清楚、便于学习和复习的 MG 教学视频。": "Turn learning objectives, knowledge structures, teaching steps, and key points into well-paced motion graphics lessons that are easy to learn from and review.",
  "把政策依据、适用对象、办理条件、材料步骤和官方渠道转化为准确、庄重、易懂的 MG 公共服务视频。": "Turn policies, eligibility, application requirements, documents, steps, and official channels into accurate, professional, and accessible public service motion graphics videos.",
  "使用数字人口播讲清商品定位、核心卖点、使用场景、优惠信息与行动引导，生成可直接播放和下载的营销视频节点。": "Use an AI presenter to explain product positioning, key benefits, use cases, promotions, and calls to action, creating marketing video nodes ready to play and download.",
  "围绕个人定位、观点表达、知识分享和内容栏目，生成具有人设一致性、自然语气与稳定镜头表现的数字人口播视频。": "Create AI presenter videos around your personal brand, opinions, expertise, and content series, with a consistent persona, natural delivery, and stable on-camera presence.",
  "使用数字人讲解企业定位、主营业务、核心优势、案例与品牌愿景，形成专业、可信的企业宣传视频。": "Use an AI presenter to explain company positioning, core business, strengths, case studies, and brand vision in a professional and credible corporate video.",
  "使用数字人讲解课程知识、培训步骤和重点内容，生成结构清晰、表达自然、便于学习的教学视频。": "Use an AI presenter to explain course material, training steps, and key points in structured, natural, easy-to-follow educational videos.",
  "使用公共服务数字人准确播报政策对象、核心权益、办理材料、流程、时限和官方咨询渠道。": "Use a public service AI presenter to accurately explain policy eligibility, benefits, required documents, procedures, deadlines, and official contact channels.",
  "剧情短片": "Story Shorts",
  "技能 Skills": "Skills",
  "Skill 范围": "Skill Library Tabs",
  "Skill 分类": "Skill Categories",
  "选择技能": "Select a Skill",
  "向左滚动分类": "Scroll categories left",
  "向右滚动分类": "Scroll categories right",
  "还没有收藏的 Skill": "No favorite Skills yet",
  "还没有创建的 Skill": "No created Skills yet",
  "当前分类暂无 Skill": "No Skills in this category",
  "取消收藏": "Remove from favorites",
  "删除": "Delete",
  "暂无创建的 Skill": "No created Skills yet"
}).forEach(([zh, en]) => TEXT.set(zh, en));
  // 2026-09-26 Product Design 改动逻辑：短剧第一步沿用首页语言开关；仅翻译显示文案，预设、画风和多选项的中文 data 值继续供原有保存与生成逻辑使用。
  Object.entries({
    "短剧生成进度":"Drama progress","点击编辑":"Edit title","工作流状态":"Workflow","大纲与设定":"Setup & Outline","分集剧本":"Episodes","资产":"Assets","分集视频":"Videos","审片":"Review",
    // 2026-09-26 改动逻辑：基础设定和转绘的目标字段统一为国家，补齐英文映射；旧地区键保留以兼容已有文案。
    "✦ 基础设定":"✦ Setup","基础设定":"Setup","基础设定摘要":"Setup summary","已选基础设定":"Selected setup","展开":"Expand","收起":"Collapse","修改":"Edit","确认":"Confirm","保存":"Save","集数":"Episodes","集":"episodes","比例":"Ratio","目标地区":"Region","目标国家":"Target country","中国":"China","韩国":"South Korea","印度":"India","巴西":"Brazil","泰国":"Thailand","选择短剧集数":"Select episode count","自定义集数":"Custom episode count","选择比例":"Select ratio","选择目标地区":"Select region","选择目标国家":"Select target country",
    "爆款预设":"Popular presets","玄幻修仙逆袭":"Fantasy Rise","现实职场成长":"Career Growth","末世生存基建":"Apocalypse Survival","非遗国潮视觉":"Heritage Style","古代女频甜宠":"Period Romance","规则怪谈悬疑":"Rule Mystery","重生复仇爽剧":"Reborn Revenge","仙门团宠日常":"Cultivation Family",
    "画风":"Visual style","画风分类":"Style categories","AI真人剧":"AI Live Action","AI漫剧":"AI Animation","自定义画风":"Custom style","已选画风":"Selected style","描述你希望使用的画风，例如：暖色赛博朋克，融合东方建筑与电影感光影。":"Describe your style, e.g. warm cyberpunk with Eastern architecture and cinematic light.",
    "现代短剧":"Modern Drama","现代短剧风格":"Modern Drama","美型古装":"Elegant Period","经典古装":"Classic Period","院线电影风":"Cinematic","张艺谋风格":"Zhang Yimou","欧洲史诗风格":"European Epic","银翼杀手风格":"Blade Runner","权力的游戏":"Game of Thrones","剧情犯罪":"Crime Drama","现代韩剧风":"Modern K-Drama","黑泽明风格":"Akira Kurosawa","诺兰风格":"Nolan","昆汀·塔伦蒂诺风格":"Tarantino","大卫·林奇风格":"David Lynch","韦斯·安德森风格":"Wes Anderson","王家卫风格":"Wong Kar-wai","邵氏武侠":"Shaw Kung Fu",
    "通用3D":"General 3D","玄幻仙侠3D":"Xianxia 3D","现代都市2D":"Urban 2D","古风仙侠2D":"Period Xianxia 2D","废土游戏CG":"Wasteland CG","Q版3D":"Chibi 3D","方块世界":"Block World","粘土玩具":"Clay Toys","欧美3D CG":"Western 3D CG","韩系都市条漫":"Korean Webtoon","罪城游戏插画":"Crime Game Art","三渲二":"Cel Shading","2D国风漫剧":"Chinese 2D","3D乙游":"Romance Game 3D","3D国创仙侠":"Chinese Xianxia 3D","像素农场":"Pixel Farm","西部荒野游戏CG":"Western Wasteland CG","双城蒸汽朋克":"Arcane Steampunk","卡通小人3D":"Cartoon 3D","颗粒复古手绘":"Grainy Retro Art","燕云十六州":"Yan Cloud Sixteen","油画三渲二":"Oil Cel Shading","美式3D":"American 3D","黑白水墨":"Black Ink","彩色水墨":"Color Ink","羊毛毡风格":"Felt Art","黏土定格":"Clay Stop Motion","惊悚怪谈风":"Folk Horror","韩漫风格":"Korean Comic","次世代三渲二":"Next Gen Cel Shading","吉卜力":"Ghibli","赛博朋克":"Cyberpunk","克苏鲁风":"Lovecraftian","伊藤润二风":"Junji Ito","日本复古动画":"Retro Anime","高燃战斗番":"Action Anime",
    "题材":"Genre","现言都市":"Urban Romance","古言宫廷":"Period Romance","仙侠玄幻":"Xianxia Fantasy","校园青春":"Campus Youth","年代情感":"Period Romance","民国传奇":"Republican Era","悬疑刑侦":"Crime Mystery","恐怖灵异":"Horror","科幻机甲":"Sci-Fi Mecha","武侠动作":"Martial Arts","职场商战":"Workplace","乡村现实":"Rural Life","奇幻脑洞":"Fantasy","家庭情感":"Family Drama","求生冒险":"Survival Adventure","轻喜剧":"Comedy","自定义题材":"Custom genre","输入自定义题材":"Enter a genre",
    "目标受众":"Audience","男频":"Male-oriented","女频":"Female-oriented","泛人群":"General","出海":"Global","银发":"Seniors","自定义目标受众":"Custom audience","输入自定义目标受众":"Enter an audience",
    "角色设定":"Characters","小人物":"Underdog","打工人":"Worker","女强":"Strong Woman","不完美成长型":"Flawed Hero","专业型":"Expert","天才":"Prodigy","双强":"Power Couple","腹黑":"Schemer","黑莲花":"Dark Heroine","忠犬":"Devoted Lover","病娇":"Obsessive Lover","福宝":"Lucky Child","大小姐":"Heiress","少爷":"Young Master","王爷":"Prince","王妃":"Princess","王妃":"Princess","皇帝":"Emperor","将军":"General","修士":"Cultivator","龙王":"Dragon King","医者":"Healer","律师":"Lawyer","警探":"Detective","教师":"Teacher","模特":"Model","自定义角色设定":"Custom character","输入自定义角色设定":"Enter a character",
    "时代背景":"Era","古代":"Ancient","现代":"Modern","架空":"Fantasy World","末世":"Apocalypse","民国":"Republican Era","年代（80-90年代）":"1980s–90s","近未来":"Near Future","平行世界":"Parallel World","多时空穿越":"Time Travel","自定义时代背景":"Custom era","输入自定义时代背景":"Enter an era",
    "核心看点":"Story hooks","器物金手指":"Magic Item","收集升级":"Collect & Level Up","基建生存":"Build & Survive","专业碾压":"Expert Edge","马甲大佬":"Hidden Master","先婚后爱":"Marriage to Love","重生复仇":"Reborn Revenge","团宠被爱":"Beloved by All","IP二创":"Fan Fiction","双向救赎":"Mutual Healing","穿越异世":"Otherworld Travel","扮猪吃虎":"Hidden Power","亲历行业细节":"Industry Detail","真实成长":"Real Growth","规则禁忌":"Forbidden Rules","单元解谜":"Episodic Mystery","文化元素新用":"Cultural Remix","风格混搭":"Style Fusion","视觉奇观":"Visual Spectacle","隐藏身份":"Secret Identity","真假千金":"Switched Heiress","契约婚姻":"Contract Marriage","萌宝助攻":"Child Matchmaker","赘婿逆袭":"Son-in-law Rise","系统傍身":"Power System","欢喜冤家":"Rivals to Lovers","普通人的处境":"Everyday Struggles","群像时代切片":"Ensemble Portrait","姐弟恋":"Age-gap Romance","穿书":"Into a Novel","时间循环":"Time Loop",
    "情绪基调":"Tone","轻松治愈":"Warm & Light","甜宠温暖":"Sweet Romance","轻喜欢脱":"Playful Comedy","热血燃爽":"High Energy","励志成长":"Uplifting","紧张刺激":"Thrilling","悬疑压迫":"Tense Mystery","暗黑沉重":"Dark","虐心悲情":"Tragic",
    "剧本结构":"Structure","三幕式":"Three Acts","五幕式":"Five Acts","英雄旅程":"Hero's Journey","平行结构":"Parallel","交叉结构":"Interwoven","非线性结构":"Nonlinear","环形结构":"Circular","单元结构":"Episodic",
    "剧本创作界面":"Script workspace","对话框":"Chat","预置对话":"Sample chat","短剧对话输入":"Drama chat input","输入你的问题，Enter 换行，Cmd/Ctrl + Enter 发送":"Ask a question. Enter for a new line; Cmd/Ctrl + Enter to send.","移除剧本文件":"Remove script","调整对话区与剧本区宽度":"Resize chat and script","剧本详情":"Script details","剧本大纲生成中，请稍后...":"Generating outline…","正在生成剧本":"Generating script…","暂无剧本大纲内容\n请先与 AI 确认剧本方向":"No outline yet\nConfirm the story direction with AI.","暂无整体剧本大纲":"No outline yet","故事大纲":"Story outline","故事梗概":"Synopsis","世界观":"World","修改剧本":"Edit script","进入下一步":"Next step","下一步":"Next","风格":"Style","选择风格":"Select style","风格分类":"Style categories","选择视频模型":"Select video model","选择图片模型":"Select image model","选择画面比例":"Select aspect ratio","未选择":"None","至多 2 项":"Up to 2","至多 3 项":"Up to 3","至多 5 项":"Up to 5","自定义...":"Custom…","生成分集剧本详情":"Generate Episodes","角色列表":"Characters","角色类型":"Character types","主角":"Lead","配角":"Supporting","角色描述":"Description","角色妆造":"Look","物品列表":"Props","大纲":"Outline","节拍":"Beats","悬疑链":"Mystery Arc","分集大纲内容视图":"Outline views","编辑":"Edit","返回首页":"Back to Home",
    "增加剧本集数？":"Add episodes?","精简剧本集数？":"Reduce episodes?","确认增加":"Add episodes","确认精简":"Reduce episodes","调整剧本集数？":"Change episode count?","取消":"Cancel","确认调整":"Confirm","在剧本中增加反转内容":"Add a plot twist","好的，已经修改了剧本，还有什么要修改的吗":"Done. Any other changes?","已上传附件":"Attachments","发送":"Send","上一个问题":"Previous question","下一个问题":"Next question","输入你的想法":"Enter your idea","输入其他选项":"Other option","清空其他选项":"Clear other option","确认并生成":"Confirm & Generate","继续":"Continue","已确认":"Confirmed","基础设定已保存，但本次 AI 请求未完成。请在对话中重试，或返回基础设定后再次确认。":"Setup saved, but AI did not respond. Retry in chat or confirm the setup again."
  }).forEach(([zh, en]) => TEXT.set(zh, en));
  // 2026-09-26 Product Design 改动逻辑：仅短剧最后的分集视频列表使用这些简短译文；示例剧情按原文整段映射，避免修改剧本数据或其他页面。
  // 2026-09-28 Product Design 改动逻辑：分集进度名称改为“已生成分镜片段”，英文标签及带数量的动态翻译使用同一名称。
  const VIDEO_TEXT = new Map(Object.entries({
    "西部世界":"Westworld","剧本":"Script","视频":"Video","分镜视频":"Episode videos","项目概览":"Project overview","正在生成分集脚本和提示词，请稍后...":"Generating scripts and prompts…",
    "已生成完成集数":"Episodes ready","已审核通过集数":"Approved","已生成分镜片段":"Generated storyboard clips","已完成":"Done","未完成":"Incomplete","审核通过":"Approved","审核不通过":"Rejected","下载":"Download","剪辑":"Cut","编辑分集标记":"Edit review status",
    "第1集：新面孔":"Ep 1: New Face","第2集：十七年真相浮现":"Ep 2: The Truth","第3集：十七年误解一朝解":"Ep 3: Misunderstood","第4集：记忆深处的出口":"Ep 4: The Exit",
    "星辉高中表面是一所培养优秀学生的寄宿学校，暗中却通过“星辉计划”筛选能感知异常频率的少年。转学生林宇在新学期意外觉醒吸收与反射能量的能力，并与同桌张曼从一段失真的广播开始，逐步揭开十七年前校园实验事故的真相。八集故事以校园悬疑为骨架，让友情、身份谜团与能力失控彼此推进，最终将一所学校的秘密扩展成更大的危机。":"At Starlight High, a secret program tests students who sense unusual energy. New student Lin Yu discovers he can absorb and reflect it. With classmate Zhang Man, he traces a distorted broadcast to a campus accident 17 years ago. Across eight episodes, their search exposes the school's secrets and a wider threat.",
    "游客韩策登上海岛猎场，被告知仿生人无法伤害人类，死亡后也会被修复重置。为了验证规则，他当街枪杀治安员陈不归。第二天，陈不归完好无损地重新出现。虽然记忆已经清空，他却看着韩策说道：“这次开枪，别再抖了。”":"Visitor Han Ce learns the island's androids cannot harm people and reset after death. He shoots officer Chen Bugui to test the rule. Chen returns the next day with no memory, but tells him, “Keep your hand steady this time.”",
    "工程师周砚发现陈不归没有昨天的记忆，身体却仍然恐惧韩策。医生罗青禾也开始听见自己过去的求救声。她跟随声音进入灯塔地下，看见正在被修复的镇民，以及一具与自己完全相同的备用身体。她问周砚：“我死过多少次？”":"Engineer Zhou Yan finds that Chen's body still fears Han Ce despite his memory reset. Doctor Luo Qinghe follows echoes of her own cries beneath the lighthouse, where she sees residents being repaired and a spare body identical to hers. “How many times have I died?” she asks.",
    "罗青禾进入控制室，发现公司一直通过仿生人测试游客。游客以为自己的行为不会留下后果，公司却记录了他们每一次撒谎、背叛和伤害。负责人顾长川命令周砚清除罗青禾的异常记忆。周砚表面答应，却悄悄保留了她的深层记忆。":"In the control room, Luo learns the company uses androids to test visitors, recording every lie and act of harm. Director Gu orders Zhou to erase her memories. Zhou agrees, but secretly saves her deepest ones.",
    "周砚告诉罗青禾，记忆清除系统只能删除完整画面，无法删除死亡时留下的声音。罗青禾启动旧广播，将镇民过去被杀害和重置的声音传遍小岛。所有仿生人陆续想起自己的痛苦，第一次知道自己每天都在重复同一天。":"Zhou tells Luo that the system can erase images, but not the sounds of death. She broadcasts the residents' past killings and resets across the island. The androids begin to remember their pain and realize they have relived the same day.",
    "陈不归与罗青禾循着残留记忆找到园区地下的旧控制室，发现每次重置都会留下短暂的出口信号。两人决定在下一次重置前联手破解系统，却在监控画面中看见另一个自己。":"Chen and Luo follow fragments of memory to an old control room. Each reset leaves a brief exit signal. They try to break the system before the next reset, then spot another version of themselves on the monitors.",
    "秦始皇令扶苏赴上郡监军，庶子嬴昭主动请命同行；临行前他预感沙丘之变将至，却只能随车队奔赴边关。":"The emperor sends Fusu to the frontier. Ying Zhao joins him, sensing a crisis ahead.",
    "沙丘传来始皇驾崩与矫诏赐死扶苏的消息，嬴昭竭力阻止兄长自刎却未能成功；扶苏血染怀中之际，嬴昭的国运系统突然觉醒。":"News arrives of the emperor's death and a forged order for Fusu to die. Ying Zhao cannot save his brother, but his power awakens.",
    "系统觉醒后的嬴昭正面迎战赵高之弟赵合及其兵马，以一敌百斩杀赵合；他提首登台，令三万长城军跪伏响应。":"Ying Zhao defeats Zhao He and his soldiers. The Great Wall army rallies behind him."
  }));
  // 2026-09-26 Product Design 改动逻辑：团队页沿用现有页面语言开关，默认仍为中文；英文模式只翻译界面文案，不改成员、团队和项目数据。
  const TEAM_TEXT = new Map(Object.entries({
    // 2026-09-29 Product Design 改动逻辑：解散团队入口与弹窗已移除，英文字典不再保留该流程文案。
    "返回上一页":"Back","团队管理":"Team","团队信息":"Team details","编辑团队资料":"Edit team","团队ID: 100670":"Team ID: 100670","权限设置":"Permissions","添加成员":"Add member",
    "团队与积分概况":"Team and credits","团队概况":"Team overview","增加席位":"Add seats","团队项目":"Projects","成员席位":"Seats","积分概况":"Credits","积分加量":"Add credits","累计消耗积分":"Credits used","当前剩余积分":"Balance","剩余可分配积分":"Available","4.18w":"41.8k",
    "团队成员数据":"Team data","团队数据视图":"Team views","成员管理":"Members","成员消耗看板":"Usage","项目看板":"Projects","成员状态：":"Status:","成员状态":"Member status","成员状态选项":"Member status options","正常":"Active","已移除":"Removed","待同意":"Pending","成员名称":"Member name","按成员名称搜索":"Search members","批量管理积分":"Bulk credits",
    /* 2026-09-26 Product Design 改动逻辑：项目筛选标签明确为修改日期，保留成员消耗筛选原日期文案。 */
    "日期：":"Date:","修改日期：":"Updated:","至":"to","选择日期":"Select date","成员消耗开始日期":"Usage start date","成员消耗结束日期":"Usage end date","项目开始日期":"Project start date","项目结束日期":"Project end date","账号ID":"Account ID","按账号 ID 搜索":"Search account ID","手机号":"Phone","按手机号搜索":"Search phone","项目名":"Project","按项目名搜索":"Search projects",
    /* 2026-09-26 Product Design 改动逻辑：新增 DDL 排序选项与截止日期列的英文文案。 */
    /* 2026-09-29 Product Design 改动逻辑：项目看板新增审核集数表头与待审核排序时，英文模式同步展示对应文案。 */
    "按项目状态筛选":"Filter by status","全部状态":"All statuses","未完成":"Incomplete","未审核":"Pending review","审核不通过":"Rejected","审核通过":"Approved","按项目类型筛选":"Filter by type","全部类型":"All types","画布":"Canvas","短剧":"Drama","项目排序":"Sort projects","按积分排序":"By credits","按时间排序":"By date","按DDL排序":"By deadline","按待审核排序":"By pending review","截止日期":"Deadline","未设置":"Not set",
    /* 2026-09-29 Product Design 文案逻辑：项目看板第二列表头改为“项目成员”后，英文模式同步显示“Project members”。 */
    "成员列表":"Member list","名称":"Name","月积分消耗/每月额度":"Monthly use / monthly limit","团队角色":"Role","状态":"Status","项目":"Projects","操作":"Actions","消耗积分":"Credits used","日期":"Date","负责人":"Owners","项目成员":"Project members","类型":"Type","修改时间":"Updated","制作进度":"Progress","消耗积分量":"Credits used",/* 2026-09-30 Product Design 改动逻辑：四个独立集数列表头同步英文翻译。 */
    /* 2026-09-30 Product Design 改动逻辑：新增视频制作百分比列的英文表头。 */
    "视频制作进度":"Video production progress","待提交审核集数":"Awaiting submission","待审核集数":"Pending review","审核通过集数":"Approved episodes","总集数":"Total episodes","分页":"Pages","上一页":"Previous page","下一页":"Next page","每页数量":"Rows per page","10 / 页":"10 / page",
    "管理员":"Admin","普通成员":"Member","参与团队所有项目":"All team projects","暂无项目":"No projects","（你）":"(you)","无权限查看或操作":"No access","暂无符合条件的成员":"No members found","暂无符合条件的成员消耗数据":"No usage found","暂无符合条件的项目数据":"No projects found","暂无数据":"No data","开始日期不能晚于结束日期":"Start date is after end date",
    "管理积分":"Manage credits","积分明细":"Credit details","人员管理":"Manage member","项目分配":"Assign projects","保存成员名称":"Save name","项目负责人":"Project owners","参与项目":"Projects","大纲与设定":"Setup","分集剧本":"Episodes","资产":"Assets","分集视频":"Videos","审片":"Review","积分":"Credits",
    "关闭权限设置":"Close permissions","普通成员权限设置":"Member permissions","配置团队普通成员在项目中的操作权限":"Set member permissions","以下限制仅针对团队普通成员，管理员拥有所有权限":"Admins have full access","可删除项目和画布节点":"Delete projects and nodes","开启后，普通成员可删除项目和画布节点":"Allow members to delete projects and nodes","可下载原始文件":"Download originals","开启后，普通成员可下载原始文件":"Allow members to download originals","可审核短剧成片":"Review drama videos","开启后，普通成员可对短剧的生成好的视频进行审核和评论":"Allow members to review and comment on videos","取消":"Cancel","保存设置":"Save settings",
    "关闭人员管理":"Close member actions","从团队移除":"Remove member","修改角色":"Change role","关闭修改角色":"Close role editor","团队角色选项":"Role options","确认":"Confirm","邀请成员":"Invite member","关闭邀请成员":"Close invitation","邀请成员手机号":"Member phone","请输入成员手机号":"Enter phone","当前团队席位总数":"Seats:","个，空余席位":" · Open:","个":"","确认邀请":"Send invite",
    "授权项目":"Assign projects","关闭授权项目":"Close project assignment","分配项目方式":"Assignment mode","授权分配":"Selected projects","全选项目":"Select all projects","全选结果":"Select all results","搜索项目名称":"Search projects","按项目名称筛选":"Search projects","选择授权项目":"Choose projects","保存授权":"Save access","该成员将参与团队所有项目，包括后续新建的项目。":"Access to all current and future projects.","勾选成员可参与的项目，取消勾选即可取消授权。":"Select projects this member can access.","没有匹配的项目，请尝试其他名称":"No matching projects","暂无可分配项目":"No projects to assign",
    // 2026-09-30 Product Design 改动逻辑：新增月额度设置、空值及成功提示的英文文案，匹配简化后的积分弹窗。
    "设定新的每月积分额度":"Set a new monthly credit limit","请输入新的每月积分额度":"Enter a new monthly credit limit","请输入有效的每月积分额度（正整数）":"Enter a valid monthly credit limit (positive integer)","每月积分额度已更新":"Monthly credit limit updated",
    "管理成员积分":"Manage credits","关闭积分管理":"Close credit manager","选择成员":"Select members","全选":"Select all","操作类型":"Action","分配积分":"Allocate credits","回收积分":"Reclaim credits","积分数额":"Amount","将每个月发放该数量的积分":"Monthly credit amount","请输入回收积分数额":"Enter amount to reclaim","成员消耗明细":"Usage details","关闭消耗明细":"Close usage details","时间":"Time",
    "验证码":"Code","请输入验证码":"Enter code","确认将该成员移出团队？":"Remove this member?","关闭成员移除确认":"Close removal dialog",
    "上个月":"Previous month","下个月":"Next month","日":"Sun","一":"Mon","二":"Tue","三":"Wed","四":"Thu","五":"Fri","六":"Sat","清除":"Clear","今天":"Today",
    "切换到旧版":"Old version","团队":"Team","来画科技头像":"Team avatar","团队版 · 高级版":"Team · Pro","我的本月额度：":"My monthly limit:","团队总积分余额":"Team balance","点":"credits","查看团队":"View team","查看团队积分并进入团队页面":"View team credits","免费版":"Free","团队账户":"Team account","个人账户":"Personal account","选择个人或团队账号":"Choose account","创建团队":"Create team",
    "编辑团队":"Edit team","修改团队名称和头像":"Update team name and avatar","关闭编辑团队":"Close team editor","团队头像":"Team avatar","选填":"Optional","团队头像预览":"Team avatar preview","上传图片":"Upload image","移除":"Remove","更换图片":"Change image","正在处理…":"Processing…","JPG、PNG、WebP，不超过 5 MB":"JPG, PNG, WebP · max 5 MB","建议正方形，未上传时使用团队名称首字":"Square image recommended","上传团队头像":"Upload team avatar","团队名称":"Team name","给团队起个名字":"Name your team","最多 24 个字符":"Up to 24 characters","最多 24 个字符，创建后可在团队管理中修改":"Up to 24 characters; edit later","与成员一起创作，共同管理项目和资产":"Create together and manage projects","关闭创建团队":"Close team creator","你将成为团队管理员":"You will be the admin","可邀请成员、管理项目和分配积分。":"Invite members, manage projects, and allocate credits.","成员邀请和权限设置可在创建后完成。":"Set invites and permissions later.","保存":"Save",
    "团队名称不能只包含空格":"Enter a valid team name","请输入团队名称":"Enter team name","团队名称不能超过 24 个字符":"Name is too long","创建中…":"Creating…","团队资料已更新":"Team updated","团队创建成功":"Team created",
    "增加席位暂未开放":"Seat purchases unavailable","积分加量暂未开放":"Credit purchases unavailable","成员名称不能为空":"Enter a member name","成员名称已更新":"Name updated","请输入有效手机号":"Enter a valid phone number","团队席位已满":"No seats left","该成员已在团队中":"Already a member","邀请已发送":"Invite sent","请先选择成员":"Select members first","未找到该成员":"Member not found","请输入有效积分数额":"Enter a valid amount","团队可分配积分不足":"Not enough available credits","成员可回收积分不足":"Not enough credits to reclaim","积分已更新":"Credits updated","设置保存失败，请重试":"Save failed. Try again.","权限设置已保存":"Permissions saved","验证码不正确":"Invalid code",
    // 2026-09-26 改动逻辑：团队头像校验、右上账户区和验证码提示也随语言切换，补齐隐藏弹窗中的错误状态及无障碍名称。
    "请选择 JPG、PNG 或 WebP 格式的图片":"Choose a JPG, PNG, or WebP image","图片不能超过 5 MB，请选择较小的图片":"Image must be under 5 MB","图片为空，请重新选择":"Empty image. Try again.","图片无法读取，请重新选择":"Can't read image. Try again.","图片无法读取，请尝试其他图片":"Can't read image. Try another.","验证码 583a3":"Code 583a3",
    "FREE，V 点余额 44580":"Free · 44,580 V points","Laipic-2140321 头像":"Account avatar","个人中心展开弹窗":"Account menu","个人中心操作":"Account actions","切换个人/团队账号":"Switch account","当前账户头像":"Account avatar","打开个人中心":"Open account menu","关闭个人中心":"Close account menu","注册/登录":"Sign in","简体中文":"Simplified Chinese","选择页面语言":"Choose language"
  }));
  const TEAM_EN_TO_ZH = new Map([...TEAM_TEXT].map(([zh,en]) => [en,zh]));
  const PLACEHOLDERS = new Map([["和我说说你想把这个产品打造成一个什么样的广告视频，例如：为索尼相机生成一组野性自然风格的极简广告视频...","Tell me what kind of ad you want to create, e.g. a minimalist wild-nature campaign for a Sony camera..."],["例如：一只戴着墨镜的橘猫在海边自拍，用轻松幽默的语气分享第一次冲浪的经历","Example: An orange cat in sunglasses takes a beach selfie and humorously shares its first surfing experience"],["如：产品名称、核心卖点、适用人群、风格色调等","E.g. product name, key benefits, audience, style, and color palette"]]);
  let language = "zh-CN", translating = false;
  const originalText = new WeakMap(), originalAttrs = new WeakMap();
  // 2026-09-26 改动逻辑：短剧工作区始终在翻译根节点内，用户先切英文再返回第一步时，导航和第一步内容仍保持英文。
  // 2026-09-26 改动逻辑：语言切换只新增分集视频列表根节点，视频编辑、审片及其他短剧步骤不随这次修改扩大翻译范围。
  const roots = () => [document.querySelector(".sidebar"),document.querySelector('[data-view="canvas"]'),document.querySelector('[data-view="script-studio"]'),document.querySelector('[data-view="episode-video"]'),document.getElementById("scriptCountChangeConfirmModal"),document.getElementById("scriptOutlineDeleteConfirmModal"),document.querySelector(".global-account"),document.getElementById("teamConsoleOverlay"),document.getElementById("teamSubmodal"),document.getElementById("teamToast"),document.getElementById("teamOwnersTooltip"),document.getElementById("teamMemberProjectTooltip"),document.querySelector(".team-calendar-popover"),document.getElementById("teamCreateDialog"),document.getElementById("teamEditDialog"),document.getElementById("profilePopover"),document.getElementById("skillDetailModal"),document.getElementById("homeSkillDropdown"),...document.querySelectorAll(".vina-home-skill-hover-preview")].filter(Boolean);
  const inScope = node => roots().some(root => root === node || root.contains(node));
  // 2026-09-26 改动逻辑：团队页面及其外置弹窗共用同一译文入口；数据值保持中文，筛选和权限判断继续使用原始值。
  const teamScope = node => node?.closest?.('#teamConsoleOverlay, #teamSubmodal, #teamToast, #teamOwnersTooltip, #teamMemberProjectTooltip, .team-calendar-popover, .team-create-dialog, .global-account');
  const teamTranslated = (value, node) => {
    if (!teamScope(node)) return null;
    const t = value.trim();
    if (TEAM_TEXT.has(t)) return value.replace(t, TEAM_TEXT.get(t));
    const parts = t.split('、');
    if (parts.length > 1) return value.replace(t, parts.map(part => TEAM_TEXT.get(part) || part).join(', '));
    let match = t.match(/^已选\s*(\d+)\s*\/\s*(\d+)\s*个项目$/);
    if (match) return value.replace(t, match[1] + '/' + match[2] + ' selected');
    match = t.match(/^已选\s*(\d+)\s*人$/);
    if (match) return value.replace(t, match[1] + ' selected');
    // 2026-09-30 改动逻辑：动态当前月额度保留千分位数值，只翻译标签。
    match = t.match(/^当前每月额度：(.+)$/);
    if (match) return value.replace(t, 'Current monthly limit: ' + match[1]);
    // 2026-09-30 改动逻辑：匹配新的团队总共剩余可分配积分标签，并保留余额数值。
    match = t.match(/^团队总共剩余可分配积分：(.+)$/);
    if (match) return value.replace(t, 'Total team credits available: ' + match[1]);
    match = t.match(/^成员名称：(.+)$/);
    if (match) return value.replace(t, 'Member: ' + match[1]);
    match = t.match(/^账号 ID：(.+)$/);
    if (match) return value.replace(t, 'Account ID: ' + match[1]);
    match = t.match(/^【(.+)】(参与项目|项目负责人|消耗明细)$/);
    if (match) return value.replace(t, match[1] + ' ' + ({'参与项目':'projects','项目负责人':'owners','消耗明细':'usage'}[match[2]]));
    match = t.match(/^编辑 (.+) 的名称$/);
    if (match) return value.replace(t, 'Edit ' + match[1]);
    // 2026-09-26 截止日期编辑逻辑：动态项目名的按钮标签在英文界面保留项目上下文。
    match = t.match(/^编辑截止日期：(.+)$/);
    if (match) return value.replace(t, 'Edit deadline: ' + match[1]);
    match = t.match(/^为 (.+) 分配项目$/);
    if (match) return value.replace(t, 'Assign projects to ' + match[1]);
    match = t.match(/^(.+)头像，点击编辑团队资料$/);
    if (match) return value.replace(t, match[1] + ' avatar, edit team');
    match = t.match(/^(.+)头像$/);
    if (match) return value.replace(t, match[1] + ' avatar');
    match = t.match(/^(.+) · (管理员|普通成员)$/);
    if (match) return value.replace(t, match[1] + ' · ' + TEAM_TEXT.get(match[2]));
    match = t.match(/^(.+)，(\d+)\/5，(.+)$/);
    if (match) return value.replace(t, (TEAM_TEXT.get(match[1]) || match[1]) + ', ' + match[2] + '/5, ' + (TEAM_TEXT.get(match[3]) || match[3]));
    match = t.match(/^(\d{4})年\s*(\d+)月(\d+)日$/);
    if (match) return value.replace(t, match[2] + '/' + match[3] + '/' + match[1]);
    match = t.match(/^(\d{4})年\s*(\d+)月$/);
    if (match) return value.replace(t, match[2] + '/' + match[1]);
    match = t.match(/^已更新 (.+) 的项目授权$/);
    if (match) return value.replace(t, match[1] + ' access updated');
    match = t.match(/^已将 (.+) 的角色修改为(管理员|普通成员)$/);
    if (match) return value.replace(t, match[1] + ' is now ' + TEAM_TEXT.get(match[2]));
    match = t.match(/^已将 (.+) 从团队移除$/);
    if (match) return value.replace(t, match[1] + ' removed');
    match = t.match(/^新成员(\d+)$/);
    if (match) return value.replace(t, 'New member ' + match[1]);
    return null;
  };
  // 2026-09-26 改动逻辑：短剧摘要、选择上限和画风预览按固定格式组合翻译；新生成的中文节点仍由原观察器即时处理。
  const baseTranslated = (value,node) => { const t=value.trim(); const videoPage=node?.closest?.('[data-view="episode-video"]'); if(videoPage&&VIDEO_TEXT.has(t))return value.replace(t,VIDEO_TEXT.get(t)); if(TEXT.has(t)) return value.replace(t,TEXT.get(t)); if(videoPage){ const count=t.match(/^共\s*(\d+)\s*集$/); if(count)return `${count[1]} episodes`; const progress=t.match(/^(已生成分镜片段|已生成完成集数|已审核通过集数)\s*(\d+\/\d+)$/); if(progress)return `${VIDEO_TEXT.get(progress[1])} ${progress[2]}`; const play=t.match(/^播放(第\d+集：.+)$/); if(play&&VIDEO_TEXT.has(play[1]))return `Play ${VIDEO_TEXT.get(play[1])}`; } const action=t.match(/^(取消收藏|收藏|删除)(.+)$/); if(action) return `${TEXT.get(action[1])} ${TEXT.get(action[2]) || action[2]}`; const m=t.match(/^(\d+)\s*集$/); if(m)return `${m[1]} episodes`; if(t.includes(" · "))return value.replace(t,t.split(" · ").map(part=>translated(part,node)).join(" · ")); if(t.includes("、")&&t.split("、").every(part=>TEXT.has(part)))return value.replace(t,t.split("、").map(part=>TEXT.get(part)).join(", ")); const limit=t.match(/^至多\s*(\d+)\s*项$/); if(limit)return `Up to ${limit[1]}`; const preview=t.match(/^(.+?)风格预览$/); if(preview&&TEXT.has(preview[1]))return `${TEXT.get(preview[1])} preview`; const group=t.match(/^(.+?)，至多选择\s*(\d+)\s*项$/); if(group&&TEXT.has(group[1]))return `${TEXT.get(group[1])}, up to ${group[2]}`; const countChange=t.match(/^当前剧本为 (\d+) 集。修改为 (\d+) 集后，是否同步(增加|精简)并调整剧本内容，使剧情结构与新集数匹配？$/); if(countChange)return `Change from ${countChange[1]} to ${countChange[2]} episodes and update the story?`; return value; };
  const translated = (value,node) => teamTranslated(value,node) ?? baseTranslated(value,node);
  // 2026-09-26 改动逻辑：右侧编辑面板会克隆已译成英文的设定表单；新克隆节点先还原中文原文，切回中文时才能正确恢复。
  const EN_TO_ZH = new Map([...TEXT].map(([zh,en])=>[en,zh]));
  // 2026-09-26 改动逻辑：克隆表单中的英文预览图说明也恢复为中文原文，保持图片无障碍文案可双向切换。
  const restored = value => {const t=value.trim(); if(EN_TO_ZH.has(t))return value.replace(t,EN_TO_ZH.get(t)); if(t.includes(" · "))return value.replace(t,t.split(" · ").map(restored).join(" · ")); const preview=t.match(/^(.+) preview$/); if(preview&&EN_TO_ZH.has(preview[1])){const name=EN_TO_ZH.get(preview[1]);return `${name}${name.endsWith("风格")?"预览":"风格预览"}`;} const m=t.match(/^(\d+) episodes$/); return m?`${m[1]} 集`:value;};
  const sourceValue = (node,value) => { if (language==="en" && node?.closest?.("summary.team-select") && teamScope(node)) { const t=value.trim(); if (TEAM_EN_TO_ZH.has(t)) return value.replace(t,TEAM_EN_TO_ZH.get(t)); } return language==="en" && node?.closest?.('[data-view="script-studio"]') ? restored(value) : value; };
  const translateNode = node => {
    if(node.nodeType===Node.TEXT_NODE){ if(!node.nodeValue.trim())return; if(!originalText.has(node)||/[\u3400-\u9fff]/.test(node.nodeValue))originalText.set(node,sourceValue(node.parentElement,node.nodeValue)); const nextText=language==="en"?translated(originalText.get(node),node.parentElement):originalText.get(node); if(node.nodeValue!==nextText)node.nodeValue=nextText; return; }
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    if(!originalAttrs.has(node))originalAttrs.set(node,{}); const saved=originalAttrs.get(node);
    ["placeholder","aria-label","title","alt"].forEach(attr=>{ if(!node.hasAttribute(attr))return; const current=node.getAttribute(attr); if(!(attr in saved)||/[\u3400-\u9fff]/.test(current))saved[attr]=sourceValue(node,current); const nextAttr=language==="en"?(PLACEHOLDERS.get(saved[attr])||translated(saved[attr],node)):saved[attr]; if(current!==nextAttr)node.setAttribute(attr,nextAttr); });
    node.childNodes.forEach(translateNode);
  };
  const applyLanguage = next => {
    language=next==="en"?"en":"zh-CN"; translating=true; document.documentElement.lang=language; roots().forEach(translateNode);
    // 2026-09-22 改动逻辑：切换中英文后分类从左端重新展示，边界箭头由现有滚动及尺寸监听同步。
    document.getElementById("homeSkillTabs")?.scrollTo({left:0,behavior:"instant"});
    const label=document.getElementById("profileLanguageLabel"); if(label)label.textContent=language==="en"?"Page language: English":"页面语言：简体中文";
    document.querySelectorAll("[data-page-language]").forEach(option=>{const active=option.dataset.pageLanguage===language; option.classList.toggle("is-active",active); option.setAttribute("aria-selected",String(active));}); translating=false;
  };
  const trigger=document.getElementById("profileLanguageTrigger"), popover=document.getElementById("profileLanguagePopover");
  const setOpen=open=>{if(!popover||!trigger)return; popover.hidden=!open; trigger.setAttribute("aria-expanded",String(open));};
  trigger?.addEventListener("click",event=>{event.stopPropagation();setOpen(popover.hidden);});
  popover?.addEventListener("click",event=>{const option=event.target.closest("[data-page-language]");if(!option)return;applyLanguage(option.dataset.pageLanguage);setOpen(false);});
  document.addEventListener("click",event=>{if(!popover?.hidden&&!popover.contains(event.target)&&!trigger?.contains(event.target))setOpen(false);});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!popover?.hidden)setOpen(false);});
  // 2026-09-22 改动逻辑：浮层及外置悬停说明属于翻译范围；监听动态文本和按钮提示，并仅写入变化值避免观察器循环。
  new MutationObserver(records=>{
    if(translating||language!=="en")return;
    translating=true;
    records.forEach(record=>{
      if(record.type==="childList")record.addedNodes.forEach(node=>{if(inScope(node))translateNode(node);});
      else if(inScope(record.target))translateNode(record.target);
    });
    translating=false;
  }).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["aria-label","title","placeholder","alt"]});
  // 2026-09-20 默认语言逻辑：每次进入页面都从简体中文开始，不使用 localStorage 记忆上次选择。
  applyLanguage("zh-CN");
})();
