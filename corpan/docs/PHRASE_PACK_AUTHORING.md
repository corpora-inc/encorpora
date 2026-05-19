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
  "accent_color": "#a5d6a7",

  // Optional publish-time fields — flow through manifest.json into the
  // S3 catalog entry. Omit for sensible defaults.
  "purchase": { "type": "free" },
  "tags": ["starter", "new"],
  "min_app_version": "0.15.0",
  "channel": "stable",
  "icon_url": "https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/phrase-botany-basics/cover.jpg"
}
```

Required: `id`, `version`, `name`. Optional in-pack metadata:
`description`, `category`, `topic`, `icon` (lucide-react icon name OR
single emoji), `accent_color` (hex). `level_min` / `level_max` are
inferred from `phrases.json` unless overridden.

Optional publish-time fields (forwarded to the S3 catalog by
`publish.py`):

- `purchase` — `{"type": "free"}` (default), `{"type": "iap",
  "productId": "...", "priceLabel": "$0.99"}`, or the subscription
  product id (`corpan.sub.monthly` / `corpan.sub.annual`) to gate behind
  the subscription.
- `tags` — free-form list, e.g. `["starter", "editors-pick", "new"]`.
  Renders as badges in the Packs-tab browser.
- `min_app_version` — defaults to `"0.15.0"`. Bump only when the pack
  depends on app features added in a later release.
- `channel` — `"stable"` (default) or `"preview"` (hidden from non-dev
  users; useful for in-progress translations).
- `icon_url` — full CDN URL to a cover image (optional polish).

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

## Publish: zip + catalog, direct to S3

Phrase packs ship through a **dedicated catalog** at
`https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/catalog.json`,
written directly to S3 by `publish.py`. **No PR, no GitHub Actions, no
app rebuild** — running apps pick up new packs within ~5 minutes (TTL),
or immediately if you invalidate. This is the difference from the
earlier v3-catalog-via-PR plan: you ship as fast as you can build.

### One-shot publish

```bash
python3 tools/phrase-packs/publish.py <pack>/build \
    --upload \
    --update-catalog \
    --invalidate \
    --bucket corpan-prod \
    --prefix artifacts/corpan/phrase-packs \
    --profile corpora
```

What each flag does:

- `--upload` — pushes `<id>-<version>.zip` to
  `s3://corpan-prod/artifacts/corpan/phrase-packs/<id>-<version>.zip`.
  CloudFront strips `artifacts/` so the served URL is
  `https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/<id>-<version>.zip`.
  Sets `Content-Type: application/zip` and a `sha256` object metadata
  attribute.
- `--update-catalog` — `GET`s the live `catalog.json` from S3 (treats 404
  as "first-ever pack, start fresh"), upserts the new pack entry by `id`,
  writes back to the same key with
  `Cache-Control: public, max-age=300, must-revalidate`. Running apps
  refresh within 5 minutes.
- `--invalidate` — optional CloudFront invalidation of
  `/corpan/phrase-packs/catalog.json` so users on a fresh-TTL cache see
  the update in ~30–60 seconds instead of waiting up to 5 minutes. Cost
  ~$0.005 per invalidation. **Recommended for the first 10 free packs
  and for any urgent fix; skip for routine adds.**

Requires AWS credentials for the `corpora` profile (or your equivalent)
with:
- `s3:PutObject` and `s3:GetObject` on the `corpan-prod` bucket under
  `artifacts/corpan/phrase-packs/`.
- `cloudfront:CreateInvalidation` on the distribution serving
  `d38iwc9748jekz.cloudfront.net` (only needed if you use
  `--invalidate`).

Talk to Skylar if you don't have a profile / role.

### Pack zips are immutable

Already-published `<id>-<version>.zip` keys must never be overwritten —
apps in the wild may have manifest URLs cached. If you need to fix a
pack, **bump the version** and publish the new one; the old key stays
in S3 forever.

The catalog's `zipUrl` for that pack id is just replaced by the new
version's URL on the next `--update-catalog`.

### Pack-entry shape (what gets written into catalog.json)

```json
{
  "id": "phrase-botany-basics",
  "name": "Botany Basics",
  "version": "0.1.0",
  "description": "Everyday plant-life vocabulary — flowers, leaves, photosynthesis, gardens.",
  "topic": "Botany",
  "category": "science",
  "zipUrl": "https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/phrase-botany-basics-0.1.0.zip",
  "sha256": "e5b1de97c0ba…",
  "sizeMb": 0.04,
  "entryCount": 80,
  "languageCount": 51,
  "levelMin": "A1",
  "levelMax": "C1",
  "purchase": { "type": "free" },
  "tags": ["starter", "new"],
  "minAppVersion": "0.15.0",
  "channel": "stable",
  "iconUrl": "https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/phrase-botany-basics/cover.jpg",
  "accentColor": "#a5d6a7"
}
```

