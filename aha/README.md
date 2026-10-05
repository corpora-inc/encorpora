# ¡AHA!

An independent, local-first adaptive math tutor. Free2Z owns authentication, balance and metered inference; Corpora operates no app backend. Learner evidence stays in native SQLite; minimized learning context goes to Free2Z for teaching.

Start a continuation session with [HANDOFF.md](HANDOFF.md): delivered builds,
remaining acceptance, follow-up issues and the private operational boundary.

## Development

Use Node 24 and Rust 1.97.1. From `aha/aha-app`:

```sh
npm ci
npm test
npm run tsc
npm run build
npx playwright install chromium
npm run test:ui
npm run dev
```

Native commands: `npm run tauri -- dev`, `npm run tauri -- android dev`, `npm run tauri -- ios dev`. Native prerequisites and real app registration are required; browser preview is not native/live acceptance.

### Device loop (Android phone or emulator)

Build and install a debug APK (`npx tauri android build --debug --apk --target aarch64`, then `adb install -r <apk>`). Debug builds expose the WebView over CDP:

```sh
node scripts/device-smoke.mjs --out /tmp/aha-smoke   # fresh data: launch, hint, wrong answer, force-stop/relaunch, settings gate
OUT=/tmp/aha-probe node scripts/device-probe.mjs my-actions.mjs   # attach to the running app and run ad-hoc Playwright actions
```

Screenshots come from `adb screencap`, so they include system bars and safe areas. This is local device evidence only, never Free2Z/live acceptance. A debug sideload is signed differently from the Play build; uninstall before switching (local progress is lost).

#### Reviewing flagged AI activities

When a learner taps "Something seems off" on an AI activity, the app stores a dispute next to the exact spec it showed. To review those on a debug build attached over USB:

```sh
npm run flag-review                                  # every flag; or: -- --serial R3GL80264RZ (or ANDROID_SERIAL)
npm run flag-review -- --all-ai --since 2026-10-05   # every AI activity since that time, flagged or not
```

It copies `learning.sqlite3` (+ `-wal`, `-shm`) off the device with `adb exec-out run-as inc.corpora.aha cat` and opens the copy read-only; it never writes to, taps or launches anything on the device. Each flagged spec is re-rendered in the focus stage (`src/activity/gallery/stage.html`, via a dev-only `window.__stageSpec`) at 384×832 light. Output goes to `.flag-review/<timestamp>/` (gitignored): one PNG per activity, `index.html` (screenshot beside the spec, flag time, model and skill) and `flags.json` (raw specs for the must-reject corpus). The model is recorded only for activities shown after #905. Flags on local tasks are listed but not rendered.

The browser preview is temporary; closing it loses preview progress. Native SQLite records remain local across restarts. Local practice is clearly labeled while live Free2Z readiness is pending.

See BUILD_STATUS.md for the issue queue and actual completion status. The standards graph and evidence model are independent of Dynawalla's adaptive engine.
