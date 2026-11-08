(() => {
 let current=null,work=null;
 const key=()=> 'burgut.tr.batch.'+(window.BurgutCloud?.status().userId||'unknown');
 const get=()=>{try{return JSON.parse(localStorage.getItem(key()));}catch{return null;}};
 const history=()=>{try{return JSON.parse(localStorage.getItem(key()+'.history'))||{};}catch{return {};}};
 function save(batch){const batches=history();batches[batch.date]=batch;localStorage.setItem(key()+'.history',JSON.stringify(batches));localStorage.setItem(key(),JSON.stringify(batch));current=batch;}
 function localBatch(bank,cards,learned,date){
  const previous=history()[date]||(get()?.date===date?get():null);
  if(previous){current=previous;return previous;}
  const used=new Set(Object.values(history()).filter(b=>b.date<date).flatMap(b=>b.words));
  const level=course(bank,learned);
  const words=bank.filter(w=>w.lvl===level&&w.levelSource&&!cards['tr|'+w.w]&&!learned['tr|'+w.w]&&!used.has('tr|'+w.w)).slice(0,5).map(w=>'tr|'+w.w);
  const batch={date,words,level,offline:true};save(batch);return batch;
 }
 function course(bank,learned){
  const b1=bank.filter(w=>w.lvl==='B1'&&w.levelSource);
  const unlocked=(current||get())?.level==='B2';
  return unlocked||(b1.length>0&&b1.every(w=>Boolean(learned['tr|'+w.w])))?'B2':'B1';
 }
 function daily(bank,cards,learned,date){
  const batch=current?.date===date?current:get();
  const selected=batch?.date===date?batch:localBatch(bank,cards,learned,date);
  return selected.words.map(k=>bank.find(w=>'tr|'+w.w===k)).filter(Boolean);
 }
 async function sync(bank,cards,learned,date){
  if(work)return work;
  work=(async()=>{
   const remoteLevel=await window.BurgutCloud.wordCourse();
   const level=remoteLevel==='B2'?'B2':course(bank,learned),saved=get();
   const keys=saved?.date===date?saved.words:bank.filter(w=>w.lvl===level&&w.levelSource&&!cards['tr|'+w.w]&&!learned['tr|'+w.w]).slice(0,5).map(w=>'tr|'+w.w);
   const batch=await window.BurgutCloud.wordBatch(date,keys,level);
   save(batch);
  })().finally(()=>work=null);return work;
 }
 const label=(bank,learned)=>`${(current||get())?.level||course(bank,learned)} · kuniga 5 tagacha yangi so‘z · manbasi tekshirilgan`;
 window.BurgutLevels={daily,sync,label,course};
})();
