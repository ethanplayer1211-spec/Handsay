# Final chronological Handsay walkthrough

Use `output/demo-film-v6/Handsay-demo-revised.mp4`. This supersedes v5's feature-led
edit. The owner's walkthrough now appears before any additional material, with
dark app footage and a matching dark editorial frame throughout.

## Picture sequence

1. Source 31.6-39.4: neutral pose, hand rises, ASL Hello, actual Hello caption.
2. Source 46.1-46.567: the pointer selects My gestures. Cut past cleanup of old
   experiments to source 55.0-56.8, the actual empty-library input.
3. Source 56.8-63.2: actual typing of “Could you repeat that question?”, Create
   gesture click, and the new entry with zero takes. No fabricated typing.
4. Source 63.2-77.0, continuous: Record next gesture, five real captures and their
   saved-take counter/feedback. The source library/camera transitions are intact.
5. Source 115.6-123.8, continuous: return to the camera, perform the saved gesture,
   and see the actual chosen sentence. Unrelated second-phrase training and failed
   retests between these excerpts are omitted.
6. Only afterward: an actual dark-interface typed-caption image illustrates text,
   editing, optional device speech and interviewer sharing.
7. A short limits screen preserves the distinction between isolated ASL signs and
   personal shortcuts, and reports independent live accuracy as unverified.

Hand motion and recognition timing are at original speed. Small end-frame holds
extend a few short UI shots behind narration; no waits are shortened within the
signing/training/test captures. App caption pixels are never replaced or rewritten.
Voiceover subtitles are a distinct lower band in bold white/yellow, with the male
Microsoft Guy stock synthetic voice. The voice is not the student's real voice.
Credits are in the description/player, without production-note footers.

## Privacy and verification

All image editing is local. Light Gaussian face blur protects the Hello hand area.
A bright-wall check limits the mask to camera frames, leaving library text intact;
a taller mask handles source-page scrolling during training. This is not identity
anonymization. The original owner recording is unchanged. Raw review images and
recordings are excluded from source and submission archives.

Check the first neutral frame, raised hand before Hello, actual Hello caption,
empty library, typed phrase, new entry, first capture, five saved takes, and live
shortcut output. Source edit decisions/hashes are in the v6 assets folder; stream,
full-decode, duration and audio checks are in verification.json/audio-quality.json.
No fluent independent signer evaluation was added or claimed. The website and
its existing 254-test validation are unchanged by this film revision.

Rebuild: edit-walkthrough-footage.py --source <second owner MP4>, then
narrate-demo-neural.py --project demo-film-v6, make-demo-film-v2.py --project
demo-film-v6, package-demo-revision.py --project demo-film-v6. Only generic
narration text uses the approved Microsoft service; images and gesture data stay
local. No public upload or hackathon submission was performed.
