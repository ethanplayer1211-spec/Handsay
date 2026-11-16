# Veritas submission preparation

The owner changed the target from HackGlobal to Veritas and confirmed registration
and high-school eligibility. No public repository, deployment or submission has
been made by the assistant.

## Track and rules

Recommended: **AI + Health**, own idea. The official Project Briefs page 7 explicitly
list webcam sign-language recognition. Enter only one track.

Build window: 14 November 2026 00:00 ET to 15 November 2026 23:59 ET.
Malaysia deadline: **16 November 2026 12:59 PM MYT**. Work in this workspace began
15 November, within the build window. Credit the reused model/code instead of
presenting it as newly authored.

- AI/ML must perform the main task; coding a regular app with AI tools alone is
  insufficient. Handsay uses actual pretrained ONNX sign classification.
- Public datasets, pretrained models, libraries, tutorial code and coding assistants
  are allowed with credits. The team must understand and explain the entire project.
- Disclose substantial Codex implementation assistance honestly; do not describe it
  as merely help with one debugging error.
- Use public/synthetic data unless the person permits collection. Report real
  results, a simple baseline and failures. Test data should be unseen in training.
- Include: **This project is a prototype and is not medical advice.**
- Teams contain 1–3 contributing high-school students. Latest resubmission before
  the deadline is judged. The specific project brief says a video is optional and
  no live kickoff attendance is required, despite older guide wording.

## Required materials

1. A GitHub repository or Colab notebook accessible without signing in.
2. Roughly one-page write-up: README, public-link Google Doc or uploaded PDF/Word.
   [A draft is prepared](VERITAS_WRITEUP.md).
3. Track and every teammate's real name, email and school.
4. Credits for data, model, code sources and AI tools.
5. Optional recommended video, up to two minutes. A public deployed website is not
   listed as required. A local ZIP alone is not the required code link.

## Measured results and the remaining gap

Run `npm run audit:replay`: all six upstream-selected demo clips are evaluated by
the real model. Always-hello matches 1/6 labels; the raw model matches 5/6. Careful
filtering accepts 3 correct and 1 mismatched label, holding back 2 correct labels.
See [all outputs](evaluation/replay-audit.json).

**These counts are not representative or live-camera accuracy.** The pinned
model and clips match the upstream artefacts, and the exporter selects held-out
test signers; see [provenance](EVALUATION_PROVENANCE.md). The six selected clips
have also been used during app development. The 254 software tests also do not measure
signing accuracy. The largest remaining evaluation gap is an independent signer
test set and non-sign negative examples. General false-alarm rates, demographic
fairness and adult interview performance have not been established.

Before submission: publish the reviewed code with correct credits; add real team
details; ideally obtain a separately held-out public/permissioned test set; report
wrong accepted words and correct words held back separately; rehearse the
[project explanation](EXPLAIN_PROJECT.md); check all links without authentication;
submit through the official form. Preparation does not submit the project.

## References

- [Briefs and submission](https://highschoolhackathon.org/briefs)
- [Official brief PDF](https://drive.google.com/file/d/15tYD48XRmCgWbk1_lLDtc8lebi6qm-4-/view)
- [FAQ](https://highschoolhackathon.org/faq)
- [Submission form](https://airtable.com/appypCyHN77hElIcS/shrXA5VBFdugmoXl6)

The supplied ScamCheck sample informs the baseline/improvement/error presentation;
its code is not incorporated in Handsay.
