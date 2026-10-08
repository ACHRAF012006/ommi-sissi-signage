import {openDatabase} from '../database/database.js';
import {config} from '../config/config.js';
const db=openDatabase();db.close();console.log(`Base initialisée : ${config.databasePath}`);
