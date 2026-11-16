import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelClient } from './model-client';
import type { ModelInput } from './features';

const json = (file: string) => JSON.parse(readFileSync(new URL(`../../public/models/${file}`,import.meta.url),'utf8'));
class WorkerStub {
  static latest: WorkerStub;
  onmessage: ((event: {data: unknown})=>void) | null = null;
  onerror: ((event: {message: string})=>void) | null = null;
  onmessageerror: (()=>void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn((message: {type: string})=>{
    if(message.type==='load')queueMicrotask(()=>this.onmessage?.({data:{type:'loaded'}}));
  });
  constructor() { WorkerStub.latest=this; }
}
const input = (): ModelInput => ({data:new Float32Array(8), frames:8,dim:1});
beforeEach(()=>{
  vi.useFakeTimers(); vi.stubGlobal('Worker',WorkerStub);
  vi.stubGlobal('location',{href:'http://localhost/'});
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>json(url.includes('labels')?'labels.json':'model-meta.json')})));
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});

describe('model worker failure recovery',()=>{
  it('resolves a matching result, preserves caller features and removes the watchdog',async()=>{
    const {client}=await ModelClient.load(), worker=WorkerStub.latest;
    const features=input(), result=client.infer(features);
    const message=worker.postMessage.mock.calls.at(-1)?.[0] as {id:number};
    worker.onmessage?.({data:{type:'result',id:message.id,logits:new Float32Array([1]),embedding:new Float32Array([2]),ms:5}});
    expect((await result).ms).toBe(5);expect(features.data.length).toBe(8);
    expect(vi.getTimerCount()).toBe(0);client.dispose();
  });
  it('times out all pending work, releases the worker and rejects future requests immediately',async()=>{
    const {client}=await ModelClient.load(),worker=WorkerStub.latest;
    const first=expect(client.infer(input())).rejects.toThrow('stopped responding');
    const second=expect(client.infer(input())).rejects.toThrow('stopped responding');
    await vi.advanceTimersByTimeAsync(10001);await Promise.all([first,second]);
    expect(client.closed).toBe(true);expect(worker.terminate).toHaveBeenCalledOnce();
    await expect(client.infer(input())).rejects.toThrow('closed');
    expect(vi.getTimerCount()).toBe(0);client.dispose();expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it.each(['crash','unreadable message'])('rejects pending results after a worker %s',async(kind)=>{
    const {client}=await ModelClient.load(),worker=WorkerStub.latest;
    const pending=expect(client.infer(input())).rejects.toThrow(/stopped|unreadable/);
    if(kind==='crash')worker.onerror?.({message:'model stopped'});else worker.onmessageerror?.();
    await pending;expect(client.closed).toBe(true);expect(vi.getTimerCount()).toBe(0);
  });
  it('releases an initialization that never replies',async()=>{
    class SilentWorker extends WorkerStub { postMessage=vi.fn(); }
    vi.stubGlobal('Worker',SilentWorker);
    const loading=expect(ModelClient.load()).rejects.toThrow('too long to start');
    await vi.advanceTimersByTimeAsync(45001);await loading;
    expect(WorkerStub.latest.terminate).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels the initialization watchdog if a metadata asset fails',async()=>{
    vi.stubGlobal('fetch',async()=>({ok:false,status:503}));
    class SilentWorker extends WorkerStub { postMessage=vi.fn(); }
    vi.stubGlobal('Worker',SilentWorker);
    await expect(ModelClient.load()).rejects.toThrow('503');
    expect(WorkerStub.latest.terminate).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
  });
});
