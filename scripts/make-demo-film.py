"""Build a narrated, captioned film from actual app screenshots and model replay.

Run with the project camera runtime (Pillow), after narrate-demo-film.ps1.
No webcam, microphone, screen capture, remote generation or upload is used here.
"""
from pathlib import Path
import json, math, subprocess, wave, shutil, zipfile, hashlib
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output/demo-film'
FF = Path(r'C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe')
PROBE = FF.with_name('ffprobe.exe')
W,H,FPS = 1280,720,20
BG,INK,MUTED,BLUE,LINE = '#f8fafd','#202124','#5f6368','#0b57d0','#dadce0'
FONTS = Path('C:/Windows/Fonts')
STORY = json.loads((OUT/'storyboard.json').read_text(encoding='utf-8'))

def font(n,bold=False):
    return ImageFont.truetype(str(FONTS/('segoeuib.ttf' if bold else 'segoeui.ttf')),n)

def lines(text,f,width):
    result=[]
    for para in text.split('\n'):
        line=''
        for word in para.split():
            trial=(line+' '+word).strip()
            if f.getlength(trial)>width and line:
                result.append(line);line=word
            else: line=trial
        result.append(line)
    return result

def text(draw,xy,value,size=24,color=INK,bold=False,width=None,spacing=1.28):
    f=font(size,bold);x,y=xy
    for line in (lines(value,f,width) if width else value.split('\n')):
        draw.text((x,y),line,font=f,fill=color);y+=size*spacing
    return y

def pill(draw,xy,value,fill='#d3e3fd',color=BLUE,size=15):
    x,y=xy;f=font(size,True);width=int(f.getlength(value))+26
    draw.rounded_rectangle((x,y,x+width,y+33),radius=16,fill=fill)
    draw.text((x+13,y+6),value,font=f,fill=color)

def shot(name,crop=None):
    im=Image.open(OUT/'assets'/name).convert('RGB')
    return im.crop(crop) if crop else im

ASSETS={
    'setup':shot('setup.jpg',(18,0,1237,431)),
    'review':shot('review.jpg',(22,145,1230,645)),
    'edited':shot('edited.jpg',(22,145,1230,645)),
    'interviewer':shot('interviewer-live.jpg',(75,50,1178,530)),
    'privacy':shot('privacy.jpg',(321,175,925,312)),
    'voice':shot('settings.jpg',(322,123,922,495)),
}

