import {t} from './i18n.js';
import {toast} from './common.js';
const button=document.querySelector('#app-fullscreen');
const enter='<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>';
const exit='<path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5"/>';
function update(){
 const active=Boolean(document.fullscreenElement||document.webkitFullscreenElement);
 const label=t(active?'exitFullscreen':'enterFullscreen');
 button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',label);button.title=label;
 button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${active?exit:enter}</svg>`;
}
button.addEventListener('click',async()=>{
 try{
  if(document.fullscreenElement||document.webkitFullscreenElement){
   const leave=document.exitFullscreen||document.webkitExitFullscreen;
   if(leave)await leave.call(document);
  }else{
   const request=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
   if(!request){toast(t('fullscreenUnavailable'),'error');return;}
   await request.call(document.documentElement,{navigationUI:'hide'});
  }
 }catch{toast(t('fullscreenUnavailable'),'error');}
 update();
});
document.addEventListener('fullscreenchange',update);document.addEventListener('webkitfullscreenchange',update);update();
