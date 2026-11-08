import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import handler from '../netlify/functions/api.mjs';
const source=fs.readFileSync(new URL('../public/cloud-sync.js',import.meta.url),'utf8');
function client(db,storage=new Map()){
  let online=true;
  const fetch=async (url,opts={})=>{
    if(!online)throw Error('offline');
    const path=new URL(url).pathname;
    const body=JSON.parse(opts.body||'{}');let result=[];
    if(path.includes('/auth/'))result={access_token:'test',expires_at:Date.now()/1000+3600};
    else if(path.endsWith('/burgut_owner'))result='same-owner';
    else if(path.endsWith('/burgut_record_save')){
      const p=body.item,k=p.kind+'|'+p.id,old=db.get(k);
      if(!old||p.updatedAt>old.updated_at)db.set(k,{...p,updated_at:p.updatedAt});
      result=null;
    }else if(path.endsWith('/burgut_records'))result=[...db.values()];
    else if(path.endsWith('/burgut_plan_save')){db.set('plan',body.item);result=null;}
    return {ok:true,json:async()=>result};
  };
  const window={BURGUT_CLOUD_CONFIG:{url:'https://example.supabase.co',anonKey:'public'}};
  vm.runInNewContext(source,{window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{},crypto:webcrypto,fetch,URL,AbortSignal,location:{origin:'https://test.invalid'}});
  return {api:window.BurgutCloud,storage,setOnline:v=>online=v};
}
test('offline expense survives reload, syncs to peer, deletion stays deleted',async()=>{
  const db=new Map(),a=client(db),b=client(db);
  a.setOnline(false);
  const {item}=await a.api.expensesApi('/api/expenses',{method:'POST',body:JSON.stringify({amount:12.5,currency:'TRY',date:'2026-11-02'})});
  await a.api.pull();
  assert.equal(a.api.pending().length,1);
  assert.ok(a.storage.get('burgut.cloud.outbox.v2').includes(item.id));
  const reloaded=client(db,a.storage);await reloaded.api.pull();
  assert.equal(reloaded.api.pending().length,0);a.setOnline(true);
  assert.equal((await b.api.expensesApi('/api/expenses')).items[0].amount,12.5);
  await new Promise(r=>setTimeout(r,5));
  await b.api.expensesApi('/api/expenses?id='+item.id,{method:'DELETE',body:JSON.stringify(item)});
  await b.api.pull();
  assert.equal((await a.api.expensesApi('/api/expenses')).items.length,0);
  assert.equal([...db.values()][0].deleted,true);
});
test('unknown queued events remain visible instead of being discarded',async()=>{
  const c=client(new Map());
  c.storage.set('burgut.cloud.outbox.v2',JSON.stringify([{type:'unsupported',id:'keep-me'}]));
  await c.api.pull();assert.equal(c.api.pending().length,1);assert.ok(c.api.status().error);
});
test('plan deletion accepts removed cached item and offline vocab is durable',async()=>{
  const db=new Map(),c=client(db);
  await c.api.plansApi('/api/plans?id=12345678',{method:'DELETE',body:JSON.stringify({id:'12345678',title:'Study',date:'2026-11-02'})});
  await c.api.pull();assert.equal(db.get('plan').deleted,true);
  c.setOnline(false);
  const result=await c.api.vocabApi({method:'PATCH',body:JSON.stringify({keys:['en|learn'],learned:true})});
  assert.ok(result.learned['en|learn']);await c.api.pull();assert.equal(c.api.pending().length,1);
});
test('function routing returns config and rejects unsupported methods/routes',async()=>{
  assert.equal((await handler(new Request('https://test.invalid/api/config'))).status,200);
  assert.equal((await handler(new Request('https://test.invalid/api/missing'))).status,404);
  assert.equal((await handler(new Request('https://test.invalid/api/config',{method:'POST'}))).status,405);
});
