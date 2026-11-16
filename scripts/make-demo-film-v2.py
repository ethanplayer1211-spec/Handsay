"""Editorial revision: full-frame app footage, neural VO and word-timed captions.
Uses the already captured local app screenshots and a labelled model replay.
"""
from pathlib import Path
import argparse, hashlib, json, math, re, shutil, subprocess, wave, zipfile
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--project',default='demo-film-v2')
parser.add_argument('--preview',action='store_true')
OPTIONS=parser.parse_args()
OUT=(ROOT/'output'/OPTIONS.project).resolve()
assert OUT.is_relative_to((ROOT/'output').resolve()),'Output must stay in the project output directory'
SOURCE=ROOT/'output/demo-film/assets'
FF=Path(r'C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe')
W,H,FPS=1920,1080,30
PAPER,INK,BLUE,MUTED,LINE='#f8fafd','#172331','#0b57d0','#5f6874','#dbe1e8'
FILM=json.loads((OUT/'storyboard.json').read_text(encoding='utf-8'))
if FILM.get('darkTheme'):
    PAPER,INK,MUTED,LINE='#131314','#e3e3e3','#b0b3b8','#444746'
FONTROOT=Path('C:/Windows/Fonts')

@lru_cache(80)
def font(size,bold=False):
    return ImageFont.truetype(str(FONTROOT/('segoeuib.ttf' if bold else 'segoeui.ttf')),size)

def wrap(value,f,width):
    result=[]
    for para in value.split('\n'):
        row=''
        for word in para.split():
            trial=(row+' '+word).strip()
            if row and f.getlength(trial)>width:result.append(row);row=word
            else:row=trial
        result.append(row)
    return result

def write(d,xy,value,size=32,color=INK,bold=False,width=None,spacing=1.28):
    f=font(size,bold);x,y=xy
    for row in wrap(value,f,width or 100000):
        d.text((x,y),row,font=f,fill=color);y+=size*spacing
    return y

def load(name,crop=None):
    im=Image.open(SOURCE/name).convert('RGB')
    return im.crop(crop) if crop else im

SHOTS={
    'setup':load('setup.jpg',(20,75,1234,423)),
    'review':load('review.jpg',(22,145,1230,645)),
    'edited':load('edited.jpg',(22,145,1230,645)),
    'interviewer':load('interviewer-live.jpg',(76,50,1176,534)),
    'privacy':load('privacy.jpg',(321,175,925,312)),
    'voice':load('settings.jpg',(322,123,922,495)),
    'opening':load('edited.jpg',(24,148,842,617)),
}
if FILM.get('voiceScreenshot'):SHOTS['voice']=Image.open(ROOT/FILM['voiceScreenshot']).convert('RGB').crop((322,123,922,495))
if FILM.get('openingAsset'):SHOTS['opening']=Image.open(ROOT/FILM['openingAsset']).convert('RGB')

def ease(t):
    t=max(0,min(1,t));return t*t*(3-2*t)

def screenshot(im,src,box,zoom=1,focus=(.5,.5)):
    x,y,r,b=map(int,box);tw,th=r-x,b-y
    # A masked photographic pan/zoom, retaining the unaltered UI pixels.
    fitted=ImageOps.fit(src,(tw,th),Image.Resampling.LANCZOS,centering=focus)
    if zoom>1:
        sw,sh=fitted.size;cw,ch=sw/zoom,sh/zoom
        left=(sw-cw)*focus[0];top=(sh-ch)*focus[1]
        fitted=fitted.crop((left,top,left+cw,top+ch)).resize((tw,th),Image.Resampling.LANCZOS)
    mask=Image.new('L',(tw,th),0);ImageDraw.Draw(mask).rounded_rectangle((0,0,tw-1,th-1),radius=18,fill=255)
    im.paste(fitted,(x,y),mask)
    ImageDraw.Draw(im).rounded_rectangle((x,y,r-1,b-1),radius=18,outline=LINE,width=2)

