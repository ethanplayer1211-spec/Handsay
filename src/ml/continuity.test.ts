import { describe, it, expect } from 'vitest';
import { TrackingStatus } from './tracking-status';
import { OverlayMemory } from './overlay-memory';
import { emptyFrame, LEFT_HAND_START } from './landmarks';

describe('tracking continuity', () => {
  it('smooths small visual jitter while following deliberate travel and preserving raw data',()=>{
    const memory=new OverlayMemory();let last=0;
    for(let i=0;i<20;i++){
      const frame=emptyFrame();frame[LEFT_HAND_START*3]=.4+(i%2?.002:-.002);frame[LEFT_HAND_START*3+1]=.4;
      const original=frame.slice();const view=memory.view(frame,i*67);last=view.frame[LEFT_HAND_START*3];
      expect([...frame]).toEqual([...original]);
    }
    expect(Math.abs(last-.4)).toBeLessThan(.0012);
    const moved=emptyFrame();moved[LEFT_HAND_START*3]=.7;moved[LEFT_HAND_START*3+1]=.4;
    expect(memory.view(moved,20*67).frame[LEFT_HAND_START*3]).toBeGreaterThan(.66);
  });
  it('does not flash lost/found status for brief dropouts and requires stable recovery', () => {
    const status = new TrackingStatus();
    expect(status.push('ok', 0)).toBe('ok');
    expect(status.push('no-hands', 50)).toBe(null);
    expect(status.push('ok', 150)).toBe(null);
    expect(status.push('partial', 200)).toBe(null);
    expect(status.push('partial', 550)).toBe('partial');
    expect(status.push('ok', 600)).toBe(null);
    expect(status.push('partial', 650)).toBe(null);
    expect(status.push('ok', 700)).toBe(null);
    expect(status.push('ok', 800)).toBe('ok');
    expect(status.push('crowded', 810)).toBe('crowded');
  });

  it('holds a dashed visual hand briefly without changing raw coordinates or inference data', () => {
    const memory = new OverlayMemory(), frame = emptyFrame();
    frame[LEFT_HAND_START * 3] = .3; frame[LEFT_HAND_START * 3 + 1] = .4;
    memory.view(frame, 0);
    const missing = emptyFrame(), view = memory.view(missing, 100);
    expect(view.held).toEqual([LEFT_HAND_START]);
    expect(view.frame[LEFT_HAND_START * 3]).toBeCloseTo(.3);
    expect(Number.isNaN(missing[LEFT_HAND_START * 3])).toBe(true);
    expect(memory.view(missing, 181).held).toEqual([]);
    memory.reset(); expect(memory.view(missing, 100).held).toEqual([]);
  });

  it('does not mistake alternating loss labels for a healthy tracking recovery', () => {
    const status = new TrackingStatus();
    status.push('ok',0);
    expect(status.push('no-hands',10)).toBe(null);
    expect(status.push('partial',200)).toBe(null);
    expect(status.push('nothing',400)).toBe('nothing');
  });
});
