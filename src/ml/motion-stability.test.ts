import { describe,it,expect } from 'vitest';
import { MotionStability } from './motion-stability';
import { Segmenter,LIVE_SEGMENTER } from './segmenter';
import { emptyFrame,LEFT_HAND_START,RIGHT_HAND_START,POSE_START,type Frame } from './landmarks';

function hand({x=.45,y=.4,angle=0,jitter=0,side=RIGHT_HAND_START,flex=0}={}):Frame {
  const frame=emptyFrame();
  for(const [p,px,py] of [[POSE_START+11,.62,.65],[POSE_START+12,.38,.65]]) {frame[p*3]=px;frame[p*3+1]=py;frame[p*3+2]=0;}
  const shape=[[0,0],[.025,-.015],[.045,-.04],[.065,-.055],[.08,-.06], [.035,-.07],[.04,-.12],[.04,-.15],[.04,-.18], [0,-.08],[0,-.14],[0,-.18],[0,-.21], [-.025,-.07],[-.03,-.12],[-.03,-.15],[-.03,-.18], [-.05,-.06],[-.06,-.10],[-.065,-.12],[-.07,-.14]];
  const a=angle*Math.PI/180;
  shape.forEach(([px,py],i)=>{
    const bent=i>=5&&i<=8?flex:0;
    frame[(side+i)*3]=x+px*Math.cos(a)+jitter;
    frame[(side+i)*3+1]=y+py+bent+jitter;
    frame[(side+i)*3+2]=-px*Math.sin(a);
  });
  return frame;
}
function events(frames:Frame[],fps=30) {
  const seg=new Segmenter(LIVE_SEGMENTER),result=[];
  frames.forEach((frame,i)=>{const event=seg.push(frame,i*1000/fps);if(event)result.push(event);});
  return result;
}
describe('stable live hand activity',()=>{
  it('does not treat estimated depth wobble of a stationary palm as travel at 15fps',()=>{
    const frames=Array.from({length:90},(_,i)=>{
      const frame=hand({jitter:Math.sin(i)*.001});
      for(let p=0;p<21;p++)frame[(RIGHT_HAND_START+p)*3+2]+=Math.sin(i*2.1)*.05;
      return frame;
    });
    expect(events(frames,15)).toEqual([]);
  });
  it.each([15,30,60])('ignores stationary landmark jitter at %i fps',fps=>{
    const frames=Array.from({length:fps*3},(_,i)=>hand({jitter:Math.sin(i*2.1)*.002}));
    expect(events(frames,fps).map(e=>e.type)).toEqual([]);
  });
  it('does not turn a one-frame landmark spike into a sign',()=>{
    const frames=Array.from({length:60},(_,i)=>hand({x:i===20?.8:.45}));
    expect(events(frames).map(e=>e.type)).toEqual([]);
  });
  it('keeps observed motion before an early tracking gap instead of starting the model input at reacquisition',()=>{
    const frames=Array.from({length:24},(_,i)=>hand({x:.3+i*.008}));
    for(let i=2;i<=7;i++)frames[i]=emptyFrame();
    frames.push(...Array.from({length:45},()=>hand({x:.484})));
    const result=events(frames);
    expect(result.map(e=>e.type)).toEqual(['start','end']);
    if(result[1].type==='end')expect(result[1].segment.timestamps[0]).toBe(0);
  });
  it('does not settle midway through a returning palm turn',()=>{
    const motion=new MotionStability();let started=false,stopped=false;
    for(let i=0;i<70;i++) {
      const state=motion.push(hand({angle:80*Math.sin(i*.22)}),i*1000/30);
      if(state.moving)started=true;
      if(started&&!state.moving)stopped=true;
    }
    expect(started).toBe(true);expect(stopped).toBe(false);
  });
  it.each([15,30,60])('settles after movement even when the held hand keeps jittering at %i fps',fps=>{
    const frames=[...Array.from({length:24},(_,i)=>hand({x:.3+i*.008})),...Array.from({length:60},(_,i)=>hand({x:.484,jitter:Math.sin(i*2.1)*.002}))];
    expect(events(frames,fps).map(e=>e.type)).toEqual(['start','end']);
    const motion=new MotionStability();let stoppedAt=Infinity;
    frames.forEach((frame,i)=>{const state=motion.push(frame,i*1000/fps);if(i>=24&&!state.moving)stoppedAt=Math.min(stoppedAt,i*1000/fps);});
    expect(stoppedAt-24*1000/fps).toBeLessThanOrEqual(300);
  });
  it('treats a 3D palm turn as motion even while the wrist stays fixed',()=>{
    const motion=new MotionStability();
    const moving=Array.from({length:30},(_,i)=>motion.push(hand({angle:i*6}),i*1000/30));
    expect(moving.slice(8).every(s=>s.moving)).toBe(true);
    expect(moving.some(s=>s.rotation>20)).toBe(true);
    let last;
    for(let i=30;i<65;i++)last=motion.push(hand({angle:174,jitter:Math.sin(i)*.0005}),i*1000/30);
    expect(last?.moving).toBe(false);
    expect(moving.some(s=>s.identityChanged)).toBe(false);
  });
  it('ignores independent small joint/depth noise after an actual sign has stopped',()=>{
    const frames=[...Array.from({length:24},(_,i)=>hand({x:.3+i*.008})),...Array.from({length:90},(_,i)=>{
      const frame=hand({x:.484});
      for(let p=0;p<21;p++)for(let axis=0;axis<3;axis++)frame[(RIGHT_HAND_START+p)*3+axis]+=Math.sin(i*1.9+p*2.3+axis*1.7)*.003;
      return frame;
    })];
    expect(events(frames).map(e=>e.type)).toEqual(['start','end']);
  });
  it('can follow finger articulation without wrist translation',()=>{
    const motion=new MotionStability();let moved=false;
    for(let i=0;i<30;i++)moved ||= motion.push(hand({flex:i*.003}),i*1000/30).moving;
    expect(moved).toBe(true);
  });
  it('recognizes a tracker-side switch without treating it as a large physical jump or changing raw data',()=>{
    const motion=new MotionStability();let switched=false;
    for(let i=0;i<30;i++) {
      const frame=hand({side:i<15?LEFT_HAND_START:RIGHT_HAND_START});const copy=frame.slice();
      const state=motion.push(frame,i*1000/30);switched ||= state.identityChanged;
      expect(state.moving).toBe(false);
      expect([...frame]).toEqual([...copy]);
    }
    expect(switched).toBe(true);
  });
  it('marks a side switch inside a sign for review and does not repeatedly classify the held pose',()=>{
    const frames=Array.from({length:24},(_,i)=>hand({x:.3+i*.008,side:i<14?LEFT_HAND_START:RIGHT_HAND_START}));
    frames.push(...Array.from({length:60},()=>hand({x:.484})));
    const result=events(frames);
    expect(result.map(e=>e.type)).toEqual(['start','end']);
    if(result[1].type==='end')expect(result[1].segment.trackingIssue).toBe('hand-identity-change');
  });
});
