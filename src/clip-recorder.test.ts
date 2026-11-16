import {afterEach,describe,expect,it,vi} from 'vitest';
import {ClipRecorder} from './clip-recorder.js';

class Encoder {
  static latest:Encoder;
  static isTypeSupported=()=>true;
  state='inactive';mimeType='video/webm';ondataavailable:any;onstop:any;onerror:any;
  constructor(){Encoder.latest=this;}
  start(){this.state='recording';}
  stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['test-video'])});this.onstop?.();}
}
function setup(options:any={}) {
  vi.useFakeTimers();const track={stop:vi.fn()};
  const stream={getAudioTracks:()=>[],getTracks:()=>[track]};
  const render=vi.fn(),revoke=vi.fn(),state=vi.fn();
  const recorder=new ClipRecorder({canvas:{captureStream:()=>stream},render,onState:state,Recorder:Encoder,makeURL:()=> 'blob:test-video',revokeURL:revoke,...options});
  return {recorder,track,render,revoke,state};
}
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});
describe('local canvas video recording',()=>{
  it('creates a video-only download and releases tracks and timers on stop',async()=>{
    const {recorder,track,revoke}=setup();const done=recorder.start();
    expect(recorder.active).toBe(true);await recorder.stop();
    expect((await done)?.blob.type).toBe('video/webm');expect(recorder.active).toBe(false);
    expect(track.stop).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
    recorder.dispose();expect(revoke).toHaveBeenCalledWith('blob:test-video');
  });
  it('never accepts audio tracks in its capture stream',()=>{
    const track={stop:vi.fn()};const {recorder}=setup({canvas:{captureStream:()=>({getAudioTracks:()=>[track],getTracks:()=>[track]})}});
    expect(()=>recorder.start()).toThrow('silent video');expect(track.stop).toHaveBeenCalledOnce();
  });
  it('stops at the duration cap and finishes a broken encoder without hanging',async()=>{
    class SilentEncoder extends Encoder {stop(){this.state='inactive';}}
    const {recorder,track}=setup({Recorder:SilentEncoder,maxMs:500});const done=recorder.start();
    await vi.advanceTimersByTimeAsync(4001);
    expect(await done).toBe(null);expect(recorder.active).toBe(false);expect(track.stop).toHaveBeenCalledOnce();
  });
  it('discards an unfinished recording on disposal and ignores late encoder data',async()=>{
    const {recorder,track}=setup();const done=recorder.start();recorder.dispose();
    expect(await done).toBe(null);expect(track.stop).toHaveBeenCalledOnce();
    Encoder.latest.ondataavailable?.({data:new Blob(['late'])});expect(recorder.url).toBe(null);
  });
  it('stops if rendering fails instead of continuing with an unknown video source',async()=>{
    const {recorder,render,track}=setup();render.mockImplementationOnce(()=>{}).mockImplementation(()=>{throw new Error('render failed');});
    const done=recorder.start();await vi.advanceTimersByTimeAsync(51);await done;
    expect(recorder.active).toBe(false);expect(track.stop).toHaveBeenCalledOnce();
  });
});
