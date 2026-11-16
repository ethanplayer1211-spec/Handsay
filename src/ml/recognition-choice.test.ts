import {describe,it,expect} from 'vitest';
import {automaticChoice} from './recognition-choice';
import type {Gesture} from './prototypes';
const labels:any=[{label:'hello'},{label:'blue'}];
const gesture=(name='Good morning'):Gesture=>({id:'greeting',name,takes:Array.from({length:3},()=>new Float32Array([1,0]))});
const result=(options:any={})=>({decision:{kind:'sign',top:[{index:0,probability:.94},{index:1,probability:.02}]},inference:{embedding:new Float32Array([1,0])},verification:[{index:0,probability:.93},{index:1,probability:.02}],verificationEmbedding:new Float32Array([1,0]),segment:{durationMs:900},partial:false,...options}) as any;
describe('combined ASL and personal shortcut choice',()=>{
  it('can explicitly prioritize a supported shortcut without turning off ASL fallback',()=>{
    expect(automaticChoice(result(),labels,[gesture()],'combined-priority','careful').choice?.text).toBe('Good morning');
    expect(automaticChoice(result({verificationEmbedding:new Float32Array([0,1])}),labels,[gesture()],'combined-priority','careful').choice?.text).toBe('hello');
  });
  it('keeps ASL-only mode independent of a matching personal phrase',()=>expect(automaticChoice(result(),labels,[gesture()],'asl','careful').choice?.text).toBe('hello'));
  it('accepts a verified personal shortcut when the base ASL result is uncertain',()=>{
    const r=result({decision:{kind:'uncertain',top:[{index:0,probability:.3}]},verification:null});
    expect(automaticChoice(r,labels,[gesture()],'combined','careful').choice?.text).toBe('Good morning');
  });
  it('holds a conflict for the person to choose instead of comparing unlike scores',()=>{
    const selected=automaticChoice(result(),labels,[gesture()],'combined','careful');
    expect(selected.conflict).toBe(true);expect(selected.choice).toBeNull();
  });
  it('returns one phrase when the personal shortcut and ASL word agree',()=>{
    const selected=automaticChoice(result(),labels,[gesture('hello')],'combined','careful');
    expect(selected.conflict).toBe(false);expect(selected.choice?.text).toBe('hello');
  });
  it('does not let a weak or boundary-inconsistent shortcut override clear ASL',()=>{
    for(const embedding of [new Float32Array([0,1]),new Float32Array([.8,.6])]){
      expect(automaticChoice(result({verificationEmbedding:embedding}),labels,[gesture()],'combined','careful').choice?.text).toBe('hello');
    }
  });
  it('requires two embedding matches for automatic personal captions',()=>{
    expect(automaticChoice(result({verificationEmbedding:null}),labels,[gesture()],'personal','careful').choice).toBeNull();
  });
  it('holds partial framing and hand-identity changes in every mode',()=>{
    for(const r of [result({partial:true}),result({segment:{durationMs:900,trackingIssue:'hand-identity-change'}})]){
      for(const mode of ['asl','personal','combined'] as const)expect(automaticChoice(r,labels,[gesture()],mode,'careful').choice).toBeNull();
    }
  });
});
