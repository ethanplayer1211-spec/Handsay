# SPDX-License-Identifier: GPL-2.0-only
# Optional native helper using pyvirtualcam (GPL-2.0). Web application is separate.
"""Receive bounded JPEG frames on stdin and publish them to the existing OBS camera.

Protocol: 4-byte big-endian size, then JPEG. Stdout is JSON status only.
Frames stay in memory. EOF or six seconds without new frames closes the camera.
"""
import io
import json
import queue
import struct
import sys
import threading
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import pyvirtualcam

WIDTH, HEIGHT, FPS = 1280, 720, 20
MAX_JPEG = 524288
Image.MAX_IMAGE_PIXELS = WIDTH * HEIGHT


def emit(**data):
    print(json.dumps(data), flush=True)


def read_exact(stream, count):
    result = bytearray()
    while len(result) < count:
        part = stream.read(count - len(result))
        if not part:
            return None
        result.extend(part)
    return bytes(result)


def paused_frame():
    image = Image.new('RGB', (WIDTH, HEIGHT), '#202124')
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.truetype('segoeui.ttf', 36)
    except OSError:
        font = ImageFont.load_default(size=36)
    draw.text((WIDTH // 2, HEIGHT // 2), 'Handsay output paused', anchor='mm', fill='white', font=font)
    return np.asarray(image).copy()


def main():
    frames = queue.Queue(maxsize=1)
    ended = threading.Event()

    def receive():
        try:
            while True:
                header = read_exact(sys.stdin.buffer, 4)
                if header is None:
                    break
                size = struct.unpack('>I', header)[0]
                if not 0 < size <= MAX_JPEG:
                    raise ValueError('Camera frame is too large or empty')
                data = read_exact(sys.stdin.buffer, size)
                if data is None:
                    break
                image = Image.open(io.BytesIO(data))
                if image.format != 'JPEG' or image.size != (WIDTH, HEIGHT):
                    raise ValueError('Expected a 1280 by 720 JPEG camera frame')
                frame = np.asarray(image.convert('RGB')).copy()
                try:
                    frames.put_nowait(frame)
                except queue.Full:
                    frames.get_nowait()
                    frames.put_nowait(frame)
        except Exception as error:
            emit(error=str(error))
        finally:
            ended.set()

    with pyvirtualcam.Camera(width=WIDTH, height=HEIGHT, fps=FPS, fmt=pyvirtualcam.PixelFormat.RGB, backend='obs') as camera:
        emit(ready=True, device=camera.device, width=WIDTH, height=HEIGHT, fps=FPS)
        threading.Thread(target=receive, daemon=True).start()
        blank = paused_frame()
        current = blank
        last = time.monotonic()
        received = 0
        while not ended.is_set():
            try:
                current = frames.get_nowait()
                last = time.monotonic()
                received += 1
            except queue.Empty:
                pass
            age = time.monotonic() - last
            if age > 6:
                break
            camera.send(blank if age > 2 else current)
            if received:
                emit(frame=received)
                received = 0
            camera.sleep_until_next_frame()
    emit(stopped=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        emit(error=str(error))
        sys.exit(1)
