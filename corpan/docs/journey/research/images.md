# Offline Image Strategy for Journey Mode — "imagepan"

**Author:** visual-content lead (research subagent) · **Date:** 2026-07-03 · **Branch:** `journey`
**Status:** research input to chief architect. Verified against the repo and live web sources; license claims cited precisely because these ship in a commercial app.

---

## 0. Executive verdict (one paragraph)

Corpan should ship images as a **single language-neutral content pack kind ("imagepan")** — one global pack usable by all 54×54 course pairs, because images are keyed to *concepts*, not languages. The primary sourcing path is **generate-once-on-the-Spark, ship-forever**: the box already has a working SD3.5-Large pipeline (`/home/skyl/projects/image-gen`), whose Community License grants output ownership and commercial use under $1M revenue. Openly-licensed sets (OpenMoji, Twemoji, game-icons.net) are viable *fallback/accent layers* but none covers 2–5k concrete vocabulary items in one consistent, learner-appropriate style. **On-device generation on phones is a gimmick for pedagogy** — 1–2 GB of weights, 5–10 s latency, and nondeterministic output breaks the "picture = meaning" contract; that budget is better spent on Qwen3/Whisper. Target: **~2,300 object images + ~50 labeled hotspot scenes ≈ 55–60 MB WebP**, heavy at A0–A1, tapering to near-zero by B2.

---

## 1. Pedagogy — where pictures genuinely help, and where they don't

### 1.1 The science, briefly
- **Dual coding / picture superiority effect**: pairing a word with a picture creates two retrieval routes (verbal + imaginal); recall gains are large and robust for *imageable* words. This is the single best-replicated result in vocabulary-learning research.
- **Direct-method meaning conveyance**: a picture lets the learner map L2 form → meaning **without routing through L1**. For Journey this matters doubly: (a) it produces stronger L2-direct links than translation pairs, and (b) it is the only L1-free option at A0 where the learner can't yet read L2 definitions. It also collapses authoring cost: one image serves all 54 native languages, whereas an L1 gloss must exist 54 times.
- **Testing formats**: picture-choice (hear/read word → pick 1 of 4 images) and its inverse are low-friction retrieval events with built-in distractor difficulty control — ideal feed cards (`NORTH_STAR.md` principle 8 already reserves this slot).
- **Imageability is the gate.** Concreteness norms (Brysbaert, Warriner & Kuperman 2014: ~40k English lemmas rated 1–5) are the practical filter. Words ≥ ~4.0 (dog, bridge, to pour) image reliably; 3.0–4.0 (weather, breakfast, to visit) need careful scene-style depiction; < 3.0 (although, justice, would) should **never** get a "meaning picture." The norms are freely downloadable supplementary data and are used only at *build time* on the Spark — nothing from them ships, so their license doesn't constrain the app.

### 1.2 Where images genuinely help (invest here)
| Category | Examples | Exercise fit |
|---|---|---|
| Concrete nouns | animals, food, objects, body parts, clothing, vehicles, nature | picture-choice both directions; flashcard face |
| High-imageability verbs | eat, run, open, pour, cut (depicted mid-action) | picture-choice; "which picture shows *she is pouring*" for aspect/tense contrast |
| Spatial prepositions & relations | on/under/between/behind | minimal-pair diagrams (same objects, different arrangement) — one of the few places images teach *grammar* |
| Colors, shapes, numbers, sizes | | trivially and perfectly |
| Adjective contrasts | big/small, hot/cold, open/closed | paired-panel images |
| Scene vocabulary | kitchen, street, market, airport, body, classroom | labeled-hotspot scenes ("find the faucet"), description speaking prompts |
| Comprehension anchors in readers | one scene image per story chapter | comprehensible-input support, not testing |

