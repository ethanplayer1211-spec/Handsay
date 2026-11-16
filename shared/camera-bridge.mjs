import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

const secret = () => randomBytes(24).toString('hex');
export const CAMERA_MAX_BYTES = 524288;
const equal = (a,b) => {
  if (typeof a !== 'string') return false;
  const first = Buffer.from(a), second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first,second);
};
const failure = (message, status = 503) => Object.assign(new Error(message), {status});

export function cameraRequestAllowed(req) {
  const address = req.socket.remoteAddress;
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)) return false;
  try {
    const host = new URL(`http://${req.headers.host}`).hostname;
    if (!['localhost','127.0.0.1','[::1]'].includes(host)) return false;
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return false;
    return true;
  } catch { return false; }
}

export class CameraBridge {
  constructor({root = process.cwd(), desktop = false, platform = process.platform, spawnImpl = spawn, exists = existsSync} = {}) {
    this.root = root; this.desktop = desktop; this.platform = platform; this.spawn = spawnImpl; this.exists = exists;
    this.python = resolve(root, '.runtime/camera/Scripts/python.exe');
    this.startKey = secret(); this.lease = null; this.child = null; this.active = false; this.starting = false;
    this.frames = 0; this.lastFrameAt = 0; this.message = ''; this.pendingFrame = null;
  }
  status() {
    return { supported: this.platform === 'win32', setupReady: this.platform === 'win32' && this.exists(this.python), desktop: this.desktop,
      active: this.active, starting: this.starting, device: 'OBS Virtual Camera', width: 1280, height: 720, fps: 20,
      frames: this.frames, lastFrameAt: this.lastFrameAt, message: this.message, startKey: this.startKey };
  }
  async start(key) {
    if (!equal(key, this.startKey)) throw failure('Camera setup token rejected', 403);
    if (this.active || this.starting) throw failure('Handsay camera output is already running in another window. Stop it there first.', 409);
    if (!this.status().setupReady) throw failure('Run npm run setup:camera on Windows, with OBS Studio installed.');
    this.starting = true; this.message = ''; this.frames = 0; this.lastFrameAt = Date.now();
    const child = this.spawn(this.python, ['-u', resolve(this.root, 'scripts/virtual_camera.py')], {cwd:this.root, windowsHide:true, stdio:['pipe','pipe','pipe']});
    this.child = child;
    let stderr = '';
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-2000); });
    child.stdin.on('error', () => { if (this.child === child) this.stop('Camera helper disconnected'); });
    return new Promise((resolveStart,rejectStart) => {
      let ready = false;
      const timeout = setTimeout(() => { rejectStart(failure('Virtual camera did not start in time')); if(this.child === child)this.stop('Virtual camera startup timed out'); }, 12000);
      const lines = createInterface({input:child.stdout});
      const failed = message => {
        this.message = message;
        clearTimeout(timeout);
        if (!ready) rejectStart(failure(message));
        if (this.child === child) this.stop(message);
      };
      lines.on('line', line => {
        let data; try { data = JSON.parse(line); } catch { return; }
        if (this.child !== child) return;
        if (data.error) return failed(`OBS camera could not run: ${String(data.error).slice(0,500)}. If OBS is outputting already, stop its virtual camera first.`);
        if (data.ready && !ready) {
          ready = true; clearTimeout(timeout); this.starting = false; this.active = true; this.lease = secret();
          this.watchdog = setInterval(() => { if (Date.now() - this.lastFrameAt > 6500) this.stop('Camera source stopped sending frames'); }, 1000);
          this.watchdog.unref();
          resolveStart({...this.status(), lease:this.lease});
        }
        if (data.frame && this.pendingFrame) {
          this.frames++; this.lastFrameAt = Date.now();
          const pending = this.pendingFrame; this.pendingFrame = null; clearTimeout(pending.timer); pending.resolve();
        }
      });
      child.on('error', error => failed(error.message));
      child.on('close', () => {
        clearTimeout(timeout); lines.close();
        if (!ready) rejectStart(failure(this.message || stderr || 'Camera helper stopped before it was ready'));
        if (this.child === child) this.stop(this.message || 'Camera output stopped');
      });
    });
  }
  async frame(lease, jpeg) {
    if (!this.lease || !equal(lease, this.lease)) throw failure('Camera session expired or belongs to another window', 403);
    if (!this.active || !this.child) throw failure('Start camera output first', 409);
    if (!Buffer.isBuffer(jpeg) || jpeg.length < 4 || jpeg.length > CAMERA_MAX_BYTES || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw failure('Expected a JPEG camera frame', 400);
    if (this.pendingFrame) throw failure('Previous camera frame is still being processed', 429);
    const header = Buffer.alloc(4); header.writeUInt32BE(jpeg.length);
    return new Promise((resolveFrame,rejectFrame) => {
      const timer = setTimeout(() => this.stop('Camera output stopped responding'), 2500);
      this.pendingFrame = {resolve:resolveFrame,reject:rejectFrame,timer};
      this.child.stdin.write(Buffer.concat([header,jpeg]));
    });
  }
  stop(message = '', lease) {
    if (lease !== undefined && (!this.lease || !equal(lease, this.lease))) throw failure('Camera session token rejected',403);
    clearInterval(this.watchdog);
    if (this.pendingFrame) { clearTimeout(this.pendingFrame.timer); this.pendingFrame.reject(failure(message || 'Camera output stopped')); this.pendingFrame = null; }
    const child = this.child; this.child = null; this.active = false; this.starting = false; this.lease = null; this.message = message;
    if (child) {
      child.stdin.end();
      const timer = setTimeout(() => { if (child.exitCode === null) child.kill(); }, 1500); timer.unref();
    }
  }
}
