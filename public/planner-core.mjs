export const categories={study:'O‘qish',reading:'Kitob o‘qish',work:'Ish',sport:'Sport',rest:'Dam olish',personal:'Shaxsiy',other:'Boshqa'};
export const statuses={pending:'Bajarilmadi',progress:'Jarayonda',done:'Bajarildi',skipped:'O‘tkazib yuborildi'};
export const addDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export const weekday=date=>new Date(date+'T12:00:00Z').getUTCDay();
export const monday=date=>addDays(date,-((weekday(date)+6)%7));
export const timeLabel=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
const formatters=new Map(),instantCache=new Map();
export function localParts(now=Date.now(),zone='Asia/Tashkent'){
  if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
  const p=Object.fromEntries(formatters.get(zone).formatToParts(now).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};
}
export function instant(date,minute,zone){
  const key=date+'|'+minute+'|'+zone;if(instantCache.has(key))return instantCache.get(key);
  const target=Date.parse(date+'T00:00:00Z')+minute*60000;let value=target;
  for(let i=0;i<4;i++){
    const p=localParts(value,zone),actual=Date.parse(p.date+'T00:00:00Z')+p.minute*60000;
    if(actual===target){if(instantCache.size>5000)instantCache.clear();instantCache.set(key,value);return value;}
    value+=target-actual;
  }
  return null; // Nonexistent clock time at a daylight-saving transition.
}
export function occurs(p,date){
  if(p.archived||date<p.start_date||(p.until_date&&date>p.until_date))return false;
  return p.repeat==='daily'||(p.repeat==='weekly'&&p.weekdays.includes(weekday(date)))||(p.repeat==='once'&&date===p.start_date);
}
export function dayItems(templates,overrides,date){
  const index=new Map(overrides.filter(o=>o.date===date).map(o=>[o.template_id,o]));
  return templates.filter(p=>occurs(p,date)).map(p=>{
    const o=index.get(p.id);
    return {...p,...(o?.patch||{}),template_id:p.id,date,status:o?.status||'pending',cancelled:o?.cancelled||false,occurrence_revision:o?.revision||0,override:o};
  }).filter(p=>!p.cancelled).sort((a,b)=>a.start_min-b.start_min||a.id.localeCompare(b.id));
}
export function conflicts(items,item){return items.filter(p=>p.id!==item.id&&item.start_min<p.end_min&&item.end_min>p.start_min);}
export function calendarItems(templates,overrides,date,zone){
 const out=[],dayStart=instant(date,0,zone),dayEnd=instant(addDays(date,1),0,zone);
 for(const p of templates)for(let shift=-2;shift<=2;shift++){
  for(const i of dayItems([p],overrides,addDays(date,shift))){
   const start=instant(i.date,i.start_min,p.timezone),end=instant(i.date,i.end_min,p.timezone);
   if(start===null||end===null||start>=dayEnd||end<=dayStart)continue;
   const a=localParts(start,zone),b=localParts(end,zone);
   out.push({...i,source_date:i.date,display_date:date,original_start:i.start_min,original_end:i.end_min,
    start_min:a.date<date?0:a.minute,end_min:b.date>date?1440:b.minute,
    scheduled_minutes:Math.round((Math.min(dayEnd,end)-Math.max(dayStart,start))/60000),instant_start:start,instant_end:end});
  }
 }
 return out.sort((a,b)=>a.start_min-b.start_min||a.id.localeCompare(b.id));
}
export function summary(items){
  const done=items.filter(p=>p.status==='done');
  const byCategory={};for(const p of done)byCategory[p.category]=(byCategory[p.category]||0)+(p.scheduled_minutes??(p.end_min-p.start_min));
  return {total:items.length,done:done.length,missed:items.filter(p=>p.status==='pending').length,percent:items.length?Math.round(done.length/items.length*100):0,byCategory};
}
export function streak(templates,overrides,today,zone){
  let cursor=today,count=0;
  const good=d=>{const s=summary(zone?calendarItems(templates,overrides,d,zone):dayItems(templates,overrides,d));return s.total>0&&s.done===s.total;};
  if(!good(cursor))cursor=addDays(cursor,-1);
  const first=templates.reduce((a,p)=>p.start_date<a?p.start_date:a,today);
  while(cursor>=first&&good(cursor)){count++;cursor=addDays(cursor,-1);}return count;
}
export function lanes(items){
  const result=[];let group=[],ends=[];
  const flush=()=>{for(const p of group)p.columns=ends.length;result.push(...group);group=[];ends=[];};
  for(const item of items){
    if(group.length&&item.start_min>=Math.max(...ends))flush();
    let lane=ends.findIndex(end=>end<=item.start_min);if(lane<0)lane=ends.length;
    ends[lane]=item.end_min;group.push({...item,lane});
  }
  flush();return result;
}
export function validate(item){
  if(!item.title?.trim()||item.title.length>160)throw Error('Faoliyat nomini kiriting (160 belgigacha)');
  if(!Number.isInteger(item.start_min)||!Number.isInteger(item.end_min)||item.start_min<0||item.end_min>1440||item.start_min>=item.end_min)throw Error('Tugash vaqti boshlanishdan keyin bo‘lsin. Yarim tundan o‘tuvchi rejani ikki kunga ajrating.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(item.start_date))throw Error('Sanani tanlang');
  if(item.repeat==='weekly'&&!item.weekdays.length)throw Error('Haftadan kamida bitta kunni tanlang');
  if(!/^#[0-9a-f]{6}$/i.test(item.color))throw Error('Rang noto‘g‘ri');
  if(instant(item.start_date,item.start_min,item.timezone)===null)throw Error('Bu vaqt soat almashinuvi sabab mavjud emas');
  return item;
}
