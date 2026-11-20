(() => {
 let ready=false,checking=null,installPrompt=null,preparing=false,feedback='';
 const initialController=navigator.serviceWorker?.controller;
 const count=()=>Object.values(window.BURGUT_WORDS||{}).reduce((n,items)=>n+items.length,0);
 function render(){
  for(const el of document.querySelectorAll('[data-offline-status]')){
   el.setAttribute('role','status');
   const text=feedback || (navigator.onLine?'Internet bor. ':'Oflayn. ')+(ready?`${count()} ta so‘z qurilmaga yuklangan. Internet bo‘lmasa ham yodlashingiz mumkin. Qurilmalarni ulash va reja saqlash uchun internet kerak.`:'Oflayn nusxa hali tasdiqlanmagan. Internet bilan ochib, «Oflayn tayyorlash»ni bosing.');
   if(el.textContent!==text)el.textContent=text;
  }
  for(const button of document.querySelectorAll('[data-offline-prepare]')){
   button.disabled=preparing;
   const text=preparing?'Tekshirilmoqda…':ready?'✓ Oflayn tayyor · tekshirish':'Oflayn tayyorlash';
   if(button.textContent!==text)button.textContent=text;
  }
 }
 async function check(){
  if(checking)return checking;
  if(!('serviceWorker' in navigator))return;
  checking=(async()=>{
  try{
   const registration=await navigator.serviceWorker.getRegistration();
   if(!registration?.active){ready=false;return;}
   ready=await new Promise(resolve=>{
    const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(false);},4000);
    channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.ready===true);};
    registration.active.postMessage({type:'BURGUT_OFFLINE_CHECK'},[channel.port2]);
   });
  }catch{ready=false;}finally{checking=null;render();}
  })();return checking;
 }
 async function prepare(button){
  if(preparing)return;
  preparing=true;feedback='Oflayn nusxa tekshirilmoqda…';render();
  try{
   await check();
   if(!ready){
   if(!('serviceWorker' in navigator))throw Error('Bu brauzer oflayn ilovani qo‘llamaydi. HTTPS manzilidan oching.');
   if(!navigator.onLine)throw Error('Birinchi yuklash uchun internetni yoqing.');
   const registration=await navigator.serviceWorker.register('./sw.js');
   await registration.update();
   const end=Date.now()+20000;
   do{await check();if(ready)break;await new Promise(r=>setTimeout(r,300));}while(Date.now()<end);
   if(!ready)throw Error('Oflayn fayllar hali to‘liq yuklanmagan. Bir ozdan so‘ng qayta tekshiring.');
   }
   feedback=`✓ ${count()} ta so‘z tayyor. Internetni o‘chirib ham shu brauzerda yodlashingiz mumkin. Telefon brauzeri menyusidan «Bosh ekranga qo‘shish»ni tanlang.`;
   navigator.storage?.persist?.().catch(()=>{});
   if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt().catch(()=>{});}
  }catch(error){feedback=error.message;}finally{preparing=false;render();}
 }
 function updateNotice(){
  check();
  if(!initialController||document.getElementById('burgut-update'))return;
  const bar=document.createElement('div');bar.id='burgut-update';bar.setAttribute('role','status');
  bar.style.cssText='position:fixed;top:12px;left:12px;right:12px;z-index:10000;background:#234b60;color:white;padding:14px;border-radius:14px;box-shadow:0 4px 20px #0004';
  bar.textContent='Yangi versiya tayyor. Ma’lumotlaringiz saqlanadi. ';
  const button=document.createElement('button');button.textContent='Yangilash';button.className='btn';button.onclick=()=>location.reload();bar.append(button);document.body.append(bar);
 }
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
 window.addEventListener('online',()=>{feedback='';check();navigator.serviceWorker?.getRegistration().then(r=>r?.update()).catch(()=>{});});window.addEventListener('offline',()=>{feedback='';render();});
 navigator.serviceWorker?.addEventListener('controllerchange',updateNotice);
 document.addEventListener('click',event=>{const button=event.target.closest('[data-offline-prepare]');if(button)prepare(button);});
 new MutationObserver(render).observe(document.getElementById('main'),{childList:true,subtree:false});
 // Only watch section replacements, never changes to status text itself.
 for(const section of document.querySelectorAll('.view'))new MutationObserver(render).observe(section,{childList:true});
 window.BurgutOffline={check,ready:()=>ready};check();
})();
