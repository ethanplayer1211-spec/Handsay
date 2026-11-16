import { mkdirSync, mkdtempSync, writeFileSync, unlinkSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

function writableDirectory(path) {
  mkdirSync(path,{recursive:true});
  const probe=join(path,`.write-check-${randomUUID()}`);
  writeFileSync(probe,'',{flag:'wx'});
  unlinkSync(probe);
}

/** Set all Chromium storage paths before readiness or creating any Session. */
export function configureDesktopRuntime(app, {
  root,
  runtimeRoot,
  fallbackRoot,
  ensureWritable=writableDirectory,
  makeSession=prefix=>mkdtempSync(prefix),
} = {}) {
  const identity=createHash('sha256').update(resolve(root)+'\0'+homedir()).digest('hex').slice(0,16);
  const candidates=[
    runtimeRoot || resolve(root,'.runtime/desktop-v2',identity),
    fallbackRoot || resolve(tmpdir(),'handsay-desktop-v2',identity),
  ];
  let base, lastError;
  for(const candidate of candidates){
    try{
      ensureWritable(candidate);
      for(const name of ['profile','logs','crashes'])ensureWritable(join(candidate,name));
      base=candidate;break;
    }catch(error){lastError=error;}
  }
  if(!base)throw new Error(`Handsay could not create a writable runtime directory: ${lastError?.message || 'access denied'}`);
  const profile=join(base,'profile'),logs=join(base,'logs'),crashes=join(base,'crashes');
  app.setName('Handsay');
  app.setPath('userData',profile);
  app.setPath('logs',logs);
  app.setPath('crashDumps',crashes);
  if(!app.requestSingleInstanceLock())return {primary:false,base,profile};
  // Sessions and their file locks are never reused, including after a crash.
  const session=makeSession(join(base,'session-'));
  app.setPath('sessionData',session);
  // Keep GPU acceleration, but avoid Chromium's shared shader-cache files.
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  return {primary:true,base,profile,session,logs,crashes};
}
