# Captions on the camera and optional head controls

The live caption is now placed directly over the webcam/recorded-landmark preview. It updates when a recognized sign is accepted, a word is undone, or text is edited. Video stays mirrored as a selfie preview; caption letters are rendered separately and stay readable. This is an overlay in this application's preview, not a virtual camera or a captioned video feed to Zoom/Meet. The interviewer room still receives text only.

## Appearance and editing

Open **Caption appearance & head controls** below the camera. Choose Sans serif, Serif or Monospace; size from 18–56 px; text colour; dark background, outline or plain design; top/middle/bottom placement; alignment; and bold. The style is stored in this browser. **Preview style** shows a labeled sample if there is no caption. **Expand camera** expands the camera with its caption overlay. It uses browser fullscreen when supported, with an in-page expanded view as a fallback; Escape or **Exit expanded view** exits.

Click the text on the camera to edit it directly, or use the existing text box. Both views and the live-caption panel stay synchronized. Automatic additions pause while either text editor has focus, so recognized words do not disrupt typing. A finished caption remains on the camera with a **FINISHED SENTENCE** label until a new draft starts or the caption is cleared.

## Head controls (experimental; off by default)

1. Start your webcam. These controls never execute on recorded samples.
2. Enable **Head controls**, then choose **Calibrate neutral head**. Face forward with a stable head for at least 1.2 seconds. Calibration is in memory only and resets when the camera stops.
3. Sign your words, then pause your hands. Controls require 800 ms without significant tracked hand motion and a neutral head before starting.
4. Nod down and return to neutral to finish the current sentence. A period is added if needed and room remains. This uses the same transcript/sharing and optional speech action as **Confirm caption**.
5. Shake left–right and return to neutral to use the selected shake action: **Undo last word** or **Clear current sentence**. A clear affects only the current draft; **Restore cleared sentence** recovers it if the draft is empty.

A neutral start, minimum motion duration, axis checks, a 2.2-second cooldown and a pause in recognition around control motions reduce accidental actions. Missing face landmarks, excessive roll, unstable calibration, mixed-axis motion and hand activity prevent controls from firing. A head action resets pending sign recognition so head movement does not immediately become another guessed word.

These motion thresholds are heuristics based on face landmarks, not a validated head-pose model. They may miss a gesture or trigger incorrectly. Head movement can also carry meaning in signing; leave controls off when they conflict with your signing or movement needs. The exact wording remains editable, and confirmed transcript entries are not removed by a shake.

## Validation scope

Unit tests cover deliberate nod and shake sequences, required return to neutral, cooldown, jitter, one-sided looking, diagonal motion, face loss, hand activity, stable calibration, geometric scale/translation normalization, style validation and text correction limits. They use controlled synthetic signals and do not establish reliability with actual people. Live head-control calibration and movement must be checked by the user on their own camera before relying on it.

The browser review checks the caption overlay using the real recorded ASL model sample, direct text edits, appearance controls, persistence and manual finish/undo/clear/restore. Recorded examples are labeled and are not evidence of a live webcam or physical head-control test.

## Observed final checks

- 119 ML tests and 16 application/backend/head-control tests passed (135 total). Production build passed.
- Real recorded **hello** inference appended **Hello** to both the live editor and camera overlay. The source remained labeled **RECORDED SAMPLE**.
- Serif font, 56 px size and outlined design were verified in computed styles; the caption's transform was `none`, so text was not mirrored. These appearance settings survived a page reload.
- Editing the camera caption to **Hello there** updated the other caption views. Undo removed **there**. Clear hid the overlay; Restore recovered it. Manual confirmation left the finished caption on camera and added the transcript entry.
- Head controls began off. Attempting calibration without a webcam produced the correct start-camera message. Both shake-action choices were available. No physical nod/shake test is claimed.
- Native fullscreen was unavailable in the in-app browser; the in-page expanded camera fallback worked, and Escape returned to the settings view. Final browser logs contained no captured warnings/errors.

Screenshots: [expanded camera overlay](screenshots/handsay-camera-overlay.jpg) and [appearance/head controls](screenshots/handsay-caption-controls.jpg). They show recorded landmarks, not a live human webcam.
