// Catch module linking errors as well as startup errors before admin.js can handle them.
const content=document.querySelector('#content');
try {
 await import('./admin.js');
} catch(error) {
 console.error('Impossible de charger l’administration',error);
 const panel=document.createElement('section');panel.className='empty-state';panel.setAttribute('role','alert');
 const title=document.createElement('h1');title.textContent='Impossible de charger le tableau de bord';
 const description=document.createElement('p');description.textContent='Rechargez la page pour récupérer la dernière version de l’interface. Si le problème persiste, vérifiez votre connexion au serveur.';
 const retry=document.createElement('button');retry.type='button';retry.className='button';retry.textContent='Recharger la page';retry.onclick=()=>location.reload();
 panel.append(title,description,retry);content.replaceChildren(panel);
} finally {
 content.setAttribute('aria-busy','false');
}