def header(im,scene,dark=False):
    d=ImageDraw.Draw(im);color='white' if dark else INK
    d.rounded_rectangle((64,39,111,86),radius=12,fill=BLUE)
    d.line((77,54,98,54),fill='white',width=4);d.line((77,64,94,64),fill='white',width=4)
    write(d,(127,39),'Handsay',37,color,bold=True)
    # Source labelling remains legible, without a repeated large template title.
    label=scene['label'].upper();f=font(22)
    d.text((1856-f.getlength(label),54),label,font=f,fill='#afc1d7' if dark else MUTED)
    d.line((64,113,1856,113),fill='#304050' if dark else LINE,width=1)

def baseline(scene):
    dark=FILM.get('darkTheme') or scene['kind'] in ['opening','results']
    im=Image.new('RGB',(W,H),PAPER if FILM.get('darkTheme') else '#101b2b' if dark else PAPER);header(im,scene,dark)
    return im

def render(scene,t,duration,replay_frame=None):
    kind=scene['kind'];im=baseline(scene);d=ImageDraw.Draw(im)
    progress=ease(t/max(1,duration))
    if kind=='opening':
        screenshot(im,SHOTS['opening'],(850,232,1856,810),1+.025*progress)
        write(d,(70,234),'A clearer\nconversation.',83,'white',True,spacing=1.13)
        write(d,(74,498),'A caption workspace\nfor interviews.',36,'#afc1d7',width=700,spacing=1.5)
        write(d,(876,840),FILM.get('openingLabel','Typed example in the actual application'),24,'#afc1d7')
        d.line((74,713,649,713),fill='#376ba4',width=3)
        write(d,(74,748),'Suggest. Review. Share.',30,'#cfe2ff')
    elif kind=='setup':
        write(d,(64,153),scene['title'],55,bold=True)
        screenshot(im,SHOTS['setup'],(64,280,1856,794),1+.015*progress)
        for x,n,label in [(64,'01','Camera or text'),(670,'02','Invite your interviewer'),(1320,'03','Review and send')]:
            write(d,(x,850),n,26,BLUE,True);write(d,(x+58,843),label,31,bold=True)
    elif kind=='replay':
        if replay_frame is not None:
            screenshot(im,replay_frame.crop((48,122,1232,665)),(64,137,1856,959))
        else:
            screenshot(im,load('frame-03.jpg') if (SOURCE/'frame-03.jpg').exists() else SHOTS['edited'],(64,137,1856,930))
    elif kind=='live':
        if replay_frame is not None:screenshot(im,replay_frame,(240,137,1680,947) if FILM.get('separateCaptionAreas') else (224,134,1696,962))
    elif kind=='capture':
        src=Image.open(ROOT/scene['image']).convert('RGB')
        # Contain the complete photographed app region: never crop a hand or
        # the app's caption to fill an editorial viewport.
        fitted=ImageOps.contain(src,(1792,780),Image.Resampling.LANCZOS)
        im.paste(fitted,((W-fitted.width)//2,140+(780-fitted.height)//2))
    elif kind=='limits':
        write(d,(100,188),'Individual words.\nPersonal shortcuts.',72,bold=True,spacing=1.2)
        d.line((100,420,1820,420),fill=LINE,width=2)
        for y,title,desc in [(475,'Review every result','A confident prediction can still be wrong.'),(630,'Type anything outside the vocabulary','The model does not translate continuous ASL.'),(785,'Live accuracy remains unverified','Independent signer testing is still needed.')]:
            write(d,(104,y),title,38,bold=True)
            write(d,(104,y+61),desc,30,color=MUTED)
    elif kind=='closing':
        write(d,(100,225),'Handsay',112,bold=True)
        write(d,(108,400),'A caption workspace.',50,color=MUTED)
        write(d,(108,630),'Sign or type. Review. Share.',40,bold=True)
    elif kind=='review':
        src=SHOTS['edited'] if t>2.7 else SHOTS['review']
        screenshot(im,src,(64,152,1856,894),1+.035*progress,focus=(.7,.5))
        write(d,(68,912),'Check the caption. Edit the answer. Send when ready.',27,color=MUTED)
        # Editorial emphasis, not a fabricated screen control.
        if 5<t<8:
            alpha=int(180*math.sin((t-5)/3*math.pi))
            overlay=Image.new('RGBA',(W,H));p=ImageDraw.Draw(overlay)
            p.rounded_rectangle((1338,654,1816,733),radius=40,outline=(11,87,208,alpha),width=5)
            im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')
    elif kind=='interviewer':
        screenshot(im,SHOTS['interviewer'],(64,149,1856,937),1+.022*progress,focus=(.45,.42))
    elif kind=='privacy':
        write(d,(64,156),scene['title'],55,bold=True)
        screenshot(im,SHOTS['privacy'],(64,287,1856,694),1+.012*progress)
        d.line((64,758,1856,758),fill=LINE,width=2)
        for x,title,desc in [(64,'Silhouette','Every camera pixel is replaced.'),(1040,'Hands only','Face, body and background are hidden.')]:
            write(d,(x,797),title,40,bold=True)
            write(d,(x,859),desc,29,color=MUTED)
    elif kind=='voice':
        write(d,(64,235),'A voice,\nwhen you\nwant one.',75,bold=True,spacing=1.13)
        write(d,(69,578),'Choose a device voice.\nReview before speaking.',31,color=MUTED,spacing=1.55)
        screenshot(im,SHOTS['voice'],(739,182,1856,875),1+.02*progress)
    elif kind=='results':
        write(d,(64,162),scene['title'],64,'white',True)
        rows=[(340,'Raw model','5 of 6 labels matched',['#9cc6ff']*5+['#e8b974']),
              (515,'Always-hello baseline','1 of 6 labels matched',['#9cc6ff']+['#3f4c5d']*5),
              (690,'Careful filter','3 correct accepted · 1 wrong accepted · 2 correct held back',['#9cc6ff']*3+['#e8b974']+['#3f4c5d']*2)]
        for y,title,desc,colors in rows:
            write(d,(64,y),title,38,'white',True)
            write(d,(67,y+61),desc,27,'#b4c3d5')
            for n,c in enumerate(colors):
                x=1325+n*85;d.ellipse((x,y+14,x+55,y+69),fill=c)
        d.line((64,855,1856,855),fill='#405166',width=2)
        write(d,(65,881),'Selected examples. Not a held-out test or a live accuracy measurement.',29,'#e8b974',True)
    elif kind=='credits':
        write(d,(64,160),'Handsay',95,bold=True)
        write(d,(70,290),'A clearer conversation,\nwith the person in control.',41,color=MUTED,spacing=1.4)
        write(d,(70,476),'250 individual ASL signs.\nNo continuous translation.',31,color=MUTED,spacing=1.55)
        write(d,(70,715),'Next: independent signer testing.',31,color=BLUE,bold=True,width=690)
        rows=[('MODEL / PREPROCESSING','GestureSign · Shashank Yadav (MIT)'),
              ('RECORDED MOTION','Google / PopSign ASL Signs (CC BY 4.0)'),
              ('TRACKING / INFERENCE','MediaPipe / ONNX Runtime'),
              ('SUBSTANTIAL AI CODING ASSISTANCE','OpenAI Codex · disclosed in write-up'),
              ('NARRATION',FILM.get('voiceCredit','Microsoft Ava · synthetic neural voice'))]
        for i,(label,value) in enumerate(rows):
            y=185+i*124;write(d,(890,y),label,22,color=MUTED);write(d,(890,y+39),value,31,bold=True)
        d.line((70,856,1856,856),fill=LINE,width=2)
        write(d,(70,883),'This project is a prototype and is not medical advice.',31,bold=True)
    return im

def captions(scene):
    data=json.loads((OUT/'audio'/f"{scene['id']}.words.json").read_text(encoding='utf-8'))
    tokens=scene['narration'].split();assert len(tokens)==len(data),(scene['id'],len(tokens),len(data))
    if scene.get('captionGroups'):
        assert ' '.join(scene['captionGroups'])==scene['narration']
        groups=[];index=0
        for value in scene['captionGroups']:
            count=len(value.split());first,last=data[index],data[index+count-1]
            groups.append({'start':first['offset']/1e7+.20,'end':(last['offset']+last['duration'])/1e7+.32,'text':value});index+=count
        for a,b in zip(groups,groups[1:]):a['end']=min(a['end'],b['start'])
        return groups
    result=[];current=[];start=0;end=0
    for i,(token,word) in enumerate(zip(tokens,data)):
        if not current:start=word['offset']/1e7+.20
        current.append(token);end=(word['offset']+word['duration'])/1e7+.20
        punct=token.endswith(('.', '?', '!'))
        if len(current)>=10 or (punct and len(current)>=3) or i==len(tokens)-1:
            result.append({'start':start,'end':end+.12,'text':' '.join(current)});current=[]
    for a,b in zip(result,result[1:]):a['end']=min(a['end'],b['start'])
    return result

def stamp(seconds):
    value=round(seconds*1000);h,rem=divmod(value,3600000);m,rem=divmod(rem,60000);s,ms=divmod(rem,1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'

def draw_caption(d,scene,active):
    if not FILM.get('captionStyle',{}).get('twoTone'):
        f=font(36);wrapped=wrap(active,f,1775);assert len(wrapped)<=2,active
        y=982 if len(wrapped)>1 else 1005
        for row in wrapped:d.text(((W-f.getlength(row))/2,y),row,font=f,fill='#fff');y+=45
        return
    # Stable phrase captions: bold white with selected yellow emphasis. Words
    # retain their colour for the whole phrase instead of flashing individually.
    f=font(42,True);wrapped=wrap(active,f,1775);assert len(wrapped)<=2,active
    y=978 if len(wrapped)>1 else 997
    accents={re.sub(r'[^a-z]','',word.lower()) for word in scene.get('accentWords',[])}
    tokens=active.split();selected={i for i,token in enumerate(tokens) if re.sub(r'[^a-z]','',token.lower()) in accents}
    if not selected:
        selected={next((i for i in range(len(tokens)-1,-1,-1) if len(tokens[i])>3),len(tokens)-1)}
    selected=set(sorted(selected)[:2]);index=0
    for row in wrapped:
        x=(W-f.getlength(row))/2
        for token in row.split():
            color='#ffd166' if index in selected else '#ffffff'
            d.text((x,y+2),token,font=f,fill='#000000',stroke_width=3,stroke_fill='#000000')
            d.text((x,y),token,font=f,fill=color,stroke_width=1,stroke_fill='#101b2b')
            x+=f.getlength(token+' ');index+=1
        y+=47

def plan():
    cursor=0
    for scene in FILM['scenes']:
        with wave.open(str(OUT/'audio'/f"{scene['id']}.wav")) as audio:speech=audio.getnframes()/audio.getframerate()
        duration=math.ceil(max(speech+.85,scene.get('minimum',0))*FPS)/FPS
        scene.update(start=cursor,duration=duration,speechSeconds=speech,captions=captions(scene));cursor+=duration
    assert cursor<120,cursor
    FILM.update(duration=cursor,fps=FPS,width=W,height=H)
    (OUT/'timeline.json').write_text(json.dumps(FILM,ensure_ascii=False,indent=2),encoding='utf-8')
    rows=[]
    for scene in FILM['scenes']:
        for c in scene['captions']:
            rows.append(f"{len(rows)+1}\n{stamp(scene['start']+c['start'])} --> {stamp(scene['start']+c['end'])}\n{c['text']}")
    (OUT/'Handsay-demo.srt').write_text('\n\n'.join(rows)+'\n',encoding='utf-8')
    (OUT/'narration.txt').write_text('\n\n'.join(s['narration'] for s in FILM['scenes'])+'\n',encoding='utf-8')

def export(preview=False):
    (OUT/'frames').mkdir(parents=True,exist_ok=True);(OUT/'segments').mkdir(exist_ok=True)
    plan()
    previous_last=None
    for index,scene in enumerate(FILM['scenes']):
        n=round(scene['duration']*FPS);decoder=None;last=None
        if scene['kind']=='replay':
            decoder=subprocess.Popen([str(FF),'-v','error','-ss','3.15','-t','7.0','-i',str(ROOT/'output/video/Handsay-avatar-demo.mp4'),'-vf',f'fps={FPS}','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
        elif scene['kind']=='live':
            decoder=subprocess.Popen([str(FF),'-v','error','-i',str(ROOT/scene.get('liveClip',FILM.get('liveClip',''))),'-vf',f'fps={FPS}','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
        if preview:
            if decoder:
                raw=decoder.stdout.read(1280*720*3);last=Image.frombytes('RGB',(1280,720),raw)
                decoder.stdout.close();decoder.terminate();decoder.wait();decoder=None
            im=render(scene,scene['duration']*.52,scene['duration'],last)
            im.save(OUT/'frames'/f'{index+1:02d}.jpg',quality=94)
            continue
        segment=OUT/'segments'/f"{scene['id']}.mp4"
        command=[str(FF),'-v','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-i',str(OUT/'audio'/f"{scene['id']}.wav"),'-filter_complex',f"[1:a]adelay=200:all=1,apad,atrim=duration={scene['duration']}[a]",'-map','0:v','-map','[a]','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t',str(scene['duration']),str(segment)]
        encoder=subprocess.Popen(command,stdin=subprocess.PIPE)
        try:
            # Preserve full 30fps motion, including gentle screenshot reframing.
            cached=None;cached_key=None
            for frame_index in range(n):
                t=frame_index/FPS
                if decoder and (scene['kind']=='live' or frame_index<210):
                    raw=decoder.stdout.read(1280*720*3)
                    if len(raw)==1280*720*3:last=Image.frombytes('RGB',(1280,720),raw)
                if scene['kind'] in ['replay','live']:im=render(scene,t,scene['duration'],last)
                else:
                    key=frame_index
                    if key!=cached_key:cached=render(scene,t,scene['duration']);cached_key=key
                    im=cached.copy()
                d=ImageDraw.Draw(im)
                active=next((c['text'] for c in scene['captions'] if c['start']<=t<c['end']),None)
                # Quiet caption band: two lines maximum, no word-by-word flashing.
                band=956 if FILM.get('separateCaptionAreas') else 969
                d.rectangle((0,band,W,H),fill='#101b2b')
                if FILM.get('separateCaptionAreas'):d.line((64,band,1856,band),fill='#405166',width=1)
                if active:
                    draw_caption(d,scene,active)
                fraction=(scene['start']+t)/FILM['duration']
                d.rectangle((0,1077,int(W*fraction),1079),fill='#739ddb')
                if t<.22:
                    im=Image.blend(previous_last if previous_last is not None else Image.new('RGB',(W,H),'#101b2b'),im,ease(t/.22))
                if index==len(FILM['scenes'])-1 and scene['duration']-t<.5:
                    im=Image.blend(Image.new('RGB',(W,H),'#101b2b'),im,ease((scene['duration']-t)/.5))
                encoder.stdin.write(im.tobytes())
                if frame_index==int(n*.55):im.save(OUT/'frames'/f'{index+1:02d}.jpg',quality=94)
            previous_last=im.copy()
            encoder.stdin.close();assert encoder.wait()==0,scene['id']
        finally:
            if decoder:decoder.stdout.close();decoder.wait()
        print(f"Rendered {scene['id']} · {scene['duration']:.2f}s",flush=True)
    if preview:return
    concat=OUT/'segments/concat.txt';concat.write_text('\n'.join(f"file '{s['id']}.mp4'" for s in FILM['scenes']),encoding='utf-8')
    movie=OUT/'Handsay-demo-revised.mp4'
    subprocess.run([str(FF),'-v','error','-y','-f','concat','-safe','0','-i',str(concat),'-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(movie)],check=True)
    subprocess.run([str(FF),'-v','error','-i',str(movie),'-f','null','-'],check=True)
    info=json.loads(subprocess.check_output([str(FF.with_name('ffprobe.exe')),'-v','error','-show_entries','format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate','-of','json',str(movie)],text=True))
    assert float(info['format']['duration'])<120
    info.update(sha256=hashlib.sha256(movie.read_bytes()).hexdigest(),voice=FILM['voice'],narrationService='Microsoft Edge speech service, script only, explicitly approved by user',scope=FILM.get('scope','Edited actual app screenshots and cropped recorded-landmark model replay; no live signing accuracy claim'),uploaded=False,fullDecodePassed=True,wordTimedCaptions=True,captionStyle=FILM.get('captionStyle',{}),status=FILM.get('status',''))
    (OUT/'verification.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    if FILM.get('posterAt') is not None:
        subprocess.run([str(FF),'-v','error','-y','-ss',str(FILM['posterAt']),'-i',str(movie),'-frames:v','1',str(OUT/'poster.jpg')],check=True)
    else:shutil.copy2(OUT/'frames/01.jpg',OUT/'poster.jpg')
    print(json.dumps(info,indent=2),flush=True)

if __name__=='__main__':
    export(OPTIONS.preview)
