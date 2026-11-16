// Runs the real landmark engine on an empty test image without requesting a camera.
export function checkTracker(featureSet, options = {}) {
  const worker = new Worker(new URL('./ml/tracker.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('The tracking engine took too long to initialize. Try the CPU on a different browser.')), 45000);
    let ended = false;
    function finish(error, result) {
      if (ended) return; ended = true; clearTimeout(timer); worker.terminate();
      options.signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(result);
    }
    const abort = () => finish(new Error('Tracking check cancelled'));
    options.signal?.addEventListener('abort', abort, {once:true});
    if (options.signal?.aborted) { abort(); return; }
    worker.onerror = e => finish(new Error(e.message || 'Tracking worker failed'));
    let delegate, testCanvas;
    const timings = [], observations = [], trackedFrames = [];
    async function sendFrame() {
      options.drawFrame?.(testCanvas, timings.length);
      const bitmap = await createImageBitmap(testCanvas);
      if (ended) { bitmap.close(); return; }
      worker.postMessage({ type: 'frame', bitmap, t: performance.now() }, [bitmap]);
    }
    worker.onmessage = async ({ data }) => {
      if (data.type === 'ready') {
        delegate = data.delegate;
        try {
          testCanvas = document.createElement('canvas'); testCanvas.width = 512; testCanvas.height = 512;
          const context = testCanvas.getContext('2d'); context.fillStyle = '#c5c9bf'; context.fillRect(0, 0, 512, 512);
          await sendFrame();
        } catch (e) { finish(e); }
      } else if (data.type === 'landmarks') {
        timings.push(data.ms);
        observations.push({ hands: data.hands, poses: data.poses });
        trackedFrames.push(data.frame);
        if (timings.length < (options.frames || 3)) { try { await sendFrame(); } catch (e) { finish(e); } }
        else finish(null, { delegate, ms: timings.slice(1).reduce((a,b)=>a+b,0) / (timings.length - 1), firstMs: timings[0], observations, trackedFrames });
      }
      else if (data.type === 'init-error' || data.type === 'frame-error') finish(new Error(data.message));
    };
    worker.postMessage({ type: 'init', featureSet, delegate: 'GPU' });
  });
}
