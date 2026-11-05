import { buildWeekly, weeklyToText } from '../../services/digest.mjs';
import { getFootball } from '../../services/football.mjs';
import { getPronunciation } from '../../services/pronunciation.mjs';

const cache = new Map();
const pending = new Map();
async function cached(key, ttl, fn) {
  const old=cache.get(key);
  if(old && Date.now()-old.at<ttl)return old.value;
  if(pending.has(key))return pending.get(key);
  const task=fn().then(value=>{cache.set(key,{at:Date.now(),value});return value;}).finally(()=>pending.delete(key));
  pending.set(key,task);return task;
}
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export default async function handler(request) {
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  const url=new URL(request.url);
  try {
    if(url.pathname==='/api/config')return json({app:{name:'Burgut'},farm:{name:'Shaxsiy yordamchi'},telegram:{configured:false}});
    if(url.pathname==='/api/football')return json(await cached('football',60000,()=>getFootball()));
    if(url.pathname==='/api/weekly' || url.pathname==='/api/weekly.txt'){
      const weekly=await cached('weekly',1800000,()=>buildWeekly({days:7,uzLimit:8,worldLimit:6,farm:{},now:new Date()}));
      return url.pathname.endsWith('.txt')?new Response(weeklyToText(weekly),{headers:{'Content-Type':'text/plain; charset=utf-8'}}):json(weekly);
    }
    if(url.pathname==='/api/pronunciation')return json(await getPronunciation(url.searchParams.get('word')||'') || {});
    return json({error:'Bu funksiya brauzerdagi Supabase ulanishi orqali ishlaydi'},404);
  }catch(error){return json({error:error.message||'Xizmat vaqtincha ishlamayapti'},503);}
}
export const config={path:'/api/*'};
