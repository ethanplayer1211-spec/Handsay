"""Build chronological walkthrough excerpts; all hand motions stay at 1x speed.
Original caption pixels and pointer actions are preserved. Local files only.
"""
from pathlib import Path
import argparse,subprocess,json,hashlib,shutil
from PIL import Image,ImageDraw,ImageFilter
ROOT=Path(__file__).resolve().parent.parent
FF=Path(r'C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe')
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);args=p.parse_args()
source=args.source.resolve();assert source.is_file()
out=ROOT/'output/demo-film-v6/assets';out.mkdir(parents=True,exist_ok=True)
clips=[
 dict(id='01-hello',start=31.6,end=39.4,cropY=130,faceY=340,faceHeight=226,protectHand=True),
 dict(id='02-open-gestures',start=46.1,end=48.5,cropY=62,faceY=265,faceHeight=226),
 dict(id='03-enter-phrase',start=55.0,end=63.2,cropY=130,faceY=None,faceHeight=0),
 dict(id='04-record-gesture',start=63.2,end=77.0,cropY=130,faceY=265,faceHeight=330),
 dict(id='05-live-test',start=115.6,end=123.8,cropY=130,faceY=340,faceHeight=226),
]
for clip in clips:
    width,height,x,y=1160,652,375,clip['cropY'];duration=round(clip['end']-clip['start'],3)
    mask=None
    if clip['faceY'] is not None:
        mask=Image.new('L',(188,clip['faceHeight']),0)
        ImageDraw.Draw(mask).ellipse((14,10,174,clip['faceHeight']-8),fill=180)
        mask=mask.filter(ImageFilter.GaussianBlur(5))
        if clip.get('protectHand'):ImageDraw.Draw(mask).rectangle((132,0,188,190),fill=0)
    movie=out/f"{clip['id']}.mp4"
    decoder=subprocess.Popen([str(FF),'-v','error','-ss',str(clip['start']),'-t',str(duration),'-i',str(source),'-vf',f'crop={width}:{height}:{x}:{y},fps=30','-an','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],stdout=subprocess.PIPE)
    encoder=subprocess.Popen([str(FF),'-v','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{width}x{height}','-framerate','30','-i','pipe:0','-vf','scale=1280:720:flags=lanczos','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],stdin=subprocess.PIPE)
    count=blurred=0
    try:
        while True:
            raw=decoder.stdout.read(width*height*3)
            if not raw:break
            assert len(raw)==width*height*3
            im=Image.frombytes('RGB',(width,height),raw)
            # This wall patch is bright only when the camera panel is visible.
            # It prevents the face mask from touching text on library screens.
            wall=im.crop((455-x,235-y,500-x,270-y)).resize((1,1)).getpixel((0,0))
            if mask is not None and sum(wall)/3>90:
                pos=(706-x,clip['faceY']-y);box=(*pos,pos[0]+188,pos[1]+clip['faceHeight'])
                face=im.crop(box).filter(ImageFilter.GaussianBlur(6));im.paste(face,pos,mask);blurred+=1
            encoder.stdin.write(im.tobytes());count+=1
            if count in [10,40,90,180,300,390]:im.resize((1280,720)).save(out/f"{clip['id']}-check-{count}.jpg",quality=95)
        decoder.stdout.close();assert decoder.wait()==0
        encoder.stdin.close();assert encoder.wait()==0
    finally:
        if decoder.poll() is None:decoder.terminate()
        if encoder.poll() is None:encoder.terminate()
    assert abs(count/30-duration)<.07,(clip['id'],count,duration)
    clip.update(frames=count,blurredFrames=blurred,duration=count/30,sha256=hashlib.sha256(movie.read_bytes()).hexdigest(),speed=1,internalCuts=False,originalCaptionsPreserved=True)
    print(f"{clip['id']}: {count/30:.2f}s; {blurred} camera frames softly blurred",flush=True)
# Cut on the My gestures click to the actual empty-library screen after the
# owner cleared earlier experiments. Do not flash pre-existing trained entries
# immediately before showing this phrase being created from scratch.
segments=out/'segments';segments.mkdir(exist_ok=True)
opened=out/'02-open-gestures.mp4';typed=out/'03-enter-phrase.mp4'
subprocess.run([str(FF),'-v','error','-y','-i',str(opened),'-i',str(typed),'-filter_complex','[0:v]trim=end_frame=14,setpts=PTS-STARTPTS[a];[1:v]trim=end_frame=54,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]','-map','[v]','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',str(segments/'opened.mp4')],check=True)
subprocess.run([str(FF),'-v','error','-y','-i',str(typed),'-vf','trim=start_frame=54,setpts=PTS-STARTPTS','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',str(segments/'typed.mp4')],check=True)
shutil.copy2(segments/'opened.mp4',opened);shutil.copy2(segments/'typed.mp4',typed)
clips[1].update(end=56.8,sourcePieces=[[46.1,46.1+14/30],[55.0,56.8]],frames=68,duration=68/30,internalCuts=True,edit='Cut on tab click past existing-library cleanup to the actual empty library.')
clips[2].update(start=56.8,frames=192,duration=6.4)
for clip in clips[1:3]:
    movie=out/f"{clip['id']}.mp4";clip['sha256']=hashlib.sha256(movie.read_bytes()).hexdigest()
    for count in [10,40,90,180]:
        if count<=clip['frames']:subprocess.run([str(FF),'-v','error','-y','-ss',str((count-1)/30),'-i',str(movie),'-frames:v','1',str(out/f"{clip['id']}-check-{count}.jpg")],check=True)
report={'source':'Owner-supplied second screen recording; original unchanged','clips':clips,'scope':'Chronological edited walkthrough. Existing-library cleanup, unrelated phrase training, idle gaps and failed retests are omitted. The tab click cuts to the actual empty library; creation then continues into real training. Capture motion and recognition waits are not speeded up.','facePrivacy':'Light blur, not anonymization; Hello hand excluded from blur; library text is untouched.'}
(out/'edit-decisions.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
