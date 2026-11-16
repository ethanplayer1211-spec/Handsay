import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { PassThrough } from 'node:stream';
import { CameraBridge, cameraRequestAllowed, CAMERA_MAX_BYTES } from '../shared/camera-bridge.mjs';
import { createApp } from '../server.mjs';

test('native camera endpoints reject remote clients, DNS-rebound hosts and cross-origin pages', () => {
  const req=(host='127.0.0.1:5417',origin='http://127.0.0.1:5417',remoteAddress='127.0.0.1')=>({headers:{host,origin},socket:{remoteAddress}});
  assert.equal(cameraRequestAllowed(req()),true);
  assert.equal(cameraRequestAllowed(req('evil.example:5417','http://evil.example:5417')),false);
  assert.equal(cameraRequestAllowed(req('127.0.0.1:5417','https://evil.example')),false);
  assert.equal(cameraRequestAllowed(req('127.0.0.1:5417',undefined,'192.168.1.5')),false);
  assert.equal(cameraRequestAllowed(req('localhost:5417','http://localhost:5417','::1')),true);
});

test('camera ownership, bounded frames, acknowledgement and stop release the correct helper', async t => {
  const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};child.exitCode=0;
  let spawned=0;
  const camera=new CameraBridge({platform:'win32',exists:()=>true,spawnImpl:()=>{spawned++;return child;}});
  t.after(()=>camera.stop());
  await assert.rejects(camera.start('wrong'),e=>e.status===403);
  await assert.rejects(camera.start('é'.repeat(48)),e=>e.status===403);
  assert.equal(spawned,0);
  const starting=camera.start(camera.status().startKey);
  child.stdout.write(JSON.stringify({ready:true})+'\n');
  const {lease}=await starting;assert.equal(camera.status().active,true);
  await assert.rejects(camera.start(camera.status().startKey),e=>e.status===409);
  await assert.rejects(camera.frame('wrong',Buffer.from([255,216,0,0])),e=>e.status===403);
  await assert.rejects(camera.frame(lease,Buffer.alloc(CAMERA_MAX_BYTES+1)),e=>e.status===400);
  await assert.rejects(camera.frame(lease,Buffer.from('not an image')),e=>e.status===400);
  const jpeg=Buffer.from([255,216,0,0,255,217]);
  const sending=camera.frame(lease,jpeg);
  await assert.rejects(camera.frame(lease,jpeg),e=>e.status===429);
  const packet=child.stdin.read();assert.equal(packet.readUInt32BE(0),jpeg.length);assert.deepEqual(packet.subarray(4),jpeg);
  child.stdout.write(JSON.stringify({frame:1})+'\n');await sending;
  assert.equal(camera.status().frames,1);
  assert.throws(()=>camera.stop('','wrong'),e=>e.status===403);
  camera.stop('',lease);assert.equal(camera.status().active,false);
  await assert.rejects(camera.frame(lease,jpeg),e=>e.status===403);
});

test('camera HTTP frames have a separate transport, so they do not consume interviewer room rate limits', async t => {
  const received=[];
  const bridge={status:()=>({setupReady:true,startKey:'setup'}),start:async key=>{assert.equal(key,'setup');return {lease:'owner'};},frame:async(key,data)=>{assert.equal(key,'owner');received.push(data);},stop:()=>{}};
  const server=createApp({cameraBridge:bridge});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const status=await fetch(base+'/api/camera/status');assert.equal((await status.json()).startKey,'setup');
  const denied=await fetch(base+'/api/camera/start',{method:'POST',headers:{Origin:'https://other.example'}});assert.equal(denied.status,403);
  const start=await fetch(base+'/api/camera/start',{method:'POST',headers:{'X-Handsay-Camera':'setup'}});assert.equal((await start.json()).lease,'owner');
  const bad=await fetch(base+'/api/camera/frame',{method:'POST',body:'text'});assert.equal(bad.status,415);
  for(let i=0;i<245;i++){
    const frame=await fetch(base+'/api/camera/frame',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Handsay-Camera':'owner'},body:Buffer.from([255,216,255,217])});
    assert.equal(frame.status,200);
  }
  assert.equal(received.length,245);
  assert.equal((await fetch(base+'/api/rooms',{method:'POST'})).status,201);
});
