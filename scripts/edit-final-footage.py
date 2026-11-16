"""Local editorial excerpts from the owner's second recording. No uploads.
Retain original app captions/timing; light face blur excludes the Hello hand.
"""
from pathlib import Path
import argparse,json,subprocess,hashlib
from PIL import Image,ImageDraw,ImageFilter
ROOT=Path(__file__).resolve().parent.parent
FF=Path(r'C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe')
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);args=p.parse_args()
source=args.source.resolve();assert source.is_file()
out=ROOT/'output/demo-film-v5/assets';out.mkdir(parents=True,exist_ok=True)
clips=[dict(id='hello',start=32.8,end=39.2,handProtected=True),dict(id='shortcut',start=117.4,end=123.6,handProtected=False)]
for clip in clips:
    mask=Image.new('L',(188,226),0);d=ImageDraw.Draw(mask)
    d.ellipse((14,10,174,218),fill=180)
    mask=mask.filter(ImageFilter.GaussianBlur(5))
    if clip['handProtected']:
        # The saluting hand is to the right of source x=838. This entire area
        # stays original, including the moving fingers beside the temple.
        ImageDraw.Draw(mask).rectangle((132,0,188,190),fill=0)
    mask.save(out/f"{clip['id']}-face-mask.png")
    movie=out/f"{clip['id']}.mp4";duration=clip['end']-clip['start']
    filters='[0:v]split[base][face];[face]crop=188:226:706:340,gblur=sigma=6[soft];[soft][1:v]alphamerge[masked];[base][masked]overlay=706:340,crop=1160:652:375:180,scale=1280:720:flags=lanczos,fps=30,format=yuv420p[v]'
    subprocess.run([str(FF),'-v','error','-y','-ss',str(clip['start']),'-t',str(duration),'-i',str(source),'-loop','1','-i',str(out/f"{clip['id']}-face-mask.png"),'-filter_complex',filters,'-map','[v]','-an','-t',str(duration),'-c:v','libx264','-preset','medium','-crf','18','-movflags','+faststart',str(movie)],check=True)
    subprocess.run([str(FF),'-v','error','-i',str(movie),'-f','null','-'],check=True)
    clip.update(duration=duration,sha256=hashlib.sha256(movie.read_bytes()).hexdigest(),sourceCrop=[375,180,1160,652],captionPixels='Original, not replaced or rewritten',audioRemoved=True,internalCuts=False,speed=1)
    for second in [0.5,1.3,2.2,4.5]:
        subprocess.run([str(FF),'-v','error','-y','-ss',str(second),'-i',str(movie),'-frames:v','1',str(out/f"{clip['id']}-{second}.jpg")],check=True)
report=dict(source='Owner-supplied second screen recording; original retained outside workspace',faceBlur='Light feathered Gaussian blur, not anonymization; Hello hand area protected',clips=clips,scope='Selected successful attempts; failures elsewhere omitted. No success-rate claim or independent live accuracy.')
(out/'edit-decisions.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
