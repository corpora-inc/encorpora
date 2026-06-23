#!/usr/bin/env bash
# Corpán iPad debug/test pipeline — instant readiness check + how-to.
#
# Run this FIRST when asked to debug/test/screenshot on the iPad. It verifies
# every layer end-to-end and prints the exact commands to drive the device.
# Anything it can't fix itself (sudo tunneld, Web Inspector toggle) it tells
# the user to do — those are the ONLY human steps.
#
#   bash scripts/dev/ipad/doctor.sh
#
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="$(pipx environment --value PIPX_LOCAL_VENVS 2>/dev/null)/pymobiledevice3/bin/python"
ok(){ printf "  \033[32m✓\033[0m %s\n" "$1"; }
no(){ printf "  \033[31m✗\033[0m %s\n" "$1"; }
hd(){ printf "\n\033[1m%s\033[0m\n" "$1"; }

hd "1. Device paired & connected"
UDID="$(idevice_id -l 2>/dev/null | head -1)"
if [ -n "$UDID" ]; then ok "device $UDID"; else no "no device (plug in, unlock, trust this Mac)"; fi

hd "2. pymobiledevice3 venv"
if [ -x "$PY" ]; then ok "$PY"; else no "pipx venv missing — pipx install pymobiledevice3"; fi

hd "3. remote tunneld (RSD) — needs sudo, USER starts once per boot"
if pgrep -f "remote tunneld" >/dev/null 2>&1; then
  ok "tunneld running (CDP + screenshots route through this, no sudo needed by us)"
else
  no "tunneld NOT running — ask the user to run in their terminal:"
  printf "      sudo pymobiledevice3 remote tunneld\n"
fi

hd "4. CDP bridge → live WebView (eval/click/scroll/rect/dom)"
TITLE="$(bash "$HERE/cdp.sh" eval "document.title" 2>/dev/null)"
if [ -n "$TITLE" ] && [ "$TITLE" != "null" ]; then
  ok "eval works → title=$TITLE"
else
  no "CDP failed. Checklist: app foregrounded; iPad → Settings → Apps → Safari"
  printf "      → Advanced → Web Inspector ON; tunneld running (step 3).\n"
fi

hd "5. Pixel screenshots (no sudo — via tunneld DVT)"
if bash -c "timeout 40 '$PY' '$HERE/screenshot.py' /tmp/corpan-doctor.png" >/dev/null 2>&1 && [ -s /tmp/corpan-doctor.png ]; then
  ok "screenshot.py → /tmp/corpan-doctor.png ($(file -b /tmp/corpan-doctor.png | cut -d, -f1,2))"
else
  no "screenshot failed (needs tunneld). Falls back to: user runs '! sudo $PY ...'"
fi

hd "6. Device os_log tail (Swift/Rust/native)"
if pgrep -f idevicesyslog >/dev/null 2>&1; then ok "idevicesyslog running"; else
  no "not tailing — start: bash $HERE/../tail-device-log.sh \"TTS |\" /tmp/ios.log"
fi

hd "7. Pack JS console forwarder (optional; CDP eval covers most reads)"
if pgrep -f "console-server" >/dev/null 2>&1; then ok "console-server on :8990 → /tmp/pc-console.log"; else
  no "not running — start in corpan-app/: npm run dev:console-server"
fi

cat <<EOF

$(printf "\033[1mCANONICAL COMMANDS (copy/paste; cdp.sh auto-retries):\033[0m")
  CDP=$HERE/cdp.sh
  \$CDP eval "document.body.innerText.slice(0,200)"     # read screen
  \$CDP eval "(()=>{location.reload();return 1})()"      # reload after HMR
  \$CDP click "button[aria-label=Next]"                  # tap an element
  \$CDP rect  ".some-selector"                           # measure layout
  $PY $HERE/screenshot.py /tmp/shot.png                  # pixel screenshot

$(printf "\033[1mLAYOUT MEASURE one-liner (boxes/gaps/centers):\033[0m")
  \$CDP eval "(()=>{const R=e=>{const r=e.getBoundingClientRect();return{t:Math.round(r.top),b:Math.round(r.bottom),cy:Math.round(r.top+r.height/2)}};return{vp_cy:Math.round(innerHeight/2)}})()"

$(printf "\033[1mNOTES:\033[0m")
  • The ONLY human steps: (a) sudo tunneld once per boot, (b) Web Inspector ON
    once, (c) iOS rebuilds (npm run ios:redeploy) for Swift/Rust changes.
  • Frontend (corpan-app/src) hot-reloads; just \$CDP reload + screenshot.
  • Never run iOS builds yourself (cargo/DerivedData locks) — see
    memory/feedback_no_ios_builds.md.
EOF
