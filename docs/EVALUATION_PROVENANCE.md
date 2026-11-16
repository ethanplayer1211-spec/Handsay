# Evaluation provenance check

The earlier unknown-training-overlap caveat can now be narrowed. The bundled
model, replay clips and model metadata match upstream commit
`ffc0578e68449676b6e9545da82092679914e8c8`. The text copies have an additional
trailing newline; comparison normalizes only the final newline, preserving every
other byte. See [the machine-readable check](evaluation/data-provenance.json).
Run `node scripts/check-evaluation-provenance.mjs` to repeat the local hash check.

The pinned [configuration](https://github.com/shashank11yadav/GestureSign/blob/ffc0578e68449676b6e9545da82092679914e8c8/pipeline/configs/default.toml)
sets test signers 16069, 37055 and 61333. The
[split implementation](https://github.com/shashank11yadav/GestureSign/blob/ffc0578e68449676b6e9545da82092679914e8c8/pipeline/src/gesturesign/prepare.py#L238-L245)
excludes test and validation participants from training. The
[replay exporter](https://github.com/shashank11yadav/GestureSign/blob/ffc0578e68449676b6e9545da82092679914e8c8/pipeline/src/gesturesign/replay.py#L95-L134)
restricts candidates to the test participants before choosing six examples.
The local replay content and model artefact hashes match the pinned upstream Git
blobs. This verifies the documented source chain; we did not independently rerun
training or inspect the original competition archive.

The six clips are held out from the base model's training according to that
verified upstream chain. They are author-selected for visibility and have also
been used while developing Handsay. They therefore support a small base-model
comparison, but not an untouched evaluation of our caption filters, a general
accuracy estimate, or live accessibility validation. Do not present the upstream
72.1% benchmark as Handsay's own result.

The current replay check compares a constant-Hello baseline (1/6) with raw model
output (5/6). Careful acceptance gives 3 correct accepted, 1 wrong accepted and
2 correct held. Wrong automatic captions and withheld correct predictions are
reported separately. A real non-sign false-alarm rate, fluent signer evaluation,
latency distribution and demographic breakdown still need independent data.

The approved owner film demonstrates specific successful Hello and personal
shortcut attempts. It includes cuts and omitted failed retests, so it is not an
accuracy experiment. Independent live signing accuracy remains unverified.
