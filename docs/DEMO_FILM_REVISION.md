# Latest owner-led walkthrough

Use `output/demo-film-v6/Handsay-demo-revised.mp4`, with the complete Hello and personal-gesture setup/test sequence before extra features. Dark theme throughout. See [FINAL_WALKTHROUGH_VIDEO.md](FINAL_WALKTHROUGH_VIDEO.md).

# Latest final cut

Use `output/demo-film-v5/Handsay-demo-revised.mp4` (1:17), with real owner-recorded Hello and personal shortcut, light face blur, male narration and distinct app/voiceover caption areas. See [FINAL_VIDEO.md](FINAL_VIDEO.md). Earlier revisions below are retained for history.

# Revised narrated demo

**Male narrator and two-colour subtitle draft:** `output/demo-film-v3/Handsay-demo-revised.mp4`
uses Microsoft Guy and bold white/yellow video captions. It retains the labelled
avatar replay pending the user's live footage. See the
[live recording shot list](LIVE_RECORDING_SHOT_LIST.md). These subtitle changes
do not alter the captured application's own caption pixels.

The latest demo is `output/demo-film-v2/Handsay-demo-revised.mp4`.
It replaces the first version's flat desktop narration and repeated slide layout.
The original video remains available in `output/demo-film/`.

The revised film is approximately 1 minute 43 seconds, 1920 × 1080 at 30 fps,
H.264 with AAC narration. The voice is **Microsoft Ava Multilingual Neural**,
selected for a warm conversational delivery. The script was rewritten for spoken
delivery, with sentence pauses and a slightly slower pace for results and closing.
It is a stock synthetic narrator, not the student's voice or a cloned person.

The user explicitly approved sending the narration text to Microsoft's Edge speech
service after automatic review requested destination-specific approval. Only the
demo script was sent. No screenshot, face, webcam, microphone, room credentials or
personal introduction was transmitted. Generated speech, word timings and WAVs
are saved in `output/demo-film-v2/audio/`. This service is an editing tool and is
not integrated into the Handsay application.

The visual revision uses larger actual application screens, gentle 30fps reframing,
short dissolves, a closer view of the replay, and fewer decorative template elements.
The replay excerpt preserves the actual model captions, including hello held for
review. The original 20fps replay is frame-rate converted without optical-flow
invention of hand movements. Typed answers and recorded replay remain labelled.
Speech-derived word timing groups subtitles into readable phrases; there is no
word-by-word flashing. Voice loudness is normalized to target -16 LUFS / -1.5 dBTP.

The results graphic shows six selected upstream clips, the always-hello baseline,
raw label matches and careful-filter outcomes. It does not claim a held-out or
live signing accuracy result. The film retains attribution and the prototype /
not-medical-advice disclaimer. No physical camera or microphone was opened.

## Editable assets and rebuild

- `output/demo-film-v2/index.html`: player, chapter navigation and transcript.
- `output/demo-film-v2/storyboard.json`: script, voice and chapter-specific pacing.
- `output/demo-film-v2/Handsay-demo.srt`: speech-timed captions.
- `output/demo-film-v2/verification.json`: final stream metadata and file hash.
- `scripts/narrate-demo-neural.py`: explicit network synthesis step.
- `scripts/make-demo-film-v2.py`: local Pillow/FFmpeg rendering.
- `scripts/package-demo-revision.py`: HTML player and editable kit packaging.

From the project root, using the existing Pillow/edge-tts environment and installed
FFmpeg path recorded in the scripts:

```powershell
# Network step: sends the storyboard narration to Microsoft.
& .runtime/camera/Scripts/python.exe scripts/narrate-demo-neural.py
# Local render and package:
& .runtime/camera/Scripts/python.exe scripts/make-demo-film-v2.py
& .runtime/camera/Scripts/python.exe scripts/package-demo-revision.py
```

Narration generation reuses existing audio files. To regenerate a changed scene,
retain a backup and remove only that scene's generated MP3 and word-timing JSON
before running synthesis again. The source kit contains original screenshots,
replay, generated narration and renderer inputs, excluding installed runtimes.
On another computer, install Pillow and edge-tts, provide Windows Segoe fonts or
adapt the font path, and adjust the FFmpeg path.

Sources: [edge-tts](https://github.com/rany2/edge-tts) 7.3.1 (LGPLv3 client),
[Microsoft voice documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support),
and [project notices](../THIRD_PARTY_NOTICES.md). No stock music or externally
generated face footage is used. Review the video before publishing. No video
upload or hackathon submission has been made by the assistant.

Final checks: the 103.12-second MP4 decoded completely without errors; stream
inspection confirmed 1080p / 30fps H.264 and AAC audio. All nine chapter frames
were visually inspected. All narration WAVs contain audio, and caption timing
stays ordered within each chapter. Measured final audio is -16.31 LUFS integrated
and -1.79 dB true peak. Local HTML asset references were checked. The prior film
is preserved for comparison.
