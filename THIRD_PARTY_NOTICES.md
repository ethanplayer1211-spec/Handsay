# Third-party acknowledgements

## GestureSign

The files under `src/ml/`, `src/replay/`, `public/models/`, `public/replay/`, and `shared/fixtures/features.json` derive from [GestureSign by Shashank Yadav](https://github.com/shashank11yadav/GestureSign), pinned to commit `ffc0578e68449676b6e9545da82092679914e8c8`. The original MIT notice is preserved at `third-party/GestureSign-LICENSE` and is shipped with the web app at `/GestureSign-LICENSE.txt`.

These components include the trained ASL model, feature preparation, tracker, inference workers, segmenter, decision logic, prototype matcher, replay decoding and original unit tests. The relative fixture path was adjusted for this repository. Handsay does not claim to have trained the base model. New product work is the interface, caption review, speech controls, temporary two-role text rooms, conversation handling, personal phrase workflow and deployment packaging.

The upstream model is intended for research, learning and demonstrations, not accessibility-critical interpreting. Its author reports 72.1% top-1 over 250 isolated signs on three held-out dataset signers, and explicitly documents failures. These are upstream results, not Handsay webcam or interview validation. Full continuous sign language, grammar, fingerspelling and unrestricted interview language are unsupported.

## Dataset

Training data and the six replay landmark samples originate from Google / PopSign, [Google — Isolated Sign Language Recognition (`asl-signs`)](https://www.kaggle.com/competitions/asl-signs), reported upstream as CC BY 4.0. Attribution to Google, PopSign and the dataset is shown in the app and the replay file. Only the provided landmark examples and model are bundled; no camera video or raw training dataset is copied. Features from the provided samples are converted to the upstream model's representation during inference. [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/).

## Runtime dependencies

- Google MediaPipe Tasks Vision and Holistic landmarker: Apache-2.0. Google-hosted Holistic model version `float16/1` is downloaded and checked against a pinned SHA-256 by `scripts/setup-assets.mjs`.
- Microsoft ONNX Runtime Web: MIT. Its official license is preserved at `public/licenses/ONNX-Runtime-LICENSE.txt`.
- Vite and Vitest: MIT, development/build tools. Dependency versions are locked in `package-lock.json`.

The app serves its model and runtime assets from its own origin. Browser speech output uses the platform's available voices, which may invoke an operating-system speech service.

## Demo film narration

Earlier revisions used Microsoft Ava Multilingual Neural; the final demo uses the stock male Microsoft Guy Neural voice via
Microsoft's Edge speech service and the [edge-tts](https://github.com/rany2/edge-tts)
7.3.1 client (LGPLv3). The user explicitly approved sending the demo narration
text for synthesis. No camera images or personal data were included. This is a
film-production tool, not an application dependency or a cloned student voice.
The client is installed separately in the local runtime; its code is not copied
into Handsay's application source. Narration is credited as synthetic in the final player description and VIDEO_DESCRIPTION.txt.

## Local live-caption additions

`src/ml/consensus.ts` and `src/live-caption.js` add motion-agreement checks and automatic caption acceptance. `src/ml/recognizer.ts` is modified to serialize inference, suppress stale errors after reset and expose verification results. These local changes are not part of the upstream model or its published accuracy study.
