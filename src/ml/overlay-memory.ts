import { LEFT_HAND_START, RIGHT_HAND_START, N_HAND, type Frame } from './landmarks';

/** A short, dashed visual hold only. Never feed this output to recognition. */
export class OverlayMemory {
  private hands = new Map<number, { points: Float32Array; t: number }>();
  reset(): void { this.hands.clear(); }
  view(frame: Frame, t: number): { frame: Frame; held: number[] } {
    let display = frame;
    const held: number[] = [];
    for (const start of [LEFT_HAND_START, RIGHT_HAND_START]) {
      if (Number.isFinite(frame[start * 3])) {
        const points=frame.slice(start*3,(start+N_HAND)*3),last=this.hands.get(start);
        if(last&&t>last.t&&t-last.t<250){
          const travel=Math.hypot(points[0]-last.points[0],points[1]-last.points[1]);
          const alpha=travel>.025?.88:1-Math.exp(-(t-last.t)/90);
          for(let k=0;k<points.length;k++)if(Number.isFinite(points[k])&&Number.isFinite(last.points[k]))points[k]=last.points[k]+alpha*(points[k]-last.points[k]);
          if(display===frame)display=frame.slice();display.set(points,start*3);
        }
        this.hands.set(start, { points, t });
      } else {
        const last = this.hands.get(start);
        if (last && t >= last.t && t - last.t <= 180) {
          if (display === frame) display = frame.slice();
          display.set(last.points, start * 3); held.push(start);
        }
      }
    }
    return { frame: display, held };
  }
}
