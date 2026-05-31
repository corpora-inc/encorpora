# iPad debug pipeline — drive the device from the host (read this first)

This dir lets an agent **fully drive and observe the app on a physical iPad**
from the Mac: run JS in the live WebView, tap/scroll/measure, take pixel
screenshots, and tail device logs — no copy-paste from the user.

> **Run `bash scripts/dev/ipad/doctor.sh` FIRST.** It checks every layer
> end-to-end and prints the exact commands. The rest of this file is the mental
> model + the gotchas that cost a real debugging session.

## Architecture (one diagram)

```
 Mac host                                   iPad
 ────────                                   ────
 sudo pymobiledevice3 remote tunneld  ──►  RSD tunnel (the foundation)
        │                                    │
        ├── WebInspector (CDP)  ────────────►│  live WebView  ← cdp.sh / cdpd.py / ipad_cdp.py
        └── DVT instruments     ────────────►│  framebuffer   ← screenshot.py
 idevicesyslog (usbmux)         ────────────►│  os_log        ← audio-tail.sh / tail-device-log.sh
```

Everything CDP- and screenshot-related rides the **tunneld RSD tunnel**. If
tunneld dies, all of it breaks (see gotchas).

## Prerequisites (the only human steps)

1. iPad plugged in, unlocked, "Trust this Mac".
2. **`sudo pymobiledevice3 remote tunneld`** running in the user's terminal
   (needs their sudo password — agents can't start it). One per boot.
3. iPad → Settings → Apps → Safari → Advanced → **Web Inspector ON**.
4. `pipx install pymobiledevice3` (the venv python the scripts use).

`doctor.sh` reports which of these is missing and the exact fix.

## The tools

| Tool | What it does | Notes |
|------|--------------|-------|
| `doctor.sh` | End-to-end readiness check + prints how-to | **Run first.** |
| `cdp.sh eval "<js>"` | Run JS in the live WebView, returns the value | Fast path via `cdpd` socket; falls back to per-call. |
| `cdp.sh click\|scroll\|rect\|dom\|pages <sel>` | Tap / scroll / measure / dump DOM / list pages | UI control. |
| `cdpd.py` | Persistent CDP daemon (socket `/tmp/corpan-cdpd.sock`) | Keeps a warm WebInspector session → fast evals. |
| `cdpc.py` | Thin client `cdp.sh` uses to talk to `cdpd` | — |
| `ipad_cdp.py` | Per-call CDP (own connect each time) | Used when daemon is down; slower but standalone. |
| `screenshot.py <out.png>` | Pixel screenshot via DVT | **Works even when CDP is dead** (different service). |
| `audio-tail.sh start\|refresh\|status\|stop [FILTER] [OUT]` | Supervised, self-healing device os_log tail | Survives the silent-hang that freezes a bare tail. |
| `scenario.py` / `suite.py` / `SCENARIOS.md` | Scripted UI sessions (anchors, beats) | See `SCENARIOS.md`. |

`screenshot.py` needs the pymobiledevice3 venv python, not system python:
`"$(pipx environment --value PIPX_LOCAL_VENVS)/pymobiledevice3/bin/python" screenshot.py /tmp/x.png`

## Gotchas (these cost hours — internalize them)

1. **ONE WebInspector client at a time.** Safari's Web Inspector and
   `cdp.sh`/`cdpd` are **mutually exclusive**. Whoever attaches second gets
   `no Target.targetCreated within timeout`. If CDP won't connect and the device
   is fine, **the user has Safari's Web Inspector open — close it.** (To read
   pack console while CDP owns the inspector, inject a `window.__log` capture —
   see recipes.)
2. **`tunneld` is load-bearing.** If `sudo pymobiledevice3 remote tunneld` dies
   (app crash, USB hiccup), `cdpd` blocks with **no socket** and per-call CDP
   times out — but `screenshot.py` may still work briefly. Verify the tunnel by
   taking a screenshot; if the whole RSD is down, the user restarts tunneld.
