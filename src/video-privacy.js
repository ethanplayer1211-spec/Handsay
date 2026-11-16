import {drawAvatar} from './avatar-renderer.js';
import {LEFT_HAND_START,RIGHT_HAND_START,HAND_CONNECTIONS} from './ml/landmarks';

export const privacyMode = value => ['camera','silhouette','hands'].includes(value) ? value : 'silhouette';
export const strongerPrivacy = (locked,current) => {
  const order=['camera','silhouette','hands'];
  return order[Math.max(order.indexOf(privacyMode(locked)),order.indexOf(privacyMode(current)))];
};

/** Private modes draw coordinates only. They never read a camera image. */
export function renderPrivateVideo(canvas, frame, mode = 'silhouette', {showStatus=true}={}) {
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.save();c.fillStyle='#e9eef3';c.fillRect(0,0,w,h);
  if(!frame) {
    if(!showStatus){c.restore();return;}
    c.fillStyle='#465568';c.font=`${Math.max(16,w*.022)}px Arial`;c.textAlign='center';
    c.fillText('Camera image hidden · waiting for tracking',w/2,h/2);c.restore();return;
  }
  if(privacyMode(mode)==='silhouette') {drawAvatar(canvas,frame,{label:showStatus?'Silhouette · camera image hidden':''});c.restore();return;}
  c.strokeStyle='#17212b';c.fillStyle='#17212b';c.lineCap='round';c.lineJoin='round';
  const point=i=>[frame[i*3]*w,frame[i*3+1]*h];
  for(const start of [LEFT_HAND_START,RIGHT_HAND_START]) {
    for(const [a,b] of HAND_CONNECTIONS) {
      const p=point(start+a),q=point(start+b);
      if(![...p,...q].every(Number.isFinite))continue;
      c.lineWidth=Math.max(2,w/280);c.beginPath();c.moveTo(...p);c.lineTo(...q);c.stroke();
    }
  }
  c.fillStyle='#465568';c.font=`${Math.max(14,w*.018)}px Arial`;c.textAlign='left';
  if(showStatus)c.fillText('Hands only · camera image hidden',20,h-22);c.restore();
}
