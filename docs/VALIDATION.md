# Validation — updated 16 November 2026

**Owner-purpose / form-ready polish:** 203 ML/client + 51 application/backend tests
pass (254 total), the production build passes, and three real-model replay checks
pass. The one-page PDF now names SeHyun Lee, centers participation in calls and
interviews, explains webcam landmarks instead of wearable sensors, includes the
real caption/TTS scope, failures, practical next steps and clickable credits.
It was re-rendered and visually inspected; the PDF has one page and seven linked
sources. The approved v6 video has not been edited.

The model/replay/metadata hashes match the pinned upstream artefacts (text copies
have an additional trailing newline). Inspection of the pinned split and exporter
confirms test-signer provenance for the six selected clips. This narrows the earlier
unknown-overlap caveat for base-model training; these are still selected development
regression examples, not independent filter/live accuracy. See
[EVALUATION_PROVENANCE.md](EVALUATION_PROVENANCE.md).

Browser checks confirmed the broader conversation entry screen, active mode badge,
untrained-personal-gesture guidance, unchanged typed caption wording and both
themes without console errors. The physical camera/microphone and the owner's
submission-form browser were not opened. Local form answers and a review checklist
are prepared; no public repository/video link was created and no form submitted.


**Chronological video revision:** The latest film is
`output/demo-film-v6/Handsay-demo-revised.mp4` (61.52 seconds, 1080p/30fps H.264/AAC).
The owner-led recording comes first: neutral → raised hand → ASL Hello → caption,
My gestures click → actual phrase entry → Create → five real training takes →
return to camera → successful live shortcut. Extra features appear only afterward.
The My gestures click cuts past old-library cleanup to the actual empty library.
Source hand motion and recognition waits are at 1x speed. Original app captions
are intact; narrator subtitles are separate, and all editorial/app screens are dark.
Sixteen rendered checkpoints verify the sequence, typing, saved counters, hand
visibility and caption separation. Full decode passes; measured audio is -15.99
LUFS / -1.48 dBTP. The opening poster shows the neutral state, not a prefilled result.
No website/model changes were made in this film revision. The previously verified
254 software tests and the unverified independent-live-accuracy disclosure remain
applicable. See [FINAL_WALKTHROUGH_VIDEO.md](FINAL_WALKTHROUGH_VIDEO.md).


**Final website and submission pass:** 203 ML/client + 51 application/backend tests
pass (254 total), plus production build, three real-model replay checks and the
simulated interview. The final browser check verified persisted combined-priority
mode, exact typed captions, light/dark presentation, demo isolation and return to
text without stale landmark drawings, suggestions or labels. No console errors
were observed. Recognition mode storage accepts only its four enumerated values,
with no transcript payload; previous saved gestures are preserved.

The final video is 77.22 seconds, 1080p/30fps H.264/AAC, with male Microsoft Guy
narration and separate white/yellow narrator subtitles. Original app caption pixels
are retained in selected continuous owner-recorded Hello and personal-shortcut
excerpts. Failed attempts elsewhere were omitted. Selected frames were visually
checked for face blur, visible hands and caption separation; full decode passed.
Measured narration is -16.07 LUFS with -1.49 dBTP peak. The write-up PDF was rendered,
visually inspected and verified to contain one page. Source credits and AI
assistance disclosure are included. No public upload or submission was performed.
Independent fluent-signer accuracy remains explicitly unverified, as the owner
confirmed no such tester is available. These checks do not establish clinical or
real-interview reliability. See [FINAL_VIDEO.md](FINAL_VIDEO.md).


**Phrase boundaries and personal-example matching:** 203 ML/client + 50
application/backend tests pass (253 total), plus production build, three
real-model replay checks, one personal-boundary integration check and the
simulated interview. Tests cover a five-second pause after Hello, joining quick
ASL words, separate personal shortcuts, protected edited text, late results and
non-mutating acceptance planning. Personal matching requires two supporting takes
on each of two views; per-view margins avoid mixing incomparable evidence.
Library quality feedback identifies weak/overlapping examples; a replacement is
saved only after a valid capture. The integration check uses variants of the same
two bundled clips, accepts their intended shortcuts and holds four unrelated
bundled clips. It is not an independent signer or live-camera accuracy study.
Browser checks confirm the selected combined-priority option, phrase guidance,
unchanged typed text, empty-library guidance, temporary phrase creation/removal,
and no console errors. No physical camera or microphone was opened. Owner live
validation remains necessary; the assistant did not have the saved owner gesture
takes for calibration. See [LIVE_RECORDING_REVIEW.md](LIVE_RECORDING_REVIEW.md).


