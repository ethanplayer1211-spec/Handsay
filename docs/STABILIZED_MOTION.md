# Motion stabilization — 16 November 2026

The user reported that stationary hands still counted as moving, prediction seemed
to start after stopping, and palm turns caused unstable tracking behavior.

## What changed

Live activity detection no longer uses only adjacent-frame average landmark speed.
It now measures palm translation, finger configuration and estimated 3D palm
orientation over a roughly 200 ms window, normalized by shoulder width. A small
three-frame median removes isolated coordinate spikes at normal camera rates.
Starting requires sustained intent; settling requires the whole observation window
to fit inside the stillness tolerance, rather than just matching its endpoints.
This prevents a returning wrist or turning palm from looking stationary midway.
Degenerate palm geometry cannot contribute an orientation estimate.

Observed stillness is backdated to the beginning of the stable window. Filtering
therefore does not add another complete 700 ms pause after the hand settles. The
existing Natural pause setting remains 0.7 s, with slower choices unchanged.

A bounded 500 ms raw lead-in survives short losses before movement is confirmed.
Leading empty frames are removed. This prevents stabilization from cutting off
the beginning of a short sign. The rolling preview is seeded from those observed
frames without classifying an outdated prefix; inference starts with the current
frame included, instead of waiting for eight additional observations.

These associated/filtered coordinates are used **only for activity detection**.
The sign model and personal-gesture embeddings still receive original tracked
coordinates. The base model, score thresholds and two-pass filter are unchanged.

If a hand appears to switch anatomical tracker slots at the same spatial location,
the activity detector follows its spatial continuity without interpreting it as a
large physical jump. The capture is marked for review. Its word is not
automatically added or spoken, and that personal-training take is not saved.
This is distinct from a normal palm rotation, which stays inside the capture.
The camera status now explicitly says **Hand settled** during the pause.

## Verification

- `npm run test:ml`: 173 tests pass. Added controlled stationary jitter and
  post-motion settling at 15/30/60 fps, independent joint/depth noise, an isolated
  spike, fixed-wrist 3D turns, returning turns, finger articulation, tracker-side
  reassignment, raw-input preservation, early losses and lead-in preview seeding.
  The controlled post-motion cases settle within 300 ms; this is a synthetic
  regression result, not a measured webcam latency guarantee.
- `npm test`: 42 tests pass; hand-identity ambiguity also rejects an otherwise
  high-score automatic caption.
- Production build passes. The scripted interview check passes.
- Three real-model replay checks pass. The selected three-sign sequence still
  returns hello, police and giraffe in order, with and without synthetic losses.
  Scores and held-back words remain in
  [avatar-continuity.json](evaluation/avatar-continuity.json). The separately
  segmented six-clip check matches 4/6 exact labels: quiet produces shh and smile
  produces napkin. This is selected demonstration data, not unseen-signer or
  human-camera accuracy. The original full-clip raw audit remains 5/6.

Restart Handsay to load the change. Check signs from Supported signs, stillness,
turning and resuming on the real webcam. Back/front palm motion is now part of the
activity detector; this does not add new vocabulary or guarantee correct semantic
classification at every hand angle. No physical webcam was captured by the
assistant during this pass.
