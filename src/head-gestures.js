// An experimental, calibrated motion control, not interpretation of facial grammar.
// Face indices follow MediaPipe's canonical face mesh. No image or baseline is stored.
export function headPoseFromFrame(frame, aspect = 1) {
  const point = i => ({ x: frame[i * 3] * aspect, y: frame[i * 3 + 1] });
  const left = point(33), right = point(263), nose = point(1), chin = point(152), top = point(10);
  if (![left, right, nose, chin, top].every(p => Number.isFinite(p.x + p.y))) return null;
  const ex = right.x - left.x, ey = right.y - left.y, width = Math.hypot(ex, ey);
  if (width < .035 || width > 1.1) return null;
  const hx = ex / width, hy = ey / width;
  const height = (chin.x - top.x) * -hy + (chin.y - top.y) * hx;
  if (height < .06) return null;
  const dx = nose.x - (left.x + right.x) / 2, dy = nose.y - (left.y + right.y) / 2;
  return { yaw: (dx * hx + dy * hy) / width, pitch: (dx * -hy + dy * hx) / height, roll: Math.atan2(ey, ex) };
}

export class HeadGestureDetector {
  constructor() { this.reset(); }
  reset() {
    this.base = null; this.calibrating = false; this.samples = []; this.phase = 'idle';
    this.filtered = null; this.lastTime = null; this.neutralSince = null; this.cooldownUntil = 0;
  }
  calibrate() { this.reset(); this.calibrating = true; }
  cancelMotion() { this.phase = 'idle'; this.neutralSince = null; }
  push(pose, t, allowed = true) {
    if (!pose || ![pose.yaw, pose.pitch, pose.roll, t].every(Number.isFinite) || Math.abs(pose.roll) > .30) {
      this.cancelMotion(); this.filtered = null; this.lastTime = null; this.samples = [];
      return { kind: 'status', message: 'Face front and keep your face visible.' };
    }
    if (this.lastTime !== null && (t <= this.lastTime || t - this.lastTime > 300)) { this.cancelMotion(); this.filtered = null; }
    const dt = this.lastTime === null ? 100 : t - this.lastTime;
    this.lastTime = t;
    const alpha = 1 - Math.exp(-dt / 70);
    this.filtered = this.filtered ? { yaw: this.filtered.yaw + alpha * (pose.yaw - this.filtered.yaw), pitch: this.filtered.pitch + alpha * (pose.pitch - this.filtered.pitch) } : { yaw: pose.yaw, pitch: pose.pitch };
    if (this.calibrating) {
      this.samples.push({ ...pose, t }); this.samples = this.samples.filter(s => t - s.t <= 1400);
      const span = t - this.samples[0].t;
      const range = key => Math.max(...this.samples.map(s => s[key])) - Math.min(...this.samples.map(s => s[key]));
      if (span >= 1200 && this.samples.length >= 12 && range('yaw') < .07 && range('pitch') < .055) {
        const mean = key => this.samples.reduce((n, s) => n + s[key], 0) / this.samples.length;
        this.base = { yaw: mean('yaw'), pitch: mean('pitch') }; this.calibrating = false; this.samples = []; this.cooldownUntil = t + 600;
        return { kind: 'calibrated', message: 'Calibrated. Keep hands still, then nod or shake deliberately.' };
      }
      return { kind: 'status', message: 'Calibrating: look straight ahead and stay still for 1.2 seconds.' };
    }
    if (!this.base) return { kind: 'status', message: 'Calibrate your neutral head position first.' };
    if (!allowed) { this.cancelMotion(); return { kind: 'status', message: 'Waiting: pause your hands before using a head gesture.' }; }
    if (t < this.cooldownUntil) { this.cancelMotion(); return { kind: 'status', message: 'Control received. Return your head to neutral.' }; }
    const x = this.filtered.yaw - this.base.yaw, y = this.filtered.pitch - this.base.pitch;
    const neutral = Math.abs(x) < .055 && Math.abs(y) < .035;
    const reset = message => { this.cancelMotion(); return { kind: 'status', message }; };
    const fire = kind => { this.cancelMotion(); this.cooldownUntil = t + 2200; return { kind, message: kind === 'nod' ? 'Nod detected.' : 'Head shake detected.' }; };
    if (this.phase === 'idle') {
      if (neutral) { this.neutralSince ??= t; return { kind: 'status', message: 'Ready: nod down and back, or shake left–right and return.' }; }
      if (this.neutralSince === null || t - this.neutralSince < 450) return reset('Return to neutral before starting a head gesture.');
      if (Math.abs(x) > .14 && Math.abs(y) < .07) { this.phase = 'shake-opposite'; this.direction = Math.sign(x); this.started = t; }
      else if (y > .085 && Math.abs(x) < .08) { this.phase = 'nod-return'; this.started = t; }
      return { kind: 'status', message: 'Complete the motion and return to neutral.' };
    }
    if (t - this.started > 2200) return reset('Motion timed out. Return to neutral and try again.');
    if (this.phase === 'nod-return') {
      if (Math.abs(x) > .10 || y < -.06) return reset('Mixed head motion ignored. Try one direction at a time.');
      if (neutral) return t - this.started >= 300 ? fire('nod') : reset('Motion too fast. Try a deliberate nod.');
    } else {
      if (Math.abs(y) > .08) return reset('Mixed head motion ignored. Try one direction at a time.');
      if (this.phase === 'shake-opposite' && Math.sign(x) === -this.direction && Math.abs(x) > .14 && t - this.started >= 150) this.phase = 'shake-return';
      else if (this.phase === 'shake-return' && neutral) return t - this.started >= 350 ? fire('shake') : reset('Motion too fast. Try a deliberate shake.');
    }
    return { kind: 'status', message: 'Complete the motion and return to neutral.' };
  }
}
