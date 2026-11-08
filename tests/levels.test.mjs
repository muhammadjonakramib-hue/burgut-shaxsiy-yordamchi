import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('only verified unstudied B1 words are fresh, batch is stable, B2 unlock leaves review data untouched',async()=>{
 const bank=[...Array.from({length:8},(_,i)=>({w:'b1-'+i,lvl:'B1',levelSource:{page:22}})),{w:'unknown',lvl:'B1'},{w:'advanced',lvl:'B2',levelSource:{page:58}}];
 let stored=null,remoteLevel='B1';const storage=new Map();const c={window:{BurgutCloud:{status:()=>({userId:'owner'}),wordCourse:async()=>remoteLevel,wordBatch:async(date,words,level)=>stored?.date===date?stored:(stored={date,words,level})}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(fs.readFileSync(new URL('../public/word-levels.js',import.meta.url),'utf8'),c);
 const api=c.window.BurgutLevels,cards={'tr|b1-0':{dueAt:'2027-01-01',attempts:3}},before=JSON.stringify(cards);
 await api.sync(bank,cards,{},'2026-11-05');const first=api.daily(bank,cards,{},'2026-11-05').map(x=>x.w);
 assert.equal(first.length,5);assert.ok(!first.includes('b1-0'));assert.ok(!first.includes('unknown'));assert.ok(!first.includes('advanced'));
 await api.sync(bank,{...cards,'tr|b1-1':{}},{},'2026-11-05');assert.deepEqual(api.daily(bank,cards,{},'2026-11-05').map(x=>x.w),first);
 const learned=Object.fromEntries(bank.filter(w=>w.levelSource&&w.lvl==='B1').map(w=>['tr|'+w.w,true]));
 await api.sync(bank,cards,learned,'2026-11-06');assert.equal(api.daily(bank,cards,learned,'2026-11-06')[0].w,'advanced');assert.equal(JSON.stringify(cards),before);
 remoteLevel='B2';stored=null;await api.sync(bank,cards,{},'2026-11-07');assert.equal(api.daily(bank,cards,{},'2026-11-07')[0].w,'advanced');
});
