// 2026-10-30 Product Design 改动逻辑：页面按 Figma 团队会员画框还原，默认团队入口，支持个人／团队会员切换；月度／年度、购买确认及 V 点超市继续复用既有处理。
(() => {
      const page = document.getElementById('membershipPage');
      const close = document.getElementById('vmMembershipClose');
      const modal = document.getElementById('vmMembershipModal');
      const modalTitle = document.getElementById('vmModalTitle');
      const modalSubtitle = document.getElementById('vmModalSubtitle');
      const modalBody = document.getElementById('vmModalBody');
      if (!page || !close || !modal || !modalTitle || !modalSubtitle || !modalBody) return;

      const format = (value) => Number(value).toLocaleString('zh-CN');
      const publishedEnterpriseConfig = {
        published: true,
        contactLabel: '企业微信顾问',
        serviceAssetLabel: '企业微信二维码（已上传）',
        // 2026-10-23 资源适配：上传 HTML 引用的顾问二维码未随文件提供，沿用原模块的未配置提示，收到真实图片后再配置资源路径。
        qrImage: '',
        consultationCopy: '扫码添加企业微信顾问，顾问将尽快与您联系。'
      };
      const publishedModelRateConfig = [
        { name: 'MiniMax H3 Max', kind: 'video', outputPerPoint: .25, memberOnly: true, personalLevels: ['标准版', '进阶版', '专业版', '豪华版'], teamLevels: ['标准版', '进阶版', '专业版', '豪华版'], discount: { // 2026-10-30：恢复当前会话的个人订阅，供返回账号菜单时隐藏已开通会员的个人横幅；团队订阅保持独立。
          personal: window.vinaPersonalMembershipState?.read() || null, team: null } },
        { name: 'MiniMax H3', kind: 'video', outputPerPoint: 1 / 6, memberOnly: true, personalLevels: ['标准版', '进阶版', '专业版', '豪华版'], teamLevels: ['标准版', '进阶版', '专业版', '豪华版'], discount: { personal: null, team: null } },
        { name: 'MiniMax H3 Fast', kind: 'video', outputPerPoint: .5, memberOnly: true, personalLevels: ['标准版', '进阶版', '专业版', '豪华版'], teamLevels: ['标准版', '进阶版', '专业版', '豪华版'], discount: { personal: null, team: null } },
        { name: 'Seedance 2.5', kind: 'video', outputPerPoint: 1 / 19, memberOnly: true, personalLevels: ['标准版', '进阶版', '专业版', '豪华版'], teamLevels: ['标准版', '进阶版', '专业版', '豪华版'], discount: { personal: null, team: null } },
        { name: 'Seedance 2.0', kind: 'video', outputPerPoint: 1 / 15, memberOnly: false, discount: { personal: null, team: null } },
        { name: 'Seedance 2.0 Fast', kind: 'video', outputPerPoint: 1 / 15, memberOnly: false, discount: { personal: null, team: null } },
        { name: 'Seedance 2.0 Mini', kind: 'video', outputPerPoint: 1 / 15, memberOnly: false, discount: { personal: null, team: null } },
        { name: 'VinaAnime 1.0', kind: 'video', outputPerPoint: 1 / 9, memberOnly: false, discount: { personal: null, team: null } },
        { name: 'Wan 3.0', kind: 'video', outputPerPoint: 1 / 9, memberOnly: false, discount: { personal: null, team: null } },
        { name: 'Kling V3 Omni', kind: 'video', outputPerPoint: 1 / 11, memberOnly: false, discount: { personal: null, team: null } },
        { name: 'Seedream 5.0 Lite', kind: 'image', outputPerPoint: .25, memberOnly: true, personalLevels: ['标准版', '进阶版', '专业版', '豪华版'], teamLevels: ['标准版', '进阶版', '专业版', '豪华版'], discount: { personal: null, team: null } },
        { name: 'GPT-5.4 Image 2', kind: 'image', outputPerPoint: .03125, memberOnly: false, discount: { personal: null, team: null } },
        { name: 'Gemini 3.1 Flash Image', kind: 'image', outputPerPoint: .1, memberOnly: false, discount: { personal: null, team: null } },
        { name: 'Gemini 3 Pro Image', kind: 'image', outputPerPoint: .0667, memberOnly: false, discount: { personal: null, team: null } }
      ];
      // 2026-10-30 Product Design：个人四档月付／年付／划线价格均独立配置，逐档略低于团队；V 点和模型权益保持一致。
      // 2026-10-30：originalMonthly 独立表示月度划线原价，只用于月度展示；购买确认继续使用 monthly 成交价。
      const personalPlans = [
        { name: '标准版', description: '每月偶尔创作，适合轻量尝鲜', points: 750, monthly: 95, originalMonthly: 105, annual: 1068, originalAnnual: 1140, badge: '' },
        { name: '进阶版', description: '每周稳定更新，适合日常内容生产', points: 1880, monthly: 279, originalMonthly: 299, annual: 3228, originalAnnual: 3348, badge: '' },
        { name: '专业版', description: '每日高频生成，适合项目交付', points: 7200, monthly: 389, originalMonthly: 419, annual: 4548, originalAnnual: 4668, badge: '首选推荐', recommended: true },
        { name: '豪华版', description: '重度生产，适合规模化创作', points: 12500, monthly: 1299, originalMonthly: 1399, annual: 15108, originalAnnual: 15588, badge: '重度创作优选' }
      ];
      // 已发布团队等级权益：由后台「团队会员配置」维护并与套餐等级绑定。
      const publishedTeamBenefitConfig = {
        '标准版': { seats: 15, videoConcurrency: 10, imageConcurrency: '无限', priorityQueue: true },
        '进阶版': { seats: 25, videoConcurrency: 15, imageConcurrency: '无限', priorityQueue: true },
        '专业版': { seats: 35, videoConcurrency: 20, imageConcurrency: '无限', priorityQueue: true },
        '豪华版': { seats: 50, videoConcurrency: 30, imageConcurrency: '无限', priorityQueue: true }
      };
      // 2026-10-30：团队四档同样增加月度划线原价；年度总价与年度划线原价不变。
      const teamPlans = [
        { name: '标准版', description: '小团队统一协作与轻量生产', points: 750, monthly: 99, originalMonthly: 109, annual: 1188, originalAnnual: 1188, badge: '' },
        { name: '进阶版', description: '多项目并行的稳定创作团队', points: 1880, monthly: 289, originalMonthly: 309, annual: 3468, originalAnnual: 3468, badge: '' },
        { name: '专业版', description: '高频交付与跨角色协作', points: 7200, monthly: 399, originalMonthly: 429, annual: 4788, originalAnnual: 4788, badge: '首选推荐', recommended: true },
        { name: '豪华版', description: '规模化内容生产与集中管理', points: 12500, monthly: 1319, originalMonthly: 1419, annual: 15828, originalAnnual: 15828, badge: '重度创作优选' }
      ].map((plan) => ({ ...plan, ...publishedTeamBenefitConfig[plan.name] }));
      const personalBenefits = ['全模型', '会员排队优先', '更低 V 点消耗', '无水印导出', '1080P 高清导出', '商用素材免费使用', '限时 8 折充值权益'];
      const state = {
        audience: 'team', personalCycle: 'yearly', teamCycle: 'yearly', returnFocus: null, modalReturnFocus: null,
        subscriptions: {
          // 2026-11-14：恢复已有个人订阅，保证套餐页与首页的 V 点会员价判断一致。
          personal: window.vinaPersonalMembershipState?.read() || null,
          team: { plan: '进阶版', cycle: 'monthly', remainingMonths: 4 }
        }
      };
      const planRank = (name) => ['标准版', '进阶版', '专业版', '豪华版'].indexOf(name);
      const rateLabel = (model, audience) => {
        const discount = model.discount[audience];
        return discount === null || discount === undefined
          ? '<span class="vm-model-badge is-pending">折扣待发布</span>'
          : `<span class="vm-model-badge">${Number(discount).toFixed(1)} 折</span>`;
      };
      const purchaseRule = (audience, plan, yearly) => {
        const current = state.subscriptions[audience];
        const targetCycle = yearly ? 'yearly' : 'monthly';
        if (!current) return { type: 'first', label: `购买${plan.name}` };
        const currentRank = planRank(current.plan);
        const targetRank = planRank(plan.name);
        if (targetRank < currentRank) return { type: 'blocked', label: '暂不可降级', reason: '当前套餐有效期内不支持降级，请在到期后重新选择。' };
        if (current.cycle === 'yearly' && targetCycle === 'monthly') return { type: 'blocked', label: '年付期内不可改月付', reason: '年度会员有效期内不可购买月付方案，可续费年度方案或升级至更高等级年度方案。' };
        if (targetRank === currentRank && targetCycle === current.cycle) return { type: 'renew', label: `续费${plan.name}` };
        if (targetRank === currentRank && current.cycle === 'monthly' && targetCycle === 'yearly') return { type: 'upgrade-yearly', label: `升级${plan.name}年付` };
        return { type: targetCycle === 'yearly' ? 'upgrade-yearly' : 'upgrade-monthly', label: `升级至${plan.name}` };
      };
      // 2026-10-30 Product Design：个人与团队共用卡片结构，个人整块省略团队权益；四档卡片采用 Figma 原始间距和资源；折算数量继续按套餐 V 点计算，模型右侧标签按最新标注移除。
      const asset = (name) => `./assets/images/membership/${name}?v=20261104-color-system-v2`;
      const checkIcon = () => `<svg class="vm-check-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>`;
      const sectionLabel = (text, short = false) => `<p class="vm-section-label"><span class="vm-section-line"><img src="${asset(short ? 'benefit-line.svg' : 'feature-line.svg')}" alt=""></span><span>${text}</span><span class="vm-section-line"><img src="${asset(short ? 'benefit-line.svg' : 'feature-line.svg')}" alt=""></span></p>`;
      // 2026-11-04 Product Design：仅重构套餐卡片的模型展示区。
      // 参考“免费生成 / 无限使用模型”双面板结构，模型均来自当前 Vina 模型目录，不改价格、V 点、购买及其他权益。
      const freeGenerationModels = [
        { name: 'MiniMax H3 Max', resolution: '1080P' },
        { name: 'MiniMax H3', resolution: '1080P' },
        { name: 'MiniMax H3 Fast', resolution: '1080P' },
        { name: 'Seedance 2.5', resolution: '1080P' },
        { name: 'Seedance 2.0', resolution: '1080P' },
        { name: 'Seedance 2.0 Fast', resolution: '720P' },
        { name: 'Seedance 2.0 Mini', resolution: '720P' },
        { name: 'VinaAnime 1.0', resolution: '720P' },
        { name: 'Wan 3.0', resolution: '1080P' }
      ];
      const modelAccessByPlan = {
        '标准版': {
          freeCount: 5,
          freeNames: ['Seedance 2.0 Fast', 'Seedance 2.0 Mini'],
          unlimitedLabel: '不含无限权限',
          unlimitedModels: [
            { name: 'Seedream 5.0 Lite', resolution: '2K', enabled: false },
            { name: 'GPT-5.4 Image 2', resolution: '2K', enabled: false }
          ]
        },
        '进阶版': {
          freeCount: 5,
          freeNames: ['MiniMax H3', 'MiniMax H3 Fast', 'Seedance 2.0', 'Seedance 2.0 Fast', 'Seedance 2.0 Mini', 'Wan 3.0'],
          unlimitedLabel: '7天无限',
          unlimitedModels: [
            { name: 'Seedance 2.0', resolution: '720P', enabled: true },
            { name: 'GPT-5.4 Image 2', resolution: '2K', enabled: true },
            { name: 'Seedream 5.0 Lite', resolution: '2K', enabled: true }
          ]
        },
        '专业版': {
          freeCount: 10,
          freeNames: freeGenerationModels.map((model) => model.name),
          unlimitedLabel: '7天无限',
          unlimitedModels: [
            { name: 'Seedance 2.5', resolution: '720P', enabled: true },
            { name: 'GPT-5.4 Image 2', resolution: '2K', enabled: true },
            { name: 'Gemini 3.1 Flash Image', resolution: '2K', enabled: true },
            { name: 'Seedream 5.0 Lite', resolution: '2K', enabled: true }
          ]
        },
        '豪华版': {
          freeCount: 30,
          freeNames: freeGenerationModels.map((model) => model.name),
          unlimitedLabel: '无限使用',
          unlimitedModels: [
            { name: 'Gemini 3 Pro Image', resolution: '2K', enabled: true },
            { name: 'GPT-5.4 Image 2', resolution: '2K', enabled: true },
            { name: 'Seedance 2.5', resolution: '1080P', enabled: true },
            { name: 'Wan 3.0', resolution: '1080P', enabled: true }
          ]
        }
      };
      const modelPanelIcon = (type) => type === 'free'
        ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h14v9H3zM2 5h16v3H2zM10 5v12M10 5c-2.4 0-4-.8-4-2 0-.8.7-1.4 1.6-1.4C9 1.6 10 3.3 10 5Zm0 0c2.4 0 4-.8 4-2 0-.8-.7-1.4-1.6-1.4C11 1.6 10 3.3 10 5Z"/></svg>'
        : '<span aria-hidden="true">∞</span>';
      const freeBenefitIcon = () => '<svg class="vm-model-access-badge-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6h11v7.5h-11zM1.5 3.75h13V6h-13zM8 3.75v9.75M8 3.75c-1.8 0-3-.6-3-1.5 0-.6.5-1 1.2-1C7.25 1.25 8 2.5 8 3.75Zm0 0c1.8 0 3-.6 3-1.5 0-.6-.5-1-1.2-1C8.75 1.25 8 2.5 8 3.75Z"/></svg>';
      const modelAccessRow = ({ name, resolution, enabled, benefit, showGift = false, extra = false }) => `<li class="vm-model-access-row${enabled ? ' is-enabled' : ' is-disabled'}"${extra ? ' data-vm-model-extra hidden' : ''}>
        <span class="vm-model-status" aria-hidden="true">${enabled ? '✓' : '×'}</span>
        <span class="vm-model-name">${name}</span>
        <span class="vm-model-resolution">${resolution}</span>
        <span class="vm-model-access-badge">${showGift ? freeBenefitIcon() : ''}<span>${benefit}</span></span>
      </li>`;
      const availableModelRow = ({ name, enabled = true, extra = false }) => `<li class="vm-model-access-row ${enabled ? 'is-enabled' : 'is-disabled'}" aria-label="${name}，${enabled ? '可用' : '不可用'}"${extra ? ' data-vm-model-extra hidden' : ''}>${enabled ? checkIcon() : '<svg class="vm-check-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>'}<span class="vm-model-name">${name}</span></li>`;
      const modelAccessPanel = (type, title, rows) => `<section class="vm-card-section vm-model-access-panel vm-model-access-${type}" aria-label="${title}">
        ${sectionLabel(title, true)}
        <ul class="vm-model-list vm-model-access-list">${rows.map(type === 'free' ? availableModelRow : modelAccessRow).join('')}</ul>
        ${rows.some((row) => row.extra) ? `<button class="vm-model-more" type="button" data-vm-model-more data-vm-collapsed-label="展开 ${rows.length} 个模型" aria-expanded="false"><span>展开 ${rows.length} 个模型</span><i aria-hidden="true"></i></button>` : ''}
      </section>`;
      const modelAccessHTML = (plan) => {
        const access = modelAccessByPlan[plan.name];
        const freeRows = freeGenerationModels
          .map((model) => ({ name: model.name, enabled: access.freeNames.includes(model.name) }))
          .sort((left, right) => Number(right.enabled) - Number(left.enabled))
          .map((model, index) => ({ ...model, enabled: true, extra: index >= 5 }));
        const unlimitedRows = access.unlimitedModels.map((model) => ({
          ...model,
          benefit: model.enabled ? access.unlimitedLabel : '不含无限权限'
        })).sort((left, right) => Number(right.enabled) - Number(left.enabled));
        return `<div class="vm-model-access-wrap">${modelAccessPanel('free', '支持模型', freeRows)}${modelAccessPanel('unlimited', '无限使用模型', unlimitedRows)}</div>`;
      };
      const modelRate = (name) => publishedModelRateConfig.find((model) => model.name === name)?.outputPerPoint || 0;
      const outputEstimate = (plan) => ({
        seconds: Math.floor(plan.points * modelRate('Seedance 2.0')),
        images: Math.floor(plan.points * modelRate('Seedream 5.0 Lite'))
      });
      const yearlySavings = (plan) => Math.max(0, plan.originalMonthly * 12 - plan.annual);
      const comparisonHTML = (plan, audience) => {
        const plans = audience === 'team' ? teamPlans : personalPlans;
        const compareName = plan.name === '豪华版' ? '专业版' : plan.name === '专业版' ? '进阶版' : '';
        if (!compareName) return '';
        const previous = plans.find((item) => item.name === compareName);
        const pointDelta = plan.points - previous.points;
        const metrics = [
          `<span><b>+${format(pointDelta)}</b><em>V点/月</em></span>`,
          ...(audience === 'team' ? [
            `<span><b>+${plan.seats - previous.seats}</b><em>团队席位</em></span>`,
            `<span><b>+${plan.videoConcurrency - previous.videoConcurrency}</b><em>视频并发</em></span>`
          ] : [])
        ].join('');
        return `<div class="vm-upgrade-gain"><div class="vm-gain-heading"><span aria-hidden="true">↗</span><strong>升级收益</strong><small>相比${compareName}</small></div><div class="vm-gain-metrics">${metrics}</div></div>`;
      };
      const cardHTML = (plan, audience) => {
        const displayBadge = { '专业版': '团队推荐', '豪华版': '高频创作首选' }[plan.name] || '';
        const yearly = state[`${audience}Cycle`] === 'yearly';
        const rule = purchaseRule(audience, plan, yearly);
        const current = state.subscriptions[audience];
        const isCurrent = current?.plan === plan.name;
        const price = yearly ? Math.round(plan.annual / 12) : plan.monthly;
        // 2026-10-30 Product Design：年度保留原有年付总价和划线价；月度在现价下方单独展示灰色划线月原价，不再出现年付说明。
        const annualLine = `年付 ¥${format(plan.annual)} /年 <s>¥${format(plan.originalAnnual)}</s>`;
        const priceMeta = yearly ? annualLine : `<s aria-label="月度原价 ¥${format(plan.originalMonthly)}">¥ ${format(plan.originalMonthly)}</s><span>/月</span>`;
        const estimate = outputEstimate(plan);
        const capacityIcons = {
          seats: '<path d="M5 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm-2 8v-2a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2Z"/>',
          concurrency: '<rect x="2" y="3" width="5" height="8" rx="1"/><rect x="9" y="5" width="5" height="8" rx="1"/>',
          points: '<circle cx="8" cy="8" r="6"/><path d="m5.5 5.5 2.5 5 2.5-5"/>'
        };
        const capacityItems = audience === 'team' ? [
          // 2026-11-12：三格使用短标签，悬停时显示完整含义。
          ['团队席位', format(plan.seats), 'seats', '团队席位数'],
          ['视频并发', format(plan.videoConcurrency), 'concurrency', '视频并发数'],
          ['共享 V点', format(plan.points), 'points', '团队共享 V 点']
        ].map(([label, value, icon, fullLabel]) => `<li><div class="vm-capacity-value"><svg viewBox="0 0 16 16" aria-hidden="true">${capacityIcons[icon]}</svg><strong>${value}</strong></div><span title="${fullLabel}">${label}</span></li>`).join('') : '';
        const capacityHTML = audience === 'team'
          ? `<section class="vm-capacity-summary" aria-label="团队能力"><ul class="vm-capacity-grid">${capacityItems}</ul></section>`
          : '';
        const productionHTML = `<section class="vm-production-panel" aria-label="预计产能">
          <div class="vm-production-heading"><strong>每月 ${format(plan.points)} V点预计产能</strong><span class="vm-production-help" tabindex="0" aria-label="按后台当前模型费率计算">!<span class="vm-production-tooltip" role="tooltip">按后台当前模型费率计算</span></span></div>
          <div class="vm-production-values"><p><strong>≈ ${format(estimate.seconds)} 秒</strong><span>Seedance 2.0</span></p><p><strong>≈ ${format(estimate.images)} 张</strong><span>Seedream 5.0 Lite</span></p></div>
        </section>`;
        const benefits = personalBenefits.map((benefit) => `<li>${checkIcon()}<span>${benefit}</span></li>`).join('');
        // 2026-10-30 Product Design 标注调整：四档套餐的团队席位和视频模型并发数只展示数值，移除数字后的“个”；共用模板保证月度／年度切换后也不显示该单位。
        const teamBenefits = audience === 'team' ? [
          `<span>团队席位：</span><b>${plan.seats}</b>`,
          `<span>视频模型并发数：</span><b>${plan.videoConcurrency}</b>`,
          `<span>图片模型并发数：</span><span>${plan.imageConcurrency}</span>`,
          `<span>${plan.priorityQueue ? '生成优先队列' : '标准生成队列'}</span>`
        ].map((content) => `<li>${checkIcon()}<span class="vm-team-benefit-copy">${content}</span></li>`).join('') : '';
        return `<div class="vm-plan-wrap ${displayBadge ? 'has-ribbon' : ''}" data-vm-plan-name="${plan.name}">
          ${displayBadge ? `<div class="vm-ribbon">${displayBadge}</div>` : ''}
          <article class="vm-plan">
            <div class="vm-plan-heading">
              <h2>${plan.name}</h2>
              ${isCurrent ? `<span class="vm-current-tag">当前${current.cycle === 'yearly' ? '年付' : '月付'}</span>` : ''}
              <p class="vm-plan-subtitle" title="${plan.description}">${plan.description}</p>
            </div>
            <div class="vm-price"><strong>¥ ${price}</strong><span><em>元</em>/月</span></div>
            <p class="vm-price-meta${yearly ? '' : ' is-monthly'}">${priceMeta}</p>
            ${capacityHTML}
            ${productionHTML}
            
            <button class="vm-plan-action" type="button" data-vm-checkout="${audience}" data-vm-plan="${plan.name}" ${rule.type === 'blocked' ? 'disabled aria-disabled="true"' : ''}>${rule.label}</button>
            <div class="vm-plan-features">
              ${modelAccessHTML(plan)}
              ${audience === 'team' ? `<section class="vm-card-section" aria-label="团队权益">${sectionLabel('团队权益', true)}<ul class="vm-team-benefit-list">${teamBenefits}</ul></section>` : ''}
              <section class="vm-card-section" aria-label="核心权益">${sectionLabel('核心权益', true)}<ul class="vm-benefit-list">${benefits}</ul></section>
            </div>
          </article>
        </div>`;
      };
      // 2026-10-30：说明区域沿用相同视觉；个人模式替换团队专用文案，不展示团队席位与审片权限。
      const teamFaqMarkup = page.querySelector('.vm-faq').innerHTML;
      const faqItem = (question, answer, open = false) => `<details${open ? ' open' : ''}><summary>${question}<img class="vm-chevron-up" src="${asset('chevron-up.svg')}" alt=""><img class="vm-chevron-down" src="${asset('chevron-down.svg')}" alt=""></summary><p>${answer}</p></details>`;
      const personalFaqMarkup = `<h2 id="vmTeamFaqTitle">个人使用说明</h2><p>个人套餐适合独立创作与日常内容生产。</p><div class="vm-faq-list">
        ${faqItem('个人套餐如何续费或升级？', '同档续费仅延长有效期；月付可升级至更高档月付或年付，年付仅可升级至更高档年付。当前周期已发放的会员 V 点不回收，未发放部分按升级规则处理。', true)}
        ${faqItem('个人会员权益归属哪个账户？', '个人会员套餐、V 点、项目和资产均归属当前个人账户，与团队账户独立管理。')}
        ${faqItem('会员 V 点什么时候发放？', '月付套餐开通后发放当月 V 点；年付套餐按月发放对应权益。具体到账状态以账户中的 V 点记录为准。')}
        ${faqItem('免费生成和无限使用模型会变化吗？', '适用模型、分辨率、次数和有效周期由后台会员配置统一发布，套餐页会同步展示当前生效的权益。')}
        ${faqItem('套餐到期后项目和资产会被删除吗？', '套餐到期不会删除已创建的项目和资产，但会员专属生成权益、折扣和排队优先级会按账户当前状态调整。')}
        ${faqItem('个人套餐可以转到团队账户吗？', '个人与团队会员独立购买和结算，现有个人套餐不会自动转移到团队账户。需要团队协作时可单独选择团队套餐。')}
      </div>`;
      const renderPlans = () => {
        const audience = state.audience;
        const team = audience === 'team';
        const label = team ? '团队' : '个人';
        const plans = team ? teamPlans : personalPlans;
        const grid = document.getElementById('vmTeamGrid');
        grid.classList.remove('is-models-expanded');
        grid.setAttribute('aria-label', `${label}会员套餐`);
        grid.innerHTML = plans.map((plan) => cardHTML(plan, audience)).join('');
        const note = document.getElementById('vmTeamMembershipNote');
        const current = state.subscriptions[audience];
        // 当前方案、记录入口和续费提示只读取所选类型，个人免费状态不继承团队的进阶版订阅。
        const membershipCopy = current
          ? `当前${label}方案：<strong>${current.plan}</strong>（${current.cycle === 'yearly' ? '年付' : '月付'}） · ${current.validUntil ? `有效期至 ${current.validUntil}` : `剩余 ${current.remainingMonths} 个月`}`
          : `当前${label}方案：<strong>免费版</strong>`;
        note.innerHTML = `<div class="vm-account-current"><span>${membershipCopy}</span><span class="vm-note-divider" aria-hidden="true"></span><button type="button" data-vm-membership-record>会员记录<img src="${asset('record-arrow.svg')}" alt=""></button></div>`;
      };
      const setCycle = (audience, cycle) => {
        if (!['personal', 'team'].includes(audience) || !['monthly', 'yearly'].includes(cycle)) return;
        // 2026-10-30：两个类型均支持月度／年度并各自保留周期；切换时同步现价、原价样式和购买按钮，成交金额继续读取对应周期配置。
        state[`${audience}Cycle`] = cycle;
        page.querySelectorAll(`[data-vm-cycle="${audience}"]`).forEach((button) => {
          const active = button.dataset.vmValue === cycle;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', String(active));
        });
        renderPlans();
      };
      const setAudience = (audience = 'team') => {
        const next = audience === 'personal' ? 'personal' : 'team';
        state.audience = next;
        page.dataset.vmAudience = next;
        const label = next === 'team' ? '团队' : '个人';
        page.setAttribute('aria-label', `${label}会员方案`);
        // 2026-10-30：选中状态、键盘焦点顺序、内容面板、周期和 V 点入口统一跟随会员类型。
        page.querySelectorAll('.vm-tabs [data-vm-audience]').forEach((button) => {
          const active = button.dataset.vmAudience === next;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', String(active));
          button.tabIndex = active ? 0 : -1;
        });
        const panel = document.getElementById('vmMembershipPanel');
        panel.dataset.vmPanel = next;
        panel.hidden = false;
        panel.setAttribute('aria-labelledby', next === 'team' ? 'vmTeamTab' : 'vmPersonalTab');
        page.querySelector('.vm-cycle').setAttribute('aria-label', `选择${label}套餐周期`);
        page.querySelectorAll('[data-vm-cycle]').forEach((button) => { button.dataset.vmCycle = next; });
        page.querySelectorAll('[data-vm-vpoint]').forEach((button) => {
          button.dataset.vmVpoint = next;
          button.setAttribute('aria-label', `打开${label} V 点超市`);
          button.innerHTML = `V 点超市<img src="${asset('purchase-arrow.svg')}" alt="">`;
        });
        page.querySelector('.vm-faq').innerHTML = next === 'team' ? teamFaqMarkup : personalFaqMarkup;
        setCycle(next, state[`${next}Cycle`]);
      };
      const closeModal = () => {
        // 2026-11-14：关闭或替换积分弹窗即取消旧的购买反馈定时器，防止快速重开后误关新弹窗。
        window.vinaVPointStore?.cleanup(modal);
        modal.hidden = true;
        state.modalReturnFocus?.focus?.({ preventScroll: true });
      };
      const openModal = ({ title, subtitle, body, trigger }) => {
        // 2026-11-14：打开其他子弹窗前撤销上一轮积分选中事件及延时关闭。
        window.vinaVPointStore?.cleanup(modal);
        state.modalReturnFocus = trigger || document.activeElement;
        modalTitle.textContent = title;
        modalSubtitle.textContent = subtitle;
        modalBody.innerHTML = body;
        modal.hidden = false;
        modal.querySelector('[data-vm-modal-close]')?.focus();
      };
      const openModelNote = (type, planName, trigger) => {
        const access = modelAccessByPlan[planName];
        const content = type === 'estimate'
          ? `<div class="vm-modal-option"><div><strong>产能换算口径</strong><span>Seedance 2.0 按当前基础消耗约 15 V点/秒；Seedream 5.0 Lite 按当前基础消耗约 4 V点/张。</span></div></div><div class="vm-modal-callout">该数值用于帮助比较套餐量级，不是生成承诺。分辨率、时长、模式及后续模型配置变化都会影响实际消耗，最终以生成页实时参数为准。</div>`
          : type === 'free'
            ? `<div class="vm-modal-option"><div><strong>${planName} · 免费生成</strong><span>当前页面展示单个模型可用的免费生成次数；没有权益的模型统一排在列表下方。</span></div></div><div class="vm-modal-callout">刷新周期、排队规则、适用任务和最终可用分辨率均以后台正式发布配置为准。</div>`
            : `<div class="vm-modal-option"><div><strong>${planName} · ${access?.unlimitedLabel || '无限使用模型'}</strong><span>适用模型与分辨率以当前套餐行内标签为准。</span></div></div><div class="vm-modal-callout">“7天无限”的起算方式、速度或排队限制，以及商业使用边界需以后台正式发布配置为准。</div>`;
        openModal({
          title: type === 'estimate' ? '产能估算说明' : type === 'free' ? '免费生成规则' : '无限使用规则',
          subtitle: '把比较口径说明清楚，避免用户误解权益边界。',
          trigger,
          body: `${content}<div class="vm-modal-actions"><button type="button" class="vm-primary" data-vm-modal-close>知道了</button></div>`
        });
      };
      const finderPlanByFrequency = { occasional: '标准版', regular: '进阶版', daily: '专业版', scale: '豪华版' };
      const openPlanFinder = (trigger) => {
        const initialAudience = state.audience;
        openModal({
          title: '帮你快速选套餐',
          subtitle: '回答两个问题，先缩小范围，再查看完整权益。',
          trigger,
          body: `<div class="vm-finder">
            <fieldset><legend>1. 谁来使用？</legend><div class="vm-finder-options"><button type="button" data-vm-finder-audience="personal">个人创作</button><button type="button" data-vm-finder-audience="team">团队协作</button></div></fieldset>
            <fieldset><legend>2. 创作频率？</legend><div class="vm-finder-options is-frequency"><button type="button" data-vm-finder-frequency="occasional">偶尔尝鲜</button><button type="button" data-vm-finder-frequency="regular">每周更新</button><button type="button" data-vm-finder-frequency="daily">每日高频</button><button type="button" data-vm-finder-frequency="scale">规模化生产</button></div></fieldset>
            <div class="vm-finder-result" data-vm-finder-result></div>
          </div>`
        });
        let selectedAudience = initialAudience;
        let selectedFrequency = 'daily';
        const syncFinder = () => {
          modal.querySelectorAll('[data-vm-finder-audience]').forEach((button) => button.classList.toggle('is-selected', button.dataset.vmFinderAudience === selectedAudience));
          modal.querySelectorAll('[data-vm-finder-frequency]').forEach((button) => button.classList.toggle('is-selected', button.dataset.vmFinderFrequency === selectedFrequency));
          const planName = finderPlanByFrequency[selectedFrequency];
          const plans = selectedAudience === 'team' ? teamPlans : personalPlans;
          const plan = plans.find((item) => item.name === planName);
          const estimate = outputEstimate(plan);
          modal.querySelector('[data-vm-finder-result]').innerHTML = `<span>建议先看</span><strong>${selectedAudience === 'team' ? '团队' : '个人'}${planName}</strong><p>${plan.description}；每月 ${format(plan.points)} V点，约可生成 ${format(estimate.seconds)} 秒 Seedance 2.0。</p><button type="button" class="vm-primary" data-vm-finder-view data-vm-finder-target="${selectedAudience}" data-vm-finder-plan="${planName}">查看这个套餐</button>`;
        };
        modal.querySelectorAll('[data-vm-finder-audience]').forEach((button) => button.addEventListener('click', () => { selectedAudience = button.dataset.vmFinderAudience; syncFinder(); }));
        modal.querySelectorAll('[data-vm-finder-frequency]').forEach((button) => button.addEventListener('click', () => { selectedFrequency = button.dataset.vmFinderFrequency; syncFinder(); }));
        modal.querySelector('.vm-finder')?.addEventListener('click', (event) => {
          const view = event.target.closest('[data-vm-finder-view]');
          if (!view) return;
          const targetAudience = view.dataset.vmFinderTarget;
          const targetPlan = view.dataset.vmFinderPlan;
          closeModal();
          setAudience(targetAudience);
          window.setTimeout(() => {
            const card = page.querySelector(`[data-vm-plan-name="${targetPlan}"]`);
            card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card?.classList.add('is-guided');
            window.setTimeout(() => card?.classList.remove('is-guided'), 2200);
          }, 80);
        });
        syncFinder();
      };
      const openCheckout = (audience, name, trigger) => {
        const plans = audience === 'team' ? teamPlans : personalPlans;
        const plan = plans.find((item) => item.name === name) || plans[0];
        const yearly = state[`${audience}Cycle`] === 'yearly';
        const price = yearly ? plan.annual : plan.monthly;
        const account = audience === 'team' ? '团队账户' : '个人账户';
        const current = state.subscriptions[audience];
        const rule = purchaseRule(audience, plan, yearly);
        if (rule.type === 'blocked') {
          openModal({ title: '暂不支持该方案', subtitle: '请保持当前套餐或选择可用升级方案。', trigger, body: `<div class="vm-modal-callout">${rule.reason}</div><div class="vm-modal-actions"><button type="button" class="vm-primary" data-vm-modal-close>返回选择方案</button></div>` });
          return;
        }
        const teamDetail = audience === 'team' ? `固定包含 ${plan.seats} 个团队席位，团队 V 点独立结算。` : '个人资产、项目、套餐和 V 点不会写入任何团队账户。';
        let title = `确认购买${audience === 'team' ? '团队' : '个人'}${name}`;
        let summary = `<div class="vm-modal-option"><div><strong>${name} · ${yearly ? '年付' : '月付'}</strong><span>权益将写入${account}</span></div><b>¥ ${format(price)} ${yearly ? '/ 年' : '/ 月'}</b></div>`;
        let special = teamDetail;
        if (rule.type === 'renew') {
          title = `确认续费${name}`;
          special = `${yearly ? '年度有效期延长 12 个月' : '有效期延长 1 个月'}；本次为一次性续费，不自动续费。已发放 V 点按原有效期使用。`;
        } else if (rule.type === 'upgrade-monthly') {
          title = `确认升级${audience === 'team' ? '团队' : '个人'}会员`;
          special = `当前 ${current.plan} 月付本月金额不抵扣、已发放 V 点不回收；支付后 ${plan.name} 月付立即生效，并按新套餐发放当月 V 点。`;
        } else if (rule.type === 'upgrade-yearly') {
          title = `确认升级为${plan.name}年付`;
          const discount = current?.cycle === 'yearly' ? Math.round(plan.annual * current.remainingMonths / 12) : 0;
          const actual = Math.max(0, price - discount);
          summary = `<div class="vm-modal-option"><div><strong>${plan.name} · 年付</strong><span>${current?.cycle === 'yearly' ? `剩余 ${current.remainingMonths} 个月未发放权益按目标年付折算优惠` : '年度会员立即生效，首月 V 点即时发放'}</span></div><b>¥ ${format(actual)} / 年</b></div>`;
          special = current?.cycle === 'yearly'
            ? `原年度套餐即时结束；已发放 V 点不回收，剩余未发放 ${current.remainingMonths} 个月 V 点停止发放。订单优惠 ¥${format(discount)}，以目标年付套餐为上限计算。`
            : `当前月付本月金额不抵扣、已发放 V 点不回收；目标年付立即生效，后续会员 V 点按月发放。`;
        }
        openModal({
          title,
          subtitle: '请确认套餐、计费周期与权益归属。',
          trigger,
          body: `${summary}<div class="vm-modal-callout">${special}</div><div class="vm-modal-actions"><button type="button" data-vm-modal-close>继续比较</button><button type="button" class="vm-primary" data-vm-confirm>确认并前往支付</button></div>`
        });
        modal.querySelector('[data-vm-confirm]')?.addEventListener('click', (event) => {
          state.subscriptions[audience] = { plan: plan.name, cycle: yearly ? 'yearly' : 'monthly', remainingMonths: yearly ? 12 : 1 };
          // 2026-10-30：沿用既有确认开通时机，仅同步个人资格到当前会话，不写入团队订阅。
          if (audience === 'personal') window.vinaPersonalMembershipState?.save(state.subscriptions.personal);
          renderPlans();
          event.currentTarget.textContent = '已确认';
          event.currentTarget.disabled = true;
          window.setTimeout(() => { closeModal(); setOpen(false); }, 560);
        });
      };
      // 2026-11-14 Product Design：直接复用 Figma 六档 V 点超市与支付结果，关闭后保留当前会员套餐页。
      const openStore = (audience, trigger) => window.openVinaVPointStore(audience, trigger);
      const openEnterprise = (type, trigger) => {
        const hasContact = publishedEnterpriseConfig.published && publishedEnterpriseConfig.contactLabel && publishedEnterpriseConfig.qrImage;
        if (type === 'consult') {
          openModal({
            title: '联系企业顾问',
            subtitle: '企业咨询信息由后台统一配置与发布。',
            trigger,
          body: hasContact
            ? `<figure class="vm-consult-qr"><img src="${publishedEnterpriseConfig.qrImage}" alt="${publishedEnterpriseConfig.contactLabel}二维码"><figcaption><strong>添加${publishedEnterpriseConfig.contactLabel}</strong><span>${publishedEnterpriseConfig.consultationCopy}</span></figcaption></figure><div class="vm-modal-actions"><button type="button" class="vm-primary" data-vm-modal-close>知道了</button></div>`
            : '<div class="vm-modal-callout">客服微信、二维码、咨询话术和可咨询时间待后台配置。配置发布前，前台不会展示或虚构联系信息。</div><div class="vm-modal-actions"><button type="button" class="vm-primary" data-vm-modal-close>知道了</button></div>'
          });
          return;
        }
        openModal({
          title: '企业版配置范围',
          subtitle: '企业版按合同配置，不在前台展示固定价或直接下单入口。',
          trigger,
          body: '<div class="vm-modal-option"><div><strong>规模与席位</strong><span>51 席起；具体席位由企业合同确认。</span></div></div><div class="vm-modal-option"><div><strong>生产与权限</strong><span>团队 V 点、可用模型、角色权限、审片范围和并发能力可按需配置。</span></div></div><div class="vm-modal-option"><div><strong>服务与素材</strong><span>价格、服务边界和客服素材均由后台发布后展示。</span></div></div><div class="vm-modal-actions"><button type="button" class="vm-primary" data-vm-modal-close>返回套餐</button></div>'
        });
      };
      // 2026-10-30 Product Design：嵌入全屏弹窗时只通知宿主关闭，不操作宿主地址或浏览历史；直接打开会员文件仍保留原有返回行为。
      const embeddedMembership = window.parent !== window && new URLSearchParams(window.location.search).get('embedded') === 'membership-modal';
      // 2026-11-12：UI 1112 会员页接收 VinaAgent 画布和短剧入口的会员提示。
      // 2026-11-07 Product Design：会员专属模型的提示属于目标会员页，而非被全屏 dialog 遮住的宿主 body。
      // 复用公共 Toast 样式和 warning 原始图标；局部提示层放在会员 iframe 内，不注册为宿主 .toast 消息源。
      let membershipNoticeTimer = 0;
      const clearMembershipNotice = () => {
        window.clearTimeout(membershipNoticeTimer);
        document.getElementById('vinaToastLayer')?.replaceChildren();
      };
      const showMembershipNotice = (notice) => {
        clearMembershipNotice();
        if (notice !== 'model-membership-required') return;
        let layer = document.getElementById('vinaToastLayer');
        if (!layer) {
          layer = document.createElement('div');
          layer.id = 'vinaToastLayer';
          layer.className = 'vina-toast-layer';
          document.body.appendChild(layer);
        }
        const toast = document.createElement('div');
        toast.className = 'vina-figma-toast';
        toast.dataset.vinaToastType = 'warning';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-atomic', 'true');
        toast.innerHTML = '<span class="vina-figma-toast-icon" aria-hidden="true"><img src="./assets/icons/toast/warning.svg" alt=""></span><span class="vina-figma-toast-message">该模型为会员专享，请先订阅会员</span>';
        layer.appendChild(toast);
        // 会员专享提示从实际展示起 3 秒后自动关闭；重复打开重置计时，普通会员入口不遗留上次提示。
        membershipNoticeTimer = window.setTimeout(clearMembershipNotice, 3000);
      };
      window.addEventListener('pagehide', clearMembershipNotice);

      const notifyMembershipHost = (type) => {
        if (embeddedMembership) window.parent.postMessage({ channel: 'vina-membership-overlay', type, subscription: window.vinaPersonalMembershipState?.read() || null }, '*');
      };
      const setOpen = (open, trigger) => {
        if (!open) {
          // 2026-11-14：关闭整个会员页同样撤销尚未完成的积分超市延时关闭。
          window.vinaVPointStore?.cleanup(modal);
          clearMembershipNotice();
          if (embeddedMembership) { notifyMembershipHost('close'); return; }
          if (window.history.length > 1) window.history.back();
          else window.location.href = './index.html';
          return;
        }
        page.hidden = false;
        document.body.classList.add('membership-page-open');
        if (open) {
          state.returnFocus = trigger || document.activeElement;
          setAudience(trigger?.dataset.membershipTarget || state.audience);
          document.getElementById('profilePopover')?.setAttribute('hidden', '');
          // 打开时将焦点放在会员页容器上，避免关闭按钮提前出现焦点外圈；按 Tab 仍可聚焦关闭按钮。
          window.setTimeout(() => page.focus({ preventScroll: true }), 0);
        } else {
          state.returnFocus?.focus?.({ preventScroll: true });
        }
      };
      // 供全局 V 点入口读取：非会员先进入对应会员套餐，购买成功后即时读取新的会员资格。
      window.vinaMembershipEligibility = (audience) => {
        const subscription = state.subscriptions[audience];
        return { active: Boolean(subscription), level: subscription?.plan || null };
      };
      // V 点加购弹窗复用同一会员状态：开通成功后立刻回填资格，无需刷新页面。
      window.activateVinaMembership = (audience, plan, cycle = 'yearly') => {
        state.subscriptions[audience] = { plan, cycle, remainingMonths: cycle === 'yearly' ? 12 : 1 };
        // 2026-10-30：通过已有全局开通入口激活个人会员时，同步账号菜单的横幅显隐状态。
        if (audience === 'personal') window.vinaPersonalMembershipState?.save(state.subscriptions.personal);
        renderPlans();
        window.onVinaMembershipActivated?.(audience);
      };
      window.openVinaMembershipPage = (audience, trigger, options = {}) => {
        // 2026-11-14：重新打开会员页不保留上次超市或其延迟回调，辅助标题与可见内容保持一致。
        window.vinaVPointStore?.cleanup(modal);
        modal.hidden = true;
        setAudience(audience);
        if (trigger?.dataset) trigger.dataset.membershipTarget = audience;
        setOpen(true, trigger);
        showMembershipNotice(options.notice);
      };
      // 2026-10-30：只接收实际父窗口的弹窗指令，兼容本地 file 地址；个人会员开通后同步宿主账号菜单，无需刷新页面。
      if (embeddedMembership) {
        window.addEventListener('message', (event) => {
          if (event.source !== window.parent || event.data?.channel !== 'vina-membership-overlay') return;
          // 2026-11-12：语言消息独立于打开动作，切换时保留当前套餐页签和弹窗。
          const { type, language } = event.data;
          if ((type === 'language' || type === 'open') && language) window.vinaMembershipI18n?.setLanguage(language);
          if (type !== 'open') return;
          const audience = event.data.audience === 'personal' ? 'personal' : 'team';
          window.openVinaMembershipPage(audience, null, { notice: event.data.notice });
        });
        window.addEventListener('vina:personal-membership-change', () => notifyMembershipHost('subscription'));
      }
      document.querySelectorAll('[data-membership-open]').forEach((trigger) => {
        trigger.addEventListener('click', () => setOpen(true, trigger));
        if (!trigger.matches('button')) trigger.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true, trigger); }
        });
      });
      close.addEventListener('click', () => setOpen(false));
      page.addEventListener('click', (event) => {
        // 2026-10-30：会员类型按钮支持直接点击；记录和购买均读取当前个人／团队类型。
        const audienceTab = event.target.closest('.vm-tabs [data-vm-audience]');
        if (audienceTab) setAudience(audienceTab.dataset.vmAudience);
        if (event.target.closest('[data-vm-scroll-plans]')) document.getElementById('vmPlansTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
        const record = event.target.closest('[data-vm-membership-record]');
        if (record) {
          // 2026-10-30 Product Design：会员记录统一打开账单全屏弹窗的会员订单页签；关闭后留在当前套餐与滚动位置。
          window.openVinaBillingRecords?.('membership', record);
        }
        const cycle = event.target.closest('[data-vm-cycle]');
        if (cycle) setCycle(cycle.dataset.vmCycle, cycle.dataset.vmValue);
        const checkout = event.target.closest('[data-vm-checkout]');
        if (checkout) openCheckout(checkout.dataset.vmCheckout, checkout.dataset.vmPlan, checkout);
        const finder = event.target.closest('[data-vm-plan-finder]');
        if (finder) openPlanFinder(finder);
        const modelMore = event.target.closest('[data-vm-model-more]');
        if (modelMore) {
          const expanded = modelMore.getAttribute('aria-expanded') === 'true';
          page.querySelectorAll('.vm-model-access-free [data-vm-model-extra]').forEach((row) => { row.hidden = expanded; });
          page.querySelectorAll('[data-vm-model-more]').forEach((button) => {
            button.setAttribute('aria-expanded', String(!expanded));
            button.querySelector('span').textContent = expanded ? button.dataset.vmCollapsedLabel : '收起模型';
          });
          document.getElementById('vmTeamGrid')?.classList.toggle('is-models-expanded', !expanded);
        }
        const vPointPurchase = event.target.closest('[data-vm-vpoint]');
        if (vPointPurchase) {
          // 2026-10-23 移植逻辑：独立套餐页复用上传 HTML 内置的积分超市弹窗，避免依赖原完整应用的全局方法而点击无响应；关闭弹窗继续查看套餐。
          openStore(vPointPurchase.dataset.vmVpoint, vPointPurchase);
        }
        const store = event.target.closest('[data-vm-store]');
        if (store) openStore(store.dataset.vmStore, store);
        const enterprise = event.target.closest('[data-vm-enterprise]');
        if (enterprise) openEnterprise(enterprise.dataset.vmEnterprise, enterprise);
        if (event.target === modal || event.target.closest('[data-vm-modal-close]')) closeModal();
      });
      page.addEventListener('keydown', (event) => {
        // 2026-10-30：原生按钮提供 Enter／空格激活，Tab 列表额外支持左右方向键及 Home／End。
        const audienceTab = event.target.closest('.vm-tabs [data-vm-audience]');
        if (audienceTab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const tabs = Array.from(page.querySelectorAll('.vm-tabs [data-vm-audience]'));
          const index = tabs.indexOf(audienceTab);
          const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          setAudience(tabs[nextIndex].dataset.vmAudience);
          tabs[nextIndex].focus({ preventScroll: true });
        }
        if (event.key === 'Escape') { if (!modal.hidden) closeModal(); else setOpen(false); }
      });
      // 企业咨询弹窗仍只读取后台已发布的咨询信息；页面本体不展示未发布的占位内容。
      renderPlans();
      setCycle('team', 'yearly');
      const countdown = page.querySelector('.vm-countdown');
      if (countdown) {
        const deadline = Date.parse(countdown.dataset.vmDeadline || '');
        const units = { days: 86400000, hours: 3600000, minutes: 60000, seconds: 1000 };
        const values = {};
        const digitViews = {};
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const foldDuration = 300;
        const foldEasing = 'cubic-bezier(.42, 0, .78, .62)';
        // The revealed top follows the folding edge, so old and new glyphs never overlap.
        const revealFrames = Array.from({ length: 25 }, (_, index) => {
          const progress = index / 24;
          return { offset: progress, clipPath: `inset(0 0 ${Math.cos(progress * Math.PI / 2) * 100}% 0)` };
        });
        const createDigit = (wrapper, value) => {
          const stack = document.createElement('span');
          stack.className = 'vm-digit-stack';
          stack.setAttribute('aria-hidden', 'true');
          const layers = {};
          ['current', 'previous'].forEach((phase) => {
            ['top', 'bottom'].forEach((half) => {
              const layer = document.createElement('span');
              layer.className = `vm-digit-half vm-digit-${phase} vm-digit-${half}`;
              const number = document.createElement('strong');
              number.textContent = value;
              layer.appendChild(number);
              stack.appendChild(layer);
              layers[`${phase}-${half}`] = layer;
            });
          });
          wrapper.appendChild(stack);
          return { stack, layers, animations: [] };
        };
        const paintDigit = (digit, previous, value, animate) => {
          digit.animations.forEach((animation) => animation.cancel());
          digit.animations = [];
          digit.stack.classList.remove('is-flipping');
          ['top', 'bottom'].forEach((half) => {
            digit.layers[`current-${half}`].firstElementChild.textContent = value;
            digit.layers[`previous-${half}`].firstElementChild.textContent = previous;
          });
          if (!animate || previous === value) return;
          digit.stack.classList.add('is-flipping');
          const { layers } = digit;
          const animations = [
            layers['previous-top'].animate([
              { transform: 'rotateX(0deg)', opacity: 1 },
              { transform: 'rotateX(-90deg)', opacity: 1 }
            ], { duration: foldDuration, easing: foldEasing, fill: 'both' }),
            layers['current-top'].animate(revealFrames, { duration: foldDuration, easing: foldEasing, fill: 'both' }),
            layers['previous-bottom'].animate([{ opacity: 1 }, { opacity: 0 }], { delay: 170, duration: 140, easing: 'ease-in-out', fill: 'both' }),
            layers['current-bottom'].animate([{ opacity: 0 }, { opacity: 1 }], { delay: 170, duration: 140, easing: 'ease-in-out', fill: 'both' })
          ];
          // Start all four layers on the same frame, without forced layout or class restarts.
          const start = document.timeline.currentTime;
          animations.forEach((animation) => { animation.startTime = start; });
          digit.animations = animations;
          Promise.all(animations.map((animation) => animation.finished)).then(() => {
            if (digit.animations !== animations) return;
            animations.forEach((animation) => animation.cancel());
            digit.animations = [];
            digit.stack.classList.remove('is-flipping');
          }).catch(() => {});
        };
        Object.keys(units).forEach((unit) => {
          const target = countdown.querySelector(`[data-vm-countdown="${unit}"]`);
          const wrapper = target?.closest('.vm-flip-card');
          if (!target || !wrapper) return;
          target.classList.add('vm-digit-value');
          digitViews[unit] = { target, wrapper, digits: [] };
        });
        const updateCountdown = () => {
          const remaining = Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : 0;
          const next = {};
          Object.entries(units).forEach(([unit, duration]) => {
            next[unit] = unit === 'days' ? Math.floor(remaining / duration) : Math.floor((remaining % (duration * (unit === 'hours' ? 24 : 60))) / duration);
          });
          Object.entries(next).forEach(([unit, value]) => {
            const view = digitViews[unit];
            if (!view || values[unit] === value) return;
            const previousValue = values[unit];
            const display = String(value).padStart(2, '0');
            const previous = previousValue === undefined ? display : String(previousValue).padStart(2, '0');
            const animate = previousValue !== undefined && !reducedMotion.matches && !document.hidden;
            view.target.textContent = display;
            if (view.digits.length !== display.length) {
              view.digits.forEach((digit) => {
                digit.animations.forEach((animation) => animation.cancel());
                digit.stack.remove();
              });
              view.digits = [...display].map((character) => createDigit(view.wrapper, character));
            }
            view.digits.forEach((digit, index) => paintDigit(digit, previous[index] || display[index], display[index], animate));
            values[unit] = value;
          });
          countdown.setAttribute('aria-label', `活动倒计时：${next.days} 天 ${String(next.hours).padStart(2, '0')} 时 ${String(next.minutes).padStart(2, '0')} 分 ${String(next.seconds).padStart(2, '0')} 秒`);
        };
        updateCountdown();
        window.setInterval(updateCountdown, 1000);
      }
      // 2026-10-30 Product Design：默认仍展示团队年度方案；允许切换个人会员，两个类型的价格、订阅、周期与 V 点入口分别处理。
      setOpen(true);
      // 2026-11-07：兼容独立导航入口；只有明确的模型权限标记才切到个人套餐并提示，消费后移除标记，刷新不重复。
      const destinationParams = new URLSearchParams(window.location.search);
      if (!embeddedMembership && destinationParams.get('notice') === 'model-membership-required') {
        window.openVinaMembershipPage('personal', null, { notice: 'model-membership-required' });
        const destination = new URL(window.location.href);
        destination.searchParams.delete('notice');
        window.history.replaceState(window.history.state, '', destination.href);
      }
      // 宿主在内容初始化后下发入口类型，避免首次加载时丢失打开指令。
      notifyMembershipHost('ready');
    })();
