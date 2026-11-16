# Explain Handsay to a judge

## A short explanation

Handsay is a caption workspace for someone with speech difficulties joining a call or interview. A
pretrained model suggests individual signs. The person reviews or types a message
and sends it to an interviewer screen. Questions travel back. We focused on stale
captions, corrections and a reliable typed fallback.

## What AI does and what we reused

MediaPipe estimates hand, body and lip coordinates. Preprocessing converts a short
sequence into numbers expected by GestureSign's existing ONNX network. It scores
250 signs. It does not write interview answers, invent grammar or understand
unrestricted signing. We credit and did not train the base model.

Read src/ml/features.ts, segmenter.ts and consensus.ts to understand the input,
when a sign ends and the agreement check. live-preview.ts predicts before a sign
ends with a bounded history/queue. caption-display.js owns expiry separately from
the editable message and saved conversation.

## Why Hello stayed and why two predictions are not proof

The old editable draft doubled as permanent camera text. A new weak prediction
could be held back, leaving the old word visible; samples could also add to it.
The new display expires, clears a lone word on new movement and isolates demos.

Full and slightly trimmed motions use the same model. Agreement may reject bad
boundaries, but both can make the same mistake. Our audit shows quiet → shh passing
the filter. Never say the filter guarantees correctness.

## The server, voice and evidence

The server shares text, not camera video. Signer and interviewer have different
random keys. Rooms expire after two hours; End interview invalidates the link.
Drafts differ from sent messages. Browser speech reads exact text on this device;
it is not a virtual microphone or video call.

Run npm run audit:replay and show docs/evaluation/replay-audit.json. Five of six
selected demo labels match, compared with one for a constant Hello baseline.
Explain the accepted mismatch and two correct labels held back. The clips have verified upstream test-signer provenance, but were also used during
app development. They are selected regression examples, not independent live
validation; software tests are not signing accuracy.

## Be ready to answer

- What did you create versus reuse? Credit the base model and substantial Codex
  assistance; explain the new communication, display and correction workflow.
- Who is the user? A specific ASL/text communicator, not every disabled person or
  every sign language.
- Where does it fail? Unknown signs, continuous signing, missing landmarks,
  unfamiliar signers and confident model mistakes.
- What would make it dependable? Independent signer/non-sign testing, fluent-user
  feedback, a suitable vocabulary/model and measured end-to-end performance.
- Why Health? The brief explicitly lists webcam sign recognition as an own idea;
  this supports communication, not diagnosis.

The approved video stays unchanged. Sources mean the model, dataset, libraries,
interface reference and AI tools we credit. Next steps mean concrete improvements
and evaluation we would do with more time, not claims about features already proven.
