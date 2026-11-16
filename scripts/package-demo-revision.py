"""Package the completed editorial revision and its editable inputs."""
from pathlib import Path
import argparse,html,json,re,zipfile,math
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--project',default='demo-film-v2')
OUT=(ROOT/'output'/parser.parse_args().project).resolve()
assert OUT.is_relative_to((ROOT/'output').resolve())
film=json.loads((OUT/'timeline.json').read_text(encoding='utf-8'))
live_clips=[ROOT/s['liveClip'] for s in film['scenes'] if s.get('liveClip')]
chapters=''.join(f'<button data-time="{s["start"]:.3f}"><span>{i+1:02d}</span>{html.escape(s["title"])}</button>' for i,s in enumerate(film['scenes']))
transcript=''.join(f'<section><h3>{html.escape(s["title"])}</h3><p>{html.escape(s["narration"])}</p></section>' for s in film['scenes'])
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Handsay — revised demo</title>
<style>body{margin:0;background:#f8fafd;color:#172331;font:16px/1.65 "Segoe UI",Arial,sans-serif}main{max-width:1240px;margin:auto;padding:30px 24px 60px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dbe1e8;margin-bottom:24px}h1{font-size:32px;letter-spacing:-.7px}header p{color:#5f6874}video{display:block;width:100%;background:#101b2b;border-radius:14px}a{color:#0b57d0}.downloads{display:flex;gap:24px;margin:20px 0}nav{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}button{padding:16px;border:1px solid #dbe1e8;border-radius:10px;background:white;color:#172331;font:inherit;text-align:left;cursor:pointer}button:hover{border-color:#0b57d0;background:#edf3fe}button span{color:#0b57d0;font-size:13px;margin-right:12px}.note{color:#5f6874;border-left:3px solid #0b57d0;padding-left:18px}details{margin-top:28px}summary{cursor:pointer;font-weight:600}section{border-bottom:1px solid #dbe1e8;padding:16px 0}footer{font-size:14px;color:#5f6874;margin-top:32px}@media(max-width:750px){header{display:block}nav{grid-template-columns:1fr}.downloads{flex-wrap:wrap;gap:12px}}</style>
<main><header><h1>Handsay</h1><p>A clearer conversation · revised demo · 1:43</p></header>
<video id="film" controls preload="metadata" poster="poster.jpg"><source src="Handsay-demo-revised.mp4" type="video/mp4"></video>
<div class="downloads"><a href="Handsay-demo-revised.mp4" download>Download MP4</a><a href="Handsay-demo.srt" download>Download subtitles</a><a href="narration.txt">Read narration</a><a href="storyboard.json">Editable storyboard</a></div>
<nav aria-label="Video chapters">CHAPTERS</nav>
<p class="note">The video combines actual Handsay screens, typed example answers and an edited recorded-landmark model replay. Sources are labelled on screen. It is not an uninterrupted screen recording or a test of live human signing accuracy. Narration is Microsoft Ava, a synthetic neural voice. No physical camera or microphone was opened. This project is a prototype and is not medical advice.</p>
<details><summary>Full voiceover transcript</summary>TRANSCRIPT</details>
<footer>Model: <a href="https://github.com/shashank11yadav/GestureSign">GestureSign · Shashank Yadav (MIT)</a>. Motion: <a href="https://www.kaggle.com/competitions/asl-signs">Google / PopSign ASL Signs (CC BY 4.0)</a>. Tracking / inference: MediaPipe / ONNX Runtime. Substantial AI implementation assistance: OpenAI Codex. Narration: Microsoft Edge speech service through <a href="https://github.com/rany2/edge-tts">edge-tts</a>, using only the public script with the user's explicit approval. No upload or hackathon submission has been made.</footer></main>
<script>const film=document.getElementById('film');document.querySelectorAll('[data-time]').forEach(button=>button.addEventListener('click',()=>{film.currentTime=Number(button.dataset.time);film.play().catch(()=>{});}));</script></html>'''
page=page.replace('CHAPTERS',chapters).replace('TRANSCRIPT',transcript)
duration=math.ceil(film['duration']);time_label=f'{duration//60}:{duration%60:02d}'
page=page.replace('1:43',time_label).replace('Narration is Microsoft Ava, a synthetic neural voice.',f'Narration: {html.escape(film.get("voiceCredit","Microsoft Ava · synthetic neural voice"))}.')
if film.get('status'):
    page=page.replace('<nav aria-label="Video chapters">',f'<p class="note">{html.escape(film["status"])}</p><nav aria-label="Video chapters">')
if film.get('liveClip'):
    page=page.replace('an edited recorded-landmark model replay','a cropped, face-blurred owner-recorded personal shortcut').replace('recorded replay','personal shortcut')
if live_clips:
    page=re.sub(r'<p class="note">The video combines.*?</p>','<p class="note">'+html.escape(film['scope'])+' Male narration is synthetic. This project is a prototype and is not medical advice.</p>',page)
(OUT/'index.html').write_text(page,encoding='utf-8')
for ref in re.findall(r'(?:src|poster|href)="([^"]+)"',page):
    if not ref.startswith('https:'):assert (OUT/ref).is_file(),ref
sheet=Image.new('RGB',(1920,((len(film['scenes'])+2)//3)*360))
for i in range(len(film['scenes'])):sheet.paste(Image.open(OUT/'frames'/f'{i+1:02d}.jpg').resize((640,360)),((i%3)*640,(i//3)*360))
sheet.save(OUT/'contact-sheet.jpg',quality=94)
(OUT/'README.txt').write_text('''HANDSay — REVISED DEMO

Watch Handsay-demo-revised.mp4 (approximately 1 minute 43 seconds).
Open index.html for the chapter player and transcript. Handsay-demo.srt provides
captions in addition to the burned-in captions.

The revision uses a conversational Microsoft Ava neural voice, a rewritten script,
1080p / 30fps export, full-frame app close-ups, subtle pans and dissolves, and
captions aligned to speech word timings. Narration remains explicitly synthetic.

The film uses real captured application screens and an edited recorded-landmark
replay, not live camera accuracy footage. Typed examples are labelled. No webcam
or microphone was opened. Review the final video before sharing it. No upload
or submission has been made.

storyboard.json is the editable script. Rebuild instructions are in
docs/DEMO_FILM_REVISION.md in the extracted kit. Re-synthesizing narration sends
the script to Microsoft; rendering uses the resulting audio locally.
'''.replace('approximately 1 minute 43 seconds',f'approximately {duration//60} minute {duration%60} seconds').replace('Microsoft Ava',film.get('voiceCredit','Microsoft Ava')).replace('burned-in captions.','burned-in captions.\n\n'+film.get('status','')),encoding='utf-8')
paths=[p for p in OUT.rglob('*') if p.is_file() and 'segments' not in p.parts]
paths += list((ROOT/'output/demo-film/assets').glob('*.jpg'))
paths += [ROOT/'scripts/narrate-demo-neural.py',ROOT/'scripts/make-demo-film-v2.py',ROOT/'scripts/package-demo-revision.py',ROOT/'docs/DEMO_FILM_REVISION.md',ROOT/'THIRD_PARTY_NOTICES.md']
if any(s['kind']=='replay' for s in film['scenes']):paths.append(ROOT/'output/video/Handsay-avatar-demo.mp4')
film_doc=ROOT/'docs/LIVE_RECORDING_SHOT_LIST.md'
if film_doc.is_file():paths.append(film_doc)
if film.get('liveClip'):
    paths += [ROOT/film['liveClip'],ROOT/'output/live-review/edited/highlight.json',ROOT/'scripts/edit-live-highlight.py',ROOT/'docs/LIVE_RECORDING_REVIEW.md']
kit=ROOT/'output'/('Handsay-live-demo-kit.zip' if film.get('liveClip') else 'Handsay-demo-revised-kit.zip' if OUT.name=='demo-film-v2' else 'Handsay-demo-male-caption-kit.zip')
if live_clips:
    kit=ROOT/'output/Handsay-final-demo-kit.zip'
    paths += [ROOT/'scripts/edit-final-footage.py',ROOT/'docs/FINAL_VIDEO.md']
    if OUT.name=='demo-film-v6':paths += [ROOT/'scripts/edit-walkthrough-footage.py',ROOT/'docs/FINAL_WALKTHROUGH_VIDEO.md',ROOT/'docs/screenshots/handsay-submission-dark.jpg']
    (OUT/'README.txt').write_text(f'''Handsay — final demo ({time_label})

Open Handsay-demo-revised.mp4, or index.html for chapter navigation.
App captions remain inside the original app footage. Bold white/yellow
voiceover subtitles appear in a separate band below the footage.
Male synthetic voice: Microsoft Guy. Source credits: description.txt.

{film['scope']}

Light face blur is not anonymization. Hand movement is not speeded up.
The final frame of a short excerpt is held briefly after the continuous clip.
Original audio is removed. No owner images or gesture data were sent for speech.
No upload or hackathon submission has been performed.
''',encoding='utf-8')
with zipfile.ZipFile(kit,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as archive:
    for path in sorted(set(paths)):archive.write(path,Path('Handsay-demo-revised-kit')/path.relative_to(ROOT))
print(f'Revised demo kit: {kit.stat().st_size:,} bytes, {len(set(paths))} files')
