# imagepan — image pipeline & scale-up plan

**Status:** operations plan (not code). **Date:** 2026-07-12.
**Owns:** how the offline concept-image pack (`imagepan`) is generated on the
Spark, curated, packaged, and published — and a concrete plan to grow it from
today's **95 concepts** toward the ~2,300 the research target envisions.

Design background: `docs/journey/research/images.md` (the full sourcing/licensing
/pedagogy audit). Tooling: `corpan/tools/imagepan/`. Pack changelog:
`corpan/tools/imagepan/CHANGELOG.md`.

---

## 0. TL;DR

- **The whole pipeline already exists and works** — five Python scripts in
  `tools/imagepan/`. Pack **0.1.0** (95 concepts, 1.01 MB) is **live on
  CloudFront** and lights up image-choice cards OTA on app ≥ 0.20.2. Nothing is
  broken; nothing needs rebuilding to resume.
- **The single biggest blocker to "a lot more images" is NOT GPU time.** It is
  the **concept source + authoring layer**: `extract_concepts.py` reads only the
  **A0/A1** course units (142 lemmas) and ships only concepts that have a
  **hand-authored** `sense_subject` in its `CURATION` table. The 95 shipped
  concepts ARE that entire hand-written table. To scale you must (a) widen the
  concept source beyond A0/A1 units and (b) author (LLM-draft → human-verify) a
  disambiguated `sense_subject` for each new concept. The Spark run itself is the
  cheap, easy step (~30–40 s/image).
- **Secondary blocker:** the Spark (`spark-f62c`) currently needs an
  **interactive Tailscale browser re-auth**, so generation can't be launched
  non-interactively by an agent — the owner runs the two `ssh` blocks by hand.

---

## 1. How the pipeline works today (file by file, end to end)

Everything lives in `corpan/tools/imagepan/`. One locked house style, one
language-neutral pack keyed to **concepts** (EN lemma + sense), consumed by the
Journey `concept` ItemRef via picture-choice. All app-side wiring ships **inert**
and degrades to plain text cards until the pack is present.

