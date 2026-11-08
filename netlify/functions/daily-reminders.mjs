import webpush from 'web-push';
import {dayItems,localParts,addDays,instant,timeLabel} from '../../public/planner-core.mjs';
export const config={schedule:'* * * * *'};
export function validPushEndpoint(endpoint){
 try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname));}catch{return false;}
}
export default async()=>{
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY,VAPID_SUBJECT}=process.env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY||!VAPID_SUBJECT){console.log('Daily push not configured');return;}
 webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
 const request=async(path,options={})=>{
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{...options,headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(7000)});
  if(!r.ok)throw Error('Push database request failed: '+r.status);return r.status===204?null:r.json();
 };
 const pages=async(table,order)=>{let result=[];for(let offset=0;;offset+=500){const p=await request(table+'?select=*&order='+order+'&limit=500&offset='+offset);result.push(...p);if(p.length<500)return result;}};
 const [subscriptions,templates,overrides]=await Promise.all([pages('burgut_daily_push','id.asc'),pages('burgut_daily_templates','id.asc'),pages('burgut_daily_occurrences','user_id.asc,template_id.asc,date.asc')]);
 const now=Date.now();let sent=0;
 for(const sub of subscriptions){
  if(!validPushEndpoint(sub.endpoint))continue;
  for(const p of templates.filter(t=>t.user_id===sub.user_id)){
   if(Date.now()-now>20000)return;
   const date=localParts(now,p.timezone).date;
   for(const d of [addDays(date,-1),date,addDays(date,1)])for(const i of dayItems([p],overrides.filter(o=>o.user_id===sub.user_id),d)){
    if(i.reminder===null||['done','skipped'].includes(i.status))continue;
    const start=instant(d,i.start_min,i.timezone);if(start===null)continue;
    const due=start-i.reminder*60000;if(now<due||now>=due+5*60000)continue;
    const key=p.id+'|'+d+'|'+i.start_min+'|'+i.reminder;
    const claimed=await request('rpc/burgut_daily_claim_notice',{method:'POST',body:JSON.stringify({sub_id:sub.id,event_id:key})});if(!claimed)continue;
    try{
      await webpush.sendNotification(sub.subscription,JSON.stringify({body:i.title+' · '+timeLabel(i.start_min)+' · '+i.timezone,tag:'daily-'+key}),{TTL:300,timeout:5000});
      await request('burgut_daily_deliveries?subscription_id=eq.'+sub.id+'&event_key=eq.'+encodeURIComponent(key),{method:'PATCH',body:JSON.stringify({sent_at:new Date().toISOString()})});sent++;
    }catch(e){
      if([404,410].includes(e.statusCode))await request('burgut_daily_push?id=eq.'+sub.id,{method:'DELETE'});
      else console.error('Daily push delivery failed',e.statusCode||'network');
    }
    if(sent>=40)return;
   }
  }
 }
};
