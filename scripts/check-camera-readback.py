"""Test-only consumer: wait for a caption on the synthetic OBS test pattern.

Does not open a physical camera. Uses FFmpeg's DirectShow consumer and saves one
frame, never a recording. A visual check is still required after the pixel check.
"""
import json
import subprocess
import time
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
command = ['ffmpeg','-hide_banner','-loglevel','error','-f','dshow','-video_size','1280x720','-framerate','20','-i','video=OBS Virtual Camera','-t','45','-pix_fmt','rgb24','-f','rawvideo','pipe:1']
process = subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
started = time.monotonic()
try:
    while time.monotonic()-started < 45:
        data = bytearray()
        while len(data) < 1280*720*3:
            part = process.stdout.read(1280*720*3-len(data))
            if not part:
                raise RuntimeError('Virtual-camera consumer ended without a caption frame')
            data.extend(part)
        pixels = np.frombuffer(data,dtype=np.uint8).reshape((720,1280,3))
        region = pixels[450:700,64:1216]
        dark = float(np.all(region < 45,axis=2).mean())
        white = float(np.all(region > 220,axis=2).mean())
        if dark > .20 and white > .01:
            target = root/'docs/evaluation/camera-caption-readback.png'
            Image.fromarray(pixels).save(target)
            print(json.dumps({'consumer':'FFmpeg DirectShow','device':'OBS Virtual Camera','width':1280,'height':720,'deviceFps':20,'elapsedSeconds':round(time.monotonic()-started,2),'captionRegionDarkFraction':dark,'captionRegionWhiteFraction':white,'frame':str(target),'scope':'Synthetic test pattern only; inspect saved image for the actual caption text'}),flush=True)
            break
    else:
        raise RuntimeError('No caption observed within 45 seconds')
finally:
    process.terminate()
    try: process.wait(timeout=3)
    except subprocess.TimeoutExpired: process.kill()
