"""Synthesize only the public demo script with Microsoft's Edge speech service.
No screenshots, webcam, microphone or personal data are transmitted.
Run explicitly: this is an editing tool, not part of the Handsay application.
"""
from pathlib import Path
import argparse, asyncio, json, subprocess, wave
import edge_tts

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--project',default='demo-film-v2')
OUT=(ROOT/'output'/parser.parse_args().project).resolve()
assert OUT.is_relative_to((ROOT/'output').resolve()),'Output must stay in the project output directory'
FF=Path(r'C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe')

async def main():
    film=json.loads((OUT/'storyboard.json').read_text(encoding='utf-8'))
    (OUT/'audio').mkdir(parents=True,exist_ok=True)
    for scene in film['scenes']:
        mp3=OUT/'audio'/f"{scene['id']}.mp3"
        timing=mp3.with_suffix('.words.json')
        if not mp3.exists() or not timing.exists():
            data=[];words=[]
            speech=edge_tts.Communicate(scene['narration'],film['voice'],rate=scene['rate'],boundary='WordBoundary',connect_timeout=15,receive_timeout=45)
            async for chunk in speech.stream():
                if chunk['type']=='audio':data.append(chunk['data'])
                elif chunk['type']=='WordBoundary':words.append({k:chunk[k] for k in ['offset','duration','text']})
            assert data and words,'No speech or word timings received'
            mp3.write_bytes(b''.join(data))
            timing.write_text(json.dumps(words,ensure_ascii=False,indent=2),encoding='utf-8')
        wav=mp3.with_suffix('.wav')
        subprocess.run([str(FF),'-v','error','-y','-i',str(mp3),'-ar','48000','-ac','1',str(wav)],check=True)
        with wave.open(str(wav)) as audio:duration=audio.getnframes()/audio.getframerate()
        print(f"{scene['id']}: {duration:.2f}s · {film['voice']} · {scene['rate']}",flush=True)

if __name__=='__main__':asyncio.run(main())
