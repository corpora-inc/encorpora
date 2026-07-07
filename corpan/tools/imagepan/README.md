# imagepan — concept image pack pipeline

Build-once, ship-forever image pack for Journey. Design: `corpan/docs/journey/research/images.md`;
architecture decision D10.6. One **language-neutral** pack keyed to concepts (EN
lemma + sense), consumed by the `concept` ItemRef kind (content-resolver.md §2.7)
via picture-choice (`choice_pick` + `media:'image'`), gated on imagepan presence
so all app-side wiring ships **inert until the pack exists**.

## Files here
- `style.py` — the LOCKED house style (`STYLE_ID`, `STYLE_PREFIX`, `NEGATIVE_PROMPT`).
  Bump `STYLE_ID` + pack version if you change it; a pack must be one consistent style.
- `extract_concepts.py` — concept extraction. Reads the A0/A1 course units
  (read-only), gates by Brysbaert concreteness ≥ 4.0, applies an authored
  sense/domain curation layer, writes `concepts_a0a1.json`.
- `concepts_a0a1.json` — the extracted concept list (checked in). Each concept:
  `{key, word, sense_subject, sense_gloss, domain, distractor_group, cefr, pos,
  concreteness, seed}`.
- `concepts_a0_proof.json` — the original 12-noun proof slice.
- `gen_batch.py` — loads SD3.5-Large ONCE, loops concepts, writes PNG + a JSON
  reproducibility sidecar. Runs **on the Spark** (`spark-f62c`, NVIDIA GB10).
  Accepts either the proof schema or the `concepts_a0a1.json` schema.
- `curate.py` — zero-dep local http.server 4-up verdict page (run against the
  Spark candidate output). Writes `verdicts.json`.
- `build_image_pack.py` — turns `verdicts.json` + picked candidates into the
  shippable `imagepan` pack (loose WebP files + SQLite index + manifest +
  ATTRIBUTION.md).
- `data/` — **gitignored.** Holds the downloaded Brysbaert norms .txt (nothing
  from it ships, so its licence never constrains the app).

## 1. Concept extraction (local)
```
python extract_concepts.py         # downloads Brysbaert norms to data/ on first run
```
Current output: **98 concepts** across 17 visual domains (food, drink, animal,
body, clothing, vehicle, object, furniture, building, place, nature, people,
money, color, number, action, event). The A0/A1 units are a bounded source, so
this is the honest ceiling — NOT the ~250-350 a full-corpus intersect would give.
Re-run after new units land; the curation table in `extract_concepts.py` is the
one place to author new `sense_subject`s.

## 2. Generation (ON THE SPARK — shared box, headroom rules apply)

**The Spark is shared.** Whisper alignment jobs for the AITW narration series
run there. Owner rule: **never OOM the box; patience over throughput.** So this
is a single, sequential, nice'd process with a per-image sleep, launched ONLY
after a headroom check.

The local Mac reaches the Spark via **Tailscale SSH**, which currently needs an
**interactive browser re-auth** (`ssh spark-f62c` prints a `login.tailscale.com`
URL) — so it can't be driven non-interactively from an agent. Run these by hand
from an authenticated shell:

```bash
# 0. HEADROOM CHECK — do NOT launch if this looks tight.
ssh spark-f62c 'nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv;
                free -g | head -2; nvidia-smi | grep -E "python|whisper" || echo "no gpu python procs"'
#    SD3.5-Large needs ~18-20 GB VRAM at fp16 + tiled VAE. If the whisper
#    alignment jobs leave < ~24 GB free VRAM or the box is swapping, STOP and
#    run this after they finish.

# 1. push the tools + concept list
rsync -av style.py gen_batch.py concepts_a0a1.json \
      spark-f62c:~/projects/image-gen/

# 2. launch: 4 candidates/concept, distinct seeds, ONE sequential process,
#    nice'd, 3s sleep between images for headroom. ~98×4=392 images @ ~41s
#    ≈ 4.5 GPU-hours of compute, longer wall-clock with the sleep — fine, it can
#    take days. load-once loop (gen_batch keeps the model resident).
ssh spark-f62c 'cd ~/projects/image-gen && mkdir -p imagepan_a0a1 && \
  nohup nice -n 15 .venv/bin/python gen_batch.py concepts_a0a1.json \
    --out imagepan_a0a1 --num 3 --sleep 3 \
    > imagepan_a0a1/run.log 2>&1 &'

# 3. verify it started (first images appear within a couple minutes) — do NOT wait for it.
ssh spark-f62c 'sleep 120; ls imagepan_a0a1/*.png | head; tail -5 ~/projects/image-gen/imagepan_a0a1/run.log'
```
Output naming: `imagepan_a0a1/<key>_<0..3>.png` + `<key>_<0..3>.json` sidecar
(prompt/seed/model/style_id — reproducibility). Model = **SD3.5-Large**
(Stability Community License; outputs owned, commercial OK < $1M revenue).
**FLUX.1-dev is BANNED for shipped assets** (NC license v1.1).

## 3. Curation (owner, after generation)
Two documented paths — pick the simpler:
```
# A) Run the page ON the Spark over Tailscale (no data copy — simplest):
ssh spark-f62c 'cd ~/projects/image-gen && python3 -' < curate.py  # or scp curate.py first
#    then open http://spark-f62c:8765/ in a browser.

# B) Or pull candidates down and curate locally:
rsync -av spark-f62c:~/projects/image-gen/imagepan_a0a1/ ./candidates_a0a1/
python curate.py --candidates ./candidates_a0a1 --concepts concepts_a0a1.json
#    open http://localhost:8765/
```
Keyboard: `1-4` pick that candidate, `r` reject all, `n`/note field to request a
regen, arrows to navigate. Verdicts stream to `verdicts.json`.

## 4. Pack build (after curation)
```
python build_image_pack.py --candidates ./candidates_a0a1 \
    --verdicts verdicts.json --concepts concepts_a0a1.json \
    --out ./dist/imagepan
```
Produces `dist/imagepan/{manifest.json, images/<key>.webp, data/index.sqlite3,
ATTRIBUTION.md}` (loose WebP files + a small SQLite concept index). rembg
background removal is used when installed (skipped gracefully otherwise), objects
resized to 384², WebP q75-80. A coverage + size-budget report prints at the end.

## App-side (already wired, ships inert)
- Resolver `concept` arm: `corpan-app/src/journey/content/resolve.ts`
  (`resolveConcept`, `SQL.conceptImage`).
- Picture-choice render: `corpan-app/src/journey/exercises/imageChoice.ts` (pure
  tile builder) + the `media:'image'` branch in `ChoicePick.tsx`.
- Emission: `runtime.ts` upgrades a fraction of first-exposure word cards to
  picture-choice when imagepan is installed (`maybeImageChoice`).
All are guarded by `findInstalledPack("imagepan")` — no behavior change until the
pack is published.
