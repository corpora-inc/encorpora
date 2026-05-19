# Phrase-pack authoring & publishing — agent handoff

This is a self-contained guide for an outside agent (you) to spin out
Corpán **phrase packs** — modular text-only corpora that the app downloads
and queries alongside its bundled corpus — and publish them to production.
Phase A of the architecture (the schema, query layer, install plumbing) is
already live in the app; your job is to author content against that
contract and ship it.

The architecture context is in
`/Users/skyl/.claude/plans/now-let-s-thing-about-mighty-sifakis.md`. You
do not need to read it. **Everything you need to ship is in this file.**

## What a phrase pack is

One self-contained SQLite file (`data.sqlite3`) of ~50–2500 English phrases
with translations into the app's supported languages (default 51), plus a
small `manifest.json` mirror of its metadata. Packed into a zip and served
from S3 / CloudFront. Users install one or many; the app's query layer
samples uniformly per entry across the user's active set, including the
bundled base corpus if they leave it enabled.

Each pack is **one topic** (Botany, Music, Rugby, Advanced Business, …)
and ships free or behind an IAP. Aim for 10 strong free packs covering
broad audiences first; then 990 niche packs, mostly $0.99 / pack.

## The first 10 free packs

Ship these in order. Target ~500 phrases each unless noted. Pack ids are
the canonical immutable identifier — once published, never change them.

1. `phrase-everyday-basics` — kitchen, bathroom, weather, errands. 800 phrases.
2. `phrase-travel-essentials` — airports, hotels, asking for help, prices. 800 phrases.
3. `phrase-food-and-dining` — ordering, cooking, ingredients, restaurants. 600 phrases.
4. `phrase-family-and-relationships` — household, friends, feelings. 500 phrases.
5. `phrase-health-and-body` — doctors, pain, pharmacy, exercise. 500 phrases.
6. `phrase-work-and-office` — meetings, email, deadlines, colleagues. 500 phrases.
7. `phrase-money-and-shopping` — prices, banking, bargaining, returns. 400 phrases.
8. `phrase-tech-everyday` — phones, accounts, apps, troubleshooting. 400 phrases.
9. `phrase-nature-outdoors` — weather, hiking, animals, seasons. 400 phrases.
10. `phrase-stories-and-emotions` — narrative beats, internal life, opinions. 600 phrases.

After these 10, the floor opens — Botany, Music, Math, Rugby, Geology,
Chess, Beekeeping, etc. The world is your oyster (which would itself be a
good `phrase-marine-biology` entry).

## Pack-id naming convention

```
phrase-<category-or-topic>-<sub-or-variant>
```

- Lowercase kebab-case only. No underscores, no uppercase, no dots.
- Always starts with `phrase-` — the build script enforces this.
- After `phrase-`, the rest is descriptive. Examples:
  `phrase-botany-basics`, `phrase-physics-mechanics`,
  `phrase-business-negotiation`, `phrase-rugby-union`.
- Once published, the id is **immutable forever**. Bump the `version`,
  never the id.

## Versioning

- Semver: `MAJOR.MINOR.PATCH`.
- Bump on any content change. Bump major if you remove or renumber
  existing entry ids in a way that would break stored history.
- `<pack-id>@<version>` is the canonical identity. The CDN keeps every
  published version forever; do not overwrite.
- `channel: "stable"` is the default. Use `channel: "preview"` for
  in-progress packs that should not appear in the public catalog.

## Authoring workflow

1. **Pick a topic** and a pack id. Write a one-line description.
2. **Write the English source** in `phrases.json` — see "Input layout"
   below. Aim for diversity in grammar (questions, commands, narratives,
   exclamations), tense, and CEFR level.
3. **Translate** to the target language set. LLM fan-out is fine but
   **spot-check** before publishing — at minimum read 10% of each
   language. Stub translations are visible to users and will hurt the app's
   reputation.
4. **Build** locally — `python3 tools/phrase-packs/build_phrase_pack.py
   <input-dir>`.
5. **Sideload** to a dev iPad via the procedure below and confirm phrases
   surface in the main loop with the pack active.
6. **Package** — `python3 tools/phrase-packs/publish.py <build-dir>`.
7. **Upload** with `--upload` once the dev pass is clean.
8. **Append to the catalog** — open a PR adding the new entry to
   `web/data/packs.json` (or wherever the v3 phrase-pack catalog source
   lives — see "Catalog" below).

## Input layout

```
example-botany/
    pack.json
    phrases.json
    translations/
        es.json
        fr.json
        de.json
        ...
```

### `pack.json`

```json
{
  "id": "phrase-botany-basics",
  "version": "0.1.0",
  "name": "Botany Basics",
  "description": "Everyday plant-life vocabulary — flowers, leaves, photosynthesis, gardens.",
  "category": "science",
  "topic": "Botany",
  "icon": "leaf",
  "accent_color": "#a5d6a7"
}
```

