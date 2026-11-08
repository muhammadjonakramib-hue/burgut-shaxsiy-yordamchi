import bank from './telegram-words.json' with {type:'json'};
const normal=value=>String(value||'').normalize('NFC').toLocaleLowerCase('tr').replace(/[‘’ʻ`]/g,"'").trim();
const line=w=>`${w.w} — ${w.t}${w.ex?'\n'+w.ex:''}${w.exUz?'\n'+w.exUz:''}`;
export function botReply(text){
 const value=String(text||'').trim().slice(0,200),command=value.split(/\s/)[0].split('@')[0];
 if(['/start','/help','/yordam'].includes(command))return 'Burgut lug‘atiga xush kelibsiz!\n\n/turkcha 1 — turkcha lug‘at\n/inglizcha 1 — inglizcha lug‘at\n/qidir word — so‘z yoki o‘zbekcha ma’nosini qidirish\n/sayt — yodlash va test\n\nBu bot lug‘atni ko‘rsatadi; takrorlash jadvali va o‘quv natijalari ilovada yuritiladi. Telegram uchun internet zarur. Internetsiz foydalanish uchun saytda «Oflayn tayyorlash»ni bosing.';
 if(command==='/sayt')return 'So‘z yodlash va test: https://ornate-alfajores-5402f7.netlify.app/#words';
 if(['/turkcha','/inglizcha'].includes(command)){
  const lang=command==='/turkcha'?'tr':'en',items=bank[lang],pages=Math.ceil(items.length/5);
  const page=Math.max(1,Math.min(pages,Number(value.split(/\s+/)[1])||1));
  return `${lang==='tr'?'Turkcha':'Inglizcha'} lug‘at · ${Math.floor(page)}/${pages}\n\n`+items.slice((Math.floor(page)-1)*5,Math.floor(page)*5).map(line).join('\n\n')+`\n\nKeyingi sahifa: ${command} ${Math.min(pages,Math.floor(page)+1)}\nBu ro‘yxat takrorlash navbati emas.`;
 }
 const query=normal(command==='/qidir'?value.replace(/^\S+\s*/, ''):value);
 if(query.length<2)return 'Qidirish uchun kamida 2 harf yozing. Masalan: /qidir kitob';
 const items=[...bank.tr.map(w=>({...w,lang:'TR'})),...bank.en.map(w=>({...w,lang:'EN'}))];
 const exact=items.filter(w=>normal(w.w)===query),matches=exact.length?exact:items.filter(w=>normal(w.w).includes(query)||normal(w.t).includes(query));
 return matches.length?matches.slice(0,8).map(w=>`[${w.lang}] ${line(w)}`).join('\n\n').slice(0,3900):'Bu so‘z lug‘atda topilmadi. Boshqa so‘z yoki o‘zbekcha ma’nosini yozing.';
}
