# Superseded by the chronological walkthrough

The latest film is `output/demo-film-v6/Handsay-demo-revised.mp4`. See [FINAL_WALKTHROUGH_VIDEO.md](FINAL_WALKTHROUGH_VIDEO.md). The v5 details below are retained for history.

# Final Handsay demo — 16 November 2026

The final film is `output/demo-film-v5/Handsay-demo-revised.mp4`: 77.22 seconds,
1920×1080 at 30fps, H.264/AAC. It uses a male Microsoft Guy narration, speech-timed
bold white/yellow subtitles, actual application screenshots and the second owner
recording. Credits are in the player description and description.txt, not a
production-note footer. The app’s caption and voiceover subtitles occupy distinct
areas. No recognized wording was substituted, restyled or generated in the footage.

The live scenes are continuous source excerpts 32.8–39.2 seconds (ASL Hello) and
117.4–123.6 seconds (personal shortcut: “Could you repeat that question?”).
There are cuts between scenes; repeated/unsuccessful attempts elsewhere are omitted.
Motion within each excerpt is at original speed. A short end-frame hold extends
the image behind the narration without shortening recognition latency. Original
recording audio is removed. The face uses light feathered Gaussian blur; the Hello
hand region is explicitly protected. This is not anonymization. Original recording
is unchanged; raw review frames are excluded from packaging.

These are selected demonstrations, not an accuracy measurement. The owner said no
fluent independent signer is available, so live accuracy remains unverified.
Selected bundled clips, boundary checks and software tests are reported separately
in VERITAS_WRITEUP.md and evaluation/replay-audit.json.

Rebuild with the existing .runtime/camera Python environment:

1. scripts/edit-final-footage.py --source <owner-supplied second MP4>
2. scripts/narrate-demo-neural.py --project demo-film-v5 (network: generic script only)
3. scripts/make-demo-film-v2.py --project demo-film-v5
4. scripts/package-demo-revision.py --project demo-film-v5

Only narration text uses the approved Microsoft speech service. Images, recording,
names and gesture vectors stay local. No publication or submission was performed.
