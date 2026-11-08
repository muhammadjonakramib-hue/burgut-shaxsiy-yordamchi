import {selectPronunciation} from './pronunciation-core.mjs';
const tasks=new Map(),cache=new Map();let current=0,audio=null;
const bundled=fetch('/pronunciation-data.json').then(r=>r.ok?r.json():null).then(data=>{for(const [key,value]of Object.entries(data?.words||{}))if(!cache.has(key))cache.set(key,{at:Date.now(),data:value});}).catch(()=>{});
try{for(const [k,v] of Object.entries(JSON.parse(localStorage.getItem('burgut.audio.gb.v1')||'{}')))if(Date.now()-v.at<7*86400000)cache.set(k,v);}catch{}
function display(word,result){
 for(const el of document.querySelectorAll('[data-pronunciation-for]'))if(el.dataset.pronunciationFor.toLowerCase()===word){
  el.textContent=result?.phonetic?result.phonetic+(result.accent==='en-GB'?' · UK':' · lug‘at IPA'):'IPA manbada topilmadi';
  el.title=result?.accent==='unspecified'?'Manba bu IPA uchun aksentni aniq belgilamagan':'';
 }
}
export async function lookup(text){
 await bundled;
 const word=text.trim().toLowerCase();if(!/^[a-z][a-z' -]{0,60}$/.test(word))return null;
 if(cache.has(word)){display(word,cache.get(word).data);return cache.get(word).data;}
 if(navigator.onLine===false){display(word,null);return null;}
 if(tasks.has(word))return tasks.get(word);
 const task=(async()=>{
  let result=null;
  try{const r=await fetch('/api/pronunciation?word='+encodeURIComponent(word),{signal:AbortSignal.timeout(9000)});if(r.ok){const d=await r.json();if(d.word===word&&['en-GB','unspecified'].includes(d.accent)&&(d.audio||d.phonetic))result=d;}}catch{}
  if(!result)try{const r=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(word),{signal:AbortSignal.timeout(7000)});if(r.ok)result=selectPronunciation(await r.json(),word);}catch{}
  if(result&&(result.audio||result.phonetic)){cache.set(word,{at:Date.now(),data:result});try{localStorage.setItem('burgut.audio.gb.v1',JSON.stringify(Object.fromEntries([...cache].slice(-600))));}catch{}}
  display(word,result);return result;
 })().finally(()=>tasks.delete(word));tasks.set(word,task);return task;
}
const notify=text=>{let el=document.getElementById('word-audio-status');if(!el){el=document.createElement('p');el.id='word-audio-status';el.setAttribute('role','status');document.getElementById('view-words').append(el);}el.textContent=text;};
async function voices(){
 const synth=window.speechSynthesis;if(!synth)return [];
 if(synth.getVoices().length)return synth.getVoices();
 await new Promise(resolve=>{const end=()=>{synth.removeEventListener('voiceschanged',end);resolve();};synth.addEventListener('voiceschanged',end,{once:true});setTimeout(end,1200);});return synth.getVoices();
}
export async function speak(text,lang){
 if(lang!=='en')return;
 const id=++current;audio?.pause();window.speechSynthesis?.cancel();notify('Talaffuz yuklanmoqda…');
 const result=await lookup(text);if(id!==current)return;
 if(result?.audio){
  try{const playing=new Audio(result.audio);audio=playing;playing.volume=1;
   await Promise.race([playing.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),8000))]);
   if(id!==current){playing.pause();return;}notify('British English · lug‘at audiosi');
   if(result.source?.startsWith('https://')){const credit=document.createElement('a');credit.href=result.source;credit.target='_blank';credit.rel='noopener noreferrer';credit.textContent=' · Audio manbasi'+(result.license?.name?' ('+result.license.name+')':'');document.getElementById('word-audio-status').append(credit);}
   playing.onerror=()=>{if(id===current)tts(text,id);};return;
  }catch{if(id!==current)return;audio?.pause();}
 }
 await tts(text,id);
}
async function tts(text,id){
 const list=await voices();if(id!==current)return;
 const voice=list.filter(v=>/^en[-_]GB$/i.test(v.lang)&&(navigator.onLine!==false||v.localService===true)).sort((a,b)=>Number(/natural|online/i.test(b.name))-Number(/natural|online/i.test(a.name)))[0];
 if(!voice){notify('Britaniya ovozi bu qurilmada yo‘q. Qurilma til sozlamasidan English (United Kingdom) ovozini o‘rnating.');return;}
 const utter=new SpeechSynthesisUtterance(text);utter.lang='en-GB';utter.voice=voice;utter.rate=.9;utter.volume=1;
 utter.onerror=()=>{if(id===current)notify('Ovoz ijro etilmadi. Qayta bosing.');};window.speechSynthesis.speak(utter);notify('British English · qurilma ovozi');
}
let scanTimer;
const scan=()=>{clearTimeout(scanTimer);scanTimer=setTimeout(async()=>{
 const root=document.getElementById('view-words');if(!root?.classList.contains('on'))return;
 const words=[...new Set([...root.querySelectorAll('[data-pronunciation-for]')].map(el=>el.dataset.pronunciationFor))];
 let at=0;await Promise.all(Array.from({length:Math.min(3,words.length)},async()=>{while(at<words.length){const w=words[at++];await lookup(w);}}));
},100);};
new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1)))scan();}).observe(document.getElementById('view-words'),{childList:true});
window.BurgutAudio={lookup,speak,peek:word=>cache.get(String(word).toLowerCase())?.data||{}};scan();
