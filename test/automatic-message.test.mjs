import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AutomaticMessage} from '../src/automatic-message.js';
const timing=(startAt,endAt,personal=false)=>({startAt,endAt,personal});
test('Hello then a five-second pause starts a separate caption rather than Hello green apple',()=>{
  const c=new AutomaticMessage();const hello=c.append('','hello',timing(0,800));
  assert.equal(c.begin(5800,hello.text),true);
  const next=c.append('','green apple',timing(5800,6800));
  assert.equal(next.text,'green apple');assert.equal(next.before,'');
});
test('source timing still separates phrases when the prior result arrives late',()=>{
  const c=new AutomaticMessage();c.begin(5800,'');
  assert.equal(c.append('','hello',timing(0,800)).applied,false);
  assert.equal(c.append('','green apple',timing(5800,6800)).text,'green apple');
});
test('quick sequential ASL words can still form one phrase',()=>{
  const c=new AutomaticMessage();const first=c.append('','green',timing(0,800));
  assert.equal(c.begin(1200,first.text),false);
  assert.equal(c.append(first.text,'apple',timing(1000,1800)).text,'green apple');
});
test('personal shortcuts are standalone messages and the next ASL word starts separately',()=>{
  const c=new AutomaticMessage();const first=c.append('','hello',timing(0,800));
  const shortcut=c.append(first.text,'I need a moment.',timing(1000,1800,true));
  assert.equal(shortcut.text,'I need a moment.');assert.equal(shortcut.before,'');
  assert.equal(c.append(shortcut.text,'blue',timing(2000,2800)).text,'blue');
});
test('typed, selected or edited messages cannot be silently overwritten or extended',()=>{
  const c=new AutomaticMessage();assert.equal(c.begin(6000,'My typed answer.'),false);
  assert.equal(c.append('My typed answer.','hello',timing(6000,6800)).applied,false);
  c.reset();
  const prior=c.append('','hello',timing(0,800));c.reset();
  assert.equal(c.append(prior.text,'apple',timing(1000,1800)).applied,false);
});
test('a full phrase is held for review instead of silently truncating its meaning',()=>{
  const c=new AutomaticMessage();c.text='a'.repeat(999);c.end=800;
  assert.equal(c.append(c.text,'word',timing(1000,1800)).applied,false);
  assert.equal(c.append('','word',timing(NaN,1800)).applied,false);
});
test('checking a proposed caption does not claim ownership or change phrase timing',()=>{
  const c=new AutomaticMessage();
  assert.equal(c.propose('','hello',timing(0,800)).text,'hello');
  assert.equal(c.text,null);assert.equal(c.end,null);
  assert.equal(c.append('','apple',timing(6000,6800)).text,'apple');
});
