import {describe,it,expect} from 'vitest';
import {gestureQuality,matchPersonalGesture} from './personal-gestures';
import type {Gesture} from './prototypes';
const v=(angle:number)=>Float32Array.from([Math.cos(angle),Math.sin(angle)]);
const g=(id:string,angles:number[]):Gesture=>({id,name:id,takes:angles.map(v)});
describe('supported personal examples',()=>{
  it('accepts a natural boundary variation supported by two saved examples',()=>{
    const gesture=g('greeting',[-.3,0,.3]);
    expect(matchPersonalGesture(v(.5),[gesture]).kind).toBe('match');
    expect(matchPersonalGesture(v(.55),[gesture],{boundaryAllowance:.04}).kind).toBe('match');
    expect(matchPersonalGesture(v(1.6),[gesture]).kind).toBe('not-sure');
  });
  it('does not approve a phrase because of a single bad saved example',()=>{
    const gesture=g('greeting',[0,.03,Math.PI/2]);
    expect(matchPersonalGesture(v(Math.PI/2),[gesture]).kind).toBe('not-sure');
    expect(matchPersonalGesture(v(0),[gesture]).kind).toBe('match');
    expect(gestureQuality(gesture).weakestIndex).toBe(2);
  });
  it('holds overlapping gestures and explains why their library needs a more distinct motion',()=>{
    const a=g('a',[0,.01,-.01]),b=g('b',[.02,.03,.01]);
    expect(matchPersonalGesture(v(.01),[a,b],{margin:.12}).kind).toBe('not-sure');
    expect(gestureQuality(a,[a,b]).state).toBe('overlap');
  });
  it('reports missing and inconsistent examples without mutating saved data',()=>{
    expect(gestureQuality(g('a',[0])).state).toBe('more-takes');
    const gesture=g('a',[0,Math.PI/2,Math.PI]);const before=gesture.takes.map(t=>[...t]);
    expect(gestureQuality(gesture).state).toBe('inconsistent');
    expect(gesture.takes.map(t=>[...t])).toEqual(before);
    expect(matchPersonalGesture(v(0),[{...gesture,takes:[new Float32Array(2),v(0)]}]).kind).toBe('empty');
  });
});
