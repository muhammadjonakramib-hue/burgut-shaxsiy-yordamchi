import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('1000 embedded unique words; offline Turkish batches survive reload and next day without changing cards',()=>{
 const storage=new Map(),cards={'tr|existing':{dueAt:'2027-03-04',wrong:3}},before=JSON.stringify(cards);
 const create=()=>{
  const c={window:{BurgutCloud:{status:()=>({userId:'same-owner'})}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
  vm.runInNewContext(fs.readFileSync(new URL('../public/words.js',import.meta.url),'utf8'),c);
  vm.runInNewContext(fs.readFileSync(new URL('../public/word-levels.js',import.meta.url),'utf8'),c);return c.window;
 };
 const a=create(),bank=a.BURGUT_WORDS;
 assert.equal(bank.tr.length+bank.en.length,1000);
 assert.equal(new Set([...bank.tr.map(w=>'tr|'+w.w),...bank.en.map(w=>'en|'+w.w)]).size,1000);
 const first=a.BurgutLevels.daily(bank.tr,cards,{},'2026-11-08').map(w=>w.w);assert.equal(first.length,5);
 const b=create(),again=b.BurgutLevels.daily(bank.tr,cards,{},'2026-11-08').map(w=>w.w);assert.equal(JSON.stringify(first),JSON.stringify(again));
 const second=b.BurgutLevels.daily(bank.tr,cards,{},'2026-11-09').map(w=>w.w);assert.equal(second.length,5);assert.ok(second.every(w=>!first.includes(w)));
 assert.equal(JSON.stringify(cards),before);
});