**Owner recording / clean caption and combined-mode update:** 198 ML/client + 42
application/backend tests pass (240 total), plus the production build, three
real-model replay checks and simulated interview. Camera captions/recordings no
longer contain unconfirmed words or generated status adornments. Combined ASL and
personal shortcuts use verified evidence and hold conflicting meanings for choice.
Depth-only travel and the lower-frame-rate median bug were corrected; visual
filtering is separate from raw model inputs. A face-blurred 12-second continuous
personal-shortcut highlight is prepared from owner footage. This older recording
does not validate the updated build live. See [LIVE_RECORDING_REVIEW.md](LIVE_RECORDING_REVIEW.md).

**Video privacy and recording:** 186 ML/client + 42 application/backend tests
pass (228 total), and the production build succeeds. Browser recording created
an actual silent WebM from the avatar/model replay, downloaded and converted to
a 14.25-second, 1280 × 720, 20 fps H.264 MP4. Intro, signing and limits frames
were visually inspected. The replay predicted hello / police / giraffe; hello
was held for review. No physical camera or microphone was opened. This does not
validate live signing or anonymization against inference from movement/text.
See [VIDEO_PRIVACY_AND_RECORDING.md](VIDEO_PRIVACY_AND_RECORDING.md).

**Motion stabilization:** 173 ML/client + 42 application tests pass (215 total),
plus three real-model replay checks and the scripted interview check. Live motion
uses windowed jitter tolerance, finger/palm activity and 3D palm orientation;
raw model inputs are unchanged. See [STABILIZED_MOTION.md](STABILIZED_MOTION.md).

**Final reliability pass:** 157 ML/client tests + 42 application/backend tests
pass (199 total), plus three real-model replay checks, a simulated interview and
a hidden Electron startup/duplicate-launch/preferences-bridge check. npm audit
reported zero known advisories. Browser checks verified draft privacy, confirmed
delivery, private demos and room shutdown. See
[FINAL_RELIABILITY_CHECK.md](FINAL_RELIABILITY_CHECK.md).

**Tracking continuity and silhouette test:** 143 ML/tracking + 38 application
checks pass (181 total), plus three actual-model replay checks. Short losses
preserve the capture and preview history, completed results survive subsequent
signs, and the default natural pause is 700 ms. Three recorded words complete
in order with and without synthetic 100 ms hand losses. The separate rendered
silhouette image test does not establish human-camera accuracy. See
[TRACKING_CONTINUITY.md](TRACKING_CONTINUITY.md).

**Recognition pacing update:** 137 ML/tracking tests + 38 application/backend
checks pass (175 total), plus two real-model replay checks. The live timing audit
completed all six selected clips with a synthetic final-pose hold; exact labels
matched 4/6, so this is not an accuracy improvement claim. Browser checks
verified the longer-pause selector, phrase-training shortcut and read-only blue
demo, with no captured warnings/errors. No new human-camera signing test. See
[RECOGNITION_PACING.md](RECOGNITION_PACING.md).

**Desktop startup fix:** three focused runtime checks passed, followed by a real
Electron hidden startup and duplicate-launch check with no reported cache errors.
See [DESKTOP_STARTUP.md](DESKTOP_STARTUP.md) and
[the startup result](evaluation/desktop-startup.json). No camera or UI input was
used for this check. Earlier feature-stage results remain below.

**Current interview redesign:** 128 ML/tracking + 30 app/backend/UI checks = 158 software tests. The separate real-model six-clip audit is reproducible with `npm run audit:replay`. See [INTERVIEW_WORKFLOW.md](INTERVIEW_WORKFLOW.md) and [VERITAS_PREPARATION.md](VERITAS_PREPARATION.md). Software tests and selected demo clips do not establish live signing accuracy. Camera permission was declined; a true mobile viewport could not be exercised. Earlier entries below describe previous builds.

