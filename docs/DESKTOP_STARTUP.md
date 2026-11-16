# Desktop cache and repeat-launch fix

15 November 2026. The reported log reached "Handsay desktop ready" but Chromium
could not open/move disk-cache files. The earlier launcher reused a shared profile
and had no single-instance lock. File permissions and competing processes can
both produce this warning; the log alone does not identify which one held a file.

The corrected launcher:

- Checks that its runtime directory is writable, with a per-user temporary-folder
  fallback if the project runtime location cannot be written.
- Uses a new per-user v2 profile and acquires Electron's single-instance lock.
  Opening the launcher again forwards to the existing instance.
- Creates a separate session-data directory for each primary launch before
  creating a Chromium Session.
- Uses an explicit Session with HTTP disk caching disabled and disables the GPU
  shader **disk** cache. GPU acceleration remains available for tracking.
- Leaves the previous `.runtime/desktop-profile` folder untouched. It does not
  delete, unlock or change the permissions of old files or other running apps.

Close existing Handsay windows and reopen `Start-Handsay.cmd` to load the fixed
main process. Do not run it as administrator to work around a cache warning.

## Verification

`node --test test/desktop-runtime.test.mjs`: three focused checks passed for unique
launch directories, writable-location fallback and rejecting duplicate cache setup.

`npm run test:desktop-startup`: a real Electron hidden-window launch reached its
local health endpoint. A second launch exited successfully and was received by
the first instance. No "Unable to move the cache", "Unable to create cache" or
"Gpu Cache Creation failed" messages were captured. The test opened no camera,
sent no UI input and used an isolated test profile. See
[the recorded result](evaluation/desktop-startup.json).

References: [Electron paths](https://www.electronjs.org/docs/latest/api/app#appgetpathname),
[single-instance locking](https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata),
[explicit sessions](https://www.electronjs.org/docs/latest/api/session#sessionfrompathpath-options).

## Preference preservation — 16 November

Fresh Chromium sessions also isolated localStorage by session and ephemeral
server port. The desktop now saves only personal gestures, voice preferences,
caption style, theme and the last recognition mode in the stable private profile, through a narrow sandboxed
preload bridge. Room keys, interview text and introduction details are not saved
by this bridge. Browser mode continues using its existing localStorage. Corrupt
preference files are preserved rather than overwritten. The previous Chromium
session directories are untouched; old localStorage contents are not migrated.

Four storage/IPC tests pass. The real hidden desktop startup also confirmed an
actual renderer preference write through the bridge, with no preload/cache errors.
