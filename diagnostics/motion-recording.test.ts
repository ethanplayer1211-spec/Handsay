import {it,expect} from 'vitest';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {Segmenter,LIVE_SEGMENTER} from '../src/ml/segmenter';
import {MotionStability} from '../src/ml/motion-stability';
const source='output/live-review/raw/tracking-before.json';
(existsSync(source)?it:it.skip)('replays private recorded tracker coordinates through the revised activity detector',()=>{
  const recording=JSON.parse(readFileSync(source,'utf8')),segmenter=new Segmenter(LIVE_SEGMENTER),motion=new MotionStability(),events:any[]=[],states:any[]=[];
  for(const sample of recording.frames){
    const frame=Float32Array.from(sample.frame,(v:number|null)=>v===null?NaN:v);
    const result=segmenter.push(frame,sample.t);states.push({sourceSecond:sample.sourceSecond,...motion.push(frame,sample.t)});
    if(result)events.push({t:sample.t,type:result.type,...('reason'in result?{reason:result.reason}:{}),...('segment'in result?{durationMs:result.segment.durationMs}:{})});
  }
  const window=(rows:any[])=>rows.filter(s=>s.sourceSecond>=318.3&&s.sourceSecond<=321);
  const before=window(recording.frames).filter(s=>s.hands&&s.motion.moving).length;
  const after=window(states).filter(s=>s.moving).length;
  const report={scope:'Re-tracked compressed screen recording with baked-in overlay, not raw live validation',frames:recording.frames.length,beforeEvents:recording.events,afterEvents:events,heldPalmWindow:{start:318.3,end:321,beforeMovingFrames:before,afterMovingFrames:after}};
  writeFileSync('output/live-review/raw/motion-comparison.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));expect(states.length).toBe(recording.frames.length);
});
