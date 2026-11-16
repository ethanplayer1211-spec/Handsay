import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
if (process.platform !== 'win32') { console.error('This native camera bridge currently supports Windows with OBS Studio.'); process.exit(1); }
const run = (command,args) => {
  const result = spawnSync(command,args,{cwd:root,stdio:'inherit',windowsHide:true,shell:false});
  if (result.status !== 0) { console.error(result.error?.message || 'Camera setup failed'); process.exit(result.status || 1); }
};
const python = resolve(root,'.runtime/camera/Scripts/python.exe');
if (!existsSync(python)) run('python',['-m','venv',resolve(root,'.runtime/camera')]);
run(python,['-m','pip','install','-r',resolve(root,'scripts/camera-requirements.txt')]);
console.log('Handsay camera helper is ready. OBS Studio must be installed once. The app starts output only when you click Start camera output.');
