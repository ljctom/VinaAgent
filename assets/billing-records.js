/* 2026-10-30 Product Design 改动逻辑：账单与记录改为覆盖当前页面的共用全屏弹窗。
 * 头像菜单默认打开 V 点明细，会员方案的会员记录默认打开会员订单；切换页签不写入路由或浏览器历史。
 * 背景页面保留原 DOM、账户状态和滚动位置，打开时锁定滚动并设为 inert，关闭时恢复焦点和原状态。
 * 原有记录、筛选、分页、充值与规则弹窗继续复用；旧账单 URL 仅作兼容入口。
 */
(() => {
  const start = () => {
    const data = window.VinaBillingReference;
    if (!data) return;
    const mount=document.createElement('div');mount.className='billing-root';mount.hidden=true;document.body.append(mount);
    let returnFocus=null,backgroundState=[];
    function openBilling(next='points',trigger){
      if(mount.hidden){
        returnFocus=trigger||document.activeElement;
        // 只暂停背景交互，不重建当前页面；关闭时逐个恢复原有 inert 状态。
        backgroundState=[...document.body.children].filter(node=>node!==mount&&!['SCRIPT','STYLE','LINK'].includes(node.tagName)).map(node=>[node,node.inert]);
        backgroundState.forEach(([node])=>node.inert=true);
        document.body.classList.add('billing-modal-open');
        mount.hidden=false;
      }
      tab=tabs.includes(next)?next:'points';render();
      mount.querySelector('.billing-modal-close')?.focus({preventScroll:true});
    }
    function closeBilling(){
      if(mount.hidden)return;
      while(modalStack.length)closeLayer();
      closeCalendar();mount.hidden=true;
      document.body.classList.remove('billing-modal-open');
      backgroundState.forEach(([node,inert])=>{if(node.isConnected)node.inert=inert;});backgroundState=[];
      if(returnFocus?.isConnected&&!returnFocus.closest('[hidden]'))returnFocus.focus({preventScroll:true});
      else document.querySelector('#topAccountAvatar, #vmMembershipClose, .home-header-benefits')?.focus({preventScroll:true});
    }
    const scope='data-v-7e4ba823';
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const scoped=(tag,cls,html='')=>`<${tag} ${scope}="" class="${cls}">${html}</${tag}>`;
    const tabs=['points','membership','orders'];
    let tab='points';
    const states=Object.fromEntries(tabs.map(t=>[t,{page:1,size:10,first:'',second:'',start:'',end:''}]));
    const configs={points:[['V点类型',['全部','充值V点','会员V点','免费V点']],['变动类型',['全部','获得','预扣','消耗','返还','过期','回收']]],membership:[['订单状态',['全部状态','待支付','已支付','已关闭','已过期']],['交易类型',['全部','购买','续费','升级']]],orders:[['订单状态',['全部状态','支付中','支付成功','支付失败']]]};
    const emptySource=new DOMParser().parseFromString(data.templates.orders,'text/html').querySelector('.entitlement-center__state.is-empty');
    let currentRows=[],calendar=null,calendarState=null,modalStack=[];
    const names={points:'V点明细',membership:'会员订单',orders:'V点订单'};
    function filtered(){const s=states[tab];return data[tab].filter(row=>{
      const date=tab==='points'?row[4].slice(0,10):row[1].slice(0,10);
      const first=tab==='points'?row[0]:tab==='membership'?row[7]:row[6];
      const second=tab==='points'?row[1]:row[3];
      return (!s.first||s.first===first)&&(!s.second||s.second===second)&&(!s.start||date>=s.start)&&(!s.end||date<=s.end);
    });}
    function pageNumbers(page,total){return total<=6?Array.from({length:total},(_,i)=>i+1):page<=4?[1,2,3,4,5,'...',total]:page>=total-3?[1,'...',total-4,total-3,total-2,total-1,total]:[1,'...',page-1,page,page+1,'...',total];}
    function render(){
      closeCalendar();const s=states[tab];currentRows=filtered();const count=currentRows.length;const total=Math.max(1,Math.ceil(count/s.size));s.page=Math.min(total,Math.max(1,s.page));
      mount.innerHTML=data.templates[tab];
      // 全屏弹窗本身提供标题与关闭按钮，不渲染品牌、账户栏或页面顶部导航。
      const dialog=mount.querySelector('.entitlement-center__dialog');
      dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.tabIndex=-1;
      const close=document.createElement('button');close.type='button';close.className='billing-modal-close';close.setAttribute('aria-label','关闭账单与记录');
      close.innerHTML='<img src="./assets/icons/asset-preview-close.svg" alt="">';dialog.prepend(close);
      mount.querySelector('.entitlement-center__page-tabs')?.setAttribute('role','tablist');
      const summary=mount.querySelector('.entitlement-center__summary');if(summary&&!summary.children.length)summary.hidden=true;
      mount.querySelectorAll('details').forEach(d=>d.open=false);
      const pageTabs=mount.querySelectorAll('.entitlement-center__page-tabs button');
      pageTabs.forEach((button,i)=>{button.dataset.billingTab=tabs[i];button.classList.toggle('is-active',tabs[i]===tab);button.setAttribute('aria-selected',String(tabs[i]===tab));button.tabIndex=tabs[i]===tab?0:-1;});
      const filters=mount.querySelectorAll('.entitlement-center__filter-menu');
      filters.forEach((menu,i)=>{
        const [label,options]=configs[tab][i];const key=i===0?'first':'second';const value=s[key];
        menu.dataset.billingFilter=key;menu.classList.toggle('is-selected',!!value);
        menu.querySelector('summary').innerHTML=esc(value||label)+`<span ${scope}="" class="entitlement-center__chevron"></span>`;
        menu.querySelector('.entitlement-center__filter-options').innerHTML=options.map((option,j)=>`<button ${scope}="" type="button" data-filter-key="${key}" data-filter-value="${j?esc(option):''}" class="${(j?value===option:!value)?'is-selected':''}">${esc(option)}</button>`).join('');
      });
      const dateTrigger=mount.querySelector('.entitlement-center__date-trigger');
      const timeLabel=tab==='points'?'变动时间':tab==='membership'?'交易时间':'下单时间';
      dateTrigger.innerHTML=`<span ${scope}="">${timeLabel} ${s.start&&s.end?esc(s.start+' - '+s.end):'全部时间'}</span><img class="billing-date-arrow" src="./assets/icons/profile-caret-right.svg" alt="">`;
      dateTrigger.setAttribute('role','button');dateTrigger.setAttribute('tabindex','0');dateTrigger.setAttribute('aria-label',timeLabel+'筛选');dateTrigger.setAttribute('aria-expanded','false');
      const tbody=mount.querySelector('tbody');
      if(tbody)tbody.innerHTML=currentRows.slice((s.page-1)*s.size,s.page*s.size).map(row=>`<tr ${scope}="">${row.map((cell,i)=>{
        const cls=tab==='points'&&i===3?(String(cell).startsWith('+')?' is-positive':' is-negative'):tab!=='points'&&i===(tab==='membership'?7:6)?' is-order-status':'';
        return `<td ${scope}="" class="entitlement-center__table-cell"><span ${scope}="" class="entitlement-center__cell-value${cls}" tabindex="0" data-tooltip-text="${esc(cell)}" title="${esc(cell)}">${esc(cell)}</span></td>`;
      }).join('')}</tr>`).join('');
      const records=mount.querySelector('.entitlement-center__records');const wrap=mount.querySelector('.entitlement-center__table-wrap');
      wrap?.querySelector('.entitlement-center__state')?.remove();
      if(!count){
        records.classList.add('is-empty-state');wrap?.classList.add('entitlement-center__empty-table');
        if(emptySource&&wrap){const empty=emptySource.cloneNode(true);empty.querySelector('strong').textContent=tab==='points'?'暂无 V 点消耗记录':tab==='membership'?'暂无会员订单记录':'暂无 V 点购买订单记录';wrap.append(empty);}
      }else{records.classList.remove('is-empty-state');wrap?.classList.remove('entitlement-center__empty-table');}
      mount.querySelector('.entitlement-center__footer')?.remove();
      if(count){
        const footer=document.createElement('footer');footer.setAttribute(scope,'');footer.className='entitlement-center__footer';
        const button=(label,page,disabled=false,active=false)=>`<button ${scope}="" type="button" data-billing-page="${page}" ${disabled?'disabled':''} class="${active?'entitlement-center__page-number is-active':''}" aria-label="${label==='‹'?'上一页':label==='›'?'下一页':'第 '+label+' 页'}">${label}</button>`;
        footer.innerHTML=`<span ${scope}="">共${count}条</span><div ${scope}="" class="entitlement-center__pagination" aria-label="分页">${button('‹',s.page-1,s.page===1)}${pageNumbers(s.page,total).map(p=>p==='...'?scoped('span','entitlement-center__page-ellipsis','...'):button(p,p,p===s.page,p===s.page)).join('')}${button('›',s.page+1,s.page===total)}<details ${scope}="" class="entitlement-center__page-size-menu"><summary ${scope}="">${s.size}条/页</summary><div ${scope}="" class="entitlement-center__page-size-options">${[5,10,20,30,50,100].map(size=>`<button ${scope}="" type="button" data-billing-size="${size}" class="${s.size===size?'is-selected':''}">${size}条/页</button>`).join('')}</div></details>${total>1?`<span ${scope}="" class="entitlement-center__goto-label">前往</span><input ${scope}="" class="entitlement-center__goto-input" inputmode="numeric" pattern="[0-9]*" aria-label="前往" value="${s.page}"><span ${scope}="" class="entitlement-center__goto-label">页</span>`:''}</div>`;
        records.append(footer);
      }
    }
    // 页签只更新弹窗内部状态，关闭后无需浏览器返回，也不改变当前地址。
    function setTab(next){if(!tabs.includes(next))return;tab=next;render();mount.querySelector(`[data-billing-tab="${tab}"]`)?.focus({preventScroll:true});}
    function reset(){states[tab]={...states[tab],page:1,first:'',second:'',start:'',end:''};render();}
    function gotoPage(value){const page=Number.parseInt(value,10);if(!Number.isFinite(page)){render();return;}states[tab].page=page;render();}
    mount.addEventListener('click',event=>{
      const target=event.target.closest('button,summary,[role="button"]');if(!target)return;
      if(target.closest('.billing-modal-close')){closeBilling();return;}
      if(target.dataset.billingTab){setTab(target.dataset.billingTab);return;}
      if(target.dataset.filterKey){states[tab][target.dataset.filterKey]=target.dataset.filterValue;states[tab].page=1;render();return;}
      if(target.hasAttribute('data-billing-page')){gotoPage(target.dataset.billingPage);return;}
      if(target.dataset.billingSize){states[tab].size=Number(target.dataset.billingSize);states[tab].page=1;render();return;}
      if(target.matches('summary')){const menu=target.closest('details');mount.querySelectorAll('details[open]').forEach(other=>{if(other!==menu)other.open=false;});closeCalendar();return;}
      if(target.closest('.entitlement-center__date-trigger')){openCalendar(target.closest('.entitlement-center__date-trigger'));return;}
      if(target.closest('.entitlement-center__reset')){
        if(tab==='points'){target.classList.add('is-refreshing');target.disabled=true;setTimeout(()=>render(),350);}else reset();return;
      }
      if(target.closest('.entitlement-center__state')){reset();return;}
      if(target.closest('.entitlement-center__balance-row'))openRecharge();
    });
    mount.addEventListener('keydown',event=>{
      if(event.target.matches('.entitlement-center__goto-input')&&event.key==='Enter'){event.preventDefault();gotoPage(event.target.value);}
      if(event.target.matches('.entitlement-center__date-trigger')&&['Enter',' '].includes(event.key)){event.preventDefault();openCalendar(event.target);}
      if(event.target.dataset.billingTab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const i=tabs.indexOf(tab);setTab(event.key==='Home'?tabs[0]:event.key==='End'?tabs[2]:tabs[(i+(event.key==='ArrowRight'?1:2))%3]);mount.querySelector(`[data-billing-tab="${tab}"]`)?.focus();}
    });
    mount.addEventListener('focusout',event=>{if(event.target.matches('.entitlement-center__goto-input')&&event.target.isConnected&&Number(event.target.value)!==states[tab].page)gotoPage(event.target.value);});
    mount.addEventListener('input',event=>{if(event.target.matches('.entitlement-center__goto-input'))event.target.value=event.target.value.replace(/\D/g,'');});
    const dateString=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    function closeCalendar(){calendar?.remove();calendar=null;mount.querySelector('.entitlement-center__date-trigger')?.setAttribute('aria-expanded','false');}
    function applyDates(start,end){const s=states[tab];s.start=start;s.end=end;s.page=1;render();mount.querySelector('.entitlement-center__date-trigger')?.focus();}
    function openCalendar(trigger){
      if(calendar){closeCalendar();return;}
      mount.querySelectorAll('details').forEach(d=>d.open=false);
      const s=states[tab];const today=new Date();const base=s.start?new Date(s.start+'T12:00:00'):today;
      calendarState={year:base.getFullYear(),month:base.getMonth(),start:s.start,end:s.end,choosing:false,hover:'',grid:null,trigger};
      calendar=document.createElement('div');calendar.className='billing-calendar';calendar.setAttribute('role','dialog');calendar.setAttribute('aria-label','选择日期范围');document.body.append(calendar);trigger.setAttribute('aria-expanded','true');renderCalendar();positionCalendar();
    }
    function positionCalendar(){if(!calendar)return;const bounds=calendarState.trigger.getBoundingClientRect();const height=calendar.getBoundingClientRect().height;calendar.style.left=Math.max(12,Math.min(bounds.right-calendar.offsetWidth,innerWidth-calendar.offsetWidth-12))+'px';calendar.style.top=(bounds.bottom+height+12<innerHeight?bounds.bottom+8:Math.max(60,bounds.top-height-8))+'px';}
    function arrow(amount,label){return `<button class="${amount<0?'previous':''}" type="button" data-month-step="${amount}" aria-label="${label}"><img src="./assets/icons/profile-caret-right.svg" alt="">${Math.abs(amount)===12?'<img src="./assets/icons/profile-caret-right.svg" alt="">':''}</button>`;}
    function renderCalendar(){
      if(!calendar)return;const c=calendarState;const today=dateString(new Date());
      calendar.innerHTML=`<div class="billing-calendar-shortcuts"><button data-date-shortcut="today">今日</button><button data-date-shortcut="week">最近一周</button><button data-date-shortcut="month">最近一个月</button>${states[tab].start?'<button class="billing-calendar-clear" data-date-shortcut="clear">清除筛选</button>':''}</div><div class="billing-calendar-months">${[0,1].map(column=>{
        const date=new Date(c.year,c.month+column,1),year=date.getFullYear(),month=date.getMonth();
        const head=`<div class="billing-calendar-head"><span>${column===0?arrow(-12,'前一年')+arrow(-1,'上个月'):''}</span><span><button data-calendar-grid="year" data-column="${column}">${year} 年</button><button data-calendar-grid="month" data-column="${column}">${month+1} 月</button></span><span>${column===1?arrow(1,'下个月')+arrow(12,'后一年'):''}</span></div>`;
        if(c.grid?.column===column){const isYear=c.grid.type==='year';return `<section class="billing-calendar-month">${head}<div class="billing-calendar-grid">${Array.from({length:12},(_,i)=>{const value=isYear?Math.floor(year/10)*10-1+i:i;return `<button data-calendar-pick="${value}" data-pick-type="${isYear?'year':'month'}" data-column="${column}">${isYear?value+' 年':value+1+' 月'}</button>`;}).join('')}</div></section>`;}
        const offset=new Date(year,month,1).getDay()||7;const first=new Date(year,month,1-offset);
        return `<section class="billing-calendar-month">${head}<table role="grid" aria-label="${year}年${month+1}月"><thead><tr>${['日','一','二','三','四','五','六'].map(day=>`<th>${day}</th>`).join('')}</tr></thead><tbody>${Array.from({length:6},(_,week)=>'<tr>'+Array.from({length:7},(_,day)=>{const date=new Date(first);date.setDate(first.getDate()+week*7+day);const value=dateString(date);return `<td><button type="button" data-calendar-date="${value}" class="${date.getMonth()!==month?'is-muted ':''}${value===today?'is-today ':''}" aria-label="${value}" aria-selected="false"><span>${date.getDate()}</span></button></td>`;}).join('')+'</tr>').join('')}</tbody></table></section>`;
      }).join('')}</div>`;paintRange();
    }
    function paintRange(){if(!calendar)return;let a=calendarState.start,b=calendarState.choosing?calendarState.hover:calendarState.end;if(a&&b&&a>b)[a,b]=[b,a];calendar.querySelectorAll('[data-calendar-date]').forEach(node=>{const value=node.dataset.calendarDate;node.classList.toggle('is-start',!!a&&value===a);node.classList.toggle('is-end',!!b&&value===b);node.classList.toggle('is-in-range',!!a&&!!b&&value>=a&&value<=b);node.setAttribute('aria-selected',String(value===a||value===b));});}
    document.addEventListener('click',event=>{
      if(calendar&&calendar.contains(event.target)){
        const button=event.target.closest('button');if(!button)return;const c=calendarState;
        if(button.dataset.dateShortcut){const today=new Date(),start=new Date(today);if(button.dataset.dateShortcut==='clear'){applyDates('','');return;}if(button.dataset.dateShortcut==='week')start.setDate(start.getDate()-7);if(button.dataset.dateShortcut==='month')start.setMonth(start.getMonth()-1);applyDates(dateString(start),dateString(today));return;}
        if(button.dataset.monthStep){const next=new Date(c.year,c.month+Number(button.dataset.monthStep),1);c.year=next.getFullYear();c.month=next.getMonth();c.grid=null;renderCalendar();return;}
        if(button.dataset.calendarGrid){c.grid={type:button.dataset.calendarGrid,column:Number(button.dataset.column)};renderCalendar();return;}
        if(button.hasAttribute('data-calendar-pick')){const column=Number(button.dataset.column),display=new Date(c.year,c.month+column,1);const next=button.dataset.pickType==='year'?new Date(Number(button.dataset.calendarPick),display.getMonth()-column,1):new Date(display.getFullYear(),Number(button.dataset.calendarPick)-column,1);c.year=next.getFullYear();c.month=next.getMonth();c.grid=null;renderCalendar();return;}
        if(button.dataset.calendarDate){const date=button.dataset.calendarDate;if(!c.choosing){c.start=date;c.end='';c.hover=date;c.choosing=true;paintRange();}else applyDates(...[c.start,date].sort());}return;
      }
      if(calendar&&!event.target.closest('.entitlement-center__date-trigger'))closeCalendar();
      if(!event.target.closest('details'))mount.querySelectorAll('details[open]').forEach(d=>d.open=false);
    });
    document.addEventListener('mouseover',event=>{const date=event.target.closest('[data-calendar-date]');if(date&&calendarState?.choosing){calendarState.hover=date.dataset.calendarDate;paintRange();}});
    document.addEventListener('keydown',event=>{
      if(mount.hidden)return;
      if(event.key==='Escape'&&calendar){closeCalendar();calendarState.trigger?.focus();event.preventDefault();event.stopImmediatePropagation();return;}
      if(calendar&&event.target.dataset.calendarDate&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const date=new Date(event.target.dataset.calendarDate+'T12:00:00');date.setDate(date.getDate()+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key]));const key=dateString(date);if(!calendar.querySelector(`[data-calendar-date="${key}"]`)){calendarState.year=date.getFullYear();calendarState.month=date.getMonth();renderCalendar();}calendar.querySelector(`[data-calendar-date="${key}"]`)?.focus();}
      // 键盘焦点约束在最上层浮层；Esc 优先关闭日历、充值等子弹窗，再关闭账单。
      if(!modalStack.length){
        if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeBilling();return;}
        if(event.key==='Tab'&&!calendar){
          const focusable=[...mount.querySelectorAll('button,a[href],input,summary,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length&&!node.closest('details:not([open]) .entitlement-center__filter-options,details:not([open]) .entitlement-center__page-size-options'));
          const first=focusable[0],last=focusable.at(-1);
          if(event.shiftKey&&(document.activeElement===first||!mount.contains(document.activeElement))){event.preventDefault();last?.focus();}
          else if(!event.shiftKey&&(document.activeElement===last||!mount.contains(document.activeElement))){event.preventDefault();first?.focus();}
        }
        return;
      }
      const layer=modalStack.at(-1);
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeLayer();}
      if(event.key==='Tab'){const focusable=[...layer.node.querySelectorAll('button,a[href],input,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    },true);
    window.addEventListener('resize',positionCalendar);mount.addEventListener('scroll',closeCalendar,true);
    function openLayer(cls,html,scopeAttr){
      closeCalendar();const focus=document.activeElement;const node=document.createElement('div');node.className='billing-layer '+cls;if(scopeAttr)node.setAttribute(scopeAttr,'');node.innerHTML=html;
      modalStack.at(-1)?.node.setAttribute('inert','');mount.inert=true;
      document.body.append(node);modalStack.push({node,focus});node.addEventListener('click',event=>{if(event.target===node)closeLayer();});node.querySelector('button')?.focus();return node;
    }
    function closeLayer(){const layer=modalStack.pop();if(!layer)return;layer.node.remove();if(modalStack.length)modalStack.at(-1).node.removeAttribute('inert');else{mount.inert=false;}if(layer.focus?.isConnected)layer.focus.focus();}
    function openRules(){const node=openLayer('points-rules-modal',data.rules,'data-v-c1e10e62');node.querySelector('[aria-label="关闭V点规则"]')?.addEventListener('click',closeLayer);}
    function openRecharge(){
      const node=openLayer('points-recharge',data.recharge,'data-v-9d4f4429');const packages=[...node.querySelectorAll('.points-recharge__package')];const check=node.querySelector('.points-recharge__selected-check')?.cloneNode(true);
      node.querySelector('[aria-label="关闭V点充值"]').addEventListener('click',closeLayer);
      packages.forEach(button=>button.addEventListener('click',()=>{packages.forEach(item=>{item.classList.toggle('is-selected',item===button);item.setAttribute('aria-pressed',String(item===button));item.querySelector('.points-recharge__selected-check')?.remove();});if(check)button.append(check.cloneNode(true));node.querySelector('.points-recharge__summary-metric strong').textContent=button.querySelector('.points-recharge__points strong').textContent+' V点';}));
      node.querySelector('.points-recharge__notice button').addEventListener('click',openRules);
      // 2026-10-30：充值弹窗里的会员入口也使用全屏覆盖层；会员页内部则复用自身切换能力，关闭后保留充值选择。
      node.querySelectorAll('.points-recharge__member-banner button,.points-recharge__membership-action').forEach(button=>button.addEventListener('click',()=>window.openVinaMembershipPage?.('personal',button)));
      node.querySelector('.points-recharge__actions button:last-of-type').addEventListener('click',()=>{
        const selected=node.querySelector('.points-recharge__package.is-selected .points-recharge__points strong').textContent;
        const checkout=openLayer('billing-checkout',`<section class="billing-checkout-card" role="dialog" aria-modal="true" aria-labelledby="billingCheckoutTitle"><button class="checkout-close" aria-label="关闭支付"><img src="https://api.iconify.design/lucide/x.svg?color=%239aa6b2" alt=""></button><h2 id="billingCheckoutTitle">购买V点</h2><div class="checkout-line"><span>已选套餐</span><strong>${esc(selected)} V点</strong></div><div class="checkout-line"><span>应付金额</span><strong>¥0.02</strong></div><div class="checkout-message" role="status">支付二维码暂时无法获取，请稍后重试</div><div class="checkout-actions"><button class="checkout-cancel">取消支付</button><button class="checkout-retry">重新获取</button></div></section>`);
        checkout.querySelectorAll('.checkout-close,.checkout-cancel').forEach(button=>button.addEventListener('click',closeLayer));
        checkout.querySelector('.checkout-retry').addEventListener('click',event=>{const button=event.currentTarget;button.disabled=true;button.textContent='获取中';setTimeout(()=>{button.disabled=false;button.textContent='重新获取';},500);});
      });
    }
    // 两个入口共用同一实例；旧账单地址仍可打开，但不再创建顶部导航或返回首页标识。
    window.openVinaBillingRecords=openBilling;
    window.closeVinaBillingRecords=closeBilling;
    if(document.documentElement.classList.contains('billing-records-page'))openBilling(new URLSearchParams(location.search).get('tab')||'points');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
