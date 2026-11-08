import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import vm from 'node:vm';
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),baseline=JSON.parse(fs.readFileSync(new URL('./repetition-baseline.json',import.meta.url),'utf8'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
for(const [name,expected]of Object.entries(baseline.functions))test('unchanged repetition function: '+name,()=>{const start=app.search(new RegExp('(?:async )?function '+name+'\\('));assert.notEqual(start,-1);assert.equal(hash(app.slice(start,app.indexOf('\n}',start)+2)),expected);});
for(const [name,expected]of Object.entries(baseline.sql))test('unchanged learning SQL: '+name,()=>assert.equal(hash(fs.readFileSync(new URL('../supabase/'+name,import.meta.url),'utf8')),expected));
test('new migrations do not update/delete/rebuild learning cards or reviews',()=>{
 for(const n of ['005_daily_planner.sql','006_daily_push.sql','007_device_link_and_word_batches.sql']){
 const s=fs.readFileSync(new URL('../supabase/'+n,import.meta.url),'utf8');
 assert.doesNotMatch(s,/(update|delete\s+from|insert\s+into|truncate(?:\s+table)?|drop\s+table)\s+(?:public\.)?vocab_(cards|reviews)/i);
 assert.doesNotMatch(s,/create\s+or\s+replace\s+function\s+public\.burgut_review\(/i);
 }
});
test('word bank has unique stable keys, verified levels and Turkish example translations',()=>{
 const c={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../public/words.js',import.meta.url),'utf8'),c);const bank=c.window.BURGUT_WORDS;
 for(const lang of ['tr','en'])assert.equal(new Set(bank[lang].map(w=>w.w)).size,bank[lang].length);
 for(const w of bank.tr){assert.ok(w.exUz);if(w.lvl)assert.ok(w.levelSource?.page&&w.levelSource?.url);assert.doesNotMatch(w.ex,/Uzoq|bilan qaror|qabul qildik/);}
});
