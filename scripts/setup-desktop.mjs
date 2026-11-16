import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const result=spawnSync(process.execPath,[resolve('node_modules/electron/install.js')],{stdio:'inherit',windowsHide:true,env:{...process.env,electron_config_cache:resolve('.runtime/electron-cache')}});
process.exit(result.status ?? 1);
