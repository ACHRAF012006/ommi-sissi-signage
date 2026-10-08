import {observePlayerLayout} from './playerLayout.js';
import {t} from './i18n.js';
import {api,escapeHTML as esc,icon,options,toast,uuid} from './common.js';
import {PlaybackEngine} from './playbackEngine.js';
import {MediaRenderer} from './mediaRenderer.js';
import {itemActive,storeStatus} from './calendar.js';
const setup=document.querySelector('#setup'),player=document.querySelector('#player'),brandScreen=document.querySelector('#brand-screen'),diagnostics=document.querySelector('#diagnostics');
const stopLayout=observePlayerLayout(document.querySelector('.tv-viewport'),document.querySelector('.tv-content'));
const previewId=new URLSearchParams(location.search).get('preview'),preview=Boolean(previewId&&/^\d+$/.test(previewId));
const storageKey='ommi.display.v1';let identity=null,snapshot=null,socket=null,engine=null,connected=false,lastSync=null,timeOffset=0,state='loading',syncing=false,syncAgain=false;
try{identity=JSON.parse(localStorage.getItem(storageKey));}catch{}
function storeIdentity(value){identity=value;localStorage.setItem(storageKey,JSON.stringify(value));}
function serverNow(){return new Date(Date.now()+timeOffset);}
async function setupScreen(){
 setup.hidden=false;player.hidden=true;engine?.destroy();socket?.disconnect();
 const error=document.querySelector('#setup-error'),form=document.querySelector('#setup-form');
 try{const data=await api('/api/display/setup');document.querySelector('#store').innerHTML=options(data.stores,identity?.storeId,'name',t('selectStore'));document.querySelector('#group').innerHTML=options(data.groups,identity?.groupId,'name',t('selectGroup'));if(!data.stores.length||!data.groups.length)throw new Error(t('setupEmpty'));if(!data.registrationEnabled)throw new Error(t('registrationClosed'));}
 catch(e){error.textContent=e.message;error.hidden=false;form.querySelectorAll('button').forEach(b=>b.disabled=true);return;}
 async function start(fullscreen){if(!form.reportValidity())return;form.querySelectorAll('button').forEach(b=>b.disabled=true);error.hidden=true;try{
   // Fullscreen must be requested during the original click, before awaiting the network.
   if(fullscreen&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen().catch(()=>{});
   const storeId=Number(document.querySelector('#store').value),groupId=Number(document.querySelector('#group').value),identifier=identity?.identifier||uuid();
   const result=await api('/api/display/register',{method:'POST',body:{unique_identifier:identifier,store_id:storeId,group_id:groupId,...(identity?.token?{token:identity.token}:{})}});
   storeIdentity({...result,storeId,groupId});history.replaceState({},'','/display/player');await startPlayer();
  }catch(e){error.textContent=e.message;error.hidden=false;}finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 form.onsubmit=e=>{e.preventDefault();start(false);};document.querySelector('#start-fullscreen').onclick=()=>start(true);
}
function getItems(data){if(!data||data.disabled||!data.playlist?.enabled)return [];return (data.catalog||data.items||[]).filter(i=>itemActive(i,serverNow(),data.store?.timezone||'Africa/Tunis'));}
function scheduleStatus(){if(preview)return {open:true,closedScreenEnabled:false};if(snapshot?.store&&snapshot.hours)return storeStatus(snapshot.store,snapshot.hours,snapshot.exceptions||[],serverNow());return snapshot?.schedule||{open:true};}
const frameFields=Object.fromEntries(['welcome','tagline','store-label','store','hours-label','hours-value','hours-day','message','discover','play','grow','date','clock'].map(name=>[name,document.querySelector(`#frame-${name}`)]));
for(const [name,key] of [['welcome','frameWelcome'],['tagline','frameTagline'],['store-label','frameStoreLabel'],['message','frameMessage'],['discover','frameDiscover'],['play','framePlay'],['grow','frameGrow']])frameFields[name].textContent=t(key);
document.querySelector('#frame-hours-icon').innerHTML=icon('clock');
function updateFrame(schedule){
 const now=serverNow(),timezone=snapshot?.store?.timezone||'Africa/Tunis';
 frameFields.store.textContent=preview?t('framePreview'):snapshot?.store?.name||'OMMI SISSI';
 frameFields.clock.textContent=new Intl.DateTimeFormat('fr-TN',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 frameFields.clock.dateTime=now.toISOString();
 frameFields.date.textContent=new Intl.DateTimeFormat('fr-TN',{timeZone:timezone,weekday:'long',day:'numeric',month:'long'}).format(now);
 const next=schedule.nextOpening,hours=schedule.currentHours||schedule.today;
 document.querySelector('#frame-hours').classList.toggle('is-closed',!schedule.open&&!preview);
 frameFields['hours-day'].hidden=true;
 frameFields['hours-value'].hidden=false;
 if(preview){frameFields['hours-label'].textContent=t('frameTagline');frameFields['hours-value'].hidden=true;}
 else if(schedule.open&&hours?.closing_time){frameFields['hours-label'].textContent=t('frameUntil');frameFields['hours-value'].textContent=hours.closing_time.replace(':','h');}
 else if(next){
  frameFields['hours-label'].textContent=t('nextOpening');frameFields['hours-value'].textContent=next.time.replace(':','h');
  frameFields['hours-day'].textContent=new Intl.DateTimeFormat('fr-TN',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(next.date+'T12:00:00Z'));
  frameFields['hours-day'].hidden=false;
 }else{frameFields['hours-label'].textContent=t('frameClosed');frameFields['hours-value'].hidden=true;}
}
function showBranded(mode){
 state=mode;brandScreen.hidden=false;document.querySelector('#screen-store').textContent=snapshot?.store?`OMMI SISSI · ${snapshot.store.name}`:'';document.querySelector('#screen-message').textContent=t(mode==='closed'?'currentlyClosed':mode==='disabled'?'screenDisabled':'contentSoon');const schedule=scheduleStatus(),today=schedule.today;document.querySelector('#screen-hours').innerHTML=mode==='closed'?(today&&!today.is_closed?`<div class="closed-hours"><div><span>${t('opening')}</span><strong>${esc(today.opening_time)}</strong></div><div><span>${t('closing')}</span><strong>${esc(today.closing_time)}</strong></div></div>`:'')+(schedule.nextOpening?`<div class="next-opening">${t('nextOpening')}<strong>${esc(new Intl.DateTimeFormat('fr-TN',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(schedule.nextOpening.date+'T12:00:00Z')))} · ${esc(schedule.nextOpening.time)}</strong></div>`:''):'';
}
function evaluate(){if(!engine||!snapshot)return;const hours=scheduleStatus();updateFrame(hours);if(snapshot.disabled){if(!engine.paused)engine.pause();showBranded('disabled');}else if(!hours.open&&hours.closedScreenEnabled){if(!engine.paused)engine.pause();showBranded('closed');}else{if(engine.paused){brandScreen.hidden=true;state='playing';engine.resume(snapshot);}else if(!engine.current&&getItems(snapshot).length){engine.stage(snapshot);}else if(!getItems(snapshot).length&&!engine.current)showBranded('empty');}}
function diagnosticsUpdate(){if(diagnostics.hidden)return;const values=[['Magasin',snapshot?.store?.name],['Écran',snapshot?.display?.name||t('previewMode')],['Groupe',snapshot?.group?.name],['Playlist',snapshot?.playlist?.name],['Média',engine?.current?.title],['Connexion',connected?t('online'):t('reconnect')],['Serveur',location.origin],['Résolution',`${innerWidth} × ${innerHeight} · DPR ${devicePixelRatio}`],['État',state],['Dernière synchronisation',lastSync?lastSync.toLocaleTimeString('fr-TN'):'—']];diagnostics.innerHTML=`<h2>OMMI SISSI · Diagnostics</h2><dl>${values.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v||'—')}</dd>`).join('')}</dl><footer>Ctrl + Maj + D : masquer · Ctrl + Maj + S : configuration</footer>`;}
async function synchronize(){
 if(syncing){syncAgain=true;return;}syncing=true;
 try{
  const start=Date.now();const data=await api(preview?`/api/playlists/${previewId}/preview`:`/api/display/${identity.identifier}/playlist`,{headers:preview?{}:{Authorization:`Bearer ${identity.token}`}});
  timeOffset=new Date(data.serverTime).getTime()-(start+Date.now())/2;snapshot=data;lastSync=new Date();connected=true;
  if(!preview)try{localStorage.setItem(`ommi.snapshot.${identity.identifier}`,JSON.stringify(data));}catch{}
  engine.stage(data);evaluate();diagnosticsUpdate();
 }catch(e){connected=false;diagnosticsUpdate();if(e.status===401&&!preview){engine.pause();localStorage.removeItem(storageKey);identity=null;await setupScreen();}else if(e.status===401&&preview){location.replace('/admin/login');}else if(!snapshot)showBranded('empty');}
 finally{syncing=false;if(syncAgain){syncAgain=false;setTimeout(synchronize,500);}}
}
async function startPlayer(){
 setup.hidden=true;player.hidden=false;
 const renderer=new MediaRenderer(document.querySelector('#media-stage'),{onError:item=>{console.warn('Média indisponible',item.id);socket?.emit('display:error',{message:`Média ${item.media_id||item.id} indisponible`});}});
 engine=new PlaybackEngine({renderer,getItems,onEmpty:()=>showBranded('empty'),onItem:()=>{brandScreen.hidden=true;state='playing';diagnosticsUpdate();heartbeat();}});
 if(!preview){try{const cached=JSON.parse(localStorage.getItem(`ommi.snapshot.${identity.identifier}`));if(cached){snapshot=cached;timeOffset=0;engine.stage(cached);evaluate();}}catch{}}
 else{document.querySelector('#preview-bar').hidden=false;document.querySelector('#exit-preview').onclick=()=>{window.close();location.href='/admin/playlists';};}
 await synchronize();
 if(!preview&&identity){socket=io({auth:{identifier:identity.identifier,token:identity.token},reconnection:true,reconnectionDelay:1000,reconnectionDelayMax:15000});socket.on('connect',()=>{connected=true;socket.emit('display:register');synchronize();heartbeat();});socket.on('disconnect',()=>{connected=false;diagnosticsUpdate();});socket.on('connect_error',()=>{connected=false;diagnosticsUpdate();});for(const event of ['playlist:updated','group:updated','store:schedule-updated'])socket.on(event,synchronize);socket.on('display:reload',()=>location.reload());socket.on('display:deleted',()=>{engine.pause();socket.disconnect();localStorage.removeItem(storageKey);identity=null;setupScreen();});}
}
function heartbeat(){if(preview||!identity||!engine)return;const payload={mediaId:engine.current?.media_id||null};if(socket?.connected)socket.emit('display:heartbeat',payload);else api(`/api/display/${identity.identifier}/heartbeat`,{method:'POST',body:payload,headers:{Authorization:`Bearer ${identity.token}`}}).catch(()=>{});}
setInterval(()=>{if(!player.hidden){evaluate();diagnosticsUpdate();}},5000);setInterval(()=>{if(!player.hidden){synchronize();heartbeat();}},25000);
window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.code==='KeyS'&&!preview){e.preventDefault();location.href='/display/setup';}if(e.ctrlKey&&e.shiftKey&&e.code==='KeyD'){e.preventDefault();diagnostics.hidden=!diagnostics.hidden;diagnosticsUpdate();}});
window.addEventListener('online',()=>{if(!player.hidden)synchronize();});window.addEventListener('beforeunload',()=>{stopLayout();engine?.destroy();socket?.disconnect();});
if(preview)startPlayer();else if(location.pathname==='/display/setup'||!identity?.token)setupScreen();else startPlayer();
