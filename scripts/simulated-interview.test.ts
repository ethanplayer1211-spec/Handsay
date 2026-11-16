import { test,expect } from 'vitest';
import { once } from 'node:events';
import { writeFileSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../server.mjs';
import { loadFixtureModel } from './model-fixture';
import { classifySegment } from '../src/ml/consensus';
import { LiveCaptionGate } from '../src/live-caption.js';

test('simulated participants exchange reviewed model answers, questions and a typed fallback',async()=>{
  const model=await loadFixtureModel();
  const server=createApp();server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const req=async(path:string,key?:string,data?:unknown)=>{
    const response=await fetch(base+path,{method:data?'POST':'GET',headers:{...(key?{Authorization:`Bearer ${key}`}:{ }),'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
    return {status:response.status,body:await response.json()};
  };
  const rows=[];
  try {
    const room=(await req('/api/rooms',undefined,{})).body,path=`/api/rooms/${room.id}`;
    let cursor=0;
    for(const [i,turn] of [
      {question:'Please greet me.',sign:'hello'},
      {question:'Which colour are you showing?',sign:'blue'},
      {question:'What do you mean by that sign?',sign:'quiet'},
      {question:'Would you like more time?',text:'Please give me a moment to answer.'},
    ].entries()){
      const asked=await req(path+'/events',room.readKey,{type:'question',text:turn.question,clientId:`question-${i}`});expect(asked.status).toBe(201);
      const writerView=await req(path+`?after=${cursor}`,room.writeKey);expect(writerView.body.events.at(-1).text).toBe(turn.question);
      let answer=turn.text,raw=null,accepted=null,review='typed fallback';
      if(turn.sign){
        const clip=model.replay.clips.find(c=>c.sign===turn.sign)!;
        const segment={frames:clip.frames,fps:clip.fps,durationMs:(clip.frames.length-1)*1000/clip.fps,timestamps:clip.frames.map((_,j)=>j*1000/clip.fps)};
        const result=await classifySegment(model.meta,model.labels,model.infer,segment,false,true);
        const [best,next]=result.decision.top,checked=result.verification?.[0];raw=model.labels[best.index].label;
        accepted=new LiveCaptionGate().accept({text:raw,probability:best.probability,runnerUp:next?.probability||0,verification:checked?{text:model.labels[checked.index].label,probability:checked.probability,runnerUp:result.verification?.[1]?.probability||0}:null,durationMs:segment.durationMs,at:1000}).accepted;
        // A scripted reviewer uses the known fixture reference. This is not an
        // automatic model correction and is not evidence of human signing accuracy.
        answer=turn.sign[0].toUpperCase()+turn.sign.slice(1);
        review=raw!==turn.sign?'scripted correction using dataset reference':!accepted?'scripted selection of held-back correct word':'accepted word reviewed before send';
      }
      const sent=await req(path+'/events',room.writeKey,{type:'caption',text:answer,clientId:`answer-${i}`});expect(sent.status).toBe(201);
      const duplicate=await req(path+'/events',room.writeKey,{type:'caption',text:answer,clientId:`answer-${i}`});expect(duplicate.body.seq).toBe(sent.body.seq);
      const readerView=await req(path+`?after=${cursor}`,room.readKey);expect(readerView.body.events.at(-1).text).toBe(answer);
      cursor=sent.body.seq;
      rows.push({question:turn.question,reference:turn.sign||null,rawPrediction:raw,acceptedByFilter:accepted,review,delivered:answer});
    }
    const transcript=(await req(path,room.readKey)).body.events;
    expect(transcript.filter(e=>e.type==='caption')).toHaveLength(4);expect(transcript.filter(e=>e.type==='question')).toHaveLength(4);
    expect(transcript.some(e=>e.type==='caption'&&e.text==='Shh')).toBe(false);
    expect((await req(path+'/end',room.writeKey,{})).status).toBe(200);
    expect((await req(path,room.readKey)).status).toBe(404);
    const report={generatedAt:new Date().toISOString(),kind:'Scripted AI-role simulation; no human participant or generated signing avatar',passed:true,questions:4,answers:4,rows,
      checks:['question delivered to signer','reviewed answer delivered to interviewer','uncertain sign reviewed','confident label mismatch corrected using known reference','typed fallback','duplicate send idempotency','ending invalidates room'],
      limitations:['Selected recorded landmark clips, not live webcam capture.','Scripted review uses known dataset references, not autonomous ASL understanding.','Does not establish real-human usability, signing accuracy or performance in any third-party call app.']};
    mkdirSync(resolve('docs/evaluation'),{recursive:true});writeFileSync(resolve('docs/evaluation/simulated-interview.json'),JSON.stringify(report,null,2)+'\n');
  } finally {await model.release();await new Promise<void>(r=>server.close(()=>r()));}
},60000);
