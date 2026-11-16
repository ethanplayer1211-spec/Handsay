"""Crop an explicitly supplied private screen recording; blur face locally.
Only the selected, silent edited highlight is intended for the demo. Raw review
frames stay in the ignored output/live-review/raw directory.
"""
from pathlib import Path
import argparse,json,hashlib,subprocess
from PIL import Image,ImageDraw,ImageFont,ImageFilter
ROOT=Path(__file__).resolve().parent.parent
FF=Path(r'C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe')
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);args=parser.parse_args()
source=args.source.resolve();assert source.is_file()
out=ROOT/'output/live-review/edited';out.mkdir(parents=True,exist_ok=True)
label=Image.new('RGBA',(1280,42),(0,0,0,0));d=ImageDraw.Draw(label)
d.rounded_rectangle((12,7,584,38),radius=6,fill=(16,27,43,220))
d.text((22,9),'USER-RECORDED FOOTAGE · PERSONAL SHORTCUT',font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',19),fill='white')
label.save(out/'source-label.png')
mask=Image.new('L',(280,280),0);ImageDraw.Draw(mask).rounded_rectangle((5,5,275,275),radius=24,fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(7));mask.save(out/'face-mask.png')
caption=Image.new('RGBA',(1280,720),(0,0,0,0));cd=ImageDraw.Draw(caption);cf=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',45)
parts=[('Good morning','#ffd166'),(' I am Ethan.','#ffffff')];x=(1280-sum(cf.getlength(value) for value,_ in parts))/2
for value,color in parts:
    cd.text((x,652),value,font=cf,fill=color,stroke_width=2,stroke_fill='#101b2b');x+=cf.getlength(value)
caption.save(out/'accepted-caption.png')
movie=out/'Handsay-live-personal-shortcut.mp4'
# A continuous 12s excerpt. No reordering or shortening of the within-clip
# recognition wait. The existing accepted phrase remains exactly as recorded.
filters="[0:v]crop=704:340:448:260,split[base][face];[face]crop=280:280:232:55,scale=10:12:flags=area,scale=280:280:flags=neighbor,gblur=sigma=18[blur];[blur][2:v]alphamerge[masked];[base][masked]overlay=232:55,scale=1280:618,pad=1280:720:0:0:color=0x101b2b,fps=30[clean];[clean][1:v]overlay=0:0[labelled];[labelled][3:v]overlay=0:0:enable='gte(t,6.6)',format=yuv420p[v]"
subprocess.run([str(FF),'-v','error','-y','-ss','315','-t','12','-i',str(source),'-loop','1','-i',str(out/'source-label.png'),'-loop','1','-i',str(out/'face-mask.png'),'-loop','1','-i',str(out/'accepted-caption.png'),'-filter_complex',filters,'-map','[v]','-an','-t','12','-c:v','libx264','-preset','medium','-crf','19','-movflags','+faststart',str(movie)],check=True)
subprocess.run([str(FF),'-v','error','-i',str(movie),'-f','null','-'],check=True)
for second in [1,5,9]:
    subprocess.run([str(FF),'-v','error','-y','-ss',str(second),'-i',str(movie),'-frames:v','1','-update','1',str(out/f'check-{second}.jpg')],check=True)
info={'source':'Owner-supplied screen recording; original retained outside project','sourceStartSeconds':315,'sourceEndSeconds':327,'durationSeconds':12,'continuousExcerpt':True,'sourceCameraCrop':[448,260,704,340],'sourceFaceBlurRectangle':[680,315,280,280],'faceBlur':'Strong pixel reduction followed by feathered Gaussian blur; fixed region checked on selected frames','audioRemoved':True,'captionTextChanged':False,'captionAppearanceRestyled':True,'acceptedCaptionShownAfterSourceSecond':321.6,'unconfirmedPreviewRemoved':True,'removed':'Browser chrome, desktop/game footage, settings, unrelated waits, tracking hints and old caption layer including tentative preview','scope':'Original-build personal shortcut demonstration, not a test of the new recognition changes or unrestricted ASL','sha256':hashlib.sha256(movie.read_bytes()).hexdigest()}
(out/'highlight.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf8')
print(json.dumps(info,indent=2))
