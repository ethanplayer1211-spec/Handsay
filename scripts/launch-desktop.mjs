import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const require=createRequire(import.meta.url);
let executable;
try { executable=require('electron'); } catch { console.error('Run npm run setup:desktop first.');process.exit(1); }
const child=spawn(executable,[resolve('scripts/desktop.mjs')],{stdio:'inherit',windowsHide:true,shell:false});
child.on('error',error=>{console.error(error.message);process.exit(1);});
child.on('exit',code=>process.exit(code ?? 0));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());
