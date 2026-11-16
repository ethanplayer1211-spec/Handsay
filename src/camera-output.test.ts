import { describe,it,expect,vi } from 'vitest';
import { captionLayout, wrapCaption, CameraOutput } from './camera-output.js';
import { CameraBridge } from '../shared/camera-bridge.mjs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

function context() {
  return {font:'40px Arial',measureText(text:string){const size=Number(/(\d+)px/.exec(this.font)?.[1] || 40);return {width:Array.from(text).length*size*.55};}};
}
describe('outgoing caption layout',()=>{
  it('a cancelled helper startup timeout cannot stop a newer active helper',async()=>{
    vi.useFakeTimers();
    const children:any[]=[];
    const bridge=new CameraBridge({platform:'win32',exists:()=>true,spawnImpl:()=>{
      const child:any=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=0;child.kill=vi.fn();children.push(child);return child;
    }});
    let heartbeat;
    try {
      const old=expect(bridge.start(bridge.status().startKey)).rejects.toThrow('did not start in time');
      bridge.stop('cancelled startup');
      const starting=bridge.start(bridge.status().startKey);
      children[1].stdout.write(JSON.stringify({ready:true})+'\n');
      const {lease}=await starting;
      heartbeat=setInterval(()=>{
        const sent=bridge.frame(lease,Buffer.from([255,216,255,217]));
        children[1].stdout.write(JSON.stringify({frame:1})+'\n');void sent.catch(()=>{});
      },1000);
      await vi.advanceTimersByTimeAsync(12001);await old;
      expect(bridge.status().active).toBe(true);expect(bridge.child).toBe(children[1]);
    } finally { clearInterval(heartbeat);bridge.stop();vi.useRealTimers(); }
  });
  it('does not start a native output after cancellation while checking its availability',async()=>{
    let finishInfo!:(value:unknown)=>void;
    const calls:string[]=[];
    const output=new CameraOutput({canvas:{},state:()=>({}),fetchImpl:async(path:string)=>{
      calls.push(path);return {ok:true,json:async()=>await new Promise(resolve=>{finishInfo=resolve;})};
    }});
    const starting=output.start();for(let i=0;i<5;i++)await Promise.resolve();
    await output.stop();finishInfo({setupReady:true,startKey:'setup'});
    expect(await starting).toBe(false);expect(calls).toEqual(['/api/camera/status']);
    output.dispose();
  });
  it('stops sending immediately even when the helper stop request is slow',async()=>{
    let finishStop!:(value:unknown)=>void;
    const output=new CameraOutput({canvas:{},state:()=>({}),fetchImpl:async()=>await new Promise(resolve=>{finishStop=resolve;})});
    output.active=true;output.lease='owner';
    const stopping=output.stop();
    expect(output.active).toBe(false);expect(output.lease).toBe(null);
    finishStop({ok:true,json:async()=>({stopped:true})});await stopping;output.dispose();
  });
  it('cannot resurrect camera output when End or Stop is clicked during startup',async()=>{
    vi.useFakeTimers();
    let finishStart!:(value:unknown)=>void;
    const calls:{path:string,key?:string}[]=[];
    const fetchImpl=async(path:string,options:any={})=>{
      calls.push({path,key:options.headers?.['X-Handsay-Camera']});
      const data=path.endsWith('/status')?{setupReady:true,startKey:'setup'}:path.endsWith('/start')?await new Promise(r=>{finishStart=r;}):{stopped:true};
      return {ok:true,json:async()=>data};
    };
    const output=new CameraOutput({canvas:{},state:()=>({}),fetchImpl});
    const starting=output.start();
    for(let i=0;i<8;i++)await Promise.resolve();
    await output.stop();finishStart({lease:'cancelled-start'});
    expect(await starting).toBe(false);expect(output.active).toBe(false);
    expect(calls).toContainEqual({path:'/api/camera/stop',key:'cancelled-start'});
    output.dispose();vi.useRealTimers();
  });
  it('wraps full words and long unbroken text without losing or reversing letters',()=>{
    const c=context();
    const text='Hello this is an interview message';
    expect(wrapCaption(c,text,200).join(' ')).toBe(text);
    const long='안녕하세요'.repeat(45);
    expect(wrapCaption(c,long,200).join('')).toBe(long);
  });
  it('fits a full-length message, including emoji, within the camera instead of silently cutting it off',()=>{
    for(const text of ['word '.repeat(200).trim(),'한'.repeat(1000),'😀'.repeat(500)]){
      const c=context();const layout=captionLayout(c,text,{font:'sans',size:56,position:'bottom'},1280,720);
      expect(layout.lines.join('').replace(/\s/g,'')).toBe(text.replace(/\s/g,''));
      expect(layout.y+layout.boxHeight).toBeLessThanOrEqual(720);
      expect(layout.lines.every(line=>c.measureText(line).width<=1280*.86)).toBe(true);
    }
  });
});
