# Handsay

**Veritas AI International High School Hackathon 2026 · AI + Health · SeHyun Lee**

[Project write-up](docs/VERITAS_WRITEUP.md) · [Credits](THIRD_PARTY_NOTICES.md) · [Evaluation and limits](docs/EVALUATION_PROVENANCE.md)

A webcam caption workspace for calls, interviews and everyday conversations. People with speech difficulties can use supported individual ASL signs, personal gestures or text, review their wording, and optionally read it aloud.

This prototype does **not** provide continuous sign-language translation or a dependable interpreter for real interviews. It uses a credited, existing research model; no zero-error or 10,000-sensor claim is made. The current 250-sign vocabulary is mostly everyday vocabulary, not a complete interview vocabulary.

## Run

Requires Node.js 24 and a modern desktop browser. In this directory:

```powershell
npm ci
npm run setup:assets
npm run build
npm start
```

Open **http://127.0.0.1:5417**. Choose **Start with camera** or **Continue with text**. **Try a recorded demo** tests model inference without a camera. No microphone access is requested. Initial model/runtime downloads require an internet connection; after setup, inference files are served by this app. Room sharing uses the included HTTP backend.

For frontend development, run the API with `PORT=5418` (PowerShell: `$env:PORT='5418'; node server.mjs`) and run `npm run dev` in another terminal. Production serves everything on port 5417. Bind a different host only for an intended deployment.

## Desktop launcher

Run `npm run setup:desktop` and `npm run setup:camera` once, then open
`Start-Handsay.cmd` or run `npm run desktop`. The optional camera bridge requires
Windows, Python 3.12+ and an installed OBS Virtual Camera. In Handsay, choose
**Use in calls → Start camera output**, then select **OBS Virtual Camera** in the
call app. This exports video and captions; synthetic-voice microphone routing is
separate. Compatibility with every client, especially mobile apps, is not promised.

The desktop cache/repeat-launch fix and its real-startup verification are documented
in [DESKTOP_STARTUP.md](docs/DESKTOP_STARTUP.md). Restart existing Handsay windows
to load that fix. Old profile folders are left untouched.

## Use

1. Choose **Start with camera** or **Continue with text**. For signing, keep face, shoulders and hands visible and use one supported ASL sign at a time.
2. Compose in **Your message**. Only accepted, chosen or typed words appear on camera; uncertain suggestions stay in the controls without generated prefixes or ellipses. Use a short natural pause (0.7 seconds by default; slower options in Settings), or **Finish sign** to check sooner. A clear word stays on camera for 6 seconds. An unsent single automatic word clears from the editor after 15 seconds of inactivity. A pause of 2.5 seconds between captured signs starts a new automatic phrase. Personal shortcuts are standalone messages. Typed/edited/selected messages are protected until sent or cleared. The base vocabulary includes **morning**, but not **good** or **good morning**. Use **Teach a personal gesture** and record at least three takes. Select **My gestures**, or **Settings → Recognize → ASL + My gestures · shortcuts first** to use both without switching. Your last recognition mode is remembered. Verified shortcuts take priority; **review conflicts** instead holds strong disagreement for your choice. See [the live-recording review](docs/LIVE_RECORDING_REVIEW.md).
3. Choose **Invite interviewer** and create a link. The interface says whether the message is local, waiting for a reader or connected. Use this alongside your normal interview call: this app relays text and plays local speech, not camera video or a virtual microphone.
4. Review and press **Show message** locally or **Send message** for the active room. Quick messages send immediately. Interviewer questions appear in the workspace. Failed deliveries retain a retry action in Conversation.
5. Use **Voice on** to read sent messages. Settings contains actual available female/male voice preferences, optional speech before review, caption appearance, recognition filters and head controls. The introduction can be edited, shown locally and explicitly sent to the interviewer.
6. **End session** stops camera/voice and invalidates the interviewer link. Conversation history remains on this page for download. Valid room credentials and shared history can be restored after refresh; unsent typed drafts are not saved.

Recorded demos are read-only: they never add to your interview message, speak or share automatically. Their expected labels are references and do not generate model predictions. Supported signs lists the 250-word vocabulary. My gestures lets you record 3–5 takes for up to 8 personal phrase shortcuts; these are not verified ASL translations. The library reports inconsistent or overlapping examples and lets you replace the weakest take once five takes are saved.

**Private video:** Settings → Video privacy defaults to **Silhouette**, which replaces all camera pixels with a drawing. **Hands only** hides face, body and background and draws tracked hands. Recognition still uses the camera locally. Choose **Record my camera with privacy → Record video → Stop recording → Download video** for a silent local WebM (maximum two minutes). No OBS installation is needed for recording. The silhouette test also has **Record avatar video** for a captioned recorded-motion demonstration without a webcam. Download before closing the app. See [privacy and recording](docs/VIDEO_PRIVACY_AND_RECORDING.md).

