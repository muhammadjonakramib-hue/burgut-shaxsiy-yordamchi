import {categories,statuses,addDays,monday,timeLabel,minutes,localParts,instant,dayItems,calendarItems,conflicts,summary,streak,lanes,validate} from './planner-core.mjs';
const root=document.getElementById('view-daily');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const days=['Du','Se','Ch','Pa','Ju','Sh','Ya'];
let data={templates:[],occurrences:[],preferences:{timezone:'Asia/Tashkent',theme:'auto'}},date=localParts().date,view='day',error='',busy=false,loaded=false,opening=null,dialogItem=null;
let lastRenderKey=null;
const cloud=()=>window.BurgutCloud;
const items=d=>calendarItems(data.templates,data.occurrences,d,data.preferences.timezone);
const storedItem=(id,d)=>dayItems(data.templates.filter(p=>p.id===id),data.occurrences,d)[0];
const today=()=>localParts(Date.now(),data.preferences.timezone).date;
const zone=()=>data.preferences.timezone;
const active=()=>root.classList.contains('on');
const dateTitle=d=>new Intl.DateTimeFormat('uz-UZ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
function message(text){const el=root.querySelector('[data-message]');if(el)el.textContent=text;}
async function load(){
 if(opening)return opening;
 opening=(async()=>{try{
   const status=await cloud().ready();if(!status.connected)throw Error(status.error||'Internet ulanishini tekshiring');
   const result=await cloud().dailyRead();
   data=result;loaded=true;error='';
   localStorage.setItem('burgut.daily.cache.'+status.userId,JSON.stringify(data));
 }catch(e){error=e.message;const owner=cloud().status().userId;
   if(!loaded&&owner){try{const cached=JSON.parse(localStorage.getItem('burgut.daily.cache.'+owner));if(cached){data=cached;loaded=true;}}catch{}}
 }finally{opening=null;if(active()&&!document.querySelector('#daily-editor[open]'))render();}})();
 return opening;
}
async function mutate(fn){
 if(busy)return;busy=true;root.setAttribute('aria-busy','true');
 try{if(opening)await opening;await fn();await load();return true;}catch(e){error=e.message;message(error);return false;}
 finally{busy=false;root.removeAttribute('aria-busy');}
}
function statsMarkup(){
 const s=summary(items(today())),st=streak(data.templates,data.occurrences,today(),zone());
 return `<div class="dp-stats">${[['Bugungi rejalar',s.total],['Bajarildi',s.done],['Bajarilmadi',s.missed],['Bajarilish',s.percent+'%'],['Muvaffaqiyatli kunlar',st+' kun']].map(([label,n])=>`<div><span>${label}</span><strong>${n}</strong></div>`).join('')}</div><div class="dp-progress" role="progressbar" aria-label="Bugungi bajarilish" aria-valuenow="${s.percent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${s.percent}%"></i></div>`;
}
function focusMarkup(){
 const now=Date.now(),all=[];
 for(const p of data.templates){const local=localParts(now,p.timezone);for(const d of [local.date,addDays(local.date,1)])for(const i of dayItems([p],data.occurrences,d))all.push({...i,at:instant(d,i.start_min,i.timezone),end:instant(d,i.end_min,i.timezone)});}
 const available=all.filter(i=>!['done','skipped'].includes(i.status)&&i.at!==null&&i.end!==null).sort((a,b)=>a.at-b.at);
 const current=available.filter(i=>i.at<=now&&i.end>now),next=available.find(i=>i.at>now);
 return `<div class="dp-focus"><span class="dp-live-dot"></span><div><small>HOZIRGI E’TIBOR</small><strong>${current.length?current.map(i=>esc(i.title)).join(' · '):'Hozircha bo‘sh vaqt'}</strong><span>${next?`Keyingi: ${esc(next.title)} · ${Math.ceil((next.at-now)/60000)} daqiqadan so‘ng`:'Yaqin 24 soatda boshqa reja yo‘q'}</span></div><button data-new>+ Yangi reja</button></div>`;
}
function chart(start,count,label){
 const values=Array.from({length:count},(_,i)=>{const d=addDays(start,i);return {date:d,...summary(items(d))};});
 return `<section class="dp-chart"><h3>${label}</h3><div class="dp-bars">${values.map(s=>`<button data-date="${s.date}" aria-label="${dateTitle(s.date)}: ${s.done}/${s.total}, ${s.percent}%" title="${s.date}: ${s.done}/${s.total} · ${s.percent}%"><i style="height:${s.percent}%;min-height:${s.total?3:1}px" class="${s.date>today()?'future':''}"></i><span>${count===7?days[(new Date(s.date+'T12:00Z').getUTCDay()+6)%7]:Number(s.date.slice(8))}</span></button>`).join('')}</div><small>Kelajak kunlari xira rangda. Rejasiz kun muvaffaqiyatli kun hisoblanmaydi.</small></section>`;
}
function analytics(){
 const start=date.slice(0,7)+'-01',count=new Date(Number(date.slice(0,4)),Number(date.slice(5,7)),0).getDate(),totals={};
 for(let i=0;i<count;i++)for(const [cat,n]of Object.entries(summary(items(addDays(start,i))).byCategory))totals[cat]=(totals[cat]||0)+n;
 return `<details class="dp-analytics"><summary>Statistika va tahlil</summary><div class="dp-chart-grid">${chart(monday(date),7,'Haftalik samaradorlik')}${chart(start,count,'Oylik samaradorlik')}</div><div class="dp-duration">${Object.entries(categories).map(([id,label])=>`<div><span>${label}</span><b>${Math.floor((totals[id]||0)/60)} soat ${(totals[id]||0)%60} daqiqa</b></div>`).join('')}</div><p>Bajarildi deb belgilangan rejalarning ajratilgan vaqti hisoblanadi; bu sekundomer o‘lchovi emas. Streak: barcha rejalari bajarilgan ketma-ket kunlar.</p></details>`;
}
function timeline(d,compact=false){
 const list=items(d),now=localParts(Date.now(),zone());
 const blocks=lanes(list).map(p=>{
   const isNow=d===now.date&&p.start_min<=now.minute&&p.end_min>now.minute;
   return `<button class="dp-block ${p.status==='done'?'done':''} ${isNow?'current':''}" data-edit="${p.id}" data-day="${p.source_date||d}" style="--event:${p.color};top:${p.start_min}px;height:${p.end_min-p.start_min}px;left:calc(${p.lane/p.columns*100}% + 3px);width:calc(${100/p.columns}% - 6px)" title="${esc(p.title)} · ${timeLabel(p.start_min)}–${timeLabel(p.end_min)} · ${statuses[p.status]}" aria-label="${esc(p.title)}, ${timeLabel(p.start_min)}–${timeLabel(p.end_min)}, ${statuses[p.status]}"><span class="dp-drag" data-drag="${p.id}" data-day="${p.source_date||d}" aria-label="Vaqtni surish" title="Ushlab yuqoriga yoki pastga suring">⠿</span><b>${p.status==='done'?'✓ ':''}${esc(p.title)}</b><small>${timeLabel(p.start_min)}–${timeLabel(p.end_min)} · ${esc(categories[p.category])}${p.timezone!==zone()?' · '+esc(p.timezone):''}</small></button>`;
 }).join('');
 return `<div class="dp-day ${compact?'compact':''}"><button class="dp-day-heading" data-date="${d}">${dateTitle(d)} <span>${summary(list).percent}%</span></button><div class="dp-timeline" data-timeline="${d}"><div class="dp-hours">${Array.from({length:24},(_,i)=>`<span style="top:${i*60}px">${String(i).padStart(2,'0')}:00</span>`).join('')}</div><div class="dp-events">${blocks}${d===now.date?`<div class="dp-now" style="top:${now.minute}px"><span>${timeLabel(now.minute)}</span></div>`:''}</div></div></div>`;
}
function month(){
 const first=date.slice(0,7)+'-01',start=monday(first);
 return `<div class="dp-month">${days.map(d=>`<b>${d}</b>`).join('')}${Array.from({length:42},(_,i)=>{const d=addDays(start,i),list=items(d);return `<button data-date="${d}" class="${d===today()?'today':''} ${d.slice(0,7)!==date.slice(0,7)?'outside':''}"><strong>${Number(d.slice(8))}</strong>${list.slice(0,3).map(p=>`<span style="--event:${p.color}">${p.status==='done'?'✓ ':''}${timeLabel(p.start_min)} ${esc(p.title)}</span>`).join('')}${list.length>3?`<small>+${list.length-3} ta</small>`:''}</button>`;}).join('')}</div>`;
}
function agenda(){return `<div class="dp-agenda"><h3>${dateTitle(date)} — vazifalar</h3>${items(date).map(p=>`<div><button data-edit="${p.id}" data-day="${p.source_date||date}"><i style="background:${p.color}"></i><span><b>${esc(p.title)}</b><small>${timeLabel(p.start_min)}–${timeLabel(p.end_min)}</small></span></button><select aria-label="${esc(p.title)} holati" data-status="${p.id}" data-day="${p.source_date||date}">${Object.entries(statuses).map(([k,v])=>`<option value="${k}" ${p.status===k?'selected':''}>${k==='done'?'✓ ':''}${v}</option>`).join('')}</select></div>`).join('')||'<p>Bu kun uchun reja yo‘q. “+ Yangi reja” orqali boshlang.</p>'}</div>`;}
function render(){
 const renderKey=date+'|'+view+'|'+zone(),previousScroll=lastRenderKey===renderKey?root.querySelector('.dp-calendar-scroll')?.scrollTop:null;
 const opened=[...root.querySelectorAll('details[open]')].map(d=>d.className);
 const theme=data.preferences.theme;
 root.dataset.theme=theme==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;
 root.innerHTML=`<div class="dp-shell"><header class="dp-header"><div><span class="dp-eyebrow">VAQTINGIZ — O‘Z QO‘LINGIZDA</span><h2>Kunlik reja</h2><p>${esc(zone())} · Kun tartibi va natijalar</p></div><div class="dp-actions"><button data-refresh aria-label="Yangilash">↻</button><select data-theme aria-label="Rang rejimi">${[['auto','Tizim'],['light','Yorug‘'],['dark','Qorong‘i']].map(([v,l])=>`<option value="${v}" ${v===theme?'selected':''}>${l}</option>`).join('')}</select><button data-notify>Eslatmalar</button></div></header><p class="dp-message" data-message role="status">${esc(error||(!loaded?'Yuklanmoqda…':'Supabase’da saqlangan'))}</p>${statsMarkup()}${focusMarkup()}<div class="dp-toolbar"><div><button data-nav="-1" aria-label="Oldingi">‹</button><button data-today>Bugun</button><button data-nav="1" aria-label="Keyingi">›</button><input aria-label="Reja sanasi" type="date" value="${date}" data-picker></div><div class="dp-segment">${[['day','Kun'],['week','Hafta'],['month','Oy']].map(([v,l])=>`<button data-view="${v}" aria-pressed="${view===v}">${l}</button>`).join('')}</div></div>${view==='month'?month():`<div class="dp-calendar-scroll ${view==='week'?'dp-week':''}">${view==='week'?Array.from({length:7},(_,i)=>timeline(addDays(monday(date),i),true)).join(''):timeline(date)}</div>`}${agenda()}${analytics()}<details class="dp-settings"><summary>Vaqt zonasi</summary><p>Yangi rejalar tanlangan zonada tuziladi. Mavjud rejalarning asl vaqt zonasi saqlanadi. Taqvimdagi barcha bloklar tanlangan zonaga o‘giriladi; tahrirlash oynasi rejaning asl zonasida ishlaydi.</p><select data-zone aria-label="Vaqt zonasi">${[...new Set(['Asia/Tashkent','Europe/Istanbul',Intl.DateTimeFormat().resolvedOptions().timeZone,zone(),...Intl.supportedValuesOf('timeZone')])].map(z=>`<option ${z===zone()?'selected':''}>${esc(z)}</option>`).join('')}</select></details></div>`;
 if(view!=='month'){const sc=root.querySelector('.dp-calendar-scroll');sc.scrollTop=previousScroll??Math.max(0,(date===today()?localParts(Date.now(),zone()).minute-100:420));}
 for(const name of opened){const d=root.querySelector('details.'+name);if(d)d.open=true;}
 lastRenderKey=renderKey;
}
function editor(p=null,d=date){
 dialogItem=p;document.getElementById('daily-editor')?.remove();
 const initial=p||{title:'',start_min:540,end_min:600,start_date:d,category:'study',color:'#4b8dbe',note:'',repeat:'once',weekdays:[],reminder:null,timezone:zone()};
 const el=document.createElement('dialog');el.id='daily-editor';el.className='dp-dialog';el.dataset.theme=root.dataset.theme;
 el.innerHTML=`<form><header><h2>${p?'Rejani tahrirlash':'Yangi reja'}</h2><button type="button" data-close aria-label="Yopish">✕</button></header><label>Faoliyat nomi<input name="title" maxlength="160" required value="${esc(initial.title)}" placeholder="Masalan, kitob o‘qish"></label><div class="dp-form-row"><label>Sana<input type="date" name="date" required value="${d}" ${p?'readonly':''}></label><label>Rang<input type="color" name="color" value="${initial.color}"></label></div><div class="dp-form-row"><label>Boshlanish<input type="time" name="start" required value="${timeLabel(initial.start_min)}"></label><label>Tugash<input type="time" name="end" required value="${timeLabel(initial.end_min===1440?0:initial.end_min)}"></label></div><label>Kategoriya<select name="category">${Object.entries(categories).map(([k,v])=>`<option value="${k}" ${k===initial.category?'selected':''}>${v}</option>`).join('')}</select></label><label>Izoh<textarea name="note" maxlength="2000">${esc(initial.note)}</textarea></label>${p?'<label>O‘zgarish doirasi<select name="scope"><option value="one">Faqat shu kun</option value="future">Shu kundan keyingi takrorlar</option></select></label>':''}<label>Takrorlash<select name="repeat">${[['once','Bir martalik'],['daily','Har kuni'],['weekly','Tanlangan hafta kunlari']].map(([k,v])=>`<option value="${k}" ${initial.repeat===k?'selected':''}>${v}</option>`).join('')}</select></label><div class="dp-weekdays">${days.map((l,i)=>`<label><input name="weekdays" type="checkbox" value="${(i+1)%7}" ${initial.weekdays.includes((i+1)%7)?'checked':''}>${l}</label>`).join('')}</div><label>Eslatma<select name="reminder">${[[null,'Eslatmasiz'],[0,'Boshlanishida'],[5,'5 daqiqa oldin'],[15,'15 daqiqa oldin'],[30,'30 daqiqa oldin'],[60,'1 soat oldin'],[1440,'1 kun oldin']].map(([k,v])=>`<option value="${k??''}" ${initial.reminder===k?'selected':''}>${v}</option>`).join('')}</select></label><p class="dp-form-hint">${esc(initial.timezone)}${p?' · “Faqat shu kun” tanlansa takrorlash qoidasi o‘zgarmaydi.':''}</p><p data-form-error role="alert"></p><footer>${p?'<button type="button" class="dp-delete" data-delete>O‘chirish</button>':''}<button type="submit">Saqlash</button></footer></form>`;
 document.body.append(el);el.showModal();
 el.querySelector('[data-close]').onclick=()=>el.close();
 el.addEventListener('close',()=>el.remove());
 const form=el.querySelector('form');
 const submit=async(event)=>{event.preventDefault();if(busy)return;
  const f=new FormData(form),candidate={id:crypto.randomUUID(),title:String(f.get('title')).trim(),start_date:String(f.get('date')),start_min:minutes(f.get('start')),end_min:minutes(f.get('end'))||1440,category:f.get('category'),color:f.get('color'),note:f.get('note'),repeat:f.get('repeat'),weekdays:f.getAll('weekdays').map(Number),timezone:initial.timezone,reminder:f.get('reminder')===''?null:Number(f.get('reminder'))};
  try{validate(candidate);const clash=conflicts(calendarItems(data.templates,data.occurrences,candidate.start_date,candidate.timezone),{...candidate,id:p?.id});
    if(clash.length&&!confirm('Vaqt to‘qnashuvi: '+clash.map(i=>i.title).join(', ')+'. Baribir saqlaysizmi?'))return;
    form.querySelector('[type=submit]').disabled=true;
    const ok=await mutate(()=>p&&f.get('scope')==='one'?cloud().dailyRpc('burgut_daily_occurrence',{item:{template_id:p.id,date:d,status:p.status,patch:((({title,start_min,end_min,category,color,note,reminder})=>({title,start_min,end_min,category,color,note,reminder}))(candidate)),cancelled:false},expected_revision:p.occurrence_revision}):cloud().dailyRpc('burgut_daily_save',{item:candidate,previous_id:p?.id||null,effective_date:p?d:null,expected_revision:p?.revision||0}));
    if(ok){date=candidate.start_date;el.close();render();}else el.querySelector('[data-form-error]').textContent=error;
  }catch(e){el.querySelector('[data-form-error]').textContent=e.message;}finally{form.querySelector('[type=submit]').disabled=false;}
 };
 form.onsubmit=submit;
 el.querySelector('[data-delete]')?.addEventListener('click',async()=>{
   if(!confirm('Rejani tanlangan doirada o‘chirasizmi? Avvalgi kunlar tarixi qoladi.'))return;
   const scope=form.elements.scope.value;
   const ok=await mutate(()=>scope==='future'?cloud().dailyRpc('burgut_daily_stop',{template_id:p.id,from_date:d,expected_revision:p.revision}):cloud().dailyRpc('burgut_daily_occurrence',{item:{template_id:p.id,date:d,status:p.status,patch:p.override?.patch||{},cancelled:true},expected_revision:p.occurrence_revision}));
   if(ok){el.close();render();}else el.querySelector('[data-form-error]').textContent=error;
 });
}
root.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||busy)return;
 if(b.hasAttribute('data-new'))editor();
 else if(b.dataset.edit){const p=storedItem(b.dataset.edit,b.dataset.day);if(p)editor(p,b.dataset.day);}
 else if(b.dataset.date){date=b.dataset.date;view='day';render();}
 else if(b.dataset.view){view=b.dataset.view;render();}
 else if(b.hasAttribute('data-today')){date=today();render();}
 else if(b.dataset.nav){let n=Number(b.dataset.nav);if(view==='month'){const dt=new Date(date.slice(0,7)+'-01T12:00Z');dt.setUTCMonth(dt.getUTCMonth()+n);date=dt.toISOString().slice(0,10);}else date=addDays(date,n*(view==='week'?7:1));render();}
 else if(b.hasAttribute('data-refresh'))load();
 else if(b.hasAttribute('data-notify'))enableNotifications();
});
root.addEventListener('change',async e=>{
 const el=e.target;
 if(el.hasAttribute('data-picker')){if(el.value){date=el.value;render();}}
 else if(el.hasAttribute('data-theme')||el.hasAttribute('data-zone')){
   await mutate(()=>cloud().dailyRpc('burgut_daily_settings',{zone:el.hasAttribute('data-zone')?el.value:zone(),mode:el.hasAttribute('data-theme')?el.value:data.preferences.theme}));render();
 }else if(el.dataset.status){
   const p=storedItem(el.dataset.status,el.dataset.day);el.disabled=true;
   await mutate(()=>cloud().dailyRpc('burgut_daily_occurrence',{item:{template_id:p.id,date:p.date,status:el.value,patch:p.override?.patch||{},cancelled:false},expected_revision:p.occurrence_revision}));render();
 }
});
// Pointer dragging works on mouse and touch. Only the grip captures touch scrolling.
let drag=null,suppressClick=false;
root.addEventListener('pointerdown',e=>{const grip=e.target.closest('[data-drag]');if(!grip||busy)return;const p=storedItem(grip.dataset.drag,grip.dataset.day);drag={p,grip,block:grip.closest('.dp-block'),y:e.clientY,start:p.start_min,visualStart:parseFloat(grip.closest('.dp-block').style.top)};grip.setPointerCapture(e.pointerId);e.preventDefault();});
root.addEventListener('pointermove',e=>{if(!drag)return;const length=drag.p.end_min-drag.p.start_min;drag.start=Math.max(0,Math.min(1440-length,Math.round((drag.p.start_min+e.clientY-drag.y)/5)*5));drag.block.style.top=(drag.visualStart+drag.start-drag.p.start_min)+'px';drag.block.classList.add('dragging');});
root.addEventListener('pointercancel',()=>{drag=null;render();});
root.addEventListener('pointerup',async()=>{
 if(!drag)return;const {p,start}=drag;drag=null;suppressClick=true;setTimeout(()=>suppressClick=false,100);
 if(start===p.start_min)return;
 const patch={...(p.override?.patch||{}),start_min:start,end_min:start+p.end_min-p.start_min};
 const hit=conflicts(calendarItems(data.templates,data.occurrences,p.date,p.timezone),{...p,...patch});
 if(hit.length&&!confirm('Vaqt to‘qnashuvi: '+hit.map(i=>i.title).join(', ')+'. Ko‘chirasizmi?')){render();return;}
 await mutate(()=>cloud().dailyRpc('burgut_daily_occurrence',{item:{template_id:p.id,date:p.date,status:p.status,patch,cancelled:false},expected_revision:p.occurrence_revision}));render();
});
root.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}},true);
async function enableNotifications(){
 try{
  if(!('Notification'in window)||!('serviceWorker'in navigator))throw Error('Bu brauzer eslatmalarni qo‘llamaydi');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Eslatmalar uchun brauzer ruxsati berilmadi');
  const r=await fetch('/api/daily-push-config'),cfg=await r.json();
  if(!r.ok||!cfg.publicKey){message('Sahifa ochiq paytda eslatmalar yoqildi. Yopiq paytdagi push xizmati serverda hali sozlanmagan.');return;}
  const reg=await navigator.serviceWorker.ready;
  const padding='='.repeat((4-cfg.publicKey.length%4)%4),raw=atob((cfg.publicKey+padding).replace(/-/g,'+').replace(/_/g,'/'));
  const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});
  try{await cloud().dailyRpc('burgut_daily_subscribe',{subscription:sub.toJSON()});}
  catch(error){await sub.unsubscribe();throw error;}
  message('Eslatmalar yoqildi. Yetkazish brauzer va qurilma bildirishnoma sozlamalariga bog‘liq.');
 }catch(e){message(e.message);}
}
async function tick(){
 if(active()&&!document.querySelector('#daily-editor[open]')&&!drag){
  const p=localParts(Date.now(),zone()),line=root.querySelector('.dp-now');if(line){line.style.top=p.minute+'px';line.querySelector('span').textContent=timeLabel(p.minute);}
  const focus=root.querySelector('.dp-focus');if(focus)focus.outerHTML=focusMarkup();
  for(const b of root.querySelectorAll('.dp-block')){const i=storedItem(b.dataset.edit,b.dataset.day);const at=i&&instant(i.date,i.start_min,i.timezone),end=i&&instant(i.date,i.end_min,i.timezone);b.classList.toggle('current',Boolean(i&&at<=Date.now()&&end>Date.now()));}
 }
 if(!loaded||!('Notification'in window)||Notification.permission!=='granted')return;
 const reg=await navigator.serviceWorker?.getRegistration();if(!reg)return;
 if(await reg.pushManager?.getSubscription())return; // server push is the sole sender on subscribed devices
 for(const p of data.templates){const local=localParts(Date.now(),p.timezone);for(const d of [local.date,addDays(local.date,1)])for(const i of dayItems([p],data.occurrences,d)){
  if(i.reminder===null||['done','skipped'].includes(i.status))continue;
  const at=instant(d,i.start_min,i.timezone);if(at===null)continue;
  const due=at-i.reminder*60000,key='burgut.daily.notice.'+p.id+'.'+d+'.'+i.start_min;
  if(Date.now()>=due&&Date.now()<due+90000&&!localStorage.getItem(key)){await reg.showNotification('Kunlik reja',{body:i.title+' · '+timeLabel(i.start_min),tag:'daily-'+p.id+'|'+d+'|'+i.start_min+'|'+i.reminder,data:{url:'/#daily'},icon:'/icon-192.png'});localStorage.setItem(key,'1');}
 }}
}
window.DailyPlanner={open:()=>{if(!root.innerHTML)render();load();}};
setInterval(()=>tick().catch(()=>{}),15000);
setInterval(()=>{if((active()||('Notification'in window&&Notification.permission==='granted'))&&!document.hidden&&!document.querySelector('#daily-editor[open]')&&!drag)load();},60000);
window.addEventListener('online',()=>{if(active())load();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active())load();});
if(active())window.DailyPlanner.open();else load();
