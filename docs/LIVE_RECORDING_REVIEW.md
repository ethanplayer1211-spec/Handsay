# Owner recording, clean captions and combined recognition

Updated 16 November 2026.

## Edited footage

The supplied 5:45 screen recording includes setup, unrelated desktop/game footage,
ASL attempts and personal-gesture training/recognition. A continuous excerpt from
**5:15 to 5:27** is saved as
`output/live-review/edited/Handsay-live-personal-shortcut.mp4`.

The edit crops to the camera, removes original audio, blurs the face
with a feathered strong pixel/Gaussian mask, and removes the old caption layer,
including a brief tentative “…” preview and the small edit label. Only the recorded
accepted greeting is restyled in bold white/yellow, starting at source second
321.6, after its confirmed appearance. The wording is unchanged; it is not
prefilled over the hand movement. There are no internal cuts or
speed changes in this 12-second highlight. Source review frames remain in the
ignored `output/live-review/raw/` directory and are excluded from source packaging.
The original recording is unchanged and remains outside this project.

The clip shows an earlier-build **personal shortcut**, not unrestricted ASL sentence
translation or post-fix live accuracy. The new narrated cut in `output/demo-film-v4/`
uses this face-blurred footage instead of the avatar replay, with a male narrator
and bold white/yellow video subtitles. No private images or names were sent for
speech synthesis; only generic narration text was sent to the previously approved
Microsoft voice service.

## Application changes

- The caption surface contains accepted, manually selected or typed wording only.
  Unconfirmed previews, generated ellipses, question marks, engine labels and
  progress messages are excluded from the camera caption and exported call/recording
  frames. Recognition feedback remains in the controls. Literal punctuation or
  words typed by the person are preserved.
- Production rolling preview inference is disabled; final classification and
  boundary verification remain. This avoids spending the inference queue on words
  that will no longer be shown as partial camera captions.
- Motion travel uses x/y image coordinates rather than unstable estimated depth.
  Genuine 3D palm turns still use palm orientation. The three-observation median
  now operates at 10–15fps instead of silently disabling below normal camera rates.
  Recognition still receives original frames, not visually smoothed coordinates.
- Landmark drawings use adaptive smoothing: small jitter is damped, larger motion
  is followed promptly. The existing short missing-hand visual hold remains separate
  from recognition. Private rendered output uses the same visual coordinates.
- A 2.5-second gap between captured signs starts a new automatic phrase. Capture
  timestamps keep delayed inference from joining unrelated phrases. Personal
  shortcuts are standalone messages. Typed/edited/manually selected drafts are
  protected from automatic changes until sent or cleared. New phrase boundaries
  clear queued voice and stale shared draft text.
- Personal shortcuts need support from at least two saved examples on both full
  and boundary-trimmed embeddings, with the same winning gesture. Full-view
  similarity adapts conservatively to example consistency (0.82–0.88); the trimmed
  view has a 0.04 allowance, floored at 0.80. Each view must independently beat the
  runner-up by 0.12 in combined modes or 0.10 in personal-only mode. These are
  heuristics, not calibrated accuracy. One outlier cannot approve a phrase.
- Settings → Recognize → **ASL + My gestures · shortcuts first** explicitly gives
  verified shortcuts priority, with ASL fallback. **Review conflicts** holds strong
  disagreement for a manual choice. ASL confidence and personal similarity are
  never compared as probabilities. The ASL filter is unchanged.
- My gestures reports inconsistent examples and overlaps with other shortcuts.
  After five takes, **Replace weakest take** preserves the old example until a
  new valid capture is saved. Cancelling preserves all saved examples.

## Verification and remaining live check

- 203 ML/client tests + 50 application/backend tests pass: **253 software tests**.
- Production build, three real-model replay checks and a simulated interview pass.
- Browser checks confirmed the combined mode option, male voice selection, exact
  typed caption content, hidden caption labels/previews/progress and no console
  errors. No physical camera or microphone was opened by the assistant.
- A local diagnostic re-tracked cropped frames from the supplied recording. This
  is compressed, mirrored screen footage with baked-in landmark drawings; it is
  not the original camera stream and cannot establish live signing accuracy.
  It was used to inspect activity behaviour, not to tune an accuracy claim.
- Face-mask placement, hand visibility and caption preservation were checked on
  selected edited frames; the encoded highlight was decoded without errors.

Restart Handsay, select **ASL + My gestures · shortcuts first**, then test: neutral → supported ASL
sign → five-second pause → saved personal shortcut. The new phrase must contain only the shortcut. Record the same complete motion at your usual speed for each training take; replace a flagged example before recording a full demo. Hold a palm still, then deliberately
turn it. A short new recording is needed to verify the updated build on the actual
camera. The edited older footage cannot prove the new fixes work live. No public
upload or hackathon submission was performed.
