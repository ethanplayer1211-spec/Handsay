// Real Electron startup test. Hidden window, no camera, no UI automation.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync,mkdtempSync,writeFileSync,readdirSync,readFileSync } from 'node:fs';
import { resolve,join,sep } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),electron=require('electron');
const folder=resolve('.runtime/desktop-startup-checks');mkdirSync(folder,{recursive:true});
const runtime=mkdtempSync(join(folder,'run-'));
const env={...process.env,HANDSAY_STARTUP_CHECK_ROOT:runtime};
const launch=()=>{
  const child=spawn(electron,[resolve('scripts/desktop.mjs'),'--startup-check'],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const result={child,stdout:'',stderr:'',exit:once(child,'close')};
  child.stdout.on('data',part=>{result.stdout+=part;});child.stderr.on('data',part=>{result.stderr+=part;});
  return result;
};
const first=launch();let second;
const timeout=setTimeout(()=>{first.child.kill();second?.child.kill();},25000);
try{
  const ready=await new Promise((resolveReady,reject)=>{
    let buffer='';
    first.child.stdout.on('data',chunk=>{
      buffer+=chunk.toString();
      const line=buffer.split(/\r?\n/).find(line=>line.startsWith('HANDSay_STARTUP_CHECK '));
      if(line)resolveReady(JSON.parse(line.slice('HANDSay_STARTUP_CHECK '.length)));
    });
    first.child.on('error',reject);first.child.on('close',()=>reject(new Error('Primary desktop exited before readiness: '+first.stderr)));
  });
  const health=await fetch(ready.origin+'/api/health');assert.equal(health.status,200);
  assert.equal(ready.profile,join(runtime,'profile'));
  assert.ok(ready.session.startsWith(runtime+sep+'session-'));
  second=launch();const [secondCode]=await second.exit;assert.equal(secondCode,0);
  assert.match(second.stdout,/already running/);
  const [firstCode]=await first.exit;assert.equal(firstCode,0);
  const logs=first.stderr+'\n'+second.stderr;
  assert.doesNotMatch(logs,/Unable to move the cache|Unable to create cache|Gpu Cache Creation failed/i);
  assert.doesNotMatch(logs,/preferences preload failed|Unable to load preload/i);
  const preferences=JSON.parse(readFileSync(join(ready.profile,'preferences.json'),'utf8'));
  assert.ok(['light','dark'].includes(preferences.values['handsay.theme.v1']));
  assert.match(first.stdout,/kept the existing instance/);
  assert.equal(readdirSync(runtime).filter(name=>name.startsWith('session-')).length,1);
  const report={checkedAt:new Date().toISOString(),passed:true,primaryStartup:true,healthCheck:true,secondLaunchForwarded:true,cacheErrors:false,httpDiskCache:false,sessionDirectoryUnique:true,preferencesBridge:true,scope:'Real Electron hidden startup, actual renderer preference write through the sandboxed bridge, and duplicate-launch check; no camera or UI input.'};
  mkdirSync(resolve('docs/evaluation'),{recursive:true});
  writeFileSync(resolve('docs/evaluation/desktop-startup.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{clearTimeout(timeout);if(first.child.exitCode===null)first.child.kill();if(second?.child.exitCode===null)second.child.kill();}
