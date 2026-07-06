# imagepan — concept image pack pipeline (bootstrap)

Build-once, ship-forever image pack for Journey. Design: `corpan/docs/journey/research/images.md`.
One **language-neutral** pack keyed to concepts (EN lemma + sense), consumed by the
`concept` ItemRef kind (`contentPacks/activityContract.ts`) via picture-choice
(`choice_pick` + `media:'image'`, params-gated on imagepan presence — feed-ux §4).

## Files here
- `style.py` — the LOCKED house style (`STYLE_ID`, `STYLE_PREFIX`, `NEGATIVE_PROMPT`).
  Bump `STYLE_ID` + pack version if you change it; a pack must be one consistent style.
- `concepts_a0_proof.json` — 12 core A0 nouns (proof slice). Full runs use a
  concreteness-gated concept list extracted from `dja/journey_pack/courses/en/units/`.
- `gen_batch.py` — loads SD3.5-Large ONCE, loops concepts, writes PNG + JSON
  reproducibility sidecar. Runs **on the Spark** (`spark-f62c`, NVIDIA GB10), not locally.

## Generation (on the Spark)
Local Mac has no CUDA/diffusers. Generate over Tailscale SSH:
```
scp gen_batch.py style.py concepts_a0_proof.json skyl@spark-f62c:~/projects/image-gen/
ssh skyl@spark-f62c 'cd ~/projects/image-gen && \
  nohup .venv/bin/python gen_batch.py concepts_a0_proof.json --out imagepan_proof \
  > imagepan_proof/run.log 2>&1 &'
# ~41s/image on the GB10 at 1024px/28 steps, fp16, guidance 4.5.
scp 'skyl@spark-f62c:~/projects/image-gen/imagepan_proof/*.png' ./proof_out/
```
Model = SD3.5-Large (Stability Community License; outputs owned, commercial OK
< $1M revenue). **FLUX.1-dev is BANNED for shipped assets** (NC license v1.1).

## Not yet built (see report / research/images.md §4.5)
- Concept extraction (`concepts.json` gen): join phrase+word corpus × Brysbaert
  concreteness norms (download separately — NOT in repo), filter ≥4.0 & CEFR ≤ B1,
  assign sense_gloss + distractor groups.
- Auto-QA (SigLIP/CLIP caption-agreement), human 4-up verdict page (http.server + tailscale).
- Post-process: rembg background removal → resize (obj 384², scene 768×512) → WebP q75-80.
- Pack build (`build_image_pack.py`, model on `dja/word_pack/build_word_pack.py`):
  sqlite + manifest (`entryType:"data"`) + ATTRIBUTION.md → S3 `artifacts/corpan/image-packs/`.
