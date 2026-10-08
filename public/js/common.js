import {t} from './i18n.js';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',stores:'M3 10h18 M5 10v11h14V10 M3 10l2-7h14l2 7 M9 21v-7h6v7',displays:'M3 4h18v13H3z M8 21h8 M12 17v4',groups:'M3 3h8v6H3z M13 15h8v6h-8z M3 15h8v6H3z M7 9v3h10v3',media:'M3 3h18v18H3z M3 16l5-5 5 5 4-4 4 4 M16 7h.01',playlists:'M4 5h11 M4 10h11 M4 15h6 M16 12l6 4-6 4z',scheduling:'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M9 14h6',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M10 2h4l1 4 4 1 3 5-3 5-4 1-1 4h-4l-1-4-4-1-3-5 3-5 4-1z',logout:'M9 4H4v16h5 M12 12h10 M18 8l4 4-4 4',plus:'M12 5v14 M5 12h14',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',arrow:'M5 12h14 M13 6l6 6-6 6',chevron:'M9 5l7 7-7 7',edit:'M16 3l5 5-12 12-6 1 1-6z M14 5l5 5',delete:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',close:'M6 6l12 12 M6 18L18 6',check:'M5 12l4 4L19 6',upload:'M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5',play:'M8 4l13 8-13 8z',image:'M3 3h18v18H3z M3 16l5-5 5 5 4-4 4 4 M16 7h.01',video:'M3 5h13v14H3z M16 9l5-3v12l-5-3',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',menu:'M3 6h18 M3 12h18 M3 18h18',refresh:'M20 7a9 9 0 1 0-1 12 M20 3v5h-5',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',drag:'M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01',up:'M6 15l6-6 6 6',down:'M6 9l6 6 6-6',help:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01',spark:'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',lock:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4',wifi:'M3 8a15 15 0 0 1 18 0 M6 12a10 10 0 0 1 12 0 M9 16a5 5 0 0 1 6 0 M12 20h.01',folder:'M3 6h7l2 2h9v13H3z',fullscreen:'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M3 16v5h5'};
export const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
let csrfToken='';
export function setCSRF(token){csrfToken=token;}
export function getCSRF(){return csrfToken;}
export async function api(url,{method='GET',body,...options}={}){
 const response=await fetch(url,{...options,method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':csrfToken}:{}),...options.headers},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json().catch(()=>({error:{message:t('error')}}));
 if(!response.ok||!result.success){const error=new Error(result.error?.message||t('error'));Object.assign(error,{status:response.status,code:result.error?.code,details:result.error?.details});throw error;}
 return result.data;
}
export function bytes(size){if(!size)return '0 B';const units=['B','KB','MB','GB','TB'];const i=Math.min(Math.floor(Math.log(size)/Math.log(1024)),4);return `${new Intl.NumberFormat('fr',{maximumFractionDigits:1}).format(size/1024**i)} ${units[i]}`;}
export function dateTime(value){if(!value)return t('never');const date=new Date(value.includes('T')?value:value.replace(' ','T')+'Z');return new Intl.DateTimeFormat('fr-TN',{dateStyle:'medium',timeStyle:'short'}).format(date);}
export function relative(value){if(!value)return t('never');const diff=Math.max(0,(Date.now()-new Date(value.includes('T')?value:value.replace(' ','T')+'Z'))/60000);return diff<1?t('justNow'):diff<60?`${Math.floor(diff)} ${t('agoMinutes')}`:diff<1440?`${Math.floor(diff/60)} ${t('agoHours')}`:`${Math.floor(diff/1440)} ${t('agoDays')}`;}
export const badge=(label,kind='neutral')=>`<span class="badge ${kind}"><span class="dot"></span>${escapeHTML(label)}</span>`;
export function toast(message,error=false){
 let root=document.querySelector('#toasts');if(!root){root=document.createElement('div');root.id='toasts';root.setAttribute('aria-live','polite');document.body.append(root);}
 const el=document.createElement('div');el.className='toast'+(error?' error':'');el.innerHTML=icon(error?'close':'check')+`<span>${escapeHTML(message)}</span>`;root.append(el);setTimeout(()=>el.remove(),5000);
}
export function modal({title,content,wide=false,footer='',onClose}){
 const overlay=document.createElement('div');overlay.className='modal-overlay';overlay.innerHTML=`<section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header><h2 id="modal-title">${escapeHTML(title)}</h2><button class="icon-button" data-close aria-label="${t('close')}">${icon('close')}</button></header><div class="modal-body">${content}</div>${footer?`<footer>${footer}</footer>`:''}</section>`;
 const before=document.activeElement;document.body.append(overlay);document.body.classList.add('modal-open');
 const close=()=>{overlay.remove();document.body.classList.remove('modal-open');document.removeEventListener('keydown',key);before?.focus();onClose?.();};
 function key(e){if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const inputs=[...overlay.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);if(!inputs.length){e.preventDefault();return;}const first=inputs[0],last=inputs.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 overlay.querySelector('[data-close]').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close();});document.addEventListener('keydown',key);overlay.querySelector('input,select,button')?.focus();return {el:overlay,close};
}
export function confirmAction(message,{label=t('delete'),danger=true}={}){
 return new Promise(resolve=>{let resolved=false;const m=modal({title:t('confirmTitle'),content:`<div class="confirmation-icon">${icon(danger?'delete':'help')}</div><p class="confirmation-message">${escapeHTML(message)}</p>`,footer:`<button class="button secondary" id="cancel-action">${t('cancel')}</button><button class="button ${danger?'danger':''}" id="confirm-action">${escapeHTML(label)}</button>`,onClose:()=>{if(!resolved)resolve(false);}});m.el.querySelector('#cancel-action').onclick=m.close;m.el.querySelector('#confirm-action').onclick=()=>{resolved=true;resolve(true);m.close();};});
}
export const field=(label,name,value='',type='text',extra='')=>`<label class="field"><span>${escapeHTML(label)}</span><input name="${name}" type="${type}" value="${escapeHTML(value)}" ${extra}></label>`;
export const checkbox=(label,name,checked=true)=>`<label class="check-field"><input type="checkbox" name="${name}" ${checked?'checked':''}><span>${escapeHTML(label)}</span></label>`;
export const options=(rows,value,label='name',empty='')=>`${empty?`<option value="">${escapeHTML(empty)}</option>`:''}${rows.map(x=>`<option value="${x.id}" ${Number(value)===x.id?'selected':''}>${escapeHTML(x[label])}</option>`).join('')}`;
export const select=(label,name,rows,value,empty='')=>`<label class="field"><span>${escapeHTML(label)}</span><select name="${name}">${options(rows,value,'name',empty)}</select></label>`;
export const emptyState=(iconName,title,action='')=>`<div class="empty-state"><div class="empty-icon">${icon(iconName)}</div><h3>${escapeHTML(title)}</h3><p>${t('emptyHint')}</p>${action}</div>`;
export const button=(id,label,ic='plus',secondary=false)=>`<button class="button ${secondary?'secondary':''}" id="${id}">${icon(ic)}${escapeHTML(label)}</button>`;
export function formHandler(form,fn){form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('[type="submit"]');if(btn?.disabled)return;if(btn)btn.disabled=true;try{await fn(new FormData(form));}catch(e){toast(e.message,true);}finally{if(btn)btn.disabled=false;}});}

// randomUUID is unavailable on plain HTTP LAN origins; getRandomValues remains available.
export function uuid(){
 if(globalThis.crypto.randomUUID)return globalThis.crypto.randomUUID();
 const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const value=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
 return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}