3. **Restart `cdpd` after any app relaunch/redeploy.** The daemon caches the
   page; a fresh app = stale connection. Recipe:
   ```bash
   pkill -f cdpd.py; rm -f /tmp/corpan-cdpd.sock
   "$(pipx environment --value PIPX_LOCAL_VENVS)/pymobiledevice3/bin/python" \
     scripts/dev/ipad/cdpd.py > /tmp/cdpd.log 2>&1 &
   ```
   Then give the WebView a few seconds to expose a target (retry the eval 3–5×).
4. **Don't hammer exit→relaunch.** Rapid automated exit + relaunch of the heavy
   stargate (Babylon/WebGL) reader can lock the app to a black screen. When
   iterating on a reader, prefer asking the user to navigate, or space ops out.
5. **When CDP is dead, screenshot first.** `screenshot.py` uses DVT, not
   WebInspector — it shows you the real device state (crashed? backgrounded?
   Home screen? Stage Manager?) so you stop guessing.
6. **`cdp.sh eval` does NOT await promises.** An `async`/promise expression
   returns `{}`. For timed measurements, arm a recorder into a `window` var with
   `setTimeout`, then read it back in a second call.

## Common recipes

```bash
CDP=scripts/dev/ipad/cdp.sh
PY="$(pipx environment --value PIPX_LOCAL_VENVS)/pymobiledevice3/bin/python"

# what's on screen
bash $CDP eval 'JSON.stringify({title:document.title, body:document.body.innerText.slice(0,60)})'

# tap an element by text (clicks the element directly, no coordinate math)
bash $CDP eval '(function(){var b=[].slice.call(document.querySelectorAll("button,[role=button],a")).find(function(e){return /open/i.test(e.textContent||"")}); if(b)b.click(); return b?"clicked":"none"})()'

# capture pack console.* without Safari (read window.__log via CDP)
bash $CDP eval '(function(){if(window.__logHooked)return"already";window.__log=[];["log","warn","error"].forEach(function(k){var o=console[k].bind(console);console[k]=function(){try{window.__log.push(k+":"+[].slice.call(arguments).map(String).join(" "))}catch(e){}o.apply(null,arguments)}});window.__logHooked=true;return"hooked"})()'
# ...do the thing...
bash $CDP eval 'JSON.stringify((window.__log||[]).slice(-25))'

# screenshot
"$PY" scripts/dev/ipad/screenshot.py /tmp/x.png   # then Read /tmp/x.png

# device os_log tail (supervised), e.g. native audio prints
bash scripts/dev/ipad/audio-tail.sh start AUDIO_KEEPALIVE /tmp/audio-trace.txt
bash scripts/dev/ipad/audio-tail.sh refresh   # force reconnect if it goes stale
tail -f /tmp/audio-trace.txt
```

## Troubleshooting decision tree

- `cdp.sh` returns `cdp failed after N attempts` / `no Target.targetCreated`:
  1. Is Safari's Web Inspector open? → close it (gotcha #1).
  2. Did the app just relaunch? → restart `cdpd` (gotcha #3), retry a few times.
  3. `screenshot.py` works? → app is up; it's a WebInspector/cdpd issue (1–2).
     `screenshot.py` also fails? → tunneld is down; user restarts it (gotcha #2).
- Log tail frozen (file not growing during activity): `audio-tail.sh refresh`.
- App black-screened / unresponsive: stop hammering relaunch; ask the user to
  restart the app, then restart `cdpd`.

## Native vs JS changes

- **JS/pack edits** hot-reload via the `dev:corpan` Vite watchers → reload the
  reader to pick them up (gentle: exit→relaunch once, don't loop).
- **Native (Swift/Rust plugin) edits** need a device build
  (`npm run tauri ios dev` / `ios:redeploy`) — **single-owner, coordinate**
  (see `corpan/DEV_LOOP.md` and memory `feedback_no_ios_builds.md`). After it
  relaunches, restart `cdpd`.
