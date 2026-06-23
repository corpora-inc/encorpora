#!/bin/bash
# End-to-end pipeline for one language. Idempotent — skips phases whose outputs exist.
# Self-heals: stale-audio reset (audio mtime < segments mtime), auto-regen on real defects (1 round).
# Auto-publishes when transcription audit shows zero real defects.
# Pauses (exits 3) only if defects persist after one regen round.
set -e
PACK=/home/skyl/encorpora/books/literature/tolstoy-short-stories/what-men-live-by/packs/ian-chatterbox-v1
LANG="$1"
SCRIPTS=/home/skyl/encorpora/books/literature/tolstoy-short-stories/what-men-live-by/scripts
LOGDIR=/tmp/wmlb_$LANG
mkdir -p "$LOGDIR"

log() { echo "[$LANG] $(date +%H:%M:%S) $*" | tee -a "$LOGDIR/run.log"; }

stale_audio_reset() {
    # Compare each segment's current tts.text against the version that produced its audio,
    # via a stored hash in pipeline_state[sid].generation_params.tts_text_hash.
    # First-time absent → record hash, no reset (assume audio matches current text).
    # Hash mismatch → reset to PENDING and update hash so next run sees current state.
    # File-mtime-based comparison was abandoned (whole-file mtime triggers all 617 segments
    # on a single-segment edit).
    python3 - <<PY
import json, os, hashlib
PACK = "$PACK"
LANG = "$LANG"
seg_path = f"{PACK}/segments_{LANG}.json"
state_path = f"{PACK}/pipeline_state_{LANG}.json"
if not os.path.exists(state_path):
    print("no state; skip stale check"); raise SystemExit(0)
seg = json.load(open(seg_path))
state = json.load(open(state_path))
to_reset = []
seeded = 0
for s in seg["segments"]:
    sid = s["id"]
    if sid not in state or not isinstance(state[sid], dict): continue
    cur_tts = (s.get("tts") or {}).get("text", "")
    cur_hash = hashlib.sha1(cur_tts.encode("utf-8")).hexdigest()[:12]
    st = state[sid]
    gp = st.get("generation_params")
    if not isinstance(gp, dict):
        gp = {}
        st["generation_params"] = gp
    prev = gp.get("tts_text_hash")
    if prev is None:
        gp["tts_text_hash"] = cur_hash
        seeded += 1
        continue
    if prev != cur_hash and st.get("status") == "DONE":
        to_reset.append(sid)
        st["status"] = "PENDING"
        st["retry_count"] = 0
        st["error"] = None
        st["validation_errors"] = []
        st["best_quality_score"] = None
        st["best_attempt"] = None
        st["plateau_count"] = 0
        gp["tts_text_hash"] = cur_hash
tmp = state_path + ".tmp"
with open(tmp, "w") as f: json.dump(state, f, indent=2)
os.replace(tmp, state_path)
print(f"stale_reset: {len(to_reset)} (seeded={seeded}) {to_reset[:8]}")
PY
}

real_defects() {
    python3 - <<PY
import json, glob
files = sorted(glob.glob("$PACK/audits/$LANG/transcription_audit_*.json"))
if not files:
    print(""); raise SystemExit(0)
audit = json.load(open(files[-1]))
real = [r for r in audit["records"] if r.get("plausibility") in ("OFF_SCRIPT_OR_TRUNCATED","HEARD_TEXT_FITS_BETTER")]
print(",".join(r["seg_id"] for r in real))
PY
}

# Phase 1: translation drift sweep (informational; segments are pre-fixed if known issues)
log "phase1 translation drift sweep"
python3 - <<PY > "$LOGDIR/preflight.log" 2>&1 || true
import json, re, unicodedata, sys
PACK = "$PACK"; LANG = "$LANG"
seg = json.load(open(f"{PACK}/segments_{LANG}.json"))
def norm(s):
    s = unicodedata.normalize("NFKD", s).lower()
    return [w for w in re.sub(r"[^\w\s]"," ",s).split() if w]
def lev(a,b):
    if not a: return len(b)
    if not b: return len(a)
    dp=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        nd=[i]+[0]*len(b)
        for j,y in enumerate(b,1): nd[j]=min(nd[j-1]+1,dp[j]+1,dp[j-1]+(x!=y))
        dp=nd
    return dp[-1]
big=[]
for s in seg["segments"]:
    if s.get("heading_level")==1: continue
    text=s.get("text","")
    tts=s.get("tts",{}).get("text","")
    if not tts: continue
    d=lev(norm(text),norm(tts))
    has_d=bool(re.search(r"\d",text)) or bool(re.search(r"\b[IVXLCM]+\b",text))
    th=8 if has_d else 5
    if d>th: big.append((s["id"],d,text[:80],tts[:80]))