`publish.py --update-catalog` derives most of these from the pack's
`manifest.json` (already produced by `build_phrase_pack.py`). Fields you
need to set explicitly on the pack's `pack.json` input:
- `purchase` (defaults to free)
- `tags` (optional)
- `minAppVersion` (defaults to `0.15.0`)
- `channel` (defaults to `stable`; use `preview` for in-progress packs
  hidden from non-dev users)
- `iconUrl` / `accentColor` (optional cosmetics)

For paid packs:
```json
"purchase": {
  "type": "iap",
  "productId": "corpan_phrase_botany_basics_lifetime",
  "priceLabel": "$0.99"
}
```

For subscription-gated packs use the existing subscription product id
(`corpan.sub.monthly` or `corpan.sub.annual`) — the app detects it and
renders "Unlock with subscription" instead of a one-time buy button.

### Catalog-level curation (starter set + groups)

Independent of pack publishes. Maintain a curation file locally and
update the catalog top-level when you want to retune:

```bash
python3 tools/phrase-packs/publish.py \
    --update-curation tools/phrase-packs/curation.json \
    --invalidate \
    --bucket corpan-prod \
    --prefix artifacts/corpan/phrase-packs \
    --profile corpora
```

`curation.json` shape:

```json
{
  "onboardingStarterPackIds": [
    "phrase-everyday-basics",
    "phrase-travel-essentials",
    "phrase-food-and-dining",
    "phrase-family-and-relationships"
  ],
  "phrasePackGroups": [
    {
      "id": "starter",
      "label": "Essentials",
      "description": "The everyday packs we recommend first.",
      "packIds": [
        "phrase-everyday-basics",
        "phrase-travel-essentials",
        "phrase-food-and-dining"
      ]
    },
    {
      "id": "sciences",
      "label": "Sciences",
      "packIds": ["phrase-botany-basics", "phrase-physics-mechanics"]
    },
    {
      "id": "humanities",
      "label": "Humanities",
      "packIds": ["phrase-history-modern", "phrase-philosophy-101"]
    }
  ]
}
```

Without these fields the onboarding step renders its "no phrase packs
yet" placeholder and the Packs-tab browser collapses to a single "All
phrase packs" group.

### Catalog file (catalog.json) shape — full reference

```json
{
  "version": 1,
  "generatedAt": "2026-05-19T03:14:00Z",
  "onboardingStarterPackIds": [ /* … */ ],
  "phrasePackGroups": [ /* … */ ],
  "packs": [
    { /* pack entry */ },
    { /* pack entry */ }
  ]
}
```

`version: 1` is the wire format version. Bump only on a breaking change
(coordinate with Skylar — the app needs to know how to parse it).

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

1. **Yank from catalog**:
   ```bash
   python3 tools/phrase-packs/publish.py \
       --remove-from-catalog phrase-broken-pack-id \
       --invalidate \
       --bucket corpan-prod \
       --prefix artifacts/corpan/phrase-packs \
       --profile corpora
   ```
   New users stop seeing it within seconds (with `--invalidate`) or 5
   minutes (without). Existing users who already installed it keep their
   copy on disk; the next catalog refresh just stops listing it.
2. **Do NOT delete the S3 zip object.** Apps in the wild that have the
   pack manifest URL cached will 404 on update checks otherwise, which
   crashes some older clients. The S3 history is a feature, not a leak.
3. Publish a fixed version under a higher version number using the
   normal `--upload --update-catalog` flow. The fixed version supersedes
   the bad one in the catalog.

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

- **Schema reference (per-pack SQLite)** — `tools/phrase-packs/build_phrase_pack.py :: _write_schema`
- **Build script** — `tools/phrase-packs/build_phrase_pack.py`
- **Publish script** — `tools/phrase-packs/publish.py`
- **Example pack** — `tools/phrase-packs/example-botany/`
- **App query layer** — `corpan-app/src-tauri/src/phrase_packs.rs` + `lib.rs`
- **App install layer** — `corpan-app/src/contentPacks/phrasePackRegister.ts`
- **App catalog layer** — `corpan-app/src/contentPacks/phrasePackCatalog.ts` + `corpan-app/src/store/phrasePackCatalog.ts`
- **App store** — `corpan-app/src/store/phrasePacks.ts`, `settings.ts` (`phrasePackIds`, `baseCorpusEnabled`)
- **CDN base** — `https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/`
- **Catalog URL** — `https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/catalog.json`
- **Catalog format** — `version: 1`, `Cache-Control: public, max-age=300, must-revalidate`
- **S3 key prefix** — `corpan-prod/artifacts/corpan/phrase-packs/`
- **AWS profile (Skylar's local)** — `corpora`
