"""Prepare local, reviewed submission materials. Never publish or submit."""
from pathlib import Path
import hashlib,json,shutil,zipfile,math
ROOT=Path(__file__).resolve().parent.parent
code_url='https://github.com/ethanplayer1211-spec/Handsay'
out=ROOT/'release/Handsay-Veritas';out.mkdir(parents=True,exist_ok=True)
film=ROOT/'output/demo-film-v6'
duration=math.ceil(float(json.loads((film/'verification.json').read_text())['format']['duration']))
time_label=f'{duration//60}:{duration%60:02d}'
files={
 'Handsay-demo.mp4':'output/demo-film-v6/Handsay-demo-revised.mp4',
 'Handsay-demo.srt':'output/demo-film-v6/Handsay-demo.srt',
 'Handsay-writeup.pdf':'output/pdf/Handsay-Veritas-writeup.pdf',
 'Handsay-writeup.md':'docs/VERITAS_WRITEUP.md',
 'VIDEO_DESCRIPTION.txt':'output/demo-film-v6/description.txt',
 'FORM_ANSWERS.txt':'docs/FORM_ANSWERS.txt',
 'REVIEW_CHECKLIST.txt':'docs/REVIEW_CHECKLIST.txt',
 'handsay-source-v0.1.zip':'release/handsay-source-v0.1.zip',
}
for name,source in files.items():shutil.copy2(ROOT/source,out/name)
(out/'START_HERE.txt').write_text('''HANDSay - VERITAS SUBMISSION MATERIALS

Prepared for review. Source code is public; video hosting and form submission
remain for the owner. Code Link: CODE_URL

1. Watch Handsay-demo.mp4 (VIDEO_DURATION). Original app captions are inside the footage;
   male narration subtitles are below it. The face blur is light, not anonymization.
2. Use Handsay-writeup.pdf as the one-page write-up. Its editable source is the
   Markdown file. SeHyun Lee is listed as the contributing student. Enter your
   email and school in the form; those details have not been invented.
3. Paste CODE_URL into the Code Link field. The reviewed source ZIP is also
   included for your records. Source/data licences and AI assistance disclosure
   are included. Original recordings, saved gestures and credentials are excluded.
4. Supply the code link and write-up in the official submission form. Optional
   video credits and the honest editing/accuracy description are in
   VIDEO_DESCRIPTION.txt. Use AI + Health / own idea; enter one track.
5. Check every submitted link without signing in and submit before the event
   deadline. The assistant has not performed this external submission.

Scope: webcam vocabulary is 250 isolated ASL words, not continuous translation.
The video shows selected owner demonstrations, with failures elsewhere omitted.
Pinned upstream test-signer provenance for the six replay clips is verified.
The examples were used during app development. Independent fluent-signer and
non-sign false-alarm testing remains unverified.
No interpretation guarantee or clinical-use claim is made.

Local app: close old Handsay windows, reopen Start-Handsay.cmd in the project,
choose ASL + My gestures / shortcuts first, and verify your saved phrases.
Voice into a third-party call needs separate audio routing; universal client
compatibility is not established. The public caption room needs secure hosting.
'''.replace('VIDEO_DURATION',time_label).replace('CODE_URL',code_url),encoding='utf-8')
manifest={name:{'bytes':(out/name).stat().st_size,'sha256':hashlib.sha256((out/name).read_bytes()).hexdigest()} for name in [*files,'START_HERE.txt']}
(out/'manifest.json').write_text(json.dumps({'codePublished':True,'codeLink':code_url,'videoUploaded':False,'submitted':False,'independentLiveAccuracy':'unverified','files':manifest},indent=2)+'\n',encoding='utf-8')
archive=ROOT/'release/Handsay-Veritas-submission.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
 for p in sorted(out.iterdir()):
  if p.is_file():z.write(p,Path('Handsay-Veritas')/p.name)
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
shutil.copy2(archive,ROOT/'release/Handsay-Veritas-walkthrough-submission.zip')
shutil.copy2(archive,ROOT/'release/Handsay-SeHyun-Lee-review.zip')
print(f'{archive}: {archive.stat().st_size:,} bytes; {len(manifest)} reviewed files plus manifest')
