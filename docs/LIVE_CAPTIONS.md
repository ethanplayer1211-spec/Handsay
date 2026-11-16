# Live captions — 15 November 2026

Live captions are enabled by default. Start the camera and sign one supported ASL word at a time, then pause. Accepted words appear automatically in the large caption and editable draft. No per-word click is required. The model remains an isolated-sign classifier, not a continuous sentence translator.

## Reducing accidental output

- Careful: minimum model score 0.80 and a 0.25 gap over the second suggestion. Balanced: 0.70 and 0.20.
- Two predictions must agree: one uses the full segmented motion; the other removes up to 10% from each boundary and recomputes features. Both must satisfy the selected score and margin. These predictions are correlated checks, not independent evidence of correctness.
- Partial framing, short motions (under 250 ms) and segments too short for a second view do not auto-append.
- Rapid repeated detections of the same word are suppressed for 1.8 seconds. Repeated words after that interval remain possible, as does the same word after an intervening word.
- Undo restores the caption before the last automatic addition and temporarily blocks that word from being re-added. Clear or changing mode/filter resets the gate. Manual editing and choosing suggestions remain available.
- Live recognition inference is serialized so results remain in capture order. Mode/source resets suppress stale pending results and errors.
- Personal gesture mode uses stricter embedding similarity and separation; those scores are not probabilities and no ASL motion agreement is claimed for personalized phrase mappings.

These are conservative, unvalidated acceptance heuristics. They can reject a correct sign, and confident systematic mistakes can still pass. No model retraining, new signing dataset, accuracy improvement percentage or zero-error claim is supported.

## Sharing and speech

Local live captions require no confirmation. To relay them to the interviewer, create a room and check **Share live text with my interviewer**. Live events are labeled unconfirmed and do not become confirmed transcript entries. Only the writer can send them. The signer can edit/undo/clear and send updates, or disconnect sharing. Recorded sample recognition is never automatically relayed.

**Confirm caption** saves a confirmed transcript entry and optionally speaks it using the existing checkbox. Speech is not automatically triggered for every recognized word. Captions do not fabricate grammar or fill in interview answers.

## Validation

- `npm run test:ml`: 119 tests passed, including two new motion-verification tests.
- `npm test`: 11 tests passed, including live filtering, duplicates, undo, writer-only live updates and clearing unconfirmed text.
- Production build passed.
- Browser: the real recorded **blue** sample remained a 75% top suggestion but was held back in Careful mode. The real recorded **hello** sample passed both checks and appended **Hello** automatically without clicking a suggestion or confirming.
- Browser: **Undo last word** removed that automatic word. An active room with sharing disabled received no draft. Enabling sharing and editing a synthetic draft exercised the live-update path separately from confirmation.

These are sample and software checks. They do not establish accuracy, usability, latency or error rates with live fluent signers. The user's observation that webcam recognition worked is encouraging but is not a controlled accuracy study.

Screenshot: [automatic caption from the recorded hello sample](screenshots/handsay-live-captions.jpg). The editable draft and live caption contain the word while the confirmed transcript is still empty.
