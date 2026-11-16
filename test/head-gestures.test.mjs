import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeadGestureDetector, headPoseFromFrame } from '../src/head-gestures.js';
import { captionStyle, removeLastWord, finishSentence } from '../src/caption-overlay.js';
const p = (yaw=0,pitch=0) => ({yaw,pitch,roll:0});
function rig() {
  const detector = new HeadGestureDetector(); let t=0; const events=[];
  const feed=(pose,n=1,allowed=true)=>{for(let i=0;i<n;i++){t+=50;const e=detector.push(pose,t,allowed);if(['nod','shake','calibrated'].includes(e.kind))events.push(e);} };
  detector.calibrate(); feed(p(),30); feed(p(),30); return {detector,feed,events};
}
test('deliberate nod and shake require returning to neutral, with cooldown',()=>{
  const r=rig();r.feed(p(0,.16),9);assert.equal(r.events.some(e=>e.kind==='nod'),false);r.feed(p(),9);assert.equal(r.events.filter(e=>e.kind==='nod').length,1);
  r.feed(p(0,.16),9);r.feed(p(),9);assert.equal(r.events.filter(e=>e.kind==='nod').length,1);
  const s=rig();s.feed(p(.25,0),8);s.feed(p(-.25,0),10);assert.equal(s.events.some(e=>e.kind==='shake'),false);s.feed(p(),9);assert.equal(s.events.filter(e=>e.kind==='shake').length,1);
});
test('jitter, one-sided looking, diagonal motion, missing face and hand activity do not trigger actions',()=>{
  for(const kind of ['jitter','look','diagonal','missing','hands']) {
    const r=rig();
    if(kind==='jitter'){for(let i=0;i<70;i++)r.feed(p(Math.sin(i)*.025,Math.cos(i)*.015));}
    if(kind==='look'){r.feed(p(.25,0),10);r.feed(p(),10);}
    if(kind==='diagonal'){r.feed(p(.25,.2),10);r.feed(p(),10);}
    if(kind==='missing'){r.feed(p(0,.16),9);r.feed(null);r.feed(p(),10);}
    if(kind==='hands'){r.feed(p(0,.16),9,false);r.feed(p(),9,false);}
    assert.equal(r.events.some(e=>e.kind==='nod'||e.kind==='shake'),false,kind);
  }
});
test('calibration must be stable; reset requires recalibration',()=>{
  const r=rig();r.detector.reset();r.feed(p(0,.2),10);r.feed(p(),10);assert.equal(r.detector.base,null);
  const d=new HeadGestureDetector();d.calibrate();for(let i=0;i<60;i++)d.push(p(i%2?.3:-.3),i*50);assert.equal(d.base,null);
});
test('face geometry is translation and scale invariant and rejects absent landmarks',()=>{
  const frame=new Float32Array(543*3).fill(NaN);const points={33:[.3,.3],263:[.7,.3],1:[.5,.4],152:[.5,.7],10:[.5,.1]};
  for(const [i,xy]of Object.entries(points)){frame[i*3]=xy[0];frame[i*3+1]=xy[1];}
  const a=headPoseFromFrame(frame);assert.ok(a);assert.ok(Math.abs(a.yaw)<.001);
  const moved=frame.map(v=>v*.7+.1);const b=headPoseFromFrame(moved);assert.ok(Math.abs(a.pitch-b.pitch)<1e-6);assert.equal(headPoseFromFrame(new Float32Array(543*3).fill(NaN)),null);
});
test('caption styles are restricted and text corrections preserve words',()=>{
  assert.equal(captionStyle({size:100,color:'url(x)',font:'evil'}).size,56);assert.equal(captionStyle({color:'bad'}).color,'#ffffff');
  assert.equal(removeLastWord('Hello thank you').text,'Hello thank');assert.equal(finishSentence(' Hello '),'Hello.');assert.equal(finishSentence('Why?'),'Why?');assert.equal(finishSentence(' '),'');
  assert.equal(finishSentence('a'.repeat(1000)).length,1000);
});
