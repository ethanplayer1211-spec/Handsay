import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';

async function app(t, options) {
  const server = createApp(options); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = async (path, options) => {
    const r = await fetch(base + path, options); return { status: r.status, body: await r.json() };
  };
  return { req, base };
}
const json = (key, data) => ({ method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
test('only confirmed captions sent by the writer can appear in the interviewer room', async t => {
  const { req } = await app(t);
  const created = await req('/api/rooms', { method: 'POST' }); assert.equal(created.status, 201);
  const room = created.body, path = `/api/rooms/${room.id}`;
  assert.notEqual(room.writeKey, room.readKey);
  assert.equal((await req(path)).status, 401);
  assert.equal((await req(path, { headers: { Authorization: 'Bearer ' + 'é'.repeat(32) } })).status, 401);
  const before = await req(path, { headers: { Authorization: `Bearer ${room.readKey}` } }); assert.deepEqual(before.body.events, []);
  assert.equal((await req(path + '/events', json(room.readKey, { type: 'caption', text: 'Forged caption' }))).status, 403);
  assert.equal((await req(path + '/events', json(room.readKey, { type: 'live', text: 'Forged live text' }))).status, 403);
  const sent = await req(path + '/events', json(room.writeKey, { type: 'caption', text: 'Hello', clientId: 'caption-1' })); assert.equal(sent.status, 201);
  const duplicate = await req(path + '/events', json(room.writeKey, { type: 'caption', text: 'Hello', clientId: 'caption-1' })); assert.equal(duplicate.status, 200); assert.equal(duplicate.body.seq, sent.body.seq);
  assert.equal((await req(path + '/events', json(room.writeKey, { type: 'caption', text: 'Changed', clientId: 'caption-1' }))).status, 409);
  assert.equal((await req(path + '/events', json(room.readKey, { type: 'question', text: 'Could you introduce yourself?' }))).status, 201);
  const read = await req(path, { headers: { Authorization: `Bearer ${room.readKey}` } }); assert.equal(read.body.events.length, 2);
  assert.deepEqual(read.body.events.map(e => e.type), ['caption', 'question']);
  assert.equal('writeKey' in read.body, false);
  const next = await req(path + '?after=1', { headers: { Authorization: `Bearer ${room.writeKey}` } }); assert.equal(next.body.events.length, 1);
});
test('rooms are isolated, bounded and expire without retaining text', async t => {
  let now = 100; const { req } = await app(t, { now: () => now });
  const a = (await req('/api/rooms', { method: 'POST' })).body;
  const b = (await req('/api/rooms', { method: 'POST' })).body;
  assert.equal((await req(`/api/rooms/${a.id}`, { headers: { Authorization: `Bearer ${b.readKey}` } })).status, 401);
  for (let i = 0; i < 205; i++) assert.equal((await req(`/api/rooms/${a.id}/events`, json(a.writeKey, { type: 'caption', text: `Caption ${i}` }))).status, 201);
  const read = await req(`/api/rooms/${a.id}`, { headers: { Authorization: `Bearer ${a.readKey}` } });
  assert.equal(read.body.events.length, 200); assert.equal(read.body.events[0].text, 'Caption 5');
  now += 120 * 60_000 + 1;
  assert.equal((await req(`/api/rooms/${a.id}`, { headers: { Authorization: `Bearer ${a.readKey}` } })).status, 404);
});
test('live captions update and clear without impersonating a confirmed caption', async t => {
  const { req } = await app(t);
  const room = (await req('/api/rooms', { method: 'POST' })).body;
  const path = `/api/rooms/${room.id}`;
  assert.equal((await req(path+'/events', json(room.writeKey,{type:'live',text:'Hello'}))).status,201);
  assert.equal((await req(path+'/events', json(room.writeKey,{type:'live',text:''}))).status,201);
  const data = (await req(path,{headers:{Authorization:`Bearer ${room.readKey}`}})).body;
  assert.deepEqual(data.events.map(e=>[e.type,e.text]),[['live','Hello'],['live','']]);
  assert.equal(data.events.some(e=>e.type==='caption'),false);
});
test('rejects malformed, oversized and cross-origin writes', async t => {
  const { req, base } = await app(t);
  const room = (await req('/api/rooms', { method: 'POST' })).body;
  const path = `/api/rooms/${room.id}/events`;
  for (const data of [null, {}, { type: 'caption', text: ' ' }, { type: 'caption', text: 'x'.repeat(1001) }, { type: 'camera', text: 'image' }]) assert.equal((await req(path, json(room.writeKey, data))).status, 400);
  assert.equal((await req(path, { ...json(room.writeKey, { type: 'caption', text: 'x'.repeat(9000) }) })).status, 413);
  assert.equal((await req('/api/rooms', { method: 'POST', headers: { Origin: 'https://unrelated.example' } })).status, 403);
  assert.equal((await req('/api/rooms', { method: 'POST', headers: { Origin: base } })).status, 201);
  assert.equal((await req(`/api/rooms/${room.id}?after=-1`, { headers: { Authorization: `Bearer ${room.readKey}` } })).status, 400);
});

test('presence distinguishes a waiting room from a connected interviewer, and only the signer can end it', async t => {
  let now = 1000; const { req } = await app(t, { now: () => now });
  const room = (await req('/api/rooms', { method: 'POST' })).body;
  const path = `/api/rooms/${room.id}`;
  const get = key => req(path, { headers: { Authorization: `Bearer ${key}` } });
  assert.equal((await get(room.writeKey)).body.viewerConnected, false);
  const joined = (await get(room.readKey)).body;
  assert.equal(joined.signerConnected, true);
  assert.equal((await get(room.writeKey)).body.viewerConnected, true);
  now += 7000;
  assert.equal((await get(room.writeKey)).body.viewerConnected, false);
  assert.equal((await req(path + '/end', json(room.readKey, {}))).status, 403);
  assert.equal((await req(path + '/end', json(room.writeKey, {}))).status, 200);
  assert.equal((await get(room.readKey)).status, 404);
  assert.equal((await req(path + '/events', json(room.writeKey, { type: 'caption', text: 'After end' }))).status, 404);
});
test('serves the actual built app and WASM without exposing source files', async t => {
  const { base } = await app(t);
  const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /Handsay/);
  const wasm = await fetch(base + '/vendor/mediapipe/wasm/vision_wasm_module_internal.wasm', { method: 'HEAD' }); assert.equal(wasm.status, 200); assert.equal(wasm.headers.get('Content-Type'), 'application/wasm');
  assert.equal((await fetch(base + '/server.mjs')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e%5cpackage.json')).status, 400);
});
