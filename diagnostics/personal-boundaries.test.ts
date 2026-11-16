import {it,expect} from 'vitest';
import {loadFixtureModel} from '../scripts/model-fixture';
import {modelInput} from '../src/ml/features';
import {cosine} from '../src/ml/prototypes';
import {matchPersonalGesture} from '../src/ml/personal-gestures';
import {mkdirSync,writeFileSync} from 'node:fs';
it('inspects actual embedding stability across sample boundaries',async()=>{
 const m=await loadFixtureModel(),rows=[],library=[];
 try{
  for(const name of ['hello','blue']){
   const clip=m.replay.clips.find(c=>c.sign===name)!;const n=Math.floor(clip.frames.length*.1);
   const variants=[clip.frames,clip.frames.slice(n),clip.frames.slice(0,-n),clip.frames.slice(n,-n)];
   const embeddings=[];
   for(const frames of variants)embeddings.push((await m.infer(modelInput(frames,clip.fps,m.meta))).embedding);
   library.push({id:name,name,takes:embeddings.slice(0,3)});
   rows.push({sign:name,scores:embeddings.map(e=>embeddings.map(f=>Number(cosine(e,f).toFixed(4))))});
  }
  const checks=[];
  for(const clip of m.replay.clips){
   const n=Math.floor(clip.frames.length*.1),frames=clip.frames.slice(n,-n);
   const embedding=(await m.infer(modelInput(frames,clip.fps,m.meta))).embedding;
   const match=matchPersonalGesture(embedding,library,{margin:.12,boundaryAllowance:.04});
   checks.push({sign:clip.sign,kind:match.kind,...('gesture'in match?{phrase:match.gesture.name,similarity:match.similarity,margin:match.margin}:{})});
   if(['hello','blue'].includes(clip.sign)){
    expect(match.kind).toBe('match');if('gesture'in match)expect(match.gesture.id).toBe(clip.sign);
   }else expect(match.kind).not.toBe('match');
  }
  const report={scope:'Selected bundled clips and variants of the same clips; integration regression only, not independent signer or live accuracy.',boundaries:rows,checks};
  mkdirSync('output/live-review/raw',{recursive:true});
  writeFileSync('output/live-review/raw/embedding-boundaries.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(checks));expect(rows).toHaveLength(2);
 }finally{await m.release();}
});
