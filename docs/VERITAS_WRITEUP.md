# Handsay: captions and speech for conversations

**Track:** AI + Health (Own idea) · **Team:** SeHyun Lee

**This project is a prototype and is not medical advice.**

## The problem

Speaking is often treated as the default in a call or interview. A person with
speech difficulties can struggle to join jokes, answer questions, or show their
abilities at their own pace. Handsay aims to give them another way to take part,
without requiring everyone else in the conversation to know sign language.

## What we built

Our own idea is a webcam caption workspace for calls, interviews and everyday
conversations. Supported ASL words become editable captions. A personal gesture
can trigger a whole sentence chosen by the user, and voice mode can read the
wording aloud on the device. Typing and quick messages provide a fallback.
The contribution is the review/edit/share workflow, captions on camera, personal
phrase controls, optional speech, privacy rendering and two-way caption rooms.

## How it works

There are no wearable hand sensors. MediaPipe estimates face, body and hand
landmarks from the webcam. Motion detection groups frames into a sign; jitter
handling and brief-gap recovery help stabilize capture. GestureSign's reused
pretrained ONNX model, trained upstream on 70,272 clips, classifies 250 isolated
ASL signs. We did not train it. Landmark sequences are normalized and resampled.
A second check trims the motion boundaries and checks agreement. Personal
shortcuts match against 3-5 saved examples. Accepted or chosen text becomes a
caption; browser speech provides text-to-speech. Video inference stays local.

## Results and failures

The owner recording shows Hello and a trained gesture producing their captions.
Speech is available for chosen wording. On six author-selected clips from the
upstream held-out signer split, a constant-Hello baseline matched 1/6 labels;
the raw model matched 5/6. The Careful filter accepted 3 correct captions and
1 wrong caption, and held back 2 correct predictions. The model, clips and split
provenance were checked against the pinned upstream files and exporter code.

These six clips were also used during development; they are regression examples,
not a representative test of our filters. Tracking can be too sensitive or miss
motion, and a custom gesture can conflict with an ASL prediction. “Quiet” was
confused with “shh.” Separately, 254 software tests pass. **Live signing accuracy
remains unverified**, with no fluent-signer, general false-alarm or demographic
study. This does not translate continuous ASL or guarantee correct meaning.

## Next steps

Stabilize motion boundaries, reduce shortcut/ASL conflicts, and evaluate with fluent
signers and non-sign movements. Improve and test camera/audio routing in Zoom,
Google Meet and Teams so captions and a selected voice reach call participants.

## Sources and assistance

[GestureSign / Shashank Yadav](https://github.com/shashank11yadav/GestureSign) (MIT):
model, preprocessing and reused code/tests.
[Google / PopSign ASL Signs](https://www.kaggle.com/competitions/asl-signs): model data
and bundled landmarks (CC BY 4.0 upstream).
[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/holistic_landmarker)
and [ONNX Runtime](https://onnxruntime.ai/) provide tracking/inference.
[OpenAI Codex](https://openai.com/codex/) provided substantial implementation,
debugging, tests and drafting under my feature direction.
[Google Meet](https://workspace.google.com/products/meet/) was an interface reference.
[edge-tts](https://github.com/rany2/edge-tts) / Microsoft Guy provided the stock
synthetic male video narration, not a cloned voice. Full licences are included.
