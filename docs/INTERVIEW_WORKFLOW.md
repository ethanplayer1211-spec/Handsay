# Interview workflow and verification

Updated 15 November 2026. Local preview: http://127.0.0.1:5417.

## User flow

Start with camera or text, invite an interviewer, review a message, then send.
The composer explicitly distinguishes local display from an active shared room.
Quick messages send immediately. Voice on reads sent messages; word-by-word
speech before review is optional in Settings and can speak recognition mistakes.
The introduction can be edited, shown locally and explicitly sent to the room.
No diagnosis is inserted automatically.

Camera, captions, voice, introduction, settings and end controls occupy one row.
Voice selection, filters, caption appearance, head controls and demos are in
Settings. The interviewer sees captions/history and can type questions back.
This is a text/voice aid alongside a separate interview call, not a video call or
virtual microphone. Camera video stays local; voice plays on the signer's device.

See [TRACKING_CONTINUITY.md](TRACKING_CONTINUITY.md) for the latest continuity fixes
and the distinction between supported ASL words and personal phrases.

Motion stabilization now separates palm translation, finger articulation and 3D
palm turns from small landmark jitter. The camera labels settled hands explicitly.
See [STABILIZED_MOTION.md](STABILIZED_MOTION.md) for the latest checks.

## Caption lifecycle fixes

- Provisional words require repeated agreement over at least 250 ms and expire
  after 3.5 s without a stable update. Weak windows do not replace words with
  reading-status text. New movement clears the old prediction, while the accepted
  message stays visible for its remaining display lifetime.
- Natural pause is 0.7 s by default (1.2 / 1.8 s options); sustained absent
  hands end the capture after 650 ms, with 100 ms stable reacquisition. Finish sign checks an open capture manually.
- A clear lone word stays on video for 6 s. A final possible word is marked for
  review for 10 s; suggestion buttons remain until a new sign. An unsent single
  automatically detected word clears from the editor after 15 s of inactivity. Typed and multiword messages
  remain editable until sent or cleared.
- Multiword drafts expire from the video after 15 s; sent messages after 10 s.
  Expiry does not delete conversation history.
- Editing pauses automatic additions during typing with a 1.5 s grace period.
  Leaving a field focused cannot freeze recognition indefinitely on Hello.
- Repeated detection of the same word requires a different accepted word or hands
  absent for 500 ms. Rapid repeats remain blocked.
- Recorded demos are read-only: no interview draft edits, automatic speech or
  sharing. Their captions also expire.

## Reliability fixes

Requests capture their destination room; event sequence numbers are room-scoped.
Failed delivery retains a local message with Retry delivery in Conversation.
Room credentials persist only in session storage so refresh can restore a valid
room and its shared history. Typed drafts are not saved. End interview stops
camera/voice and invalidates the link; the reader disables questions. New room
links in an existing tab reload credentials; skip links preserve those credentials.

Tracking initialization has a timeout. Repeated frame errors and worker failure
are surfaced. Late camera bitmaps are closed after disposal. Camera denial offers
typed messages as the immediate continuation. Duplicate camera/settings element
IDs were removed and are covered by regression checks.

## Design and observed checks

Reference: [Google Meet](https://workspace.google.com/products/meet/) and its
[caption controls](https://support.google.com/meet/answer/15077804). Handsay uses
its own markup/icon, system fonts, a camera/panel layout, short transitions and
persistent light/dark themes. No Google branding or proprietary font is included.
Focus indicators, keyboard sending, reduced motion and responsive CSS are present.

- 128 ML/tracking + 30 app/backend/UI tests pass: 158 software tests. The separate
  real-model replay audit is run with `npm run audit:replay`.
- Hello expired from the camera after 2.5 s. Shared Hello expired on the reader,
  then Blue replaced it correctly.
- A sent answer reached a second tab; its question arrived back. Introduction,
  quick messages, presence, refresh restoration, a fresh room's first question
  and room termination were exercised in the browser.
- Microsoft David preview reported completion. Sent-message speech began with
  the exact text; End interview stopped it. Audibility was not independently checked.
- Blue demo playback left the interview message/history unchanged.
- Desktop light/dark screenshots were inspected. The viewport override did not
  change the effective 1265 px browser width, so mobile/touch layout is unverified;
  the override was reset.
- Camera permission was declined. No new human-camera signing or physical head
  gesture accuracy is claimed.

## Model limits

The real-model audit found quiet → shh at high score, passing both checks. It also
held back two correct labels. This remains a 250-isolated-sign ASL prototype, not a
general interpreter. See [audit results](evaluation/replay-audit.json) and
[Veritas preparation](VERITAS_PREPARATION.md).
