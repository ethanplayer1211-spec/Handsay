# Live voice, introduction and guided setup

## What to click

1. Under **Choose your voice**, select Female or Male, check the actual available voice name and press **Preview voice**. Choose speed if desired. Enable **Speak new captions live** for automatic voice output.
2. Under **Introduce yourself**, press **Edit my introduction**. Optional name and communication-needs fields can be used to build a message; edit the complete text before showing it. **Introduce myself** displays it as a large caption over the camera. Reading it aloud is enabled by default but can be disabled in its editor.
3. Press **Start conversation**, allow camera access and sign supported words with a short pause. Accepted words appear as captions and are spoken in the selected voice. Recorded samples can also exercise this path without camera access; they remain labeled as recorded samples.
4. **Read caption aloud** reads the current edited caption or last confirmed caption on demand. **Stop voice** cancels current/queued speech and switches live voice off. Undo, clear and manual edits cancel queued speech. Words already heard cannot be recalled.
5. **Quick guide** explains corrections, finishing, optional head controls and sharing. Appearance and head controls remain below the camera; the optional head-control setup link takes you there.

## Voice behavior

The browser's actual speech voices are used. In the tested Windows in-app browser, Microsoft Zira, Microsoft David, Microsoft Mark and Microsoft Heami were available. The Female preference selected **Microsoft Zira**, and Male selected **Microsoft David**. Both preview utterances completed synthesis. Voice metadata does not include a gender field; initial profile suggestions use familiar voice names and can be changed by the user. Two distinct voices cannot be guaranteed on other devices.

Only newly accepted words enter live speech. A short 350 ms batching pause combines adjacent accepted words, with a maximum 1.2-second wait before flushing. Utterances are serialized rather than interrupting each other. The queue is bounded; overload or synthesis errors pause live voice and display a message. Switching voice/speed cancels pending audio. Finishing a sentence flushes unsaid words instead of reading the entire already-spoken caption again. While live voice is enabled, the separate Speak when I confirm option is disabled to prevent duplicate speech.

This is speech output, not a microphone or speech-to-text feature. Speech plays on the device running this page. The interviewer room still carries text, not a video/audio call or a virtual microphone stream. Some browser/OS voices may use an online speech service; the tested Zira/David voices were listed by the browser as device voices.

## Introduction behavior and privacy

The default introduction describes use of signing/text and AI assistance without asserting a medical diagnosis. A condition or communication need is inserted only from text entered by the user. The message is editable and is not automatically stored. Voice preferences are saved in local browser storage; intro content is not.

The introduction pauses recognition and head controls and preserves the draft. It remains visible until **Close intro & continue** is pressed. The user can replay its speech. Sharing the introduction with an active interviewer room is a separate unchecked option; showing/speaking it does not automatically publish it to the room.

## Validation

- 119 ML tests and 22 application/backend/voice tests passed: **141 total**. Production build passed.
- Browser voice lists exposed both Zira and David; each preview completed with the Finished speaking status.
- A synthetic demo introduction built from the name **Demo user** and the entered needs **I have difficulty speaking** appeared as a large caption and completed speech. These were test inputs, not facts about the owner.
- The pre-existing **Thank you** draft returned unchanged when the introduction closed. Reload reset the unsaved intro details.
- With live voice enabled, the real recorded **hello** sample was automatically captioned and speech completed (Live voice ready for your next words). Confirmation did not restart speech.
- No live fluent-signer accuracy, physical head-gesture reliability or external meeting audio-routing validation is claimed. Native synthesis completion does not establish the listener's speaker volume or subjective voice quality.

Specification reference: [Web Speech API — SpeechSynthesis](https://webaudio.github.io/web-speech-api/#tts-section). Existing model attribution and recognition limitations remain in `THIRD_PARTY_NOTICES.md`.

Screenshots: [three-step setup](screenshots/handsay-voice-setup.jpg) and [large introduction](screenshots/handsay-introduction.jpg). The final intro screenshot uses the neutral default and has the camera off; it is a presentation preview, not a live signer or a claim about the owner's condition. The expanded intro fitted its container without overflow (519 px content/viewport height).

The first browser playback attempt exposed an unbound native timer call; the default timer wrappers were corrected. Both voice previews, the spoken introduction and automatic sample speech subsequently completed. The browser's retained error log refers to that earlier build; no new error was observed during the final build checks.
