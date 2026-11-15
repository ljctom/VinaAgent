// 2026-11-14 Product Design：直接读取 Figma 原文件实现，非会员 6815:30277、会员 6815:30377、支付结果 6815:27487。
// 首页和会员套餐页共用原生 dialog；六档金额以整数分计算，非会员按普通价结算、会员自动应用 8 折。
// 购买对接已有支付适配器或支付结果事件；仅成功回执展示成功层，不将按钮点击视为扣款成功，不写入虚构积分和订单。
(() => {
  const packs = [390, 1000, 2000, 5000, 7500, 10000].map(points => ({ points, regularCents: points * 10, memberCents: points * 8 }));
  const assets = './assets/images/vpoint-store/';
  const number = value => Number(value).toLocaleString('en-US');
  const money = cents => '¥' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const language = () => window.vinaPageLanguage?.get() || document.documentElement.lang || 'zh-CN';
  const arabic = {
    '当前总余额': 'إجمالي الرصيد', '充值V点余额': 'رصيد النقاط المشحونة', 'V点': 'نقاط V',
    '会员8折已生效': 'خصم العضوية 20٪ مفعّل', '以下均为你的会员专享价格': 'أسعار خاصة للأعضاء لجميع الباقات أدناه',
    '开通后，本页全部套餐均享会员价': 'اشترك للاستفادة من سعر العضوية لجميع الباقات', '已自动应用会员价': 'تم تطبيق سعر العضوية',
    '已省 ¥{n}': 'وفّرت ¥{n}', '支付结果': 'نتيجة الدفع', '查看订单': 'عرض الطلب',
    '{n} V点 · 实付 {amount}': '{n} نقاط V · المبلغ المدفوع {amount}',
    '到账：充值V点 {n} · 有效期 2 年': 'أضيفت {n} نقاط V · صالحة لعامين',
    '请扫码完成支付': 'امسح الرمز للدفع', '支付二维码': 'رمز QR للدفع',
    '订单金额已变化，请重新获取': 'تغيّر مبلغ الطلب، يرجى المحاولة مجددًا', '关闭弹窗': 'إغلاق النافذة'
  };
  const t = (source, values = {}) => {
    const locale = language();
    const index = ['en', 'ja', 'fr', 'ms'].indexOf(locale);
    const translated = locale === 'ar' ? (arabic[source] || window.VinaArabicCopy?.texts?.[source]) : index < 0 ? source : window.vinaMembershipCopy?.find(row => row[0] === source)?.[index + 1];
    return (translated || source).replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
  };
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let dialog = null, layer = null, current = null, scroll = null, returnFocus = null, serial = 0;
  const lastSelection = { personal: 0, team: 0 };
  const accountDocument = () => { try { return window.parent !== window ? window.parent.document : document; } catch (_) { return document; } };
  const paidTier = value => typeof value === 'string' && !['', 'FREE', '免费版', '免费', '非会员'].includes(value.trim().toUpperCase());
  const isMember = audience => {
    const eligibility = window.vinaMembershipEligibility?.(audience);
    if (typeof eligibility?.active === 'boolean') return eligibility.active;
    if (audience === 'personal') {
      const subscription = window.vinaPersonalMembershipState?.read();
      if (typeof subscription?.plan === 'string') return paidTier(subscription.plan);
    }
    return paidTier(accountDocument().querySelector(audience === 'team' ? '.va-membership-title strong' : '.profile-popover-personal-tier')?.textContent || '');
  };
  const balances = audience => {
    const supplied = window.vinaVPointAccount?.(audience);
    if (supplied && Number.isFinite(supplied.total) && Number.isFinite(supplied.purchased)) return supplied;
    const doc = accountDocument();
    const read = selector => Math.max(0, Number(doc.querySelector(selector)?.textContent.replace(/[^\d.]/g, '')) || 0);
    return audience === 'team' ? { total: read('#profileTeamCreditBalance'), purchased: 0 } : {
      total: read('.profile-popover-balance'), purchased: read('.profile-personal-credit-sources .profile-team-credits-top:last-child strong')
    };
  };
  const cancelRequest = () => {
    current?.request?.controller.abort();
    if (current) current.request = null;
  };
  const closeLayer = () => {
    if (!layer?.open) return;
    const focus = layer.returnTarget;
    if (layer.dataset.kind !== 'rules') cancelRequest();
    layer.close();
    if (dialog?.open && focus?.isConnected) focus.focus({ preventScroll: true });
  };
  const restore = () => {
    if (!scroll) return;
    document.documentElement.style.overflow = scroll.html;
    document.body.style.overflow = scroll.body;
    window.scrollTo(scroll.x, scroll.y);
    scroll = null;
    const target = returnFocus?.isConnected && !returnFocus.closest('[hidden], [inert], dialog:not([open])') ? returnFocus : document.getElementById('profilePopoverTrigger') || document.getElementById('vmMembershipClose');
    target?.focus({ preventScroll: true });
  };
  const close = () => {
    closeLayer(); cancelRequest(); current = null;
    if (dialog?.open) dialog.close();
    restore();
  };
  const create = () => {
    dialog = document.createElement('dialog');
    dialog.id = 'vinaVPointStore';
    dialog.setAttribute('aria-labelledby', 'vinaVPointStoreTitle');
    dialog.setAttribute('translate', 'no');
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', () => { if (!dialog.open) { cancelRequest(); current = null; restore(); } });
    dialog.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (event.target === dialog || target?.hasAttribute('data-store-close')) { close(); return; }
      if (!target || !current) return;
      if (target.hasAttribute('data-store-pack')) {
        if (current.request) return;
        current.selected = Number(target.dataset.storePack);
        lastSelection[current.audience] = current.selected; update();
      }
      if (target.hasAttribute('data-store-rules')) openRules(target);
      if (target.hasAttribute('data-store-membership')) {
        const audience = current.audience;
        const trigger = document.getElementById('homeHeaderPlan') || document.getElementById('vmMembershipClose');
        close(); window.openVinaMembershipPage?.(audience, trigger);
      }
      if (target.hasAttribute('data-store-buy')) checkout();
    });
    document.body.append(dialog);
  };
  const markup = () => `<section class="vsp-card" data-figma-node="6815:30277"><header class="vsp-header"><h2 id="vinaVPointStoreTitle">${escape(t('购买V点'))}</h2><button class="vsp-close" type="button" data-store-close aria-label="${escape(t('关闭V点充值'))}"><img src="${assets}close.svg" alt=""></button></header>
    <div class="vsp-overview"><div class="vsp-account"><div class="vsp-balances"><span>${escape(t('当前总余额'))} <b data-total></b></span><i aria-hidden="true"></i><span>${escape(t('充值V点余额'))} <b data-purchased></b></span></div><div class="vsp-notice"><span>${escape(t('充值V点到账后有效期 2 年'))}</span><button type="button" data-store-rules>${escape(t('查看V点规则'))}<img src="${assets}chevron.svg" alt=""></button></div></div>
    <div class="vsp-banner"><div><strong data-banner-title></strong><span data-banner-subtitle></span></div><button type="button" data-store-membership>${escape(t('查看会员方案'))}<span aria-hidden="true"> ›</span></button><img class="vsp-banner-points" src="${assets}points.svg" alt=""></div></div>
    <section class="vsp-pack-section"><div class="vsp-pack-heading"><h3>${escape(t('选择V点套餐'))}</h3><span data-member-applied>${escape(t('已自动应用会员价'))}</span></div><div class="vsp-packages" aria-label="${escape(t('充值包'))}">${packs.map((pack, index) => `<button type="button" class="vsp-pack" data-store-pack="${index}" aria-pressed="false"><span class="vsp-points"><strong>${number(pack.points)}</strong> <em>${escape(t('V点'))}</em></span><span class="vsp-regular">${escape(t('普通价 ¥{n}', { n: money(pack.regularCents).slice(1) }))}</span><span class="vsp-price-label">${escape(t('会员价'))}</span><strong class="vsp-price">${money(pack.memberCents)}</strong><span class="vsp-saving" data-savings></span><span class="vsp-check" aria-hidden="true"><img src="${assets}check.svg" alt=""></span></button>`).join('')}</div></section>
    <footer class="vsp-summary"><div class="vsp-metrics"><div><span>${escape(t('已选套餐'))}</span><strong data-selected></strong></div><i aria-hidden="true"></i><div><span>${escape(t('应付金额'))}</span><strong data-payable></strong></div></div><div class="vsp-savings-summary"><p>${escape(t('成为会员，本单可省'))} <strong data-order-saving></strong></p><span>${escape(t('当前应付仍为普通价，开通成功后自动应用为会员价'))}</span></div><div class="vsp-actions"><button class="vsp-secondary" type="button" data-store-membership>${escape(t('开通会员享8折'))}</button><button class="vsp-primary" type="button" data-store-buy>${escape(t('立即购买'))}</button></div></footer></section>`;
  const update = () => {
    if (!current || !dialog?.open) return;
    const member = isMember(current.audience), selected = packs[current.selected], balance = balances(current.audience);
    current.member = member;
    dialog.dataset.member = String(member);
    dialog.querySelector('.vsp-card').dataset.figmaNode = member ? '6815:30377' : '6815:30277';
    dialog.querySelector('[data-total]').textContent = number(balance.total);
    dialog.querySelector('[data-purchased]').textContent = number(balance.purchased);
    dialog.querySelector('[data-banner-title]').textContent = t(member ? '会员8折已生效' : '会员购买V点享8折');
    dialog.querySelector('[data-banner-subtitle]').textContent = t(member ? '以下均为你的会员专享价格' : '开通后，本页全部套餐均享会员价');
    dialog.querySelectorAll('[data-store-pack]').forEach((button, index) => {
      button.classList.toggle('is-selected', index === current.selected);
      button.setAttribute('aria-pressed', String(index === current.selected));
      button.querySelector('[data-savings]').textContent = t(member ? '已省 ¥{n}' : '开通后可省 ¥{n}', { n: money(packs[index].regularCents - packs[index].memberCents).slice(1) });
    });
    dialog.querySelector('[data-selected]').textContent = t('{n} V点', { n: number(selected.points) });
    dialog.querySelector('[data-payable]').textContent = money(member ? selected.memberCents : selected.regularCents);
    dialog.querySelector('[data-order-saving]').textContent = money(selected.regularCents - selected.memberCents);
  };
  const makeLayer = () => {
    layer = document.createElement('dialog'); layer.id = 'vinaVPointResult'; layer.setAttribute('translate', 'no');
    layer.addEventListener('cancel', event => { event.preventDefault(); closeLayer(); });
    layer.addEventListener('close', () => { if (!layer.open && layer.dataset.kind !== 'rules') cancelRequest(); });
    layer.addEventListener('click', event => {
      if (event.target === layer || event.target.closest('[data-layer-close]')) closeLayer();
      if (event.target.closest('[data-payment-retry]')) checkout();
      if (event.target.closest('[data-result-done]')) close();
      if (event.target.closest('[data-result-orders]')) {
        const receipt = current?.receipt, trigger = returnFocus;
        close(); window.openVinaBillingRecords?.('orders', trigger, { orderId: receipt?.orderId });
      }
    });
    document.body.append(layer);
  };
  const showLayer = (kind, title, body, actions = '') => {
    if (!layer) makeLayer();
    if (!layer.open) layer.returnTarget = document.activeElement;
    layer.dataset.kind = kind; layer.setAttribute('aria-labelledby', 'vinaVPointResultTitle');
    layer.innerHTML = `<section class="vsp-result-card"><header><h2 id="vinaVPointResultTitle">${escape(t(title))}</h2><button class="vsp-result-close" type="button" data-layer-close aria-label="${escape(t('关闭弹窗'))}"><img src="${assets}result-close.svg" alt=""></button></header>${body}${actions}</section>`;
    layer.querySelector('.vsp-result-card').dir = language() === 'ar' ? 'rtl' : 'ltr';
    if (!layer.open) layer.showModal();
    layer.querySelector('.vsp-result-close').focus({ preventScroll: true });
  };
  const openRules = () => {
    const template = document.createElement('template'); template.innerHTML = window.VinaBillingReference?.rules || '';
    const rules = template.content.querySelector('section') || template.content.firstElementChild;
    if (!rules) return;
    showLayer('rules', 'V点规则', `<div class="vsp-rules-content">${rules.innerHTML}</div>`);
    layer.querySelector('.vsp-rules-content [aria-label="关闭V点规则"]')?.remove();
  };
  const paymentMessage = (message, retry = true) => {
    showLayer('checkout', '购买V点', `<div class="vsp-checkout-info"><p>${escape(t('已选套餐'))}<strong>${escape(t('{n} V点', { n: number(current.request.order.points) }))}</strong></p><p>${escape(t('应付金额'))}<strong>${money(current.request.order.amountCents)}</strong></p><div role="status">${escape(t(message))}</div></div>`, `<footer class="vsp-result-actions"><button class="vsp-secondary" type="button" data-layer-close>${escape(t('取消支付'))}</button>${retry ? `<button class="vsp-primary" type="button" data-payment-retry>${escape(t('重新获取'))}</button>` : ''}</footer>`);
  };
  // 支付服务以 createOrder(order, {signal}) 接入；也可按 requestId 回传 vina:vpoint-payment-result。
  // 没有支付服务时沿用原项目“二维码暂时无法获取”反馈，成功结果只消费对应的有效订单回执。
  const checkout = () => {
    if (!current) return;
    cancelRequest(); update();
    const pack = packs[current.selected];
    const order = Object.freeze({ requestId: 'vpoint-' + Date.now() + '-' + (++serial), audience: current.audience, points: pack.points, member: current.member, amountCents: current.member ? pack.memberCents : pack.regularCents });
    const request = { order, controller: new AbortController() }; current.request = request;
    const createOrder = window.vinaVPointPayment?.createOrder;
    if (typeof createOrder !== 'function') { paymentMessage('支付二维码暂时无法获取，请稍后重试'); return; }
    paymentMessage('获取中', false);
    Promise.resolve().then(() => createOrder(order, { signal: request.controller.signal })).then(result => {
      if (current?.request !== request || request.controller.signal.aborted) return;
      if (result?.status === 'success') { receive({ ...result, requestId: order.requestId }); return; }
      if (typeof result?.qrCodeUrl === 'string' && /^https:\/\//.test(result.qrCodeUrl)) {
        paymentMessage('请扫码完成支付', false);
        const img = document.createElement('img'); img.className = 'vsp-payment-qr'; img.src = result.qrCodeUrl; img.alt = t('支付二维码'); layer.querySelector('.vsp-checkout-info').append(img);
      } else paymentMessage('支付二维码暂时无法获取，请稍后重试');
    }).catch(() => { if (current?.request === request && !request.controller.signal.aborted) paymentMessage('支付二维码暂时无法获取，请稍后重试'); });
  };
  const receive = receipt => {
    const request = current?.request;
    if (!request || receipt?.requestId !== request.order.requestId || request.controller.signal.aborted) return false;
    if (receipt.status !== 'success' || typeof receipt.orderId !== 'string' || !receipt.orderId.trim()) return false;
    if (receipt.amountCents !== undefined && receipt.amountCents !== request.order.amountCents) { paymentMessage('订单金额已变化，请重新获取'); return false; }
    const order = request.order;
    current.receipt = { ...receipt, audience: order.audience };
    request.controller.abort(); current.request = null;
    showLayer('success', '支付结果', `<div class="vsp-success-content"><div class="vsp-success-icon"><img src="${assets}success.svg" alt=""></div><p>${escape(t('支付成功'))}</p><div><p>${escape(t('{n} V点 · 实付 {amount}', { n: number(order.points), amount: money(order.amountCents) }))}</p><p>${escape(t('到账：充值V点 {n} · 有效期 2 年', { n: number(order.points) }))}</p></div></div>`, `<footer class="vsp-result-actions"><button class="vsp-secondary" type="button" data-result-done>${escape(t('完成'))}</button><button class="vsp-primary" type="button" data-result-orders>${escape(t('查看订单'))}</button></footer>`);
    window.dispatchEvent(new CustomEvent('vina:vpoint-payment-success', { detail: { ...receipt, ...order } }));
    return true;
  };
  window.openVinaVPointStore = (audience = 'personal', trigger) => {
    if (!document.getElementById('membershipPage')) window.closeVinaMembershipPage?.();
    if (!dialog) create();
    closeLayer(); cancelRequest();
    const kind = audience === 'team' ? 'team' : 'personal';
    current = { audience: kind, selected: lastSelection[kind], request: null, receipt: null };
    dialog.dataset.audience = kind; dialog.innerHTML = markup();
    dialog.querySelector('.vsp-card').dir = language() === 'ar' ? 'rtl' : 'ltr';
    if (!dialog.open) {
      returnFocus = trigger || document.activeElement;
      scroll = { html: document.documentElement.style.overflow, body: document.body.style.overflow, x: window.scrollX, y: window.scrollY };
      document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; dialog.showModal();
    }
    update(); dialog.querySelector('.vsp-close').focus({ preventScroll: true });
  };
  window.closeVinaVPointStore = close;
  window.showVinaVPointPaymentResult = receive;
  window.vinaVPointStore = { cleanup: container => { if (container === dialog) cancelRequest(); } };
  window.addEventListener('vina:vpoint-payment-result', event => receive(event.detail));
  window.addEventListener('vina:personal-membership-change', update);
  window.addEventListener('storage', update);
  document.addEventListener('vina:language-change', () => { if (dialog?.open && current && !layer?.open) { dialog.innerHTML = markup(); update(); } });
})();