The Careful filter requires score 0.80, a 0.25 margin and agreement on a boundary-trimmed segment of at least 250 ms. Balanced uses 0.70 / 0.20. These are heuristics, not measured correctness guarantees. The same model can confidently make the same mistake twice.

Current workflow and verification: [INTERVIEW_WORKFLOW.md](docs/INTERVIEW_WORKFLOW.md). Target event: [Veritas preparation](docs/VERITAS_PREPARATION.md), with a [draft write-up](docs/VERITAS_WRITEUP.md). The owner confirmed registration and high-school eligibility. The source is published for review; the submission form has not been submitted and the app is not publicly hosted.

## Original work and research baseline

The existing [GestureSign](https://github.com/shashank11yadav/GestureSign) ASL model, preprocessing, tracking and associated tests are included with MIT attribution. Our work is the communication interface and review flow, personal phrase workflow, browser speech, temporary interviewer rooms and Vultr deployment packaging. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Do not present the base model or upstream accuracy as newly trained work.

The upstream 250-class model consumes up to 64 frames of 460 features from hands, upper body and lips. It does not model full facial grammar or continuous sentences. The author reports 72.1% top-1 on its held-out dataset, with known confusions. This app has not established accuracy on fluent live signers or in real interviews.

## Privacy and server behavior

- Webcam video and landmark processing stay on the client during recognition. Up to 543 landmarks are estimated coordinates, not physical sensors. Optional native call-camera output sends the rendered output frames to the localhost camera helper; private modes replace every camera pixel. Recordings are local downloads and are never automatically uploaded.
- Personal phrase embeddings are stored in browser local storage and can be removed individually. They are movement-derived personal data, even though they are not images.
- Shared text exists in server memory for at most two hours and is discarded on server restart. Each room retains up to 200 recent events. No analytics, database, user accounts or cookies are used.
- A random writer key can publish captions; a distinct interviewer key can read text and send questions. Anyone with an interviewer link gets that room's access. Keys live in URL fragments or browser memory; they are not persistent user credentials.
- Refresh restores a still-valid room and its shared history using session storage; it loses unsent drafts and unshared local history. Download a transcript if needed. Disconnecting stops new sharing; it does not recall text already displayed or spoken.
- Browser/OS speech voices may use their own speech service. The app requests no microphone and performs no audio transcription.

## Check

```powershell
npm test
npm run test:ml
npm run build
```

HTTP tests verify room isolation, roles, message validation, duplicate handling, retention/expiry and serving the built app. Upstream ML tests verify feature parity, segmentation, uncertainty handling, payload validation and prototype matching. Automated tests are not clinical, accessibility or real-interview validation.

Deployment: [docs/DEPLOY_VULTR.md](docs/DEPLOY_VULTR.md). Concept, scope and roadmap: [docs/CONCEPT.md](docs/CONCEPT.md). Demo and submission material: [docs/HACKATHON_SUBMISSION.md](docs/HACKATHON_SUBMISSION.md).

## Measured demo audit

Run `npm run audit:replay` to evaluate the real ONNX model on all six bundled demo clips. A constant hello baseline matches 1/6 expected labels; raw model output matches 5/6. Careful filtering accepts 3 correct labels and 1 mismatch (quiet -> shh), while holding back 2 correct labels. See [full results](docs/evaluation/replay-audit.json).

The clips were selected upstream from the base model's held-out test signers. We verified the pinned model, replay and metadata against upstream Git blobs and checked the exporter/split code; see [data provenance](docs/EVALUATION_PROVENANCE.md). These six clips are selected examples used during app development, not an untouched evaluation of our filters or live-camera accuracy. The 254 software checks also do not measure signing accuracy. An independent signer/non-sign evaluation remains necessary.

[Light workspace](docs/screenshots/handsay-review-light.jpg) · [Dark workspace](docs/screenshots/handsay-review-dark.jpg)

## AI assistance and design reference

OpenAI Codex provided substantial implementation, debugging, tests, audit tooling and drafting assistance under the user's feature direction. This is disclosed for the event; the submitting team must review and understand the project. Google Meet was the layout/control reference; Handsay uses its own markup and icon with system fonts. No Google branding or proprietary font is included.

Final demo: [chronological walkthrough and editing notes](docs/FINAL_WALKTHROUGH_VIDEO.md). Independent live signing accuracy remains unverified.
