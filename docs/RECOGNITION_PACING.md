# Recognition pacing and vocabulary — 15 November 2026

Historical first pacing fix. [TRACKING_CONTINUITY.md](TRACKING_CONTINUITY.md)
supersedes its pause defaults, brief-loss behavior, treatment of completed
results arriving during the next sign, and clearing of accepted single words.

The user reported that ASL “good morning” mostly produced “Reading sign…” or a
word that disappeared too quickly. Two separate problems were found: the base
model has the isolated word **morning**, but no **good** or **good morning** label;
and live capture ended after only 300 ms of stillness, with an 850 ms preview.
Changing display timing cannot add a missing language class.

## Current behavior

- Live capture waits for a 1.2 s final pose, with 0.8 s and 1.8 s settings. A
  progress bar and camera status distinguish movement, holding and checking.
  “Finish sign” explicitly checks the open capture sooner. Short pauses inside
  a sign can resume movement without submitting the incomplete sign.
- Hands leaving the frame have a separate 500 ms gap. Switching from a still
  pose to absent hands starts a fresh gap, without inserting absent frames as
  final pose context. Maximum live capture is 10 s instead of 4 s.
- The model receives up to 250 ms of final held-pose context, rather than the
  full waiting period. This preprocessing choice can change predictions.
- Rolling words require at least two matching predictions spanning 250 ms;
  a different word needs the same agreement. Display thresholds remain 0.55
  score / 0.15 margin. Weak windows reset the candidate without replacing a
  readable word with “Reading sign”. Status text is separate from caption words.
- A rolling word stays readable for up to 3.5 s without a stable update,
  including brief tracking gaps and final inference. Confirmed single words
  stay on video for 6 s. Final held-back candidates with score >= 0.35 and
  margin >= 0.08 can appear as **Possible word**, with a question mark, for 10 s.
  These review thresholds are display heuristics, not correctness estimates.
  Suggestions remain available below until the next sign.
- A new sign, reset, source change or manual correction clears the old preview.
  A late final result cannot overwrite a newer sign. Single automatic drafts
  expire after 15 s of inactivity; typed drafts do not use this expiry.
- The stricter two-pass automatic-add filter is unchanged. Provisional/review
  words are never automatically spoken or added to the message. Call output
  sends only sent messages by default; the existing explicit live-output option
  can include provisional words, labelled as unconfirmed.

For this greeting, **Teach “Good morning” as my phrase** opens My gestures with
the phrase filled in. Start the camera, create the phrase, record the same full
motion at least three times, and choose **Settings → Recognize → My gestures**.
These recordings are personal shortcuts, not newly trained universal ASL classes.
No recordings were created on the user's behalf.

## Verification and limits

- `npm run test:ml`: 137 passing tests, including internal pauses, held-pose
  context, still-to-absent gaps, slow signs, progress and stale final answers.
- `npm test`: 38 passing tests, including stable previews, longer review expiry,
  clearing on new movement, and room/voice/camera transport regressions.
- `npm run audit:replay`: two passing real-ONNX checks. Original selected clips
  still match 5/6 raw labels. The new live segmentation check extends each
  selected clip's final pose synthetically: all six complete, four exact labels
  match. Quiet still predicts shh; smile predicts napkin at score 0.26, below
  both the preview/review display thresholds and automatic-add threshold.
  See [the timing audit](evaluation/live-timing-audit.json).
- Production build passed. Background browser checks observed the 1.8 s selector,
  the greeting shortcut with no saved takes, and a real-model read-only blue
  demo. No captured console warnings/errors. [Training flow](screenshots/handsay-good-morning-shortcut.jpg).

The six selected clips are not independent live signers. There is no bundled
good-morning clip, no new human-camera test, and no measured reduction in semantic
errors. The model remains limited to 250 isolated ASL signs. Full conversational
ASL and unrestricted phrase translation remain unsupported.