**Previous:** rolling provisional camera captions are implemented. **125 ML + 22 application/backend/voice tests = 147 passing tests.** Real model replay showed blue before the clip ended. See [ROLLING_CAPTIONS.md](ROLLING_CAPTIONS.md); human webcam performance remains unmeasured.

**Previous:** voice and introduction support is implemented. **119 ML + 22 application/backend/voice tests = 141 passing tests.** See [VOICE_AND_INTRO.md](VOICE_AND_INTRO.md). Earlier entries below document previous feature stages.

**Latest update:** camera caption overlays, styling and optional calibrated head controls are implemented. **119 ML + 16 application/backend/head-control tests = 135 passing tests.** See [CAMERA_CAPTIONS.md](CAMERA_CAPTIONS.md). Physical head gestures still require user testing.

**Earlier update:** live captions have since been added. The current checks are **119 ML tests + 11 application/HTTP tests = 130 passing tests**. See [LIVE_CAPTIONS.md](LIVE_CAPTIONS.md) for the automatic-caption behavior and browser results. The observations below document the initial manual-confirmation version.

Local project: `C:\My files\HackGlobal2026`. Validation completed around 12:10 Malaysia time. Preview is served by the Node backend at `http://127.0.0.1:5417`.

## Automated checks

- `npm run test:ml`: **117 tests passed**, 10 files. These include the credited upstream feature-parity, segmentation, uncertainty, protocol, prototype-matching and replay-decoding tests. They are not newly authored signing-accuracy tests.
- `npm test`: **6 tests passed**. New tests cover exact caption wording, corrupt gesture data, room role enforcement, room isolation, idempotent messages, retention, expiry, input/origin validation and serving the built app.
- `npm run build`: passed after the final interface changes.
- `node --check` on server and main browser JavaScript: passed.
- Asset setup verified the ONNX model, Google Holistic model and parity fixture against their pinned size/hash, and copied the locked inference runtimes.

## Observed in the browser

- The production app opened and loaded the real ONNX model successfully.
- The recorded **blue** landmark sample produced **blue** as the top suggestion (displayed 75% model score).
- The recorded **hello** landmark sample produced **hello** as the top suggestion (displayed 93% model score).
- Adding a suggestion changed the editable draft. It did not create a confirmed caption.
- A temporary interviewer view initially showed no draft text. After confirmation, **Hello** appeared in that view.
- An interviewer typed **Could you repeat that, please?** and it appeared in the shared conversation. Room behavior was also checked independently by the HTTP tests.
- Vocabulary search for **thank** showed **thank you** and its external dictionary link.
- A personal phrase could be created with zero takes, correctly marked as requiring at least three examples. The test-only phrase was removed; no trained personal gesture is claimed.
- The real MediaPipe Holistic worker initialized on GPU and processed three blank test frames without opening a webcam. The diagnostic reported approximately **6 ms average after warm-up** for the last two blank frames. This is a compatibility check; it does not measure live-signer performance, end-to-end delay or recognition accuracy. Initial warm-up in the preceding check took approximately 5.75 seconds.
- The final browser console check returned no captured warning/error entries.
- The updated **Use camera** control remains available after a sample playback, so users can switch to a real webcam.

Screenshot: [handsay-demo.jpg](screenshots/handsay-demo.jpg). It is a **recorded landmark sample**, not a live signer or evidence of real interview performance.

## Not established

- No live camera capture of the user was requested by the agent. Webcam recognition, personal gesture training with real movements, actual voice audibility and fluent-signer usability still need hands-on checks.
- No independent signing accuracy study, continuous ASL translation, fingerspelling or unrestricted interview vocabulary.
- No physical sensors, sensor gloves or 10,000-sensor hardware.
- No mobile-device or physical-device accessibility study.
- No Docker/Vultr deployment validation: Docker is not available on this host. Files are prepared but have not been run on a cloud instance.
- No public GitHub repository, public demo URL, recorded video, event registration verification or hackathon submission was completed here.

The source package contains the prototype, model/preprocessing attribution, deployment files and a concrete submission checklist. Model benchmark results remain the upstream author's results, not this app's live-camera evaluation.