print(f"big-diff segments: {len(big)}")
for sid,d,t,tt in big[:10]:
    print(f"  {sid} d={d}\n    text: {t}\n    tts:  {tt}")
PY

# Phase 1b: stale audio reset (catches translator-fix segments needing regen)
log "phase1b stale audio reset"
stale_audio_reset 2>&1 | tee -a "$LOGDIR/run.log"

# Phase 3: generate
needs_gen=$(python3 -c "
import json, os
sp = '$PACK/pipeline_state_$LANG.json'
if not os.path.exists(sp): print(1); raise SystemExit(0)
ps = json.load(open(sp))
d = sum(1 for k,v in ps.items() if isinstance(v,dict) and v.get('status')=='DONE')
print(0 if d >= 617 else 1)
")
if [ "$needs_gen" = "1" ]; then
    log "phase3 generate (cuda)"
    ttsctl generate "$PACK" --lang "$LANG" --device cuda > "$LOGDIR/generate.log" 2>&1
    log "phase3 generate done"
else
    log "phase3 skip (already 617 DONE)"
fi

# Phase 4: polish (run only once per lang)
if [ ! -f "$LOGDIR/polish.done" ]; then
    log "phase4 polish (cuda)"
    ttsctl polish "$PACK" --lang "$LANG" --device cuda > "$LOGDIR/polish.log" 2>&1
    touch "$LOGDIR/polish.done"
    log "phase4 polish done"
else
    log "phase4 skip (already done)"
fi

run_master_audit() {
    log "phase6 master --all"
    ttsctl master "$PACK" --lang "$LANG" --all > "$LOGDIR/master.log" 2>&1
    log "phase6 ttsctl audit"
    ttsctl audit "$PACK" --lang "$LANG" > "$LOGDIR/ttsctl_audit.log" 2>&1
    if ! grep -q "OK" "$LOGDIR/ttsctl_audit.log"; then
        log "ttsctl audit FAILED — abort"
        cat "$LOGDIR/ttsctl_audit.log"
        return 2
    fi
    log "ttsctl audit OK"
    log "phase5 transcription audit"
    /home/skyl/tts_venv/bin/python "$SCRIPTS/audit_transcription.py" --lang "$LANG" > "$LOGDIR/audit.log" 2>&1
    log "phase5 audit done"
}

run_master_audit || exit 2

DEFECTS=$(real_defects)
log "real-defect candidates: ${DEFECTS:-none}"

# Auto-regen one round if defects detected
if [ -n "$DEFECTS" ]; then
    log "phase5b auto-regen ${DEFECTS}"
    /home/skyl/tts_venv/bin/python "$SCRIPTS/reset_pending.py" --lang "$LANG" $(echo "$DEFECTS" | tr ',' ' ') >> "$LOGDIR/run.log" 2>&1
    ttsctl generate "$PACK" --lang "$LANG" --device cuda >> "$LOGDIR/generate.log" 2>&1
    log "phase5b regen done; re-running master+audit"
    run_master_audit || exit 2
    DEFECTS2=$(real_defects)
    log "post-regen real-defect candidates: ${DEFECTS2:-none}"
    if [ -n "$DEFECTS2" ]; then
        log "PAUSE — defects persist after one regen round."
        echo "$DEFECTS2" > "$LOGDIR/defects.txt"
        exit 3
    fi
fi

# Phase 7: publish (auto, only when zero real defects)
if [ ! -f "$LOGDIR/published.txt" ]; then
    log "phase7 publish"
    # Detect existing version on CDN; bump if present
    EXISTING_VER=$(curl -s "https://d38iwc9748jekz.cloudfront.net/catalog-v2.json?_t=$(date +%s)" \
        | python3 -c "
import json, sys
c = json.load(sys.stdin)
for n in c['narrations']:
    if n['bookId']=='book_tolstoy_what_men_live_by' and n['language']=='$LANG' and n['voiceId']=='ian-chill-clear':
        print(n['version']); break
")
    PUB_VER="0.2.0"
    if [ "$EXISTING_VER" = "0.2.0" ]; then PUB_VER="0.2.1"; fi
    if [ "$EXISTING_VER" = "0.2.1" ]; then PUB_VER="0.2.2"; fi
    log "publishing version=$PUB_VER (existing=$EXISTING_VER)"
    ttsctl publish "$PACK" --lang "$LANG" --voice-id ian-chill-clear --version "$PUB_VER" \
        --tier premium --price 0.99 --product-id corpan.book.tolstoy_what_men_live_by \
        > "$LOGDIR/publish.log" 2>&1
    grep -E "Narration.*published|sha256|ZIP" "$LOGDIR/publish.log" | tee "$LOGDIR/published.txt"
    log "phase7 publish done (version=$PUB_VER)"
fi
log "ALL DONE"
