import readline from 'node:readline/promises';
import {administratorTarget,saveAdministrator} from '../services/userService.js';
import {openDatabase} from '../database/database.js';
function secret(question){
 return new Promise((resolve,reject)=>{
  process.stdout.write(question);let value='';process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
  const finish=(error)=>{process.stdin.removeListener('data',input);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(value);};
  function input(text){for(const char of text){if(char==='\r'||char==='\n'){finish();return;}if(char==='\u0003'){finish(new Error('Opération annulée.'));return;}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' '&&value.length<128)value+=char;}}
  process.stdin.on('data',input);
 });
}
if(!process.stdin.isTTY){console.error('Ouvrez un terminal interactif et lancez npm run create-admin. Aucun mot de passe par défaut.');process.exit(1);}
const db=openDatabase();let rl;
try{
 rl=readline.createInterface({input:process.stdin,output:process.stdout});
 const username=(await rl.question('Identifiant : ')).trim();const exists=administratorTarget(db,username);
 if(exists){const answer=await rl.question('Ce compte existe. Réinitialiser son mot de passe ? [o/N] : ');if(answer.toLowerCase()!=='o'){rl.close();process.exitCode=0;db.close();process.exit();}}
 rl.close();const password=await secret('Mot de passe (12 caractères minimum, saisie masquée) : '),confirmation=await secret('Confirmez le mot de passe : ');
 if(password!==confirmation)throw new Error('Les mots de passe ne correspondent pas.');
 await saveAdministrator(db,username,password);
 console.log(`Administrateur « ${username} » prêt. Connectez-vous sur /admin/login.`);
}catch(e){console.error(e.issues?e.issues.map(i=>i.message).join(' · '):e.message);process.exitCode=1;}finally{rl?.close();if(db.open)db.close();}
