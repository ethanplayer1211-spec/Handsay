import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrackerClient } from './tracker-client';

class WorkerStub {
  static latest: WorkerStub;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn((message: { type: string }) => {
    if (message.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: 'ready', delegate: 'GPU' } }));
  });
  constructor() { WorkerStub.latest = this; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('camera tracking lifecycle', () => {
  it('stops a camera that remains connected but never supplies usable images',async()=>{
    vi.useFakeTimers();vi.stubGlobal('Worker',WorkerStub);
    const tracker=await TrackerClient.create('hands_pose_lips'),fail=vi.fn();
    tracker.start({readyState:1} as HTMLVideoElement,vi.fn(),fail);
    await vi.advanceTimersByTimeAsync(8001);
    expect(fail).toHaveBeenCalledWith(expect.stringContaining('No camera images'));
    expect(WorkerStub.latest.terminate).toHaveBeenCalledOnce();tracker.dispose();
  });
  it('continues timed capture without preview paint callbacks and stops scheduling after disposal', async () => {
    vi.useFakeTimers();vi.stubGlobal('Worker', WorkerStub);
    vi.stubGlobal('createImageBitmap', async () => ({close:vi.fn()}));
    const tracker=await TrackerClient.create('hands_pose_lips');
    const worker=WorkerStub.latest;
    worker.postMessage.mockImplementation((message:{type:string,t?:number})=>{
      if(message.type==='frame')queueMicrotask(()=>worker.onmessage?.({data:{type:'landmarks',frame:new Float32Array(1629),t:message.t,poses:1,ms:5}}));
    });
    const previewPaint=vi.fn(), received=vi.fn();
    tracker.start({readyState:2,videoWidth:960,requestVideoFrameCallback:previewPaint} as unknown as HTMLVideoElement,received);
    await vi.advanceTimersByTimeAsync(125);
    expect(received.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(previewPaint).not.toHaveBeenCalled();
    tracker.dispose();const count=received.mock.calls.length;
    await vi.advanceTimersByTimeAsync(400);expect(received).toHaveBeenCalledTimes(count);
  });
  it('stops and reports repeated tracking failures instead of silently freezing captions', async () => {
    vi.useFakeTimers();vi.stubGlobal('Worker', WorkerStub);
    vi.stubGlobal('createImageBitmap',async()=>({close:vi.fn()}));
    const tracker = await TrackerClient.create('hands_pose_lips');
    const fail = vi.fn();
    WorkerStub.latest.postMessage.mockImplementation((message:{type:string,t?:number})=>{
      if(message.type==='frame')queueMicrotask(()=>WorkerStub.latest.onmessage?.({data:{type:'frame-error',t:message.t,message:'bad frame'}}));
    });
    tracker.start({ readyState: 2, videoWidth:960 } as HTMLVideoElement, vi.fn(), fail);
    await vi.advanceTimersByTimeAsync(250);
    expect(fail).toHaveBeenCalledWith('Camera tracking repeatedly failed');
    expect(WorkerStub.latest.terminate).toHaveBeenCalledOnce();
    const count=WorkerStub.latest.postMessage.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);expect(WorkerStub.latest.postMessage).toHaveBeenCalledTimes(count);
    tracker.dispose();
  });
  it('releases a crashed tracking worker without continuing capture',async()=>{
    vi.stubGlobal('Worker',WorkerStub);
    const tracker=await TrackerClient.create('hands_pose_lips'),fail=vi.fn();
    tracker.start({readyState:1} as HTMLVideoElement,vi.fn(),fail);
    WorkerStub.latest.onerror?.({ message: 'stopped' });
    expect(fail).toHaveBeenCalledWith('The tracking engine stopped');
    tracker.dispose();
    expect(WorkerStub.latest.terminate).toHaveBeenCalledOnce();
  });
  it('times out a frozen bitmap or frame request and closes late bitmaps',async()=>{
    vi.useFakeTimers();vi.stubGlobal('Worker',WorkerStub);
    let finish!:(bitmap:{close:()=>void})=>void;
    vi.stubGlobal('createImageBitmap',()=>new Promise(resolve=>{finish=resolve;}));
    const tracker=await TrackerClient.create('hands_pose_lips'),fail=vi.fn(),received=vi.fn();
    tracker.start({readyState:2,videoWidth:960} as HTMLVideoElement,received,fail);
    await vi.advanceTimersByTimeAsync(8001);
    expect(fail).toHaveBeenCalledWith(expect.stringContaining('stopped responding'));
    expect(WorkerStub.latest.terminate).toHaveBeenCalledOnce();
    const close=vi.fn();finish({close});await Promise.resolve();
    expect(close).toHaveBeenCalledOnce();expect(received).not.toHaveBeenCalled();
    expect(WorkerStub.latest.postMessage).toHaveBeenCalledTimes(1);
    tracker.dispose();
  });
  it('closes a late camera bitmap instead of posting it to an already disposed worker', async () => {
    vi.stubGlobal('Worker', WorkerStub);
    let resolve!: (bitmap: { close: () => void }) => void;
    vi.stubGlobal('createImageBitmap', () => new Promise(r => { resolve = r; }));
    const tracker = await TrackerClient.create('hands_pose_lips');
    tracker.start({ readyState: 2, videoWidth: 960, requestVideoFrameCallback: vi.fn() } as unknown as HTMLVideoElement, vi.fn());
    tracker.dispose(); const close = vi.fn(); resolve({ close }); await Promise.resolve();
    expect(close).toHaveBeenCalledOnce();
    expect(WorkerStub.latest.postMessage).toHaveBeenCalledTimes(1);
    expect(WorkerStub.latest.terminate).toHaveBeenCalledOnce();
  });
  it('times out and releases a worker that never initializes', async () => {
    vi.useFakeTimers();
    class SilentWorker extends WorkerStub { postMessage = vi.fn(); }
    vi.stubGlobal('Worker', SilentWorker);
    const creating = TrackerClient.create('hands_pose_lips');
    const checked = expect(creating).rejects.toThrow('Tracking took too long');
    await vi.advanceTimersByTimeAsync(25001); await checked;
    expect(WorkerStub.latest.terminate).toHaveBeenCalledOnce();
  });
});
