import { readFileSync, statSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const KEYS = new Set(['handsay.gestures.v1','handsay.voicePrefs.v1','handsay.captionStyle.v1','handsay.theme.v1','handsay.recognition.v1']);
const MAX_BYTES = 524288;
function check(key, value) {
  if (!KEYS.has(key)) throw new Error('Only gesture, recognition and appearance/voice settings can be saved');
  if (value !== undefined) {
    if (typeof value !== 'string' || Buffer.byteLength(value) > MAX_BYTES / 2) throw new Error('Setting is too large or invalid');
    if (key === 'handsay.theme.v1') { if (!['light','dark'].includes(value)) throw new Error('Invalid theme'); }
    else {
      const data=JSON.parse(value);if (!data || typeof data !== 'object') throw new Error('Invalid saved settings');
      if(key==='handsay.recognition.v1'&&(Object.keys(data).length!==1||!['asl','personal','combined','combined-priority'].includes(data.mode)))throw new Error('Invalid recognition mode');
    }
  }
}

/** Separate allowed preferences from temporary Chromium caches and room data. */
export class DesktopSettings {
  constructor(file) {
    this.file=file;this.values={};this.readError=null;
    try {
      if(statSync(file).size > MAX_BYTES)throw new Error('too large');
      const saved=JSON.parse(readFileSync(file,'utf8'));
      if(saved.version !== 1 || !saved.values || typeof saved.values !== 'object' || Array.isArray(saved.values))throw new Error('bad format');
      for(const [key,value] of Object.entries(saved.values))check(key,value);
      this.values=saved.values;
    } catch(error) {
      if(error.code !== 'ENOENT')this.readError=new Error('Saved preferences could not be read. Existing data was not overwritten.');
    }
  }
  getItem(key) { check(key);if(this.readError)throw this.readError;return this.values[key] ?? null; }
  setItem(key,value) { if(typeof value !== 'string')throw new Error('Invalid saved value');check(key,value);this.commit({...this.values,[key]:value}); }
  removeItem(key) { check(key);const next={...this.values};delete next[key];this.commit(next); }
  commit(next) {
    if(this.readError)throw this.readError;
    const text=JSON.stringify({version:1,values:next});
    if(Buffer.byteLength(text) > MAX_BYTES)throw new Error('Saved preference storage is full');
    mkdirSync(dirname(this.file),{recursive:true});
    const temporary=this.file+'.'+randomUUID()+'.tmp';
    try { writeFileSync(temporary,text,{flag:'wx',mode:0o600});renameSync(temporary,this.file); }
    catch(error) {try{unlinkSync(temporary);}catch{}throw error;}
    this.values=next;
  }
}

export function desktopSettingsRequest(event, contents, origin, store, request) {
  try {
    if(event.sender !== contents || new URL(event.senderFrame?.url).origin !== origin)throw new Error('Untrusted settings request');
    if(!request || !['get','set','remove'].includes(request.operation))throw new Error('Invalid settings operation');
    let value=null;
    if(request.operation==='get')value=store.getItem(request.key);
    else if(request.operation==='set')store.setItem(request.key,request.value);
    else store.removeItem(request.key);
    return {ok:true,value};
  } catch { return {ok:false,error:'Preferences are unavailable or this request is not allowed. Existing saved data was kept.'}; }
}
