import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
if(/[\r\n]/.test(root)){console.error('Le chemin du projet ne peut pas contenir de saut de ligne.');process.exit(1);}
const uid=process.argv[2];
if(!/^\d+$/.test(uid||'')||Number(uid)===0){console.error('Un UID utilisateur non-root est requis.');process.exit(1);}
// systemd specifiers use %, and its quoted values use C-style escapes.
const quote=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('%','%%').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
process.stdout.write(`[Unit]
Description=OMMI SISSI Digital Signage
After=network.target

[Service]
Type=simple
User=${uid}
WorkingDirectory=${root.replaceAll('%','%%')}
# The ':' prefix keeps dollar signs in filesystem paths literal.
ExecStart=:${quote(process.execPath)} ${quote(path.join(root,'server.js'))}
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
`);
