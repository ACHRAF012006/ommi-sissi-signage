import {openDatabase} from '../database/database.js';
import {saveAdministrator} from '../services/userService.js';

// Explicit recovery command; it is never run during application startup.
const db=openDatabase();
try {
 await saveAdministrator(db,'admin','123456789123',{rename:true});
 console.log('Administrateur réinitialisé : admin. Utilisez le mot de passe par défaut documenté dans README.md.');
 console.log('Les anciennes sessions ont été révoquées. Connexion : /admin/login');
} catch(error) {
 console.error(error.issues?error.issues.map(issue=>issue.message).join(' · '):error.message);
 process.exitCode=1;
} finally {
 db.close();
}
