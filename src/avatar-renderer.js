import { POSE_START, LEFT_HAND_START, RIGHT_HAND_START, HAND_CONNECTIONS } from './ml/landmarks';

/** Code-generated silhouette. The source coordinates remain recorded motion. */
export function drawAvatar(canvas, frame, { dropout = false, label = 'Silhouette · recorded sign movement' } = {}) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h); c.fillStyle = '#e9eef3'; c.fillRect(0, 0, w, h);
  const raw = i => [frame[i * 3], frame[i * 3 + 1]];
  const finite = p => p.every(Number.isFinite);
  const left = raw(POSE_START + 11), right = raw(POSE_START + 12);
  if (!finite(left) || !finite(right)) return;
  const mid = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
  const shoulder = Math.max(.1, Math.hypot(left[0] - right[0], left[1] - right[1]));
  const scale = Math.min(w / (shoulder * 4.2), h / (shoulder * 4));
  const project = p => [w / 2 + (p[0] - mid[0]) * scale, h * .38 + (p[1] - mid[1]) * scale];
  const point = i => project(raw(i));
  const line = (a, b, thickness) => {
    if (!finite(a) || !finite(b)) return;
    c.lineWidth = thickness; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
  };
  const unit = shoulder * scale;
  c.fillStyle = '#15191e'; c.strokeStyle = '#15191e'; c.lineCap = 'round'; c.lineJoin = 'round';
  const l = project(left), r = project(right), center = project(mid);
  const [bodyLeft, bodyRight] = l[0] < r[0] ? [l,r] : [r,l];
  c.beginPath(); c.moveTo(bodyLeft[0], bodyLeft[1]); c.lineTo(bodyRight[0], bodyRight[1]);
  c.lineTo(center[0] + unit * .48, center[1] + unit * 1.45);
  c.lineTo(center[0] - unit * .48, center[1] + unit * 1.45); c.closePath(); c.fill();
  const nose = raw(POSE_START), head = finite(nose) ? project(nose) : [center[0], center[1] - unit * .7];
  line([center[0], center[1]], [head[0], head[1]], unit * .22);
  c.beginPath(); c.ellipse(head[0], head[1] - unit * .06, unit * .29, unit * .36, 0, 0, Math.PI * 2); c.fill();
  for (const [shoulderIndex, elbow, wrist, hand] of [[11, 13, 15, LEFT_HAND_START], [12, 14, 16, RIGHT_HAND_START]]) {
    const end = finite(raw(hand)) ? point(hand) : point(POSE_START + wrist);
    line(point(POSE_START + shoulderIndex), point(POSE_START + elbow), unit * .14);
    line(point(POSE_START + elbow), end, unit * .11);
    const palm = [0, 1, 5, 9, 13, 17].map(i => point(hand + i));
    if (palm.every(finite)) { c.beginPath(); palm.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fill(); }
    for (const [a, b] of HAND_CONNECTIONS) line(point(hand + a), point(hand + b), Math.max(2.2, unit * .025));
  }
  c.fillStyle = dropout ? '#865500' : '#465568'; c.font = '16px Arial'; c.textAlign = 'left';
  c.fillText(dropout ? 'Injected tracking loss · hand coordinates absent' : label, 20, h - 22);
}
