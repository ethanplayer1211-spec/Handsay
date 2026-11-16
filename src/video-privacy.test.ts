import {describe,it,expect,vi} from 'vitest';
import {renderCameraOutput} from './camera-output.js';
import {strongerPrivacy} from './video-privacy.js';

function surface() {
  const context:any={save:vi.fn(),restore:vi.fn(),fillRect:vi.fn(),fillText:vi.fn(),drawImage:vi.fn()};
  return {context,canvas:{width:1280,height:720,getContext:()=>context}};
}
describe('video privacy boundaries',()=>{
  it('clean output contains only the chosen caption, without waiting or status badges',()=>{
    for(const videoActive of [false,true]){
      const {canvas,context}=surface();context.measureText=(text:string)=>({width:text.length*10});
      renderCameraOutput(canvas,{videoActive,privacy:'hands',landmarks:null,text:'Good morning',showCaptionLabel:false});
      expect(context.fillText.mock.calls.map((args:any[])=>args[0])).toEqual(['Good morning']);
    }
  });
  it.each(['silhouette','hands',undefined,'invalid'])('never accesses camera pixels in private mode %s, including when tracking is absent',privacy=>{
    const {canvas,context}=surface();
    const camera=new Proxy({},{get(){throw new Error('Private mode accessed the webcam image');}});
    renderCameraOutput(canvas,{video:camera,videoActive:true,privacy,landmarks:null});
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalledWith(0,0,1280,720);
  });
  it('requires explicit visible-camera mode to draw video pixels',()=>{
    const {canvas,context}=surface(),video={readyState:2,videoWidth:960,videoHeight:640};
    renderCameraOutput(canvas,{videoActive:true,video,privacy:'camera'});
    expect(context.drawImage).toHaveBeenCalledOnce();
  });
  it.each(['silhouette','hands'])('draws tracked coordinates without reading camera pixels in %s mode',privacy=>{
    const {canvas,context}=surface();
    Object.assign(context,Object.fromEntries(['clearRect','beginPath','moveTo','lineTo','closePath','fill','stroke','ellipse'].map(name=>[name,vi.fn()])));
    const camera=new Proxy({},{get(){throw new Error('Private drawing accessed the camera');}});
    renderCameraOutput(canvas,{video:camera,videoActive:true,privacy,landmarks:new Float32Array(543*3).fill(.5)});
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(context.fillText).toHaveBeenCalledWith(expect.stringContaining('camera image hidden'),expect.any(Number),expect.any(Number));
  });
  it('cannot weaken an active recording privacy choice',()=>{
    expect(strongerPrivacy('silhouette','camera')).toBe('silhouette');
    expect(strongerPrivacy('hands','silhouette')).toBe('hands');
    expect(strongerPrivacy('camera','hands')).toBe('hands');
    expect(strongerPrivacy(undefined,'camera')).toBe('silhouette');
  });
});
