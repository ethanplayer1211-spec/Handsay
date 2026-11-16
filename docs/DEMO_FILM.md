# Narrated hackathon demo film

**Latest version:** the [editorial revision](DEMO_FILM_REVISION.md) uses a neural
voice, larger app footage and a 1080p / 30fps export. Its file is
`output/demo-film-v2/Handsay-demo-revised.mp4` (approximately 1:43).
The rest of this page records the original 1:55 version.

Created 16 November 2026. Final video: `output/demo-film/Handsay-hackathon-demo.mp4`.
Duration is approximately 1 minute 55 seconds, below the two-minute limit.
The film is 1280 × 720 at 20 fps, H.264 video with AAC English synthetic narration,
burned-in captions, and a separate SRT subtitle file.

The film uses the actual Handsay interface, captured through browser UI actions.
An interviewer question and typed answer were sent across two local browser tabs;
the room was ended afterwards. No external interviewer was contacted. Screenshots
are edited into a narrated presentation; this is not an uninterrupted screen recording.

The signing scene embeds the previously recorded avatar/model replay. It uses
recorded coordinates, not camera-tracked avatar pixels. Reference labels never
supply predictions. Hello was held for review; police and giraffe were added in
the demo. Full-sentence answers in the other scenes are explicitly labelled typed
examples. No physical camera or microphone was opened for production.

The nine chapters cover the problem, setup, replay, review/editing, interviewer
delivery, privacy settings, voice settings, measured results and limits/credits.
The film does not claim live signing accuracy, general ASL translation or automatic
audio routing into calls. Actual results and known failures appear in the film.

Assets and editable sources:

- `output/demo-film/index.html`: local HTML player with chapter jumps and transcript.
- `output/demo-film/storyboard.json`: editable headings, narration and scene notes.
- `output/demo-film/Handsay-demo.srt`: captions.
- `output/demo-film/narration.txt`: narration transcript.
- `scripts/narrate-demo-film.ps1`: local Microsoft Zira Desktop synthesis to WAV.
- `scripts/make-demo-film.py`: Pillow/FFmpeg rendering and HTML authoring.
- `output/demo-film/verification.json`: stream metadata and final video hash.

Rebuild from the project root with PowerShell:

```powershell
pwsh -NoProfile -File scripts/narrate-demo-film.ps1
& .runtime/camera/Scripts/python.exe scripts/make-demo-film.py
```

The renderer uses the existing project's Pillow environment, Windows Segoe fonts
and installed FFmpeg. Its FFmpeg path is recorded in the script; adapt it when
moving to another computer. Screenshots and the source replay are in the demo kit.

Narration is synthesized locally using Microsoft Zira Desktop. Avatar artwork and
presentation graphics are drawn in code. Model/preprocessing credits: GestureSign,
Shashank Yadav, MIT. Recorded motion: Google / PopSign ASL Signs, CC BY 4.0.
MediaPipe, ONNX Runtime and substantial OpenAI Codex assistance are credited.
See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for source links.

QA: all nine chapter frames were visually inspected; the full encoded video was
decoded with FFmpeg without errors. Stream inspection confirmed duration below
120 seconds, video and narration tracks, and 1280 × 720 / 20 fps. Narration is
loudness normalized. Captions are grouped by phrase and approximately timed to
each narration segment, not word-level forced alignment. No live signer evaluation
was performed. Review the final film before uploading; no upload or submission
has been made by the assistant.
