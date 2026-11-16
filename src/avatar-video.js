import {wrapCaption} from './camera-output.js';

/** Captioned, truthfully labelled demo frame. Never draws a physical webcam. */
export function renderAvatarVideo(canvas, source, {stage='demo',caption='',reference='',phase=''}={}) {
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.fillStyle='#101b2b';c.fillRect(0,0,w,h);c.textAlign='left';c.textBaseline='alphabetic';
  c.fillStyle='#e8eef8';c.font='600 36px Arial';c.fillText('Handsay',48,58);
  c.fillStyle='#a8c7fa';c.font='20px Arial';c.fillText('RECORDED-MOTION DEMO · NO WEBCAM',48,94);
  if(stage==='demo') {
    c.drawImage(source,48,122,740,460);
    c.fillStyle='#e8eef8';c.font='600 25px Arial';c.fillText('Three isolated signs',830,162);
    c.font='22px Arial';c.fillText(reference.replace('Recorded reference: ',''),830,209);
    c.fillStyle='#b6c4d9';c.font='19px Arial';
    wrapCaption(c,phase,360).slice(0,4).forEach((line,i)=>c.fillText(line,830,260+i*29));
    ['Actual pretrained model output','? = held for review','No automatic sentence rewriting'].forEach((line,i)=>c.fillText(line,830,410+i*34));
    c.fillStyle='#233650';c.fillRect(48,598,w-96,65);c.fillStyle='#fff';c.font='600 30px Arial';
    c.fillText(caption.slice(0,76)||'Reading the recorded movement…',68,641);
  } else {
    const lines=stage==='intro'
      ? ['A private caption workspace for interviews.','Supported signs → model suggestions → your review.','This avatar follows recorded sign landmarks.','The clip demonstrates the software without showing a person.']
      : ['Review every word before sending.','The model supports 250 isolated ASL signs.','It can reject correct signs or accept a wrong word.','This replay does not measure live webcam accuracy.'];
    c.fillStyle='#e8eef8';c.font='600 34px Arial';c.fillText(stage==='intro'?'Signing, captions and privacy':'A prototype with visible limits',48,207);
    c.font='25px Arial';lines.forEach((line,i)=>c.fillText(line,48,280+i*65));
  }
  c.fillStyle='#aebdd2';c.font='15px Arial';
  c.fillText('Model / preprocessing: GestureSign, Shashank Yadav (MIT). Motion: Google / PopSign ASL Signs (CC BY 4.0).',48,h-22);
}
