import {test} from 'node:test';import assert from 'node:assert/strict';
import {chooseVoices,introductionText,LiveVoiceQueue} from '../src/voice.js';
function rig(){const spoken=[],callbacks=[],timers=new Map();let id=0,cancels=0,disabled=false;const q=new LiveVoiceQueue({speak:(text,end,error)=>{spoken.push(text);callbacks.push({end,error});},cancel:()=>cancels++,setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:key=>timers.delete(key),disabled:()=>disabled=true});return {q,spoken,callbacks,timers,get cancels(){return cancels;},get disabled(){return disabled;}};}
test('profiles select available named voices, preserve choices and handle one or no voice honestly',()=>{
 const voices=[{name:'Microsoft Zira',voiceURI:'zira',lang:'en-US'},{name:'Microsoft David',voiceURI:'david',lang:'en-US'}];
 assert.equal(chooseVoices(voices).female.voiceURI,'zira');assert.equal(chooseVoices(voices).male.voiceURI,'david');
 assert.equal(chooseVoices(voices,{female:'david'}).female.voiceURI,'david');assert.deepEqual(chooseVoices([]),{female:null,male:null});assert.equal(chooseVoices(voices.slice(0,1)).male.voiceURI,'zira');
});
test('intro adds only communication needs the user explicitly supplied',()=>{
 assert.doesNotMatch(introductionText(),/disability|deaf|nonspeaking/);assert.match(introductionText('Sam','I have difficulty speaking'),/Hello, I'm Sam\. I have difficulty speaking\./);
});
test('new words are batched, then spoken in order without overlap or replay on a flush',()=>{
 const r=rig();r.q.setEnabled(true);r.q.add('hello');r.q.add('there');r.q.flush();assert.deepEqual(r.spoken,['hello there']);
 r.q.add('thank you');r.q.flush();assert.deepEqual(r.spoken,['hello there']);r.callbacks[0].end();assert.deepEqual(r.spoken,['hello there','thank you']);r.callbacks[1].end();r.q.flush();assert.equal(r.spoken.length,2);
});
test('correction and stop remove queued words and ignore stale speech completion callbacks',()=>{
 const r=rig();r.q.setEnabled(true);r.q.add('wrong');r.q.flush();r.q.add('queued');r.q.stop();r.callbacks[0].end();assert.deepEqual(r.spoken,['wrong']);assert.equal(r.timers.size,0);
 r.q.say('introduction');assert.deepEqual(r.spoken,['wrong','introduction']);
});
test('queue overflow disables live voice instead of allowing an unbounded delay',()=>{
 const r=rig();r.q.setEnabled(true);for(let i=0;i<11;i++){r.q.add(`word ${i}`);r.q.flush();}assert.equal(r.disabled,true);assert.equal(r.q.enabled,false);assert.equal(r.q.queue.length,0);
});
test('a synthesis error pauses live voice instead of repeatedly queuing failed audio',()=>{
 const r=rig();r.q.setEnabled(true);r.q.add('hello');r.q.flush();r.callbacks[0].error();assert.equal(r.disabled,true);assert.equal(r.q.enabled,false);r.q.add('another word');r.q.flush();assert.deepEqual(r.spoken,['hello']);
});
