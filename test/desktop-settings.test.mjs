import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {DesktopSettings,desktopSettingsRequest} from '../shared/desktop-settings.mjs';

function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'handsay-preferences-test-'));
  t.after(()=>{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));rmSync(root,{recursive:true,force:true});});
  return {root,file:join(root,'preferences.json')};
}
test('desktop gesture and style preferences survive a fresh settings instance without storing interview data',t=>{
  const {root,file}=fixture(t), first=new DesktopSettings(file);
  const gesture=JSON.stringify([{id:'test-only',name:'Test phrase',takes:[]}]);
  first.setItem('handsay.gestures.v1',gesture);first.setItem('handsay.theme.v1','dark');
  const fresh=new DesktopSettings(file);
  assert.equal(fresh.getItem('handsay.gestures.v1'),gesture);assert.equal(fresh.getItem('handsay.theme.v1'),'dark');
  for(const key of ['handsay.room.v1','transcript','introMessage','../../other'])assert.throws(()=>fresh.setItem(key,'private data'));
  assert.throws(()=>fresh.setItem('handsay.theme.v1','invalid'));
  assert.throws(()=>fresh.setItem('handsay.voicePrefs.v1','x'.repeat(300000)));
  assert.throws(()=>fresh.setItem('handsay.gestures.v1',undefined));
  assert.equal(fresh.getItem('handsay.gestures.v1'),gesture);
  assert.deepEqual(readdirSync(root),['preferences.json']);
  fresh.removeItem('handsay.theme.v1');assert.equal(new DesktopSettings(file).getItem('handsay.theme.v1'),null);
});
test('corrupted desktop preferences remain untouched and block destructive overwrites',t=>{
  const {file}=fixture(t);writeFileSync(file,'original corrupted data');
  const store=new DesktopSettings(file);
  assert.throws(()=>store.getItem('handsay.gestures.v1'),/not overwritten/);
  assert.throws(()=>store.setItem('handsay.theme.v1','dark'),/not overwritten/);
  assert.equal(readFileSync(file,'utf8'),'original corrupted data');
});
test('recognition mode survives restart and cannot carry interview text in its preference',t=>{
  const {file}=fixture(t),store=new DesktopSettings(file);
  store.setItem('handsay.recognition.v1',JSON.stringify({mode:'combined-priority'}));
  assert.deepEqual(JSON.parse(new DesktopSettings(file).getItem('handsay.recognition.v1')),{mode:'combined-priority'});
  for(const data of [{mode:'other'},{mode:'asl',transcript:'private'},['asl'],{mode:'personal',roomKey:'private'}])assert.throws(()=>store.setItem('handsay.recognition.v1',JSON.stringify(data)));
  assert.deepEqual(JSON.parse(store.getItem('handsay.recognition.v1')),{mode:'combined-priority'});
});
test('preferences IPC accepts only the current app origin and exact browser window',t=>{
  const {file}=fixture(t),store=new DesktopSettings(file),contents={};
  const event={sender:contents,senderFrame:{url:'http://127.0.0.1:54321/'}};
  const call=(evt,request)=>desktopSettingsRequest(evt,contents,'http://127.0.0.1:54321',store,request);
  assert.equal(call(event,{operation:'set',key:'handsay.theme.v1',value:'dark'}).ok,true);
  assert.deepEqual(call(event,{operation:'get',key:'handsay.theme.v1'}),{ok:true,value:'dark'});
  assert.equal(call({...event,sender:{}},{operation:'get',key:'handsay.theme.v1'}).ok,false);
  for(const url of ['https://other.example/','http://127.0.0.1:1/','file:///anything'])assert.equal(call({...event,senderFrame:{url}},{operation:'get',key:'handsay.theme.v1'}).ok,false);
  assert.equal(call(event,{operation:'get',key:'handsay.room.v1'}).ok,false);
  assert.equal(call(event,{operation:'execute',key:'handsay.theme.v1'}).ok,false);
});
test('sandboxed preload exposes only the restricted settings methods and propagates errors',t=>{
  const {file}=fixture(t), store=new DesktopSettings(file),contents={};let exposed;
  const event={sender:contents,senderFrame:{url:'http://127.0.0.1:54321/'}};
  runInNewContext(readFileSync(new URL('../scripts/preload.cjs',import.meta.url),'utf8'),{require:name=>{
    assert.equal(name,'electron');return {
      contextBridge:{exposeInMainWorld:(key,value)=>{assert.equal(key,'handsayStorage');exposed=value;}},
      ipcRenderer:{sendSync:(channel,request)=>{assert.equal(channel,'handsay:preferences');return desktopSettingsRequest(event,contents,'http://127.0.0.1:54321',store,request);}},
    };
  }});
  assert.deepEqual(Object.keys(exposed).sort(),['getItem','removeItem','setItem']);
  exposed.setItem('handsay.theme.v1','light');assert.equal(exposed.getItem('handsay.theme.v1'),'light');
  assert.throws(()=>exposed.getItem('transcript'),/not allowed/);
});
