(() => {
 let ready=false,checking=false,installPrompt=null;
 const count=()=>Object.values(window.BURGUT_WORDS||{}).reduce((n,items)=>n+items.length,0);
 function render(){
  for(const el of document.querySelectorAll('[data-offline-status]')){
   el.textContent=(navigator.onLine?'Internet bor. ':'Oflayn. ')+(ready?`${count()} ta so‘z qurilmaga yuklangan. Test javoblari internet qaytganda yuboriladi.`:'Oflayn nusxa hali tasdiqlanmagan. Internet bilan ochib, «Oflayn tayyorlash»ni bosing.');
  }
 }
 async function check(){
  if(checking||!('serviceWorker' in navigator))return;
  checking=true;
  try{
   const registration=await navigator.serviceWorker.getRegistration();
   if(!registration?.active){ready=false;return;}
   ready=await new Promise(resolve=>{
    const channel=new MessageChannel(),timer=setTimeout(()=>resolve(false),4000);
    channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.ready===true);};
    registration.active.postMessage({type:'BURGUT_OFFLINE_CHECK'},[channel.port2]);
   });
  }catch{ready=false;}finally{checking=false;render();}
 }
 async function prepare(button){
  button.disabled=true;
  try{
   if(!('serviceWorker' in navigator))throw Error('Bu brauzer oflayn ilovani qo‘llamaydi. HTTPS manzilidan oching.');
   if(!navigator.onLine)throw Error('Birinchi yuklash uchun internetni yoqing.');
   const registration=await navigator.serviceWorker.register('./sw.js');
   await registration.update();
   await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Yuklash tugamadi. Internetni tekshirib qayta urinib ko‘ring.')),20000))]);
   await check();
   if(!ready)throw Error('Oflayn fayllar hali to‘liq yuklanmagan. Bir ozdan so‘ng qayta tekshiring.');
   await navigator.storage?.persist?.();
   if(installPrompt){await installPrompt.prompt();installPrompt=null;}
   else alert('Oflayn nusxa tayyor. Telefon brauzeri menyusidan «Bosh ekranga qo‘shish»ni tanlang. Brauzer ma’lumotlarini o‘chirsangiz, nusxa va yuborilmagan javoblar ham o‘chadi.');
  }catch(error){alert(error.message);}finally{button.disabled=false;render();}
 }
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
 window.addEventListener('online',check);window.addEventListener('offline',render);
 navigator.serviceWorker?.addEventListener('controllerchange',check);
 document.addEventListener('click',event=>{const button=event.target.closest('[data-offline-prepare]');if(button)prepare(button);});
 new MutationObserver(render).observe(document.getElementById('main'),{childList:true,subtree:false});
 // Only watch section replacements, never changes to status text itself.
 for(const section of document.querySelectorAll('.view'))new MutationObserver(render).observe(section,{childList:true});
 window.BurgutOffline={check,ready:()=>ready};check();
})();
