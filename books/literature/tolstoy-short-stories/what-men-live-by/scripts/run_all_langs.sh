#!/bin/bash
# Sequentially run pipeline for all remaining langs. Each lang: 50-90 min.
# Skips fr + he (Aoede-Gemini territory; not for this Chatterbox run).
# Ordering: it 0.2.1 fix-up first, then de finish, then 16 fresh langs.
SCRIPTS=/home/skyl/encorpora/books/literature/tolstoy-short-stories/what-men-live-by/scripts
LOGDIR=/tmp/wmlb_all
mkdir -p "$LOGDIR"

# Order: it (0.2.1 republish), de (finish), then 16 fresh.
# Post-reboot recovery: skip already-published (it/nl/el) and already-paused
# (de/da/fi/no/pl/sv — need manual tts.text rewrites, not more cycles).
# pt resumes from RETRY=9 + 1 GEN. Then 8 fresh langs.
LANGS="pt tr ms sw hi ja ko zh ar"

for L in $LANGS; do
    echo "================ $L ================" | tee -a "$LOGDIR/all.log"
    "$SCRIPTS/run_lang.sh" "$L" 2>&1 | tee -a "$LOGDIR/all.log"
    rc=${PIPESTATUS[0]}
    echo "[$L] rc=$rc" | tee -a "$LOGDIR/all.log"
    if [ "$rc" = "3" ]; then
        echo "[$L] paused for human review of defects" | tee -a "$LOGDIR/all.log"
    elif [ "$rc" != "0" ]; then
        echo "[$L] FAILED rc=$rc — moving on" | tee -a "$LOGDIR/all.log"
    fi
done
echo "[all] done" | tee -a "$LOGDIR/all.log"
