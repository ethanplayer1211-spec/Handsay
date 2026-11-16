# Tracking continuity and silhouette diagnostic — 15 November 2026

The user reported repeated hand lost/found interruptions and difficulty continuing
into the next sign. Inspection found three concrete causes beyond pose-wait time:

1. Any single unframed or hand-missing frame reset the rolling preview history.
2. Starting a new sign advanced the same generation counter used for source
   cancellation, discarding a valid completed result still being computed.
3. Starting a new sign removed an accepted single word from the camera message,
   even though it remained in the editable draft.

## Changes

- Preview history survives losses shorter than 600 ms; inference uses observed
  frames, never fabricated hands. Crowded frames immediately cancel the capture.
- Live capture bridges hand losses for up to 650 ms. Recovery requires 100 ms of
  sustained observation, so an isolated found frame cannot restart the loss timer
  indefinitely. Loss time does not count toward a completed final pose. Real NaN
  coordinates remain in the segment; captures with less than 60% usable framing
  are held back as partial. The model acceptance thresholds were not lowered.
- UI loss statuses wait 350 ms, recovery waits 100 ms. Alternating kinds of loss
  count as one interruption. The overlay can hold the last observed hand for only
  180 ms, dashed amber; this is display-only and never fed into the model.
- The default natural pause is 700 ms; slower 1.2 s and 1.8 s choices remain.
  Finish sign still manually closes a capture. Maximum capture stays 10 s.
- Capture IDs are separate from source generations. Completed signs classify in
  order while later signs proceed. An earlier result can append its word and show
  suggestions without clearing the newer preview or ending its capture. Explicit
  resets, mode/source changes and introduction still invalidate pending results.
- Accepted message text stays visible during the next sign for its remaining
  lifetime (6 s for one word, 15 s for a multiword draft). New motion clears only
  the prior prediction. Uncertainty never inserts reading-status text as a word.

## Silhouette demo

The new button below the camera opens a private diagnostic with a dark,
code-generated head, torso, arms, palms and fingers driven by recorded landmarks.
It plays hello, police and giraffe, with optional 100 ms synthetic hand losses
and short word-boundary pauses. Actual ONNX results appear in order; question
marks explicitly identify words the production filter holds for review. Reference
labels are shown for comparison and never supply the classifier's answer.

Playback supplies recorded landmarks directly, bypassing image detection. A
separate **Check silhouette pixels** diagnostic passes 12 rendered frames through
the actual MediaPipe image tracker without requesting a camera. A flat silhouette
can lack the hand/face detail that the tracker needs; its outcome is reported as
hands/body frames, not as human signing accuracy. The demo never modifies the
interview draft, speech, interviewer room or virtual-camera captions. Opening it
pauses live recognition; closing it resumes normal operation.

## Evidence

- `npm run test:ml`: 143 tests, including repeated gaps, transient reacquisition,
  UI status debounce, raw-data preservation, ordered late results and source reset.
- `npm test`: 38 tests, including accepted-word continuity and bounded expiry.
- `npm run audit:replay`: three real-model checks. In the three-word stream,
  all three captures completed and predictions were hello, police, giraffe both
  with and without synthetic losses. The test deliberately resolves earlier
  results after later captures start. This is selected recorded data, not new
  human-camera or continuous-language validation. See
  [avatar-continuity.json](evaluation/avatar-continuity.json).
- Production build succeeds. Browser playback with losses showed
  **hello ? police ? giraffe**. The hello and police results were held for review;
  giraffe passed the acceptance filter. A typed test draft remained unchanged
  after opening, playing and closing the demo. No physical webcam was opened.
- The final rendered-pixel diagnostic detected hands on **0/12** frames and body
  on **0/12** frames. It correctly declined to report a word-recognition test.
  No captured browser warning/error logs were present.
- [Observed silhouette and captions](screenshots/handsay-silhouette-continuity.jpg).

The isolated 250-sign model still cannot translate unrestricted continuous ASL,
and “good morning” still requires a personal shortcut or typed text. Tracking
continuity fixes do not add language classes or prove improved semantic accuracy.