Required: `id`, `version`, `name`. Optional but recommended:
`description`, `category`, `topic`, `icon` (lucide-react icon name OR
single emoji), `accent_color` (hex). `level_min` / `level_max` are
inferred from `phrases.json` unless overridden.

### `phrases.json`

```json
[
  {"english": "The flower opens at sunrise.", "level": "A2"},
  {"english": "Leaves turn yellow in autumn.", "level": "A2"},
  {"english": "Photosynthesis converts sunlight into energy.", "level": "B2"}
]
```

Required per row: `english`. Strongly recommended: `level` (one of
`A0 A1 A2 B1 B2 C1 C2`). The order of this list is the canonical entry-id
order — index 0 becomes `entries.id = 0`, etc. **Never reorder or remove
existing entries in a version bump** unless you do a major bump.

### `translations/<lang>.json`

```json
{
  "0": {"text": "La flor se abre al amanecer.", "romanization": null},
  "1": {"text": "Las hojas se vuelven amarillas en otoño.", "romanization": null}
}
```

Keyed by the phrase index (as a JSON string). `text` required;
`romanization` optional (null when not applicable). One file per target
language, named with the BCP-47 code used by the app (see canonical list
below).

### Canonical target language list (51 codes)

```
en, es, ca, fr, it, ro, pt-PT, pt-BR,
de, nl, no, sv, da, fi, hu,
lt, pl, cs, sk, sl, hr, sr, bg, uk, ru,
el, tr,
he, ar, fa, ur, pa-Arab,
pa-Guru, hi, ne, bn, mr, gu, kn, te, ta,
th, vi, id, ms,
sw,
zh-Hans, zh-Hant, yue-Hant-HK, ko-polite, ja
```

Mirror of `corpan-app/src/store/settings.ts :: ALL_LANGUAGES`. The build
script hardcodes this; override per pack with `--langs en,es,fr`.

## Build

```bash
python3 tools/phrase-packs/build_phrase_pack.py tools/phrase-packs/<pack>
```

Produces `<pack>/build/data.sqlite3` + `<pack>/build/manifest.json`.

Flags:
- `--placeholder` — fill missing translations with `[<lang>] <english>`
  markers. **Debug only.** Useful when you want to test the install +
  query pipeline before translations are ready.
- `--strict` — hard-fail on any missing translation. Use this before
  publishing to make sure the pack is complete.
- `--langs en,es,fr` — override the target language set. Use sparingly;
  the value proposition of a Corpán pack is broad language coverage.
- `--out <dir>` — write somewhere other than `<input>/build`.

The script validates pack-id naming, schema, and PRAGMA application_id /
user_version. Inspect the result:

```bash
sqlite3 <pack>/build/data.sqlite3 'SELECT * FROM pack_meta'
sqlite3 <pack>/build/data.sqlite3 'PRAGMA integrity_check'
sqlite3 <pack>/build/data.sqlite3 'SELECT COUNT(*) FROM entries, translations'
```

Expected: `application_id = 1129271888` (= 0x434F5250 = "CORP"),
`user_version = 1`, integrity ok.

## Sideload to a dev iPad

You have a USB-connected iPad with a dev build of Corpán installed. From
your Mac:

1. Serve the built pack on your LAN:
   ```bash
   cd <pack>/build && python3 -m http.server 8765 --bind 0.0.0.0
   ```
2. Find your Mac's LAN IP:
   ```bash
   ipconfig getifaddr en0
   ```
