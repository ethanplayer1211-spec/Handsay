import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync,mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,sep } from 'node:path';
import { configureDesktopRuntime } from '../shared/desktop-runtime.mjs';

function fixture(t){
  const base=mkdtempSync(join(tmpdir(),'handsay-runtime-test-'));
  t.after(()=>{assert.ok(resolve(base).startsWith(resolve(tmpdir())+sep));rmSync(base,{recursive:true,force:true});});
  const paths=new Map(), switches=[];
  const app={setName(){},setPath(name,path){paths.set(name,path);},requestSingleInstanceLock:()=>true,commandLine:{appendSwitch:name=>switches.push(name)}};
  return {base,app,paths,switches};
}
test('relaunches keep a stable instance-lock profile but never reuse session caches',t=>{
  const {base,app,paths,switches}=fixture(t);
  const options={root:base,runtimeRoot:join(base,'new-runtime')};
  const first=configureDesktopRuntime(app,options),second=configureDesktopRuntime(app,options);
  assert.equal(first.profile,second.profile);assert.notEqual(first.session,second.session);
  assert.equal(paths.get('sessionData'),second.session);
  assert.ok(existsSync(first.session));assert.ok(existsSync(second.session));
  assert.ok(switches.includes('disable-gpu-shader-disk-cache'));
  assert.equal(switches.includes('disable-gpu'),false);
});
test('unwritable runtime locations fall back without changing an existing file',t=>{
  const {base,app}=fixture(t);const blocked=join(base,'blocked');writeFileSync(blocked,'existing');
  const result=configureDesktopRuntime(app,{root:base,runtimeRoot:blocked,fallbackRoot:join(base,'fallback')});
  assert.equal(result.base,join(base,'fallback'));assert.ok(existsSync(blocked));
  const nested=join(base,'nested');mkdirSync(nested);writeFileSync(join(nested,'profile'),'existing profile file');
  const next=configureDesktopRuntime(app,{root:base,runtimeRoot:nested,fallbackRoot:join(base,'nested-fallback')});
  assert.equal(next.base,join(base,'nested-fallback'));assert.ok(existsSync(join(nested,'profile')));
});
test('a second instance does not initialize another Chromium cache',t=>{
  const {base,app,paths}=fixture(t);app.requestSingleInstanceLock=()=>false;
  let sessions=0;
  const result=configureDesktopRuntime(app,{root:base,runtimeRoot:join(base,'runtime'),makeSession:()=>{sessions++;throw new Error('Must not create a second session');}});
  assert.equal(result.primary,false);assert.equal(sessions,0);assert.equal(paths.has('sessionData'),false);
});