def image_card(im,source,box=(365,132,1235,566),border=True):
    d=ImageDraw.Draw(im);x,y,r,b=box
    d.rounded_rectangle((x+3,y+5,r+3,b+5),radius=14,fill='#e5eaf2')
    d.rounded_rectangle(box,radius=14,fill='white',outline=LINE if border else None,width=1)
    fitted=ImageOps.contain(source,(r-x-18,b-y-18),Image.Resampling.LANCZOS)
    im.paste(fitted,(x+(r-x-fitted.width)//2,y+(b-y-fitted.height)//2))

def base(scene,index):
    im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
    d.rounded_rectangle((44,31,78,65),radius=9,fill=BLUE)
    d.line((53,42,68,42),fill='white',width=3);d.line((53,49,66,49),fill='white',width=3)
    text(d,(91,30),'Handsay',28,bold=True)
    text(d,(970,39),'VERITAS AI  /  HEALTH',16,color=MUTED)
    d.line((44,86,1235,86),fill=LINE,width=1)
    text(d,(44,105),f'{index+1:02d} / 09',16,color=BLUE,bold=True)
    if scene['kind']!='title':
        text(d,(44,151),scene['heading'],42,bold=True,spacing=1.16)
        notes={
            'setup':'A camera is optional.\nTyping is always available.',
            'replay':'Actual model predictions.\nReference labels never\nsupply the answer.',
            'review':'The user controls the\nfinal message.',
            'interviewer':'Questions travel back.\nReviewed answers travel out.',
            'privacy':'Drawings replace pixels.\nRecognition stays local.',
            'voice':'Choose a device voice.\nReview before speaking.',
            'results':'Count the mistakes.\nDo not hide held-back words.',
            'credits':'250 isolated ASL signs.\nNo continuous translation.',
        }
        text(d,(44,360),notes.get(scene['kind'],''),21,color=MUTED,spacing=1.6)
        text(d,(365,103),scene['note'],15,color=BLUE,bold=True)
    if scene['kind']=='title':
        text(d,(44,157),'Your words.',65,bold=True)
        text(d,(44,238),'Reviewed by you.',65,bold=True)
        text(d,(48,352),'A caption workspace for interviews.',27,color=MUTED)
        pill(d,(48,425),'SIGN SUGGESTIONS')
        pill(d,(250,425),'EDITABLE CAPTIONS')
        pill(d,(48,470),'OPTIONAL VOICE')
        d.rounded_rectangle((790,160,1218,355),radius=25,fill='#d3e3fd')
        text(d,(820,190),'I would like to\nexplain my idea.',35,color='#062e6f',bold=True)
        pill(d,(945,382),'REVIEWED BY ME',fill='#ceead6',color='#174c35')
        text(d,(795,455),'Illustrative text',17,color=MUTED)
        text(d,(795,488),'Actual app walkthrough follows.',20,color=MUTED)
    elif scene['kind']=='setup':
        image_card(im,ASSETS['setup'],(365,146,1235,487))
        pill(d,(390,516),'1  START');pill(d,(610,516),'2  CONNECT');pill(d,(854,516),'3  REVIEW & SEND')
    elif scene['kind']=='review':
        image_card(im,ASSETS['review'])
    elif scene['kind']=='interviewer':
        image_card(im,ASSETS['interviewer'])
    elif scene['kind']=='privacy':
        image_card(im,ASSETS['privacy'],(365,147,1235,367))
        for x,title,desc in [(365,'Silhouette','Hide every camera pixel.'),(807,'Hands only','Hide face, body and background.')]:
            d.rounded_rectangle((x,393,x+428,552),radius=14,fill='white',outline=LINE)
            text(d,(x+22,415),title,26,bold=True)
            text(d,(x+22,463),desc,21,color=MUTED,width=386)
        text(d,(365,567),'Output modes · recordings are local downloads',16,color=MUTED)
    elif scene['kind']=='voice':
        image_card(im,ASSETS['voice'])
    elif scene['kind']=='results':
        for x,value,label in [(365,'5 / 6','Raw model label matches'),(807,'1 / 6','Always-hello baseline')]:
            d.rounded_rectangle((x,148,x+428,340),radius=14,fill='white',outline=LINE)
            text(d,(x+25,162),value,66,color=BLUE,bold=True)
            text(d,(x+25,266),label,22,color=MUTED)
        d.rounded_rectangle((365,362,1235,535),radius=14,fill='#fff3d6')
        text(d,(389,381),'Careful filter: 3 correct + 1 mismatch accepted',25,bold=True)
        text(d,(389,432),'2 correct labels held back. Quiet → shh passed the filter.',22,color=MUTED)
        text(d,(389,479),'Selected upstream clips · not held-out or live accuracy',22,color='#7c4a00',bold=True)
    elif scene['kind']=='credits':
        rows=[('Base model / preprocessing','GestureSign · Shashank Yadav · MIT'),
              ('Recorded sign motion','Google / PopSign ASL Signs · CC BY 4.0'),
              ('Tracking / inference','MediaPipe / ONNX Runtime'),
              ('Substantial AI coding assistance','OpenAI Codex · disclosed in the write-up')]
        y=145
        for label,value in rows:
            text(d,(365,y),label,16,color=MUTED)
            text(d,(365,y+27),value,25,bold=True);y+=85
        d.rounded_rectangle((365,494,1235,572),radius=12,fill='#d3e3fd')
        text(d,(385,509),'Next: independent signer and non-sign testing.',24,color='#062e6f',bold=True)
        text(d,(385,544),'Prototype · not medical advice',18,color='#062e6f')
    return im

def caption_chunks(value,maxchars=83):
    words=value.split();chunks=[];current=[]
    for word in words:
        if current and len(' '.join(current+[word]))>maxchars:
            chunks.append(' '.join(current));current=[]
        current.append(word)
    if current:chunks.append(' '.join(current))
    return chunks

def stamp(seconds):
    ms=round(seconds*1000);h,rem=divmod(ms,3600000);m,rem=divmod(rem,60000);s,ms=divmod(rem,1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'

def build():
    timeline=[];subtitles=[];offset=0
    for i,scene in enumerate(STORY['scenes']):
        audio=OUT/'audio'/f"{scene['id']}.wav"
        with wave.open(str(audio)) as wav: speech=wav.getnframes()/wav.getframerate()
        duration=math.ceil(max(speech+.95,scene.get('minimum',0))*FPS)/FPS
        scene.update(start=offset,duration=duration,speechSeconds=speech)
        chunks=caption_chunks(scene['narration']);weight=sum(len(c.split()) for c in chunks);local=.25;caps=[]
        for j,chunk in enumerate(chunks):
            end=local+speech*len(chunk.split())/weight
            caps.append((local,end,chunk));subtitles.append((offset+local,offset+end,chunk));local=end
        scene['captions']=[{'start':a,'end':b,'text':s} for a,b,s in caps]
        timeline.append(scene);offset+=duration
    assert offset<120, f'Film too long: {offset}'
    (OUT/'timeline.json').write_text(json.dumps({'duration':offset,'fps':FPS,'scenes':timeline},ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'Handsay-demo.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{s}' for i,(a,b,s) in enumerate(subtitles))+'\n',encoding='utf-8')
    (OUT/'narration.txt').write_text('\n\n'.join(s['narration'] for s in timeline)+'\n',encoding='utf-8')
    for i,scene in enumerate(timeline):
        duration=scene['duration'];n=round(duration*FPS);kind=scene['kind'];static=base(scene,i)
        alternate=static.copy()
        if kind=='review':image_card(alternate,ASSETS['edited'])
        decoder=None;last=None
        if kind=='replay':
            decoder=subprocess.Popen([str(FF),'-v','error','-i',str(ROOT/'output/video/Handsay-avatar-demo.mp4'),'-vf',f'fps={FPS}','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
        segment=OUT/'segments'/f"{scene['id']}.mp4"
        command=[str(FF),'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-i',str(OUT/'audio'/f"{scene['id']}.wav"),'-filter_complex',f'[1:a]adelay=250:all=1,apad,atrim=duration={duration}[a]','-map','0:v','-map','[a]','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-t',str(duration),'-movflags','+faststart',str(segment)]
        encoder=subprocess.Popen(command,stdin=subprocess.PIPE)
        try:
            for frame_index in range(n):
                t=frame_index/FPS;im=(alternate if kind=='review' and t>3 else static).copy()
                if decoder:
                    raw=decoder.stdout.read(W*H*3)
                    if len(raw)==W*H*3:last=Image.frombytes('RGB',(W,H),raw)
                    if last:image_card(im,last,(343,132,1235,591))
                d=ImageDraw.Draw(im)
                # A restrained animated chapter rule and progress marker.
                progress=(scene['start']+t)/offset
                d.line((44,596,1235,596),fill=LINE,width=2)
                d.line((44,596,44+int(1191*progress),596),fill=BLUE,width=3)
                if kind in ['review','interviewer']:
                    pill(d,(365,552 if kind=='review' else 552),'TYPED ANSWER' if kind=='review' else 'REVIEWED MESSAGE DELIVERED',size=14)
                active=next((v for a,b,v in caps_for(scene) if a<=t<b),scene['captions'][-1]['text'] if t>.25 else '')
                d.rounded_rectangle((32,611,1248,688),radius=12,fill='#101b2b')
                if active:
                    f=font(24);wrapped=lines(active,f,1158);y=622 if len(wrapped)>1 else 635
                    for line in wrapped:
                        d.text(((W-f.getlength(line))/2,y),line,font=f,fill='white');y+=30
                text(d,(44,697),'Handsay · narrated software demonstration · synthetic voice',13,color=MUTED)
                text(d,(1050,697),f'{i+1:02d} / 09  ·  {int(scene["start"]+t):02d}s',13,color=MUTED)
                # Short fade from the page background. No fabricated UI frames.
                fade=min(1,t/.25,(duration-t)/.2)
                if fade<1:im=Image.blend(Image.new('RGB',(W,H),BG),im,max(0,fade))
                encoder.stdin.write(im.tobytes())
                if frame_index==min(n-1,round(duration*.55*FPS)):
                    im.save(OUT/'assets'/f"frame-{i+1:02d}.jpg",quality=94)
            encoder.stdin.close()
            if encoder.wait()!=0:raise RuntimeError(f'Encoding failed: {scene["id"]}')
        finally:
            if decoder:
                decoder.stdout.close();decoder.wait()
        print(f'Rendered {scene["id"]}: {duration:.2f}s',flush=True)
    concat=OUT/'segments/concat.txt'
    concat.write_text('\n'.join(f"file '{s['id']}.mp4'" for s in timeline),encoding='utf-8')
    final=OUT/'Handsay-hackathon-demo.mp4'
    subprocess.run([str(FF),'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart',str(final)],check=True)
    # Poster and a simple local HTML player with chapter navigation/transcript.
    shutil.copy2(OUT/'assets/frame-01.jpg',OUT/'poster.jpg')
    html_player(timeline)
    info=json.loads(subprocess.check_output([str(PROBE),'-v','error','-show_entries','format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate','-of','json',str(final)],text=True))
    info.update(sha256=hashlib.sha256(final.read_bytes()).hexdigest(),scope='Edited actual application screenshots and recorded-landmark avatar replay; no live human webcam accuracy test.',narration='Microsoft Zira Desktop, locally synthesized',uploaded=False)
    (OUT/'verification.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(info,indent=2),flush=True)

def caps_for(scene):
    return [(c['start'],c['end'],c['text']) for c in scene['captions']]

def html_player(timeline):
    import html
    chapters=''.join(f'<button data-time="{s["start"]:.2f}"><span>{i+1:02d}</span>{html.escape(s["heading"].replace(chr(10)," "))}</button>' for i,s in enumerate(timeline))
    transcript=''.join(f'<section><h3>{i+1:02d} · {html.escape(s["heading"].replace(chr(10)," "))}</h3><p>{html.escape(s["narration"])}</p></section>' for i,s in enumerate(timeline))
    content='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Handsay — demo film</title>
<style>body{margin:0;font:16px/1.6 "Segoe UI",Arial,sans-serif;background:#f8fafd;color:#202124}main{max-width:1150px;margin:auto;padding:32px 24px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dadce0;margin-bottom:28px}h1{font-size:30px;letter-spacing:-.6px}header p{color:#5f6368}video{display:block;width:100%;border-radius:16px;background:#101b2b}nav{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:24px 0}button{background:white;color:#0b57d0;border:1px solid #dadce0;border-radius:10px;padding:15px;text-align:left;cursor:pointer;font:inherit}button:hover{background:#d3e3fd}button span{margin-right:12px;color:#5f6368}a{color:#0b57d0}.note{background:#e9eef3;padding:20px;border-radius:12px}section{border-bottom:1px solid #dadce0;padding:12px 0}h3{font-weight:600}footer{font-size:14px;color:#5f6368;margin-top:30px}@media(max-width:700px){nav{grid-template-columns:1fr}header{display:block}}</style>
<main><header><h1>Handsay</h1><p>Veritas AI · Health · narrated demo</p></header>
<video id="film" controls preload="metadata" poster="poster.jpg"><source src="Handsay-hackathon-demo.mp4" type="video/mp4"></video>
<p><a href="Handsay-hackathon-demo.mp4" download>Download MP4</a> · <a href="Handsay-demo.srt" download>Subtitle file</a> · <a href="storyboard.json">Editable storyboard</a></p>
<nav aria-label="Video chapters">CHAPTERS</nav>
<p class="note">The film combines actual app screenshots, typed example answers and a recorded-landmark model replay. Replay and typed scenes are labelled. It does not demonstrate live human signing accuracy. Narration is a locally synthesized Microsoft Zira voice. No physical camera or microphone was opened. This project is a prototype and is not medical advice.</p>
<details><summary>Full narration transcript</summary>TRANSCRIPT</details>
<footer>Model / preprocessing: <a href="https://github.com/shashank11yadav/GestureSign">GestureSign · Shashank Yadav (MIT)</a>. Recorded motion: <a href="https://www.kaggle.com/competitions/asl-signs">Google / PopSign ASL Signs (CC BY 4.0)</a>. MediaPipe / ONNX Runtime. Substantial implementation and drafting assistance: OpenAI Codex. No upload or submission has been made.</footer></main>
<script>const film=document.getElementById('film');document.querySelectorAll('[data-time]').forEach(button=>button.addEventListener('click',()=>{film.currentTime=Number(button.dataset.time);film.play().catch(()=>{});}));</script></html>'''
    (OUT/'index.html').write_text(content.replace('CHAPTERS',chapters).replace('TRANSCRIPT',transcript),encoding='utf-8')

if __name__=='__main__':build()
