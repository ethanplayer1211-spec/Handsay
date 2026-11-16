# Rolling camera captions — 15 November 2026

Historical first implementation. The current timing and review behavior is in
[RECOGNITION_PACING.md](RECOGNITION_PACING.md); the original observations below
do not describe the latest word lifetimes or clearing behavior.

Previously, the model ran only after the end-of-sign pause. A completed recorded
Hello example could also leave Hello visible while the camera was off.

The webcam pipeline now runs a separate rolling provisional prediction while a
sign is in motion. It needs at least eight tracked frames with hands and both
shoulders in view. It requests a fresh prediction at most every 180 ms and keeps
at most 1.6 seconds / 64 frames. One preview inference can be pending; slow devices
skip intermediate windows instead of accumulating outdated captions. Webcam
preview and final inference use a serialized model queue.

Provisional text appears over the camera in the selected font and design, and in
the Signing now line. It can change as the motion develops. Weak or close model
scores display Reading sign instead of inventing a word. Provisional words use a
0.55 model-score / 0.15 margin display filter, which is a UI heuristic, not a
validated accuracy measure. These words are not spoken or shared. After the
sign ends, the existing stricter two-pass agreement gate decides whether to add
the word to the editable sentence and live voice. Held-back words remain in the
suggestion list for manual selection.

Predictions clear on lost framing, absent hands, segment end, source/mode change,
reset or an inference error. In-flight answers from an old window cannot restore
a stale caption. Optional head controls and introduction continue to pause the
camera recognizer. A source notice and Start live camera button distinguish the
real webcam from recorded landmarks; completed samples explicitly say CAMERA OFF.

## Verification

- `npm run test:ml`: 125 passing tests, including five rolling-window tests and
  an integration test verifying previews arrive during motion before any final
  result. Tests cover changing words, resets, lost tracking, single-signer/full
  framing requirements, slow inference and error recovery.
- `npm test`: 22 passing application, backend, voice and head-control tests.
- Production build and JavaScript syntax check passed.
- In the browser, the real ONNX model displayed **blue …** at recorded frame
  **28 of 39**, before playback finished. Screenshot:
  [rolling prediction](screenshots/handsay-rolling-prediction.jpg).
- A separate recorded police clip produced a 92% model-score top suggestion and
  was accepted into the caption. Its short playback did not yield an observed
  provisional police word before completion; immediate recognition of every sign
  is not established.
- No captured browser warnings or errors during these checks. No human webcam
  signing or end-to-end live-signer latency/accuracy study was performed.

This improves when predictions are displayed, not the base model's vocabulary or
accuracy. The model recognizes 250 isolated ASL signs; continuous conversational
translation, arbitrary gestures and fingerspelling remain unsupported.
