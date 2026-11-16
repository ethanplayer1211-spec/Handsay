import { afterEach, expect, it, vi } from 'vitest';
import { waitForVideo } from './media-ready.js';
afterEach(()=>vi.useRealTimers());
it('bounds an opened camera whose video never becomes playable',async()=>{
  vi.useFakeTimers();
  const playing=expect(waitForVideo({play:()=>new Promise(()=>{})})).rejects.toThrow('did not provide playable video');
  await vi.advanceTimersByTimeAsync(10001);await playing;expect(vi.getTimerCount()).toBe(0);
});
it('removes the watchdog when video starts or playback rejects',async()=>{
  vi.useFakeTimers();
  await waitForVideo({play:async()=>{}});expect(vi.getTimerCount()).toBe(0);
  await expect(waitForVideo({play:async()=>{throw new Error('disconnected');}})).rejects.toThrow('disconnected');
  expect(vi.getTimerCount()).toBe(0);
});
