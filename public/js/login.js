import {api,setCSRF,icon} from './common.js';
import {t} from './i18n.js';
const form=document.querySelector('#login-form'),error=document.querySelector('#login-error'),button=form.querySelector('[type="submit"]');
document.querySelector('#lock-icon').innerHTML=icon('lock');
const toggle=document.querySelector('#toggle-password'),password=document.querySelector('#password');toggle.innerHTML=icon('eye');toggle.onclick=()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.setAttribute('aria-label',t(show?'hidePassword':'showPassword'));toggle.setAttribute('aria-pressed',String(show));};
async function session(){const data=await api('/auth/session');setCSRF(data.csrfToken);if(data.user)location.replace('/admin');if(!data.hasAdmin){error.textContent=t('firstAdmin');error.hidden=false;}return data;}
session().catch(e=>{error.textContent=e.message;error.hidden=false;});
form.onsubmit=async e=>{e.preventDefault();button.disabled=true;error.hidden=true;try{await session();await api('/auth/login',{method:'POST',body:Object.fromEntries(new FormData(form))});location.replace('/admin');}catch(e){error.textContent=e.message;error.hidden=false;password.focus();}finally{button.disabled=false;}};