### 1.3 Where images don't help (do not spend budget)
- **Abstract vocabulary** (justice, opinion, although, despite) — any picture is a riddle, and a *misleading image is worse than no image*: the learner encodes the wrong sense.
- **Function words, connectives, morphology, most grammar** — picture-based grammar teaching beyond spatial/aspect contrasts is a Rosetta Stone-era dead end.
- **Near-synonym discrimination** (stroll vs. saunter) — the picture can't carry the distinction; that's wordpan's job (the 11,757-word explanation corpus).
- **B2+ vocabulary generally** — by then the learner reads L2 definitions; the ~50-word wordpan paragraphs are pedagogically superior. Images at B2+ survive only as *speaking/writing prompts* (describe this scene), where richness, not precision, is the point.
- **Polysemy traps**: "bank," "date," "light" need *sense-level* keys, not word-level. The pack schema below keys images to (lemma, sense-gloss), never to bare strings.
- **Cultural specificity**: "bread," "breakfast," "wedding" look different across the 54 native languages. Rule: depict the *target-language culture's* prototype (it's a course about the target language/culture), or choose culturally-neutral compositions; never mix.

### 1.4 Quantitative implication
Of the ~11,757-word EN pivot corpus (`docs/journey/codebase/content-data.md:106`), concreteness-filtering will yield roughly 3–4k image-eligible lemmas; intersecting with A0–B1 frequency bands lands in the **1,800–2,500** range — comfortably inside the "2–5k" hypothesis in the task brief. This is a *finite, one-time* content project, not an ongoing pipeline.

---

## 2. Sourcing options for an offline image pack

### 2.1 License audit of candidate open sets (verified 2026-07)

