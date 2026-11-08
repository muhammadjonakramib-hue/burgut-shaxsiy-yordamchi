import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import handler from '../netlify/functions/telegram.mjs';import {botReply} from '../services/telegram.mjs';import bank from '../services/telegram-words.json' with {type:'json'};
test('bot uses the same 1000 words; lookup and pagination do not change learning state',()=>{
 const c={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../public/words.js',import.meta.url),'utf8'),c);
 assert.equal(JSON.stringify(bank),JSON.stringify(c.window.BURGUT_WORDS));
 assert.match(botReply('/qidir university'),/universitet/);assert.match(botReply('/turkcha 2'),/2\/27/);assert.match(botReply('/start'),/natijalari ilovada/);
});
test('webhook requires secret and personal owner chat; never returns personal data',async()=>{
 const oldSecret=process.env.TELEGRAM_WEBHOOK_SECRET,oldOwner=process.env.TELEGRAM_OWNER_ID;
 process.env.TELEGRAM_WEBHOOK_SECRET='a'.repeat(64);process.env.TELEGRAM_OWNER_ID='12345';
 const request=(secret,chat='12345',type='private')=>new Request('https://local.test/.netlify/functions/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify({update_id:1,message:{text:'/start',chat:{id:Number(chat),type},from:{id:Number(chat)}}})});
 try{
  assert.equal((await handler(request('wrong'))).status,403);
  assert.equal(await (await handler(request('a'.repeat(64),'999'))).text(),'OK');
  assert.equal(await (await handler(request('a'.repeat(64),'12345','group'))).text(),'OK');
  const accepted=await (await handler(request('a'.repeat(64)))).json();assert.equal(accepted.chat_id,'12345');assert.equal(accepted.method,'sendMessage');
 }finally{if(oldSecret===undefined)delete process.env.TELEGRAM_WEBHOOK_SECRET;else process.env.TELEGRAM_WEBHOOK_SECRET=oldSecret;if(oldOwner===undefined)delete process.env.TELEGRAM_OWNER_ID;else process.env.TELEGRAM_OWNER_ID=oldOwner;}
});
