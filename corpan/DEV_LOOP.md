# Corpán dev loop — debugging iOS plugins with Claude

This is the workflow that finally let us pin down the
`tauri-plugin-stt` argument-passing bug after many failed iterations.
Use it for any future iOS plugin / pack debugging where the bug shape
is "something happens on the device but I can't see what".

## ⚡ Instant setup (DO THIS FIRST)

```sh
bash corpan/scripts/dev/ipad/doctor.sh
```

One command verifies the WHOLE pipeline end-to-end and prints the exact
commands to drive the device. Green across the board = you have full
control right now. Don't rediscover this setup from scratch — it cost an
hour once; the doctor makes it instant.

**Claude has FULL device control (no copy-paste, no guessing):**

| Capability | Command | Notes |
|---|---|---|
| **Run JS / read screen** | `scripts/dev/ipad/cdp.sh eval "EXPR"` | live WebView, returns JSON |
| **Tap an element** | `cdp.sh click "SELECTOR"` | synthesizes `.click()` |
| **Scroll** | `cdp.sh scroll SEL DY` | element or `window` |
| **Measure layout** | `cdp.sh rect "SEL"` / `dom "SEL"` | bounding box, html |
| **Pixel screenshot** | `screenshot.py /tmp/x.png` | DVT over tunneld, **no sudo** |
| **Device os_log** | `tail-device-log.sh "FILTER"` | Swift/Rust/native |
| **Pack JS console** | `npm run dev:console-server` | optional; CDP eval covers most |

CDP + screenshots both ride the **already-running `pymobiledevice3 remote
tunneld`** (the user starts it once with sudo; we connect without sudo via
`_tunneld`). The CDP path needs Web Inspector ON (iPad → Settings → Apps →
Safari → Advanced → Web Inspector).

**The ONLY human steps:** (a) `sudo pymobiledevice3 remote tunneld` once
per boot, (b) Web Inspector ON once, (c) `npm run ios:redeploy` for
Swift/Rust changes. Everything else Claude drives directly.

**Two gotchas baked into the tools (don't re-debug them):**
- `ipad_cdp.py` must capture the auto-created `Target` id (WebKit on iOS
  26.x routes all commands through `Target.sendMessageToTarget`; upstream's
  `_target_created` is a no-op, so without the capture every command fails
  with `'Runtime' domain was not found`). Already handled.
- `cdp.sh` retries with backoff — WebInspector allows one session at a
  time, so back-to-back calls can collide. Don't hammer it sub-second.

## TL;DR

Three things stream concurrently. Each runs once and stays up:

| Stream | What it captures | How |
|---|---|---|
| **Pack JS console** → `/tmp/pc-console.log` | Every `console.log/info/warn/error` from the pack running in the iPad's WKWebView. | `npm run dev:console-server` (in `corpan-app/`). Pack-side wrapper auto-detects dev URL and POSTs. |
| **Device os_log** → `/tmp/whisper-trace-live.txt` | Filtered Swift os_log lines from the iPad in real time, no sudo. | `bash scripts/dev/tail-device-log.sh "Whisper |"` |
| **App + Swift hot rebuild** | iOS app + Rust + Swift compile and sideload. | `npm run ios:redeploy` (in `corpan-app/`). |

Once those are running, **Claude reads the two log files directly** and
proposes changes. You only press buttons in the app and (occasionally)
re-run `ios:redeploy` when Swift changes.

## Why this exists

The bug class that motivated this loop: a model identity argument
(`{ model: "openai_whisper-large-v3_turbo" }`) was being silently
rewritten to `openai_whisper-base` somewhere between pack JS and Swift.
You only see the symptom ("Remove on Advanced wipes Standard") on the
device. The pack-side console showed the right argument going out; the
Swift os_log showed the wrong one coming in. The diagnosis required
**both** logs **on a unified timeline**, which copy-paste-from-Safari
couldn't provide. The forwarder + tail give us that timeline by
default.

## Setup (once per session)

You need `libimobiledevice` for `idevicesyslog`. If missing:

```sh
brew install libimobiledevice
```

Pair the iPad with this Mac at least once (Xcode → Window → Devices &
Simulators, trust the device).

## The three terminals

### Terminal 1 — pack console receiver

```sh
cd corpan/corpan-app
npm run dev:console-server
```

This Node script (lives at `corpan/scripts/dev/console-server.js`)
listens on `:8990/__console`, accepts POSTs, and appends each one as
a timestamped line to `/tmp/pc-console.log`. Leave it running.

### Terminal 2 — iOS build + deploy

```sh
cd corpan/corpan-app
npm run ios:redeploy
```

This is an alias for `npm run tauri ios dev`. It builds the Rust
plugin, the Swift plugin, the host app, and installs to the paired
device. Confirm any Xcode prompts. Leave it running for hot-reload of
JS host code; Swift changes need a re-run of this command.

### Terminal 3 — device log tail

```sh
bash corpan/scripts/dev/tail-device-log.sh "Whisper |"
```

This kicks off `idevicesyslog -m "Whisper |"` in the background and
returns immediately. The filter restricts to lines containing
`"Whisper |"` (the prefix every STT-plugin os_log line uses). For
other plugins, change the filter:

```sh
bash corpan/scripts/dev/tail-device-log.sh "TTS |"
bash corpan/scripts/dev/tail-device-log.sh "IAP |" /tmp/iap-trace.txt
```

Stop with `pkill -f idevicesyslog`.

## Per-iteration loop

After the three streams are up:

| Change scope | What you do | What Claude does |
|---|---|---|
| **Pack JS only** (`packs/<name>/src/...`) | `npm run build` in pack dir. Reload the pack on iPad (one tap on the pack tile). Reproduce. | Reads `/tmp/pc-console.log` and `/tmp/whisper-trace-live.txt`. Proposes next change. |
| **Host app TS/React** (`corpan-app/src/...`) | Same — Vite hot-reloads via the dev manifest. | Same. |
| **Swift plugin / Rust plugin** (`plugins/.../ios/Sources/...` or `plugins/.../src/...`) | Re-run `npm run ios:redeploy`. Confirm Xcode prompts. Reproduce. | Same. |

You **never copy-paste logs**. Claude tails them directly.

## Adding the loop to a new pack

If you build a new pack and want the JS console forwarded:

```ts
// in your pack's src/main.ts (or equivalent entry)
import { installDevConsoleForwarder } from "../../sdk/devConsole"

installDevConsoleForwarder()
```

That's it. The forwarder no-ops in production builds (only activates
on `http://lan-ip` dev manifests served by `corpan/packs/<name>` dev
servers), so it's safe to land in shipped pack code.