3. Open Safari on Mac → Develop → \<your iPad\> → corpan (tauri://localhost).
4. In the Web Inspector console, install + verify:
   ```js
   await window.__corpanInstallPhrasePack(
     "http://<MAC-IP>:8765/<pack-id>-<version>.zip"
   )
   await window.__corpanListPhrasePacks()
   ```
   The first call returns the install result; the second lists what's
   registered. The Zustand store key is `corpan-phrase-packs-v1` in
   localStorage if you want to inspect manually.
5. Activate the pack from the Stack settings (or via the store directly
   for dev):
   ```js
   const s = (await import("/src/store/settings.ts")).useSettingsStore;
   s.getState().setPhrasePackIds(["<pack-id>"]);
   s.getState().setBaseCorpusEnabled(false);   // optional, pack-only mode
   ```
6. Tap the main screen and confirm phrases from your pack surface.

## Package

```bash
python3 tools/phrase-packs/publish.py <pack>/build
```

Produces `<pack-id>-<version>.zip` (manifest.json + data.sqlite3) and
`<pack-id>-<version>.zip.sha256` alongside. Size limits:

- Warn at >5 MB compressed (likely too many languages or too long entries).
- Hard-fail at >25 MB.

The size of a typical 500-entry × 51-language pack is ~2 MB compressed.
Botany Basics at 80 entries is 40 KB.

## Upload

```bash
python3 tools/phrase-packs/publish.py <pack>/build \
    --upload --bucket corpan-prod --prefix artifacts/corpan/phrase-packs \
    --profile corpora
```

Requires AWS credentials for the `corpora` profile (or your equivalent)
with `s3:PutObject` on the `corpan-prod` bucket under
`artifacts/corpan/phrase-packs/`. Talk to Skylar if you don't have a
profile.

The CDN serves the resulting `https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/<id>-<version>.zip`
(the CloudFront distribution strips the `artifacts/` prefix).

Already-published versions are immutable — uploading the same key twice
is a publishing bug. The script does not refuse it (boto3 will overwrite)
but you should never invoke `--upload` against an existing key. If you
need to fix a pack, bump the version.

## Catalog entry

Phrase packs ship through the existing v3 catalog at
`https://encorpora.io/corpan/packs/catalog-v3.json`. The source lives in
this repo (likely `web/data/packs.json` — confirm with `grep -rn
catalog-v3 web/`). Open a PR adding:

```json
{
  "id": "phrase-botany-basics",
  "name": "Botany Basics",
  "version": "0.1.0",
  "packType": "phrase",
  "description": "Everyday plant-life vocabulary — flowers, leaves, photosynthesis, gardens.",
  "manifestUrl": "https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/phrase-botany-basics-0.1.0/manifest.json",
  "zipUrl": "https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/phrase-botany-basics-0.1.0.zip",
  "sha256": "<from the .sha256 sidecar>",
  "sizeMb": 0.04,
  "imageUrl": "https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/phrase-botany-basics/cover.jpg",
  "purchase": { "type": "free" },
  "minAppVersion": "0.15.0",
  "channel": "stable",
  "category": "science",
  "topic": "Botany",
  "entryCount": 80,
  "languageCount": 51,
  "levelMin": "A1",
  "levelMax": "C1"
}
```

For paid packs use `"purchase": {"type": "iap", "productId":
"corpan_phrase_botany_basics_lifetime", "priceLabel": "$0.99"}` and
configure the StoreKit/Play Billing product separately (talk to Skylar
about the IAP product naming convention).

Land the PR. CloudFront-cached catalog refreshes are fast (< 5 min);
running apps pick up the new entry on their next catalog fetch.

## Validation rules

The build script enforces:
- pack id starts with `phrase-`, kebab-case, no underscores or uppercase.
- `pack.json` has `id`, `version`, `name`.
- `phrases.json` is a non-empty list; every row has non-empty `english`.

Before publishing, also confirm by hand:
- Every language file (when not using `--placeholder`) covers every
  phrase index. `--strict` catches gaps.
- The pack's `language_codes` in `pack_meta` matches what the catalog
  entry advertises.
- The pack id and version match what the catalog references.

## Rollback

If a published pack is broken (translation errors, crashes, NSFW slip):

1. **Yank from catalog** — open a PR removing the entry from
   `catalog-v3.json`. New users stop seeing it; existing users who
   already installed it keep their copy.
2. **Do NOT delete the S3 object.** Apps in the wild that have the manifest
   URL cached will 404 on update checks otherwise, which crashes some
   older clients. The S3 history is a feature, not a leak.
3. Publish a fixed version under a higher version number. Update the
   catalog entry on the same PR (or a follow-up).

## What this contract does NOT cover (yet)

- **Audio.** Phrase packs are text-only. TTS is generated on-device using
  the app's existing voice pipeline.
- **Per-pack ordering of phrases.** The sampler is random across the
  active set. There's no "lesson 1, lesson 2" structure yet.
- **Custom UI per pack.** Phrase packs do not bundle JS; the app's main
  loop and any game pack consumes them through the same query layer.
- **Schema additions** (etymology, audio refs, difficulty subscore,
  per-language CEFR overrides). If you need a new field, raise it with
  Skylar — it requires a `schema_version` bump app-side first.

## Quick reference

- **Schema reference** — `tools/phrase-packs/build_phrase_pack.py :: _write_schema`
- **Build script** — `tools/phrase-packs/build_phrase_pack.py`
- **Publish script** — `tools/phrase-packs/publish.py`
- **Example pack** — `tools/phrase-packs/example-botany/`
- **App query layer** — `corpan-app/src-tauri/src/phrase_packs.rs` + `lib.rs`
- **App install layer** — `corpan-app/src/contentPacks/phrasePackRegister.ts`
- **App store** — `corpan-app/src/store/phrasePacks.ts`, `settings.ts` (`phrasePackIds`, `baseCorpusEnabled`)
- **CDN base** — `https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/`
- **Catalog** — `https://encorpora.io/corpan/packs/catalog-v3.json`
