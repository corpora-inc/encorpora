#!/usr/bin/env bash
# tuto-test.sh — ONE complete CDP scenario for the Tutomaton premium flow.
# Drives the real UI: reload → open → observe setup gate → (optionally) download
# → wait for ready → send a prompt → watch streamed tokens. Always exits 0.
#
#   bash tuto-test.sh            # observe + (if needed) tap download, then chat
#   bash tuto-test.sh nodownload # observe only; don't tap the 2.4 GB download
set +e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
Q="$HERE/q.sh"
MODE="${1:-download}"
PROMPT="${2:-Tell me a fun fact about Spain in one sentence.}"
say() { echo "── $* ──"; }
ev() { bash "$Q" eval "$1"; }

say "1. cdpd up + title"; bash "$Q" up

say "2. reload (fresh HMR frontend + pack bundle)"
ev "(()=>{location.reload();return 'reloading'})()"; sleep 15

say "3. open Tutomaton"
ev "(()=>{const e=[...document.querySelectorAll('*')].filter(x=>/^Tutomaton\$/.test((x.textContent||'').trim())&&x.children.length<=1);if(!e.length)return 'tile-not-found';(e[0].closest('button,a,[role=button]')||e[0]).click();return 'opened'})()"; sleep 6

say "4. setup-gate state"
ev "(()=>{const s=document.querySelector('.lt-setup');const b=document.querySelector('.lt-setup-body');const a=document.querySelector('.lt-setup-action');return JSON.stringify({gateVisible:!!(s&&!s.hidden),body:b?b.textContent:null,action:a?a.textContent:null,actionHidden:a?a.hidden:null})})()"

say "5. screenshot of the gate"; bash "$Q" shot /tmp/tuto-gate.png

if [ "$MODE" = "nodownload" ]; then
  say "stopping before download (nodownload mode)"; echo "done."; exit 0
fi

say "6. tap download (or skip if already past gate)"
ev "(()=>{const a=document.querySelector('.lt-setup-action');if(a&&!a.hidden){a.click();return 'tapped'}return 'no-action(maybe already installed/ready)'})()"

say "7. poll setup phase until ready (download can take minutes)"
for i in $(seq 1 60); do
  s=$(ev "(()=>{const st=document.querySelector('.lt-setup');const b=document.querySelector('.lt-setup-body');const p=document.querySelector('.lt-setup-pct');return JSON.stringify({ready:!!(st&&st.hidden),body:(b&&b.textContent||'').slice(0,70),pct:p&&p.textContent||''})})()")
  echo "  [$((i*15))s] $s"
  echo "$s" | grep -q '"ready":true' && { echo "  >>> MODEL READY"; break; }
  sleep 15
done

say "8. send prompt: $PROMPT"
ev "(()=>{const i=document.querySelector('.lt-text');if(!i)return'no-input';const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;set.call(i,$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$PROMPT"));i.dispatchEvent(new Event('input',{bubbles:true}));const s=document.querySelector('.lt-send');s.disabled=false;s.click();return'sent'})()"

say "9. poll assistant bubble for tokens"
for i in $(seq 1 24); do
  a=$(ev "(()=>{const a=[...document.querySelectorAll('.lt-msg-assistant .lt-msg-body')].pop();return a?a.textContent.slice(0,240):'(none)'})()")
  echo "  [$((i*5))s] $a"
  echo "$a" | grep -qiE '[A-Za-zÀ-ÿ¿¡]{6}' && { case "$a" in *"(none)"*) ;; *) echo "  >>> TOKENS"; break;; esac; }
  sleep 5
done

say "10. final screenshot"; bash "$Q" shot /tmp/tuto-final.png
echo "done."
exit 0