## File map

```
corpan/
  scripts/
    dev/
      console-server.js          # Node receiver on :8990
      tail-device-log.sh         # idevicesyslog tail wrapper
    capture-stt-log.sh           # deprecated, redirects to tail-device-log.sh
  packs/
    sdk/
      devConsole.ts              # canonical pack-side console forwarder
    pronunciation-coach/
      src/
        main.ts                  # imports installDevConsoleForwarder
  corpan-app/
    package.json                 # ios:redeploy + dev:console-server scripts
  DEV_LOOP.md                    # this file
```

## Limits (honest)

What Claude **cannot** do autonomously:

- Start `sudo pymobiledevice3 remote tunneld` (needs the user's sudo
  password) or flip Web Inspector on (device Settings).

**Coordinated, single-owner (not a hard "cannot"):**

- `npm run ios:redeploy` and restarting `npm run tauri ios dev`. These hold
  Cargo/DerivedData locks, so **exactly one of us owns the device build at a
  time** (see `feedback_no_ios_builds.md`). Default owner is the user; when he
  explicitly hands Claude control for a task, Claude runs the redeploy and
  restarts `tauri ios dev` itself, and they coordinate so they never build at
  once. State who holds it whenever control changes.

What Claude **can** do (this used to be the "cannot" list — it isn't
anymore, via `scripts/dev/ipad/`):

- **Tap, scroll, read, and measure the live WebView** through CDP
  (`cdp.sh click/scroll/eval/rect/dom`) — full UI control.
- **Take pixel screenshots** (`screenshot.py`, no sudo) and look at them.
- Read both log streams in real time with `tail -200 /tmp/...`.
- `cargo check`, `npm run tsc`, and `npm run build` before asking
  the user to test.
- Write code, kick off a JS-only rebuild (`npm run build` in pack).

When the iDevice link drops or the receiver crashes, restart the
relevant terminal. That's rare.

## CDP / log-tail gotchas (these cost real debugging time — read first)

- **One WebInspector client at a time.** Safari's Web Inspector and
  `cdp.sh`/`cdpd` are mutually exclusive — whichever attaches second gets
  `no Target.targetCreated within timeout`. If CDP can't connect, **close
  Safari's Web Inspector**. `screenshot.py` uses a different service and is
  unaffected (use it to see device state when CDP is dead).
- **`tunneld` is the foundation.** `sudo pymobiledevice3 remote tunneld`
  carries the RSD tunnel for both CDP and screenshots. If it dies, `cdpd`
  blocks silently (no socket created) and per-call CDP times out. Confirm a
  screenshot works to verify the tunnel; if it's down, the user restarts
  tunneld.
- **Restart `cdpd` after any app relaunch/redeploy.** The daemon caches the
  WebInspector page; a fresh app = stale connection. Recipe:
  `pkill -f cdpd.py; rm -f /tmp/corpan-cdpd.sock; <venv-py> scripts/dev/ipad/cdpd.py &`
  then give the WebView a few seconds to expose a target (retry the eval).
- **Don't hammer exit→relaunch.** Rapid automated exit + relaunch of the heavy
  stargate (Babylon) bundle can lock the app to a black screen. When iterating
  on a reader, prefer asking the user to navigate, or space the operations out.
- **Robust device os_log tail:** `scripts/dev/ipad/audio-tail.sh`
  (`start｜refresh｜status｜stop`) — a supervised, self-healing
  `idevicesyslog -m FILTER` that respawns on the silent-hang/disconnect that
  freezes a bare tail during `dvt`/redeploy/lock.
- **In-WebView console capture without Safari:** inject a wrapper that pushes
  `console.*` into `window.__log`, then read it via `cdp.sh eval` — lets you
  read pack logs while CDP (not Safari) owns the inspector.

## Why not headless / CI?

We could in principle drive the iPad with XCUITest from a CI runner
and capture logs there, but the friction-to-value ratio is bad for an
iterative debugging loop. The pattern in this doc — three local
terminals + Claude reading log files — solves the actual problem
without infrastructure.
