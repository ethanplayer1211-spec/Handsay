import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CameraBridge, cameraRequestAllowed, CAMERA_MAX_BYTES } from './shared/camera-bridge.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
const MAX_AGE = 2 * 60 * 60 * 1000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.onnx': 'application/octet-stream', '.task': 'application/octet-stream', '.txt': 'text/plain' };
const token = () => randomBytes(24).toString('base64url');
const same = (a, b) => {
  if (typeof a !== 'string') return false;
  const actual = Buffer.from(a), expected = Buffer.from(b);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export function createApp({ root = ROOT, now = Date.now, desktop = false, cameraBridge = new CameraBridge({root:dirname(fileURLToPath(import.meta.url)),desktop}) } = {}) {
  const rooms = new Map();
  const limits = new Map();
  const expiryTimers = new Set();
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  function sweep() {
    for (const [id, room] of rooms) if (room.expiresAt <= now()) rooms.delete(id);
    for (const [id, limit] of limits) if (now() - limit.start > 60_000) limits.delete(id);
  }
  async function body(req) {
    let text = '';
    for await (const chunk of req) {
      text += chunk;
      if (Buffer.byteLength(text) > 8192) throw Object.assign(new Error('Request too large'), { status: 413 });
    }
    try { return JSON.parse(text); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, service: 'Handsay', retentionMinutes: 120 });
      if (url.pathname.startsWith('/api/camera/')) {
        if (!cameraRequestAllowed(req)) return json(res,403,{error:'Camera output is available only to this computer and this app origin'});
        if (req.method === 'GET' && url.pathname === '/api/camera/status') return json(res,200,cameraBridge.status());
        if (req.method === 'POST' && url.pathname === '/api/camera/start') return json(res,200,await cameraBridge.start(req.headers['x-handsay-camera']));
        if (req.method === 'POST' && url.pathname === '/api/camera/stop') {
          cameraBridge.stop('',req.headers['x-handsay-camera'] ?? '');
          return json(res,200,{stopped:true});
        }
        if (req.method === 'POST' && url.pathname === '/api/camera/frame') {
          if (req.headers['content-type'] !== 'image/jpeg') return json(res,415,{error:'Use image/jpeg'});
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > CAMERA_MAX_BYTES) return json(res,413,{error:'Camera frame too large'});
            chunks.push(chunk);
          }
          await cameraBridge.frame(req.headers['x-handsay-camera'],Buffer.concat(chunks));
          return json(res,200,{sent:true});
        }
        return json(res,404,{error:'Camera endpoint not found'});
      }
      if (url.pathname.startsWith('/api/')) {
        sweep();
        // Browser mutations must come from the same origin. No proxy header trust.
        if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(res, 403, { error: 'Origin rejected' });
        const ip = req.socket.remoteAddress;
        const record = limits.get(ip) ?? { start: now(), count: 0 };
        record.count++; limits.set(ip, record);
        if (record.count > 240) return json(res, 429, { error: 'Please slow down and retry in a minute' });
        if (url.pathname === '/api/rooms' && req.method === 'POST') {
          if (rooms.size >= 100) return json(res, 503, { error: 'Room capacity reached. Try later.' });
          const id = randomBytes(12).toString('hex');
          const room = { writeKey: token(), readKey: token(), expiresAt: now() + MAX_AGE, events: [], next: 1 };
          rooms.set(id, room);
          const expiry = setTimeout(() => { rooms.delete(id); expiryTimers.delete(expiry); }, MAX_AGE);
          room.expiryTimer = expiry;
          expiry.unref(); expiryTimers.add(expiry);
          return json(res, 201, { id, writeKey: room.writeKey, readKey: room.readKey, expiresAt: room.expiresAt });
        }
        const match = /^\/api\/rooms\/([a-f0-9]{24})(?:\/(events|end))?$/.exec(url.pathname);
        if (!match) return json(res, 404, { error: 'Endpoint not found' });
        const room = rooms.get(match[1]);
        if (!room) return json(res, 404, { error: 'Room expired or unavailable. Create a new room.' });
        const key = req.headers.authorization?.replace(/^Bearer /, '');
        const writer = same(key, room.writeKey);
        if (!writer && !same(key, room.readKey)) return json(res, 401, { error: 'Invalid room key' });
        if (req.method === 'POST' && match[2] === 'end') {
          if (!writer) return json(res, 403, { error: 'Only the signer can end the room' });
          clearTimeout(room.expiryTimer); expiryTimers.delete(room.expiryTimer);
          rooms.delete(match[1]);
          return json(res, 200, { ended: true });
        }
        if (req.method === 'GET' && !match[2]) {
          const after = Number(url.searchParams.get('after') ?? 0);
          if (!Number.isSafeInteger(after) || after < 0) return json(res, 400, { error: 'Invalid cursor' });
          if (writer) room.signerLastSeen = now(); else room.viewerLastSeen = now();
          return json(res, 200, { events: room.events.filter(e => e.seq > after), expiresAt: room.expiresAt, viewerConnected: room.viewerLastSeen !== undefined && now() - room.viewerLastSeen < 6500, signerConnected: room.signerLastSeen !== undefined && now() - room.signerLastSeen < 6500 });
        }
        if (req.method === 'POST' && match[2]) {
          const data = await body(req);
          if (!data || !['caption', 'question', 'live'].includes(data.type) || typeof data.text !== 'string' || (data.type !== 'live' && !data.text.trim()) || data.text.length > 1000) return json(res, 400, { error: 'Use a caption, question or live text of at most 1000 characters' });
          if (!writer && data.type !== 'question') return json(res, 403, { error: 'Only the signer can publish captions' });
          const clientId = typeof data.clientId === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(data.clientId) ? data.clientId : null;
          const previous = clientId && room.events.find(e => e.clientId === clientId);
          if (previous) {
            if (previous.text !== data.text.trim() || previous.type !== data.type) return json(res, 409, { error: 'Message identifier already used' });
            return json(res, 200, previous);
          }
          const event = { seq: room.next++, type: data.type, text: data.text.trim(), clientId, at: now() };
          room.events.push(event);
          if (room.events.length > 200) room.events.shift();
          return json(res, 201, event);
        }
        return json(res, 405, { error: 'Method not allowed' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' });
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Bad URL' }); }
      if (pathname.includes('\0') || pathname.includes('\\')) return json(res, 400, { error: 'Bad path' });
      const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(root + sep)) return json(res, 403, { error: 'Forbidden' });
      const info = await stat(path).catch(() => null);
      if (!info?.isFile()) return json(res, 404, { error: 'File not found' });
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(path));
    } catch (error) { json(res, error.status ?? 500, { error: error.status ? error.message : 'Server error' }); }
  });
  server.on('close', () => { cameraBridge.stop(); for (const timer of expiryTimers) clearTimeout(timer); expiryTimers.clear(); rooms.clear(); limits.clear(); });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 5417);
  const host = process.env.HOST ?? '127.0.0.1';
  createApp().listen(port, host, () => console.log(`Handsay listening at http://${host}:${port}`));
}