### Stage 0 — Locked house style · `style.py`
- `STYLE_ID = "flat-vector-v1"`, a fixed `STYLE_PREFIX` ("flat vector
  illustration of a single {subject}, centered, friendly modern children's-book
  style, thick clean dark outlines, soft cel shading… no text, no words, no
  labels") and a fixed `NEGATIVE_PROMPT`.
- **Invariant:** one pack = one style. If the style changes, bump `STYLE_ID`
  **and** the pack version — a pack must be visually uniform (spaced repetition
  re-shows the same card; distractor pools assume style uniformity).

### Stage 1 — Concept extraction (local Mac) · `extract_concepts.py`
- **Source (read-only):** `word:en:<lemma>` items + concrete phrase-nouns from
  `dja/journey_pack/courses/en/units/a0-*.yaml` and `a1-*.yaml`.
- **Mechanical gate:** Brysbaert/Warriner/Kuperman (2014) concreteness
  `Conc.M ≥ 4.0` and POS ∈ {Noun, Name, Verb}. Norms `.txt` auto-downloads to
  `data/` on first run (gitignored — never ships, so its licence never
  constrains the app).
- **Authored curation layer (the bottleneck):** a concept only ships if it has a
  hand-written entry in the `CURATION` dict — `lemma → (sense_subject, domain,
  sense_gloss)`. `sense_subject` is the disambiguated diffusion subject (e.g.
  `water → "clear glass of drinking water"`), `domain` buckets the visually-
  confusable distractor pool. Colors + small numbers are force-added via
  `INCLUDE_EXTRA` (perfectly imageable despite a sub-4.0 norm). Known polysemy /
  non-visual traps are listed in `SENSE_TRAP` and deliberately excluded.
- **Output:** `concepts_a0a1.json` — **98 concepts** across 17 visual domains,
  each `{key, word, sense_subject, sense_gloss, domain, distractor_group, cefr,
  pos, concreteness, seed}`. `key == lowercased word` — this is the exact id the
  app looks up (`runtime.ts` calls `resolveItems([{kind:"concept",
  source:"imagepan", id: word.toLowerCase()}])`).
- Command: `python extract_concepts.py`

### Stage 2 — Generation (ON THE SPARK) · `gen_batch.py`
- Loads **SD3.5-Large** (`stabilityai/stable-diffusion-3.5-large`, fp16, tiled
  VAE) **once**, then loops the concept list writing `<key>_<i>.png` + a JSON
  reproducibility sidecar (prompt/seed/model/style_id/timing) per image.
- Model licence: **SD3.5-Large Stability Community License** — outputs are owned,
  commercial use OK under **$1M** annual revenue. **FLUX.1-dev is BANNED** for
  shipped assets (NC licence v1.1). Apache-2.0 alternatives (FLUX.1-schnell,
  Qwen-Image) are noted in the research doc if the $1M ceiling ever bites.
- Flags: `--num` candidates/concept, `--steps` (default 28), `--guidance-scale`
  (4.5), `--sleep` (seconds between images — the shared-box headroom knob).
- **Shared-GPU rule:** the Spark also runs Whisper alignment jobs for the AITW
  narration series. Owner rule: **never OOM the box; patience over throughput.**
  So generation is a single, sequential, `nice`-d process with a per-image sleep,
  launched only after a headroom check. SD3.5-Large needs ~18–20 GB VRAM.

### Stage 3 — Curation (owner) · `curate.py`
- Zero-dependency local `http.server` that serves a **4-up verdict page**
  (keyboard: `1–4` pick a candidate, `r` reject all, `n` request a regen).
  Verdicts stream to `verdicts.json` (`{key: {verdict:"pick"|"reject",
  candidate:0-3, …}}`). Run it against the Spark output (over Tailscale) or
  against candidates pulled down locally. **verdicts.json is the owner's
  editorial record and IS tracked in git.**

### Stage 4 — Pack build (local) · `build_image_pack.py`
- Turns `verdicts.json` + the picked candidate PNGs into the shippable pack:
  - `images/<key>.webp` — background-removed if `rembg` is installed (skipped
    gracefully otherwise), fit onto a **384×384** transparent canvas, **WebP
    q78**.
  - `data/index.sqlite3` — `pack_meta` + `concept(key, word, sense_gloss, cefr,
    domain, file, distractors_json)` + a `concept_word` index. **Column names are
    a hard contract with the app resolver — do not rename.**
  - `manifest.json` (`id:"imagepan"`, `entryType:"data"`,
    `databases:{main:"data/index.sqlite3"}`, `version`) + `ATTRIBUTION.md`.
- Only `verdict == "pick"` concepts whose source PNG exists are shipped;
  distractor lists are pruned to siblings that also shipped. A coverage +
  size-budget + `<3-distractor` report prints at the end; a missing image file
  is a **hard** validation failure.

### Stage 5 — Publish to CloudFront (owner authorizes) · `publish_image_pack.py`
- Verifies the built pack (every concept + distractor WebP present), builds a
  **byte-reproducible** zip, runs an **immutability check** (same version with
  different sha256 → hard abort; bump the manifest version instead), uploads the
  zip, and **accumulate-merges** `index.json`.
- Bucket `corpan-prod` / us-east-2, prefix `artifacts/corpan/imagepan/`, served
  at:
  - `https://d38iwc9748jekz.cloudfront.net/corpan/imagepan/imagepan-<version>.zip`
  - `https://d38iwc9748jekz.cloudfront.net/corpan/imagepan/index.json`
- `--channel preview` (default) keeps it dev-only; `--channel stable` promotes
  it. Creds: `--profile corpan-publisher` (the ~/.env `AWS_ACCESS_KEY` is stale).
  `--dry-run` prints the would-be index entry and uploads nothing.

### App-side delivery (already wired; ships inert)
- Index parser `corpan-app/src/contentPacks/imagePackCatalog.ts` polls the
  CloudFront `index.json`; `corpan-app/src/util/imagePack.ts`
  (`ensureImagePackInstalled`) lazily auto-installs on Journey session open and
  registers into the generic `store/dataPacks.ts` registry.
- Resolver `concept` arm reads `data/index.sqlite3`; assets served by the
  `corpan-pack://` scheme handler in
  `plugins/tauri-plugin-game-packs/src/lib.rs` as `image/webp`.
- `runtime.ts` upgrades a fraction of first-exposure word cards to picture-choice
  (`maybeImageChoice`) and can reveal a concept picture as the meaning
  (`maybeConceptImage`). **Graceful degrade:** no index / unreachable / install
  error → `findInstalledPack("imagepan")` stays false → plain text cards, exactly
  as before the pack existed.

### Current state (as of this doc)
- Pack **0.1.0**: 98 concepts extracted → **95 picked, 3 rejected**
  (`verdicts.json`), 1.01 MB, published **stable**, `minAppVersion` 0.20.2.
- **421 MB of A0/A1 candidate PNGs already sit on the local Mac**
  (`tools/imagepan/candidates_a0a1/`, 392 images = 98×4, untracked). The A0/A1
  tier is effectively **complete** — its images are generated, curated, shipped.

---

## 2. The scale-up problem (why 95, and what it takes to grow)

The research target (`images.md` §1.4/§4.3) is **~2,300 object images**, heavy at
A0–A1 and tapering to near-zero by B2. We ship 95. The gap is **not** GPU budget.
Three real constraints, in priority order:

**(A) Concept source is capped at A0/A1 units.** `extract_concepts.py` globs only
`a0-*.yaml` + `a1-*.yaml` (142 unique lemmas). The A2 (28) and B1 (30) units are
untapped, and — critically — the **whole 88-unit course has only 373 unique
`word:en` lemmas total.** So the course units can *never* yield 2,300 concepts.
The research's 2,300 figure comes from the **frequency-ranked wordpan corpus
(~11,757 EN words) + the 25,774-phrase corpus**, concreteness-filtered — a
different, much larger source (`dja/word_pack/extract_words.py` already builds
exactly this universe from `release.sqlite3` + phrase packs). **Scaling past a few
hundred concepts requires switching the concept source from course-units to that
frequency corpus.**

**(B) Every shipped concept needs a hand-authored `sense_subject`.** This is
deliberate (a wrong picture teaches a wrong meaning) and it is the true
bottleneck: the 95 shipped concepts equal the entire `CURATION` table. Growing to
hundreds/thousands means authoring a disambiguated, unambiguous subject phrase +
domain + gloss for each — realistically an **LLM-drafts → human-verifies** pass
(the research §4.5 step 1 calls for exactly this; a local Qwen or codex run
drafting `sense_subject`/`sense_gloss`/`distractor_group`, then owner review). No
such drafting script exists yet — it must be written.

**(C) Spark access is interactive-only right now.** `ssh spark-f62c` triggers a
`login.tailscale.com` browser re-auth, so an agent can't launch the run. The
owner runs the two generation `ssh` blocks by hand. (Fixing this = a Tailscale
auth key / non-expiring SSH, out of scope here but worth doing before a
multi-day batch.)

GPU cost for context: the full 2,300-concept × 4-candidate run ≈ 9,600 images ≈
~3.3 GPU-days on the GB10 — background-batchable, the easy part.

---

## 3. Recommended plan

### 3.1 Prioritization order (what to image first)
1. **DONE — A0/A1 survival core (95).** Numbers, colors, everyday nouns,
   greetings-adjacent objects. Already shipped in 0.1.0.
2. **Batch 2 — finish A1 + add A2 concrete vocab (→ ~0.2.0).** Author the ~47
   A0/A1 lemmas currently reported `uncurated` by `extract_concepts.py` that are
   *actually* imageable (not in `SENSE_TRAP`), then extend the glob to `a2-*.yaml`
   and author its concrete nouns/verbs. Realistic yield: **~150–250 net-new
   concepts.** This is the highest-value next tier — it directly covers the words
   the learner meets right after the opening arcs.
3. **Batch 3+ — frequency-ranked concrete corpus (→ 0.3.0 … toward 2,300).**
   Switch the source to `dja/word_pack/extract_words.py`'s universe, keep only
   `Conc.M ≥ 4.0` Noun/Verb lemmas, rank by corpus frequency, and author in
   descending-frequency tiers of ~300. Stop where images stop earning their place
   (B1 tail; §1.3 abstract/relational/near-synonym words never get a picture).

### 3.2 Recommended FIRST batch (concrete)
**Batch 2 = "finish A1 + reach into A2." ~250 concepts target, ~1,000 candidate
images (4 each), ~1 GPU-day of compute** (longer wall-clock with the shared-box
sleep — fine, it can run for days). ~3–4 MB added to the pack. Ships as
**imagepan 0.2.0**. Rationale: it is the smallest step that visibly delivers "a
lot more images," reuses the pipeline unchanged except the concept source, and
front-loads the vocabulary the learner hits next.

### 3.3 Batch strategy & style consistency
- Keep `STYLE_ID = flat-vector-v1` and the **same seeds discipline** so 0.2.0 is
  visually indistinguishable from 0.1.0 (do **not** bump `STYLE_ID` — that would
  force a full regen of the shipped 95 for uniformity).
- Generate 4 candidates/concept, distinct seeds; single sequential `nice`-d
  process with `--sleep 3`.
- Curate in the same 4-up page; **bad images must not ship** — the `pick`/`reject`
  gate + the build's hard "missing file" failure + the `<3-distractor` report are
  the quality gates. Reject anything mislabeled, miscounted (numbers!), or
  off-sense; request a regen rather than shipping a marginal card.

### 3.4 Versioning / republish
- Zips are **immutable**; ship changes by bumping `manifest.json` `version`
  (0.1.0 → 0.2.0) in `build_image_pack.py`'s `MANIFEST` and the `pack_meta`
  version, rebuild, `--dry-run`, then `--channel stable`. `index.json`
  accumulate-merges, so the app picks up the new version OTA (no app release).
- Add a dated entry to `tools/imagepan/CHANGELOG.md` (per `corpan/CHANGELOGS.md`).

---

## 4. Exact commands to resume generation (copy-pasteable)

> Run from `corpan/tools/imagepan/` on the local Mac, except the two `ssh` blocks
> which run in an **already-authenticated** Tailscale shell (the owner completes
> the `login.tailscale.com` browser re-auth first). Respect the shared-GPU rule.

```bash
# ── 0. (Batch 2 authoring — one-time, before generating) ──────────────────────
#   Extend the concept source + author sense_subjects. Today extract_concepts.py
#   globs only a0-*/a1-*; for Batch 2 add a2-*.yaml and author the new + the ~47
#   currently-uncurated A0/A1 lemmas in the CURATION table. See the report the
#   script already prints:
python extract_concepts.py            # prints shipped / uncurated / sense-trap lists
#   -> edit CURATION (and the UNITS glob for A2) in extract_concepts.py, re-run
#      until concepts_a0a1.json holds the Batch-2 concept set. (A frequency-corpus
#      + LLM-draft path for Batch 3 must still be BUILT — see §2(B).)

# ── 1. HEADROOM CHECK on the Spark — do NOT launch if tight ───────────────────
ssh spark-f62c 'nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv;
                free -g | head -2;
                nvidia-smi | grep -E "python|whisper" || echo "no gpu python procs"'
#   SD3.5-Large needs ~18-20 GB VRAM. If Whisper alignment leaves < ~24 GB free
#   VRAM or the box is swapping: STOP, run after those jobs finish.

# ── 2. Push tools + the concept list to the Spark ─────────────────────────────
rsync -av style.py gen_batch.py concepts_a0a1.json spark-f62c:~/projects/image-gen/

# ── 3. Launch: 4 candidates/concept, ONE sequential nice'd process, 3s sleep ──
ssh spark-f62c 'cd ~/projects/image-gen && mkdir -p imagepan_batch2 && \
  nohup nice -n 15 .venv/bin/python gen_batch.py concepts_a0a1.json \
    --out imagepan_batch2 --num 4 --sleep 3 \
    > imagepan_batch2/run.log 2>&1 &'

# ── 4. Verify it started (do NOT block on it) ─────────────────────────────────
ssh spark-f62c 'sleep 120; ls imagepan_batch2/*.png | head; tail -5 ~/projects/image-gen/imagepan_batch2/run.log'

# ── 5. CURATE (after the run; pick the simpler path) ──────────────────────────
#   A) run the verdict page ON the Spark over Tailscale (no data copy):
ssh spark-f62c 'cd ~/projects/image-gen && python3 -' < curate.py   # then open http://spark-f62c:8765/
#   B) or pull candidates down and curate locally:
rsync -av spark-f62c:~/projects/image-gen/imagepan_batch2/ ./candidates_a0a1/
python curate.py --candidates ./candidates_a0a1 --concepts concepts_a0a1.json  # http://localhost:8765/

# ── 6. BUILD the pack (bump manifest version to 0.2.0 first) ──────────────────
python build_image_pack.py --candidates ./candidates_a0a1 \
    --verdicts verdicts.json --concepts concepts_a0a1.json --out ./dist/imagepan

# ── 7. PUBLISH (owner authorizes) ─────────────────────────────────────────────
python publish_image_pack.py --dry-run                        # inspect the entry
python publish_image_pack.py --channel stable --profile corpan-publisher
```

---

## 5. Honest gaps & risks

- **No frequency-corpus concept extractor yet (Batch 3+).** `extract_concepts.py`
  is hard-wired to course units. The ~2,300 vision needs a new extractor over
  `dja/word_pack/extract_words.py`'s universe **plus an LLM-draft →
  human-verify** `sense_subject` authoring pass. That authoring pass, not GPU
  time, is the schedule driver. **This is the main thing that must be built.**
- **Authoring is inherently manual/curated.** Sense disambiguation, culturally
  neutral vs. target-culture prototypes, and distractor grouping are editorial
  judgments (§1.3/§1.5 of the research). An LLM can draft; a human must verify —
  wrong pictures actively harm learning.
- **Spark is interactive-only + shared.** The Tailscale browser re-auth blocks
  agent automation; the Whisper jobs mean patience-over-throughput. A long batch
  is days of wall-clock. Consider a non-expiring Tailscale auth key before a
  multi-day run.
- **Style drift across batches.** Different diffuser/torch versions or a model
  re-pull on the Spark can shift the look even at a fixed prompt/seed. Keep the
  `.venv` pinned; spot-check a few 0.1.0 concepts regenerate identically before a
  big batch. If the look moves, you must bump `STYLE_ID` **and regen the whole
  pack** for uniformity — expensive, so guard against it.
- **Numbers/counts are the classic failure.** Diffusion miscounts dots; the
  number/color cards need especially careful curation (reject aggressively).
- **Licence ceiling.** SD3.5-Large outputs are owned under **$1M** revenue; if
  Corpora crosses that, an Enterprise licence is needed for *continued model use*
  (already-shipped outputs stay owned). Apache-2.0 models (FLUX.1-schnell,
  Qwen-Image) are the escape hatch — but switching models = a new `STYLE_ID` and
  a full regen.
- **Storage.** 421 MB of A0/A1 candidates already sit locally (gitignored);
  candidate PNGs for larger batches will be multi-GB on both the Spark and the
  Mac. Only the curated WebP + verdicts.json persist; plan to prune candidates.
- **Size budget on device.** The full set is ~55 MB WebP (research §4.6) — in
  family with the 46.8 MB phrase DB, but it is a JIT download; keep the A1 tier
  small enough to feel instant and let the long tail stream.

---

## 6. Bottom line for the CTO

1. **Generation works today and lives in `corpan/tools/imagepan/`** (5 scripts +
   locked style). Pack 0.1.0 (95 concepts) is live on CloudFront and lights up
   Journey image-choice OTA. You can "turn it back on" for more A1/A2 concepts
   **with the existing tooling unchanged** — only the concept list changes.
2. **Biggest blocker = concept source + authoring, not GPU.** Course units cap at
   373 lemmas total; the 95 shipped = the entire hand-authored `CURATION` table.
   Real scale needs a new frequency-corpus extractor + an LLM-draft/human-verify
   `sense_subject` pass (to be built). The Spark run is cheap (~30–40 s/image).
3. **Recommended first batch:** finish A1 + reach into A2 → **~250 concepts,
   ~1,000 candidate images, ~1 GPU-day**, ship as **imagepan 0.2.0** (~+3–4 MB).
   Highest value, zero new tooling.
4. **Tooling to just "turn it on":** ✅ present for course-unit-sourced batches
   (Batches 1–2). ❌ **must be built** for the frequency-corpus path to thousands
   (the extractor + sense authoring). Plus a Spark Tailscale auth fix so a
   multi-day batch can run unattended.
</content>