| Source | License (exact) | Count / style | Verdict for shipping in a commercial pack |
|---|---|---|---|
| **OpenMoji** | **CC BY-SA 4.0** — commercial use OK; attribution required ("All emojis designed by OpenMoji…" in About screen); ShareAlike binds only *modified emoji*, not the app ([FAQ](https://openmoji.org/faq/), [issue #155](https://github.com/hfg-gmuend/openmoji/issues/155)) | ~4,300 SVGs, single hand-drawn outline style, includes non-Unicode extras | ✅ Usable. Best *consistent-style* open set. SA is a mild irritant if we recolor (modified glyphs must be republished CC BY-SA — trivial to comply: publish our recolored set). |
| **Twemoji (jdecked fork)** | Graphics **CC-BY 4.0**, code MIT; fork actively maintained (v17.x, 2026) ([LICENSE-GRAPHICS](https://github.com/jdecked/twemoji/blob/main/LICENSE-GRAPHICS), [repo](https://github.com/jdecked/twemoji)) | ~3,700 SVGs, flat colorful | ✅ Usable with attribution. No ShareAlike. |
| **Noto Emoji (Google)** | Apache 2.0 (fonts under OFL) | ~3,600, flat | ✅ Cleanest license of the emoji sets. |
| **game-icons.net** | **CC BY 3.0**, per-author attribution ("Icons made by {author}, available on game-icons.net") ([about](https://game-icons.net/about.html), [FAQ](https://game-icons.net/faq.html)) | 4,180 monochrome SVGs, RPG/game aesthetic | ✅ Usable; great for *game-pack UI* (lingo-hero, corpan-city), wrong aesthetic for meaning-cards (sword-and-sorcery vibe, monochrome silhouettes ambiguous for A0 learners). |
| **Wikimedia Commons** | **Per-file** — mix of PD, CC0, CC BY, CC BY-SA (incl. 2.0/3.0 variants with differing attribution rules) | ~100M files, zero style consistency | ⚠️ Usable only with per-file license/author capture in the DB and generated ATTRIBUTION manifest. Photographic realism is pedagogically fine but the style chaos is jarring in a feed. Best reserved for encyclopedic needs (specific animals, landmarks, foods). |
| **Openverse** | **Not a license** — a search engine over ~800M nominally-CC works; metadata is scraped and *not guaranteed accurate* (their own ToS disclaims it) | — | ⚠️ Use as a *finder*, then verify license at the source before ingesting. Never bulk-trust. |
| **LibreShot** | CC0-equivalent ("copyright-free," commercial, no attribution) but **ToS forbids mass download / redistributing a big part of the collection** ([license page](https://libreshot.com/license-information/)) | few thousand photos, one photographer | ⚠️ Fine for onesie-twosie photos; a bulk-ingested pack skirts their anti-redistribution clause. Low value anyway (landscape-heavy). |
| **OpenClipart** | CC0 | ~170k clipart, wildly inconsistent quality/style | ⚠️ License perfect, curation cost high. |
| **Kenney.nl** | CC0 | game asset packs, consistent within packs | ✅ For mini-game art, not vocab cards. |
| **unDraw** | custom open license (free commercial, no attribution) | ~1,600 flat illustrations, single style, single accent color | ⚠️ Conceptual scenes ("team meeting"), almost no concrete-noun coverage. |
| **Unsplash / Pexels / Pixabay** | Custom licenses that **prohibit redistributing photos as a competing collection/dataset** — a downloadable image *pack* is plausibly exactly that | huge | ❌ **Do not ship.** The app-embedding carve-outs don't clearly cover redistributable content packs. Not worth the legal ambiguity. |
| **Icon systems** (Material Symbols Apache-2.0, Phosphor MIT, Lucide ISC, Tabler MIT) | permissive | thousands, UI-centric | ✅ For UI chrome; concrete-noun coverage too thin for vocab. |

**Compliance mechanics regardless of source:** every image row carries `license`, `author`, `source_url` columns; the pack build emits an `ATTRIBUTION.md` bundled in the pack + surfaced in the app About screen. This satisfies CC BY/BY-SA "reasonable manner" attribution ([OpenMoji FAQ](https://openmoji.org/faq/)) and is per existing memory rule *no absolutes in marketing* — say "openly licensed," don't say "no rights issues ever."

### 2.2 The gap no open set fills
No existing openly-licensed set delivers **2–5k concrete-vocabulary depictions in one consistent, friendly, unambiguous style at learner-card quality**. Emoji sets top out around 1,000–1,500 genuinely useful noun/verb depictions and are stylistically tiny (designed for 18px, ambiguous at card size for A0 disambiguation — is 🦭 a seal or a sea lion?). Photo sources have license or consistency problems. This is precisely the shape of problem **generate-once-ship-forever** solves, and the Spark is already tooled for it (§3.2).

### 2.3 Recommended sourcing stack (layered)
1. **Primary (≥90% of cards): Spark-generated illustration set** in one locked house style (§4.4) — SD3.5-Large or an Apache-2.0 model. Zero attribution burden, infinite style consistency, exact sense control via prompt, regenerable forever.
2. **Fallback/accent: OpenMoji or Noto Emoji** for tiny inline glyphs (feed card badges, domain icons, lingo-hero note icons) where card-quality art is overkill.
3. **Surgical: Wikimedia Commons (verified per-file)** for the handful of concepts where photographic reality matters (specific landmarks, culturally specific foods) — with full per-file license capture.
4. **Never:** Unsplash/Pexels/Pixabay in redistributable packs; Openverse results without source-verification.

---

## 3. Generation feasibility

### 3.1 On-device generation on phones (2026): viable tech, wrong tool
**State of the art:** SD 1.5-class models run genuinely on-device today. Snapdragon NPUs (QNN) do 512×512/20-step in **5–10 s** on 8 Gen 1+ (apps: [Local Dream](https://github.com/xororz/local-dream), Off Grid); CPU-only is 15–30 s with thermal/battery pain; Qualcomm has demoed **sub-second** SD on 8 Gen 3 with heavy distillation ([Hackster](https://www.hackster.io/news/qualcomm-promises-to-power-on-device-ai-with-snapdragon-8-shows-off-sub-second-stable-diffusion-419332bfa9ef)); SDXL-class needs 8 Gen 3+. Apple Core ML SD runs at similar few-second latencies on A17/M-series. Quantized weights are **1–2 GB**.

**Why it's still a gimmick for Journey:**
- **Pedagogical correctness is the product.** A meaning-card image must depict *exactly* the sense being taught. Diffusion at mobile-distilled quality misdraws hands, counts, and rare objects; a wrong picture teaches a wrong meaning. Curation is the value, and curation happens offline, once.
- **Weight budget collision.** 1–2 GB fights Qwen3-4B (~2–3 GB Q4), Whisper, and TTS on the same phones. 55 MB of curated WebP beats 1.5 GB of generator + nondeterminism by ~27×.
- **Consistency impossible on-device.** 54 courses need the *same* picture for the same concept (spaced repetition re-shows it; distractor pools depend on style uniformity).
- **Battery/thermal + Android device spread** (NPU path only on recent Snapdragons; Corpan targets broad devices).

**Where on-device gen could someday earn a slot (non-core, post-v1):** a "reward card" novelty ("your streak forged this image"), or user-personalized mnemonic images. Treat as a future experiment pack, never a curriculum dependency.

### 3.2 Generation on the Spark: tooling already exists
`/home/skyl/projects/image-gen` (see `PROJECT_SETUP.md`):
- Working venv (`.venv`, PyTorch 2.10 cu130 — do not recreate), `scripts/generate.py` (SD3.5-Large, seeds, JSON reproducibility sidecars per image), `scripts/img2img.py`.
- **Models already in HF cache:** `stabilityai/stable-diffusion-3.5-large`, `stabilityai/stable-diffusion-xl-base-1.0` (verified in `~/.cache/huggingface/hub`).
- A proven **batch book-illustration pipeline** with style-prefix prompts, per-image config, ControlNet: `scripts/generate_monte_alban_v2.py` (41 KB) and `generate_monte_alban_flux.py` (FLUX.1-dev + Canny ControlNet, `STYLE_PREFIX` pattern at line ~47) — directly reusable skeleton for a vocab-image batcher.

**Model licensing for generated outputs (critical):**
- **SD3.5-Large — Stability Community License**: free commercial use under **$1M annual revenue**; **"You own outputs… use at your discretion"** ([license](https://huggingface.co/stabilityai/stable-diffusion-3.5-large/blob/main/LICENSE.md), [stability.ai/license](https://stability.ai/license)). ✅ Recommended. Caveat: if Corpora ever crosses $1M revenue, an Enterprise License is needed *for continued model use* — already-generated shipped outputs are owned, but plan the crossing.
- **FLUX.1-dev — do NOT use for shipped assets.** Its Non-Commercial License **v1.1 (2025-06) removed the commercial-outputs allowance** and now defines non-commercial to exclude "direct or indirect payment arising from use of Outputs" ([BFL terms](https://bfl.ai/legal/non-commercial-license-terms), [HF discussion](https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev/discussions/6)). The monte-alban FLUX script stays research-only.
- **Fully clean alternatives (no revenue ceiling):** FLUX.1-schnell (Apache 2.0) and Qwen-Image (Apache 2.0) — worth a bake-off for the house style; Apache 2.0 removes even the $1M contingency.
- Note: pure-AI outputs likely carry **no copyright** in the US — fine for us (we don't need to enforce), just means the set is copyable by others. Human curation/selection/compilation still earns compilation protection.

---

## 4. Concrete proposal: the **imagepan** pack

### 4.1 Shape: ONE language-neutral pack (+ optional culture variants)
Images key to **concepts (EN-pivot lemma + sense gloss)**, exactly as wordpan keys to EN words. Labels in any language come from the existing translation corpus at runtime. Therefore: **one global `imagepan-core` pack serves all courses** — no per-pair fan-out (contrast: wordpan's 54 per-pair packs). Optional later: small per-target-culture overlay packs (`imagepan-culture-ja`: bento, torii…) that add/override concepts.

Distribution follows the wordpan precedent (`MEMORY: word-explanation packs`): S3 `artifacts/corpan/word-packs/`-style prefix → `artifacts/corpan/image-packs/` + its own `index.json`, discovered via settings/JIT; **not** in the main narration catalog. Manifest follows `packs/PACK_DEV.md §2` with `entryType: "data"` and `databases: {"main": "data/images.sqlite3"}`, mirroring `packs/wordpan/manifest.json`.

### 4.2 Pack format (SQLite, blobs in-DB for atomicity; served via `hostApi.queryPackDb`)
```sql
pack_meta(id, version, schema_version, name, style_id, image_count, scene_count, authored_at)

concept(
  id INTEGER PK,               -- stable forever, like phrase-pack entry ids
  en_lemma TEXT NOT NULL,      -- EN pivot, joins to cor_translation / wordpan
  sense_gloss TEXT,            -- disambiguates polysemy: "bank (river)" vs "bank (money)"
  pos TEXT,                    -- noun/verb/adj/prep
  concreteness REAL,           -- Brysbaert norm, build-time provenance
  cefr_band TEXT,              -- A0..B1 (image-eligible bands)
  domain_codes TEXT            -- joins to the 13 Domain codes
);

image(
  id INTEGER PK, concept_id INT REFERENCES concept,
  kind TEXT CHECK(kind IN ('object','action','contrast','scene')),
  webp BLOB NOT NULL, width INT, height INT,
  license TEXT NOT NULL, author TEXT, source_url TEXT,  -- 'generated-sd35' for house set
  gen_meta TEXT                -- JSON: prompt, seed, model — reproducibility, mirrors image-gen sidecars
);

scene(id INTEGER PK, image_id INT, slug TEXT, cefr_band TEXT);   -- kitchen, street, market…
hotspot(scene_id INT, concept_id INT, x REAL, y REAL, w REAL, h REAL,  -- normalized 0..1
        PRIMARY KEY(scene_id, concept_id)) WITHOUT ROWID;

distractor_group(concept_id INT, distractor_concept_id INT, difficulty INT);
  -- curated confusables for picture-choice: easy = different domain, hard = same domain (cat/dog/fox)
```
PRAGMA `application_id`/`user_version` per the phrase-pack convention (`tools/phrase-packs/build_phrase_pack.py::_write_schema`).

**Activity-contract hooks this format enables** (all language-neutral providers for the Journey spine):
1. `picture_choice_receptive` — hear/read L2 word → pick 1 of 4 images (distractor_group drives difficulty).
2. `picture_choice_productive` — see image → pick/type/say the L2 word (STT via pronunciation-coach).
3. `scene_find` — "find the faucet" → tap hotspot; one scene yields 15–25 cards.
4. `contrast_grammar` — preposition/aspect minimal-pair panels.
5. `describe_scene` — B1+ speaking/writing prompt (LLM-judged via tutomaton).
6. Mini-game skins: memory-match, lingo-hero lane icons, juice-squeeze targets.

### 4.3 Curriculum-band coverage (heavy at A1, tapering)
| Band | Concepts with images | % of band's vocab cards carrying an image |
|---|---|---|
| A0–A1 | ~800 | 60–80% (survival vocab is overwhelmingly concrete) |
| A2 | ~700 | ~40% |
| B1 | ~600–800 | ~20% |
| B2+ | ~0 new objects; scenes only | <5% (description prompts) |
| Scenes | ~50 scenes × 15–25 hotspots | spread A0–B1 |

**Total: ~2,300 object/action images + ~50 scenes ≈ 2,400 images** — within the 2–5k envelope; every image earns its place via concreteness ≥4.0 (objects) or curated scene membership.

### 4.4 Style guide (locked before batch generation; one `style_id` per pack version)
- **One style**: flat, friendly, soft-shaded vector-look illustration; thick clean outlines; 2–3 value shading; consistent limited palette harmonized with the app theme; **transparent/plain background for object cards** (subject fills ~70% of frame, centered).
- **No text in images, ever** — text is unlocalizable across 54 UI languages and diffusion mangles it anyway.
- **No brands, logos, real-person likenesses, flags-as-decoration**; culturally neutral defaults, target-culture prototypes only in culture overlay packs.
- **Actions**: single actor mid-action, motion cues, gender/ethnicity-varied across the set as a whole.
- **Contrast pairs**: identical composition except the contrasted feature.
- Mechanically enforced via a fixed `STYLE_PREFIX` + negative prompt + narrow seed policy (the pattern already proven in `generate_monte_alban_flux.py`), plus img2img style-transfer passes for outliers.

### 4.5 Spark pipeline sketch (build once, iterate cheaply)
1. **Concept extraction** (`dja` script): join 25,774-phrase corpus + 11,757-word corpus (`content-data.md:77-106`) against Brysbaert concreteness norms; filter ≥4.0 & CEFR ≤ B1; LLM pass (local Qwen or codex, per cost-discipline ladder) to assign sense_gloss + distractor groups → `concepts.json`.
2. **Prompt templating**: `STYLE_PREFIX + sense-specific description + negative prompt`; 4 candidates per concept, distinct seeds; SD3.5-Large on the Spark (reuse `scripts/generate.py` batching + JSON sidecars). ~2,400 concepts × 4 ≈ 9,600 images; at ~30 s/image on the GB10 that's ~3.3 GPU-days — run as background batches like TTS fanouts (check `nvidia-smi` first per house rule).
3. **Auto-QA**: SigLIP/CLIP image↔caption agreement score to auto-reject off-concept candidates; duplicate-style outlier detection.
4. **Human verdict page**: `http.server` on `0.0.0.0`, tailscale URL (`http://spark-f62c:PORT/`), 4-up pick-or-regenerate per concept — per the *build a test page when unsure* and *tailscale* memory rules. Human ear→eye: verdicts are calibration data.
5. **Post-process**: background removal (rembg) for object cards → resize (objects 384×384, scenes 768×512) → **WebP q75–80** (~15–25 KB objects, ~50–70 KB scenes).
6. **Pack build** (`dja/image_pack/build_image_pack.py`, modeled on `dja/word_pack/build_word_pack.py`): sqlite + manifest + ATTRIBUTION.md → zip → S3 `artifacts/corpan/image-packs/` + index.json. 100% coverage audit before publish (*only perfection ships*).

### 4.6 Size budget
| Component | Count | Per-item | Subtotal |
|---|---|---|---|
| Object/action WebP 384px | ~2,300 | ~20 KB | ~46 MB |
| Scenes WebP 768px | ~50 | ~60 KB | ~3 MB |
| Contrast panels | ~150 | ~25 KB | ~4 MB |
| SQLite overhead + metadata | | | ~2 MB |
| **imagepan-core total** | | | **~55 MB** |

Optionally split: `imagepan-a1` (~800 images, **~18 MB**, bundled or first-download) + `imagepan-full` (~55 MB, JIT). Context: the bundled phrase DB is 46.8 MB (`content-data.md:40`); a 55 MB downloadable pack is in-family. WebP is already compressed — no zip savings; ship zip for structure only.

### 4.7 What NOT to do
- ❌ Ship an on-device generator as a curriculum dependency (§3.1).
- ❌ Bulk-ingest Unsplash/Pexels/Pixabay/LibreShot into a redistributable pack (license/ToS conflicts, §2.1).
- ❌ Use FLUX.1-dev outputs in shipped packs (license v1.1 ambiguity, §3.2).
- ❌ Per-language image packs — images are language-neutral; 54× duplication would be pure waste.
- ❌ Attach images to abstract/B2+ vocabulary "for polish" — wrong pictures actively harm encoding (§1.3).
- ❌ Bake text into images.

---

## 5. Open questions for the architect
1. **Blob-in-SQLite vs. loose WebP files + JSON index**: `hostApi.queryPackDb` makes blobs clean (one file, atomic versioning), but the webview needs blob→objectURL plumbing; static files ride the existing pack asset-serving path (`PACK_DEV.md §1 public/`). Needs a perf spike on low-end Android (recommend: spike both, measure decode + memory).
2. **Where does the imagepan provider live** — as a pack implementing the activity contract, or as host-app-native exercise types consuming a data-only pack (wordpan precedent suggests the latter)?
3. **House-style bake-off**: SD3.5-Large vs FLUX.1-schnell vs Qwen-Image (both Apache 2.0 candidates avoid the $1M Stability contingency) — needs a 20-concept sample sheet + human verdict page.
4. **Culture overlays**: v1 ships neutral-only, or does journey-ja/zh/ar need culture packs at launch?
5. **Sense inventory ownership**: sense_gloss should probably become an authoring-side (`dja`) model so wordpan, imagepan, and the course spine share one concept registry — who owns that migration?
6. **Concreteness norms for non-EN pivots**: EN norms suffice while EN is the pivot, but "image-eligible" judgments could drift for target languages with different lexicalization (e.g., ZH classifiers) — revisit at course-authoring time.

---

## Appendix A — Repo facts this report relies on
- `/home/skyl/projects/image-gen/PROJECT_SETUP.md` — SD3.5-Large pipeline, venv, Community License note, reproducibility sidecars.
- `/home/skyl/projects/image-gen/scripts/` — `generate.py`, `img2img.py`, `generate_monte_alban_v2.py`, `generate_monte_alban_flux.py` (STYLE_PREFIX + ControlNet batch pattern, lines 1–50).
- `~/.cache/huggingface/hub` — SD3.5-large + SDXL-base already cached on the Spark.
- `/home/skyl/encorpora/corpan/docs/journey/NORTH_STAR.md` — principle 8 (images enter the arsenal), principle 6 (content is packs).
- `/home/skyl/encorpora/corpan/docs/journey/codebase/content-data.md` — corpus counts (lines 77–91: 25,774 phrases × 54 langs; line 106: 11,757 words), release DB 46.8 MB (line 40), phrase-pack schema (lines 44–57), wordpan pack layout (lines 106–119).
- `/home/skyl/encorpora/corpan/packs/PACK_DEV.md` — pack anatomy, manifest contract, `queryPackDb`.
- `/home/skyl/encorpora/corpan/packs/wordpan/manifest.json` — `entryType:"data"` + `databases` precedent.
- Verified current app packs ship **no images** beyond UI (e.g., `packs/lingo-hero/assets/` contains only `audio/` + `fonts/`).

## Appendix B — License sources (retrieved 2026-07-03)
- OpenMoji CC BY-SA 4.0 + attribution guidance: https://openmoji.org/faq/ ; https://github.com/hfg-gmuend/openmoji/issues/155
- Twemoji graphics CC-BY 4.0, maintained fork: https://github.com/jdecked/twemoji ; https://github.com/jdecked/twemoji/blob/main/LICENSE-GRAPHICS
- game-icons.net CC BY 3.0 (per-author attribution): https://game-icons.net/about.html ; https://game-icons.net/faq.html
- LibreShot CC0-equivalent + anti-mass-download ToS: https://libreshot.com/license-information/
- Stability Community License (SD3.5, <$1M revenue, output ownership): https://stability.ai/license ; https://huggingface.co/stabilityai/stable-diffusion-3.5-large/blob/main/LICENSE.md
- FLUX.1-dev Non-Commercial License v1.1 outputs ambiguity: https://bfl.ai/legal/non-commercial-license-terms ; https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev/discussions/6
- On-device SD on phone NPUs (5–10 s SD1.5 512px; sub-second demos): https://github.com/xororz/local-dream ; https://www.hackster.io/news/qualcomm-promises-to-power-on-device-ai-with-snapdragon-8-shows-off-sub-second-stable-diffusion-419332bfa9ef
