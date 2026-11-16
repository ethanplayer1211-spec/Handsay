import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as ort from 'onnxruntime-web/wasm';
import { parseMeta, parseLabels } from '../src/ml/meta';
import { decodeReplay } from '../src/replay/clips';
import type { ModelInput } from '../src/ml/features';
export async function loadFixtureModel() {
  const json=(file:string)=>JSON.parse(readFileSync(resolve(file),'utf8'));
  const meta=parseMeta(json('public/models/model-meta.json'));
  const labels=parseLabels(json('public/models/labels.json'),meta.classes);
  const replay=decodeReplay(json('public/replay/clips.json'));
  ort.env.wasm.numThreads=1;
  ort.env.wasm.wasmBinary=new Uint8Array(readFileSync(resolve('public/vendor/ort/ort-wasm-simd-threaded.wasm')));
  const session=await ort.InferenceSession.create(new Uint8Array(readFileSync(resolve('public/models/model.onnx'))),{executionProviders:['wasm']});
  const infer=async(input:ModelInput)=>{
    const out=await session.run({frames:new ort.Tensor('float32',input.data,[1,input.frames,meta.featureDim])});
    return {logits:out.logits.data as Float32Array,embedding:out.embedding.data as Float32Array};
  };
  return {meta,labels,replay,infer,release:()=>session.release()};
}
