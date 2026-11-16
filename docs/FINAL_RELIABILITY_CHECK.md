# Final reliability pass — 16 November 2026 (MYT)

This pass checks failure recovery, local privacy and shutdown. It does not certify
failproof operation or reliable sign-language interpretation.

## Fixes made

- End interview releases the physical webcam, stops queued speech and cancels
  demos before awaiting virtual-camera or room network shutdown. Room errors keep
  a retry path. Interview history remains available for download.
- Model metadata downloads time out after 20 s; worker startup after 45 s; model
  inference after 10 s. A crash, unreadable message or stalled inference rejects
  pending requests, terminates the worker and prevents a backlog of new requests.
  Restarting the camera reloads a failed model. Typed draft text is preserved.
- Camera tracking stops on repeated failures, a frozen bitmap/frame request, or
  eight seconds without usable images. Late bitmaps are closed and stale frame
  replies ignored. Playback of an opened camera is bounded to 10 s. Camera-stop
  callbacks from an older start cannot stop a newer camera session.
- Cancelling virtual-camera startup before its status check finishes cannot
  later start a helper. An old cancelled helper's startup timeout cannot stop a
  newer helper. Existing frame-size limits, ownership tokens and local-origin
  restrictions remain in place.
- Fresh desktop browser sessions had isolated saved personal gestures and
  preferences. A narrow, origin/window-checked preload API now preserves only
  gestures, voice choice, caption style and theme in the stable private profile.
  The page gains no general file or Electron API. Room keys, introduction details
  and transcripts are not persisted through this API. Corrupt saved files block
  overwriting. Older Chromium data remains untouched and is not migrated.
- Temporary extracts, release archives and environment-file variants are ignored
  by Git; source packaging continues to exclude runtime profiles and credentials.

## Completed verification

- `npm run build`: passed.
- `npm run test:ml`: 157 tests passed, including injected worker crashes, stalls,
  startup cancellation, timeout races, ordered captions and stale-result guards.
- `npm test`: 42 tests passed, including preference persistence and IPC boundaries,
  corrupt-file preservation, room authorization, privacy, expiry and voice stop.
- `npm run audit:replay`: three real-model checks passed on selected recorded data.
- `npm run test:conversation`: scripted four-question/four-answer simulation
  passed, including review/correction and typed fallback. It is not a human test.
- `npm run test:desktop-startup`: a hidden real Electron instance loaded, wrote a
  preference through the actual sandboxed bridge and handled a second launch.
  No reported cache/preload errors. No camera or UI input was requested.
- `npm audit --json`: zero known advisories reported for installed Node packages
  at check time. This is not a general security guarantee or a Python-package audit.
- In the background browser: unsent synthetic text was absent from the local
  interviewer view with live sharing off; confirming delivered the text; a question
  reached the signer; a real-model silhouette demo did not publish its words;
  End interview invalidated the reader room and disabled new questions. No captured
  browser warnings/errors. Camera and voice remained off throughout this UI check.
  [Observed shutdown](screenshots/handsay-final-shutdown-check.jpg).

## Owner test next

Close all Handsay desktop windows, then reopen Start-Handsay.cmd. Start with voice,
draft sharing and experimental head controls off. Try signs from Supported signs
with Natural pause (0.7 s), continuing between individual words. Check correction,
typed fallback and sending. Then check optional voice and the receiving call app.
Finally stop the camera and use End interview; verify the device camera indicator
turns off and the interviewer link ends.

The assistant did not open the physical webcam or validate a real third-party
call. The model still covers 250 isolated signs and can accept a wrong word or
reject a correct one. “Good morning” needs a personal shortcut or typed text.
