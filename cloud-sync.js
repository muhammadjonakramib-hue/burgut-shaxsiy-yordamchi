(() => {
  let SESSION = 'burgut.supabase.session';
  const CONFIG = 'burgut.cloud.config';
  const QUEUE = 'burgut.cloud.outbox.v2';
  let cfg, authWork, syncWork;
  const state = {configured:false, connected:false, error:null, userId:null, pending:0};
  const read = (key, fallback=null) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}};
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  async function config() {
    if (cfg) return cfg;
    cfg = read(CONFIG);
    const supplied=window.BURGUT_CLOUD_CONFIG;
    if(supplied?.url && supplied?.anonKey){
      const previous=cfg;
      if(previous?.url && previous.url!==supplied.url)write(CONFIG+'.previous',previous);
      cfg={url:supplied.url,anonKey:supplied.anonKey};
      SESSION='burgut.supabase.session.'+new URL(cfg.url).hostname;
      // Leave old credentials untouched; only reuse a legacy session for this project.
      if(!read(SESSION) && previous?.url===cfg.url){
        const legacy=read('burgut.supabase.session');
        if(legacy?.access_token)write(SESSION,legacy);
      }
      write(CONFIG,cfg);
    }
    if (!cfg) {
      try {const r=await fetch('/api/supabase-config',{signal:AbortSignal.timeout(5000)}); const value=await r.json(); if(value.configured)cfg=value;} catch {}
    }
    state.configured=Boolean(cfg?.url && cfg?.anonKey);
    return cfg;
  }
  async function configure(url, anonKey) {
    const parsed=new URL(url);
    if(parsed.protocol!=='https:' || !parsed.hostname.endsWith('.supabase.co'))throw Error('Supabase HTTPS manzilini kiriting');
    if(!anonKey.trim())throw Error('Public kalit kerak');
    if(read(SESSION) && cfg?.url && cfg.url!==parsed.origin)throw Error('Mavjud hisob loyihasini almashtirib bo‘lmaydi');
    cfg={url:parsed.origin,anonKey:anonKey.trim()};write(CONFIG,cfg);state.configured=true;
    return ready();
  }
  async function auth() {
    if(authWork)return authWork;
    const run=async()=>{
      await config(); if(!state.configured)throw Error('Bulut hali sozlanmagan');
      const current=read(SESSION);
      if(current?.access_token && current.expires_at*1000>Date.now()+60000)return current;
      const refresh=current?.refresh_token;
      const r=await fetch(cfg.url+(refresh?'/auth/v1/token?grant_type=refresh_token':'/auth/v1/signup'),{
        method:'POST',headers:{apikey:cfg.anonKey,'Content-Type':'application/json'},
        body:JSON.stringify(refresh?{refresh_token:refresh}:{}),signal:AbortSignal.timeout(12000)
      });
      const data=await r.json();
      if(!r.ok || !data.access_token)throw Error(data.msg||data.error_description||'Anonymous sign-in yoqilganini tekshiring');
      data.expires_at ||= Math.floor(Date.now()/1000)+(data.expires_in||3600);
      write(SESSION,data);return data;
    };
    authWork=(navigator.locks?navigator.locks.request('burgut-auth',run):run()).finally(()=>{authWork=null;});
    return authWork;
  }
  async function request(path, options={}) {
    const session=await auth();
    const r=await fetch(cfg.url+path,{...options,headers:{apikey:cfg.anonKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
    const data=await r.json().catch(()=>null);
    if(!r.ok)throw Error(data?.message||data?.error_description||'Bulut bilan aloqa uzildi');
    return data;
  }
  const rpc=(name,body={})=>request('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body)});
  async function ready() {
    try {
      await config();
      if(state.configured){state.userId=await rpc('burgut_owner');state.connected=true;state.error=null;}
    }catch(e){state.connected=false;state.error=e.message;}
    state.pending=read(QUEUE,[]).length;return {...state};
  }
  function enqueue(event) {
    const q=read(QUEUE,[]);
    if(!q.some(e=>e.id===event.id)){q.push(event);write(QUEUE,q);}
    state.pending=q.length;
  }
  async function flush() {
    if(syncWork)return syncWork;
    syncWork=(async()=>{
      try{
        await ready();if(!state.connected)return;
        let uploadError=null;
        for(const e of read(QUEUE,[])) {
          try {
          if(e.type==='review')await rpc('burgut_review',{event_id:e.id,word_key:e.key,rating:e.rating,reviewed_at:e.at});
          else if(e.type==='plan')await rpc('burgut_plan_save',{item:e.item});
          else if(e.type==='record')await rpc('burgut_record_save',{item:e.item});
          else if(e.type==='budget')await request('/rest/v1/budgets?on_conflict=user_id,month,currency',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:state.userId,month:e.month+'-01',currency:e.currency,spending_limit:e.limit,income:e.income,updated_at:e.at})});
          else throw Error('Noma’lum sinxronlash yozuvi');
          write(QUEUE,read(QUEUE,[]).filter(item=>item.id!==e.id));
          } catch(error) {uploadError=error.message;}
        }
        state.error=uploadError;
      }catch(e){state.error=e.message;state.connected=false;}
      state.pending=read(QUEUE,[]).length;
    })().finally(()=>{syncWork=null;});return syncWork;
  }
  async function pushReview(review,card) {
    enqueue({type:'review',id:review.id,key:review.key,rating:review.rating,at:review.at||card?.lastReviewedAt||new Date().toISOString()});
    await flush();
  }
  async function pushBudget(month,currency,budget) {
    enqueue({type:'budget',id:crypto.randomUUID(),month,currency,...budget,at:new Date().toISOString()});await flush();
  }
  async function rows(table, fields) {
    const out=[];
    const order={vocab_reviews:'reviewed_at.asc,id.asc',vocab_cards:'word_key.asc',budgets:'month.asc,currency.asc',burgut_plans:'id.asc',burgut_records:'kind.asc,id.asc'}[table];
    for(let offset=0;;offset+=500){const page=await request('/rest/v1/'+table+'?select='+fields+'&order='+order+'&limit=500&offset='+offset);out.push(...page);if(page.length<500)return out;}
  }
  async function pull() {
    await flush();if(!state.connected)return null;
    const [cards,budgets,reviews]=await Promise.all([rows('vocab_cards','*'),rows('budgets','*'),rows('vocab_reviews','id,word_key,rating,reviewed_at')]);
    return {cards,budgets,reviews};
  }
  async function createPair() {
    await flush();if(!state.connected)throw Error(state.error||'Avval bulutni sozlang');
    return rpc('burgut_pair_create');
  }
  async function plansApi(path,options={}) {
    const method=options.method||'GET';
    const saved=read('burgut.plans',[]);
    if(method==='GET'){
      await flush();
      if(!state.connected)throw Error(state.error||'Rejalar qurilmada saqlangan');
      const remote=await rows('burgut_plans','*');
      const merged=new Map(remote.map(p=>[p.id,{...p,date:p.date||'',time:p.time?.slice(0,5)||'',doneAt:p.done_at,createdAt:p.created_at,updatedAt:p.updated_at}]));
      // Preserve local-only rows until the user migrates them, including offline writes.
      for(const p of saved)if(!merged.has(p.id)){
        merged.set(p.id,p);
        if(!read(QUEUE,[]).some(e=>e.type==='plan'&&e.item.id===p.id))enqueue({type:'plan',id:crypto.randomUUID(),item:{...p,updatedAt:p.updatedAt||new Date().toISOString()}});
      }
      for(const e of read(QUEUE,[]).filter(e=>e.type==='plan'))merged.set(e.item.id,e.item);
      return {items:[...merged.values()].filter(p=>!p.deleted)};
    }
    const body=JSON.parse(options.body||'{}');
    const now=new Date().toISOString();
    const id=method==='POST'?(body.id||crypto.randomUUID()):body.id||new URL(path,location.origin).searchParams.get('id');
    const old=saved.find(p=>p.id===id) || (method==='DELETE'?body:null);
    if(method!=='POST'&&!old)throw Error('Reja topilmadi');
    const item={...(old||{id,createdAt:now,done:false,doneAt:null}),...body,id,updatedAt:now,deleted:method==='DELETE'};
    if('done' in body)item.doneAt=body.done?now:null;
    enqueue({type:'plan',id:crypto.randomUUID(),item});
    // Queue is durable before a network request; background retries retain failed writes.
    void flush();
    return {item,ok:true};
  }

  async function saveRecord(kind,id,data,deleted=false) {
    const item={kind,id,data,deleted,updatedAt:new Date().toISOString()};
    enqueue({type:'record',id:crypto.randomUUID(),item});
    void flush();
    return item;
  }
  async function records() {
    await flush();
    if(!state.connected)throw Error(state.error||'Internet ulanishi kerak');
    const remote=await rows('burgut_records','*');
    const merged=new Map(remote.map(r=>[r.kind+'|'+r.id,r]));
    for(const e of read(QUEUE,[]).filter(e=>e.type==='record'))merged.set(e.item.kind+'|'+e.item.id,e.item);
    // Import existing browser data once; remote tombstones always win.
    const imported='burgut.records.imported.'+state.userId;
    if(!read(imported,false)){
      const local=[...read('burgut.expenses',[]).map(p=>({kind:'expense',id:p.id,data:p})),
        ...['vocab','todo'].flatMap(kind=>Object.entries(read('burgut.'+kind,{})).map(([id,value])=>({kind,id,data:{value}})))];
      for(const r of local)if(!merged.has(r.kind+'|'+r.id)){
        const item=await saveRecord(r.kind,r.id,r.data);
        merged.set(r.kind+'|'+r.id,item);
      }
      write(imported,true);
    }
    return [...merged.values()];
  }
  async function expensesApi(path,options={}) {
    const method=options.method||'GET';
    if(method==='GET')return {items:(await records()).filter(r=>r.kind==='expense'&&!r.deleted).map(r=>({...r.data,id:r.id}))};
    const body=JSON.parse(options.body||'{}');
    if(method==='DELETE'){
      const id=new URL(path,location.origin).searchParams.get('id');
      await saveRecord('expense',id,body,true);return {ok:true};
    }
    if(!Number.isFinite(body.amount)||body.amount<=0||!['TRY','USD'].includes(body.currency))throw Error('Summa yoki valyuta noto‘g‘ri');
    const item={...body,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
    await saveRecord('expense',item.id,item);return {item};
  }
  async function vocabApi(options={}) {
    const learned=read('burgut.vocab',{});
    if(options.method==='PATCH'){
      const body=JSON.parse(options.body||'{}');
      for(const key of body.keys||[]){
        const value=new Date().toISOString();
        await saveRecord('vocab',key,{value},!body.learned);
        if(body.learned)learned[key]=value;else delete learned[key];
      }
      return {learned};
    }
    for(const r of await records())if(r.kind==='vocab'){if(r.deleted)delete learned[r.id];else learned[r.id]=r.data.value;}
    return {learned};
  }
  async function claimPair(code) {
    if(read('burgut.plans',[]).length || read('burgut.expenses',[]).length)throw Error('Ulashni rejalari yo‘q yangi qurilmada bajaring');
    if(read(QUEUE,[]).length || read('burgut.reviewQueue',[]).length)throw Error('Bu qurilmadagi javoblarni avval sinxronlang');
    if(!/^[a-f0-9-]{36}$/i.test(code.trim()))throw Error('Ulash kodi noto‘g‘ri');
    state.userId=await rpc('burgut_pair_claim',{pair_code:code.trim()});return pull();
  }
  window.BurgutCloud={saveRecord,records,expensesApi,vocabApi,ready,configure,pull,pushReview,pushBudget,createPair,claimPair,plansApi,pending:()=>read(QUEUE,[]),status:()=>({...state})};
})();
