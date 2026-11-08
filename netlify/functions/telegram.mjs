import {timingSafeEqual} from 'node:crypto';
import {botReply} from '../../services/telegram.mjs';
export default async function handler(request){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=process.env.TELEGRAM_WEBHOOK_SECRET||'',owner=process.env.TELEGRAM_OWNER_ID||'';
 if(secret.length<32||!/^\d+$/.test(owner))return new Response('Bot hali sozlanmagan',{status:503});
 const provided=request.headers.get('X-Telegram-Bot-Api-Secret-Token')||'';
 if(Buffer.byteLength(secret)!==Buffer.byteLength(provided)||!timingSafeEqual(Buffer.from(secret),Buffer.from(provided)))return new Response('Forbidden',{status:403});
 if(Number(request.headers.get('Content-Length'))>32768)return new Response('Too large',{status:413});
 const raw=await request.text();if(raw.length>32768)return new Response('Too large',{status:413});
 let update;try{update=JSON.parse(raw);}catch{return new Response('Invalid JSON',{status:400});}
 const message=update.message;
 if(!Number.isSafeInteger(update.update_id)||message?.chat?.type!=='private'||String(message.chat.id)!==owner||String(message.from?.id)!==owner||message.from?.is_bot||typeof message.text!=='string')return new Response('OK');
 // Telegram supports executing sendMessage in the webhook response. No Auth,
 // learning RPC or personal data is accessed by this dictionary-only handler.
 return Response.json({method:'sendMessage',chat_id:owner,text:botReply(message.text),link_preview_options:{is_disabled:true},reply_markup:{keyboard:[[{text:'/turkcha 1'},{text:'/inglizcha 1'}],[{text:'/sayt'},{text:'/yordam'}]],resize_keyboard:true}});
}
