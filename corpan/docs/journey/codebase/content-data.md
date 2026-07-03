# Content / Data Layer Map — Journey Mode Input

Scope: authoring models (`dja`), pack build pipelines, app-side catalogs/stores, S3/CloudFront
distribution, and the ordering/difficulty metadata gap. All counts verified live on 2026-07-03
(release.sqlite3 on disk + live CDN catalogs).

---

## 1. Phrase corpus & phrase-pack entry schema

### 1a. Authoring source of truth (Django, `dja/cor/models.py`)

- `Language` (`models.py:7`) — `code` (e.g. `es`, `ko-polite`, `pa-Arab`), `name`. 54 rows.
- `Domain` (`models.py:15`) — `code`, `name`, `description`. 13 rows.
- `CEFR_LEVELS` (`models.py:24`) — `A0 A1 A2 B1 B2 C1 C2`.
- `Entry` (`models.py:35`) — **`en_text` (unique — English is the pivot language)**, `level`
  (single CEFR string), `domains` M2M. That is the ENTIRE per-entry metadata: one CEFR bucket +
  domain tags. No frequency, no lemma, no ordering.
- `Translation` (`models.py:44`) — FK entry + FK language, `text`, optional `romanization`
  (pinyin etc.), unique per (entry, language).
- `Narrator` (`models.py:65`), `Pack` (`models.py:88`), `PackEntry` (`models.py:150`) — Django-side
  ordered collections: `PackEntry(pack, entry, order)` with `unique_together(pack, order)`.
  **Important: these ordered-Pack tables exist ONLY in Django. They are NOT exported to the
  shipped DB** (see §7) — the app never sees them. `cor/packs/service.py:13`
  (`create_pack_from_text`) is the source→EN-pivot→54-language fan-out generator for that model.

### 1b. Bundled base corpus (what actually ships in the app binary)

`dja/make_release_sqlite.py` (schema at lines 10–47) strips Django down to five tables:

```sql
cor_entry(id INTEGER PK, level TEXT)              -- note: en_text is DROPPED
cor_domain(id, code)
cor_entry_domains(entry_id, domain_id)            -- WITHOUT ROWID
cor_language(id, code)
cor_translation(entry_id, language_id, text, romanization)  -- WITHOUT ROWID; en is just another language row
```

English text lives only in `cor_translation` under language `en`. File:
`dja/release.sqlite3`, **46.8 MB**, embedded at compile time (§7).

### 1c. Downloadable phrase-pack SQLite schema

Built by `tools/phrase-packs/build_phrase_pack.py::_write_schema` (lines 275–325):

```sql
pack_meta(id, version, schema_version, name, description, category, topic,
          level_min, level_max, entry_count, language_codes, authored_at, icon, accent_color)
entries(id INTEGER PK, english TEXT NOT NULL, level TEXT)   -- id = authoring index, stable forever
translations(entry_id, language_code, text, romanization)   -- WITHOUT ROWID, PK(entry_id, language_code)
entries_fts  -- FTS5 contentless mirror of entries.english (bm25 search; used by Tutomaton phrase-bridge)
CREATE INDEX idx_entries_level ON entries(level);
```

PRAGMA `application_id = 0x434F5250` ("CORP"), `user_version = 1`. Input format
(`docs/PHRASE_PACK_AUTHORING.md`): `pack.json` (id/version/name/category/topic/localized maps/
purchase/channel), `phrases.json` (`[{"english": "...", "level": "A2"}, ...]` — **array order IS
the immutable entry id**), `translations/<lang>.json` keyed by phrase index. Audio: **none** —
phrase packs are text-only; TTS is on-device at runtime (`PHRASE_PACK_AUTHORING.md:670-681`).

### 1d. Phrase-pack catalog wire format (app-side)

`corpan-app/src/contentPacks/phrasePackCatalog.ts` — format version 1, canonical URL
`https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/catalog.json` (line 35). Entry type
(lines 40–87): `id, name(+Localized), version, description(+L), topic(+L), category, zipUrl,
sha256, sizeMb, entryCount, languageCount, levelMin, levelMax, purchase, tags, minAppVersion,
channel(stable|preview), iconUrl, accentColor`. Catalog also carries
`onboardingStarterPackIds` and `phrasePackGroups[]` (id/label(+L)/packIds) — lines 89–116.
Installed-pack registry: `src/store/phrasePacks.ts:20-58` (`InstalledPhrasePack`, localStorage
mirror of disk at `app_data_dir/corpan-packs/<id>/`); per-stack activation is `phrasePackIds` +
`baseCorpusEnabled` in `store/settings.ts`.

---

## 2. Corpus size NOW (verified)

**Base corpus** (`dja/release.sqlite3`):
- **10,000 entries × 54 languages = 540,000 translations** (every language exactly 10,000 — full coverage).
- Levels: A0 380, A1 2,500, A2 2,800, B1 3,400, B2 800, C1 100, **C2 20** (top end is thin).
- 13 domains (entry counts): everyday 5,792; social 3,370; business 1,192; education 1,187;
  travel 1,100; culture 1,048; health 929; housing 704; technology 690; environment 624;
  civic 422; emergency 383; numbers 360.

**Phrase packs** (live `corpan/phrase-packs/catalog.json`, generatedAt 2026-06-18):
- **34 packs, 15,774 entries, every pack languageCount=54, all channel=stable, all levelMin=A0 levelMax=C2.**
- 23 topic packs at v0.3.1 (504–810 entries each), phrase-botany-basics v0.2.1 (505), plus 10
  `phrase-professional-*` packs at v0.1.0 (56–120 entries each, early).
- 13 curated groups; onboarding starters: travel-essentials, cooking-basics, family-and-friends, learning.
- Facet-driven expansion editorial file: `tools/phrase-packs/facets.py` (DEEP=800-target / WIDE=500-target tiers).

**Grand total ≈ 25,774 English phrases × 54 languages ≈ 1.39 M translation rows** across base + packs.

Canonical 54 locale list (mirrors `corpan-app/src/store/settings.ts :: ALL_LANGUAGES`):
`en es ca fr it ro pt-PT pt-BR de nl no sv da fi hu lt pl cs sk sl hr sr bg uk ru el tr he ar fa
ur pa-Arab pa-Guru hi ne bn mr gu kn te ta th vi id jv su ms tl sw zh-Hans zh-Hant yue-Hant-HK
ko-polite ja`.

---

## 3. Word-explanation packs (wordpan) — schema + rollout state

### Schema

Pipeline: `dja/word_pack/` (README, `extract_words.py`, `generate_word_explanations.py`,
`build_word_pack.py`). Word universe = unique EN surface words from base corpus + all phrase
packs = **11,757 words** (from ~25,269 phrases). Per word, ONE ~50-word paragraph covering
polysemy + etymology + sense-branching, authored in EN, adversarially origin-verified
(`origin_confidence` high/medium/low), then translated per language.

Pack SQLite (`dja/word_pack/README.md:47-54`, verified in `packs/wordpan/data/word.sqlite3`):

```sql
word_explanation(word TEXT, language_code TEXT, paragraph TEXT, PRIMARY KEY(word, language_code));
CREATE INDEX word_explanation_language ON word_explanation(language_code);
pack_meta(key, value)  -- schema_version=1, generated_at, core_db, word_count
```

Shipped pair packs contain exactly 2 languages (en + native): es pair = 23,514 rows. Manifest
(`packs/wordpan/manifest.json`): `entryType: "data"`, `databases: {"main": "data/word.sqlite3"}`
— **no JS, data-only pack** queried via generic `content_packs_query_db` (§6).

### Generation corpus state (`/home/skyl/wordpack_seed/english_verified.json`, 268 MB)

- 11,757 records; origin_confidence: high 9,404 / medium 2,192 / low 161.
- **44 languages COMPLETE** (all 11,757): en + ar bg bn da de el es fa fi fr gu he hi hr hu id it
  ja kn ko-polite mr ms ne nl no pa-Arab pa-Guru pl pt-BR pt-PT ru sr sv sw ta te th tr uk ur vi
  zh-Hans zh-Hant.
- Partial: **ro 11,412/11,757 (97%)**, **ca 72 (0.6%)**.
- Not started: **cs lt sk sl jv su tl yue-Hant-HK** (8 langs).

### Published rollout (live `corpan/word-packs/index.json`, generatedAt 2026-06-24)

- **41 native→EN pairs published, ALL v0.1.0, ALL `channel: "preview"`** (dev-mode only),
  wordCount 11,757 each, 3.06–3.90 MB zips.
- bg and uk are complete in the seed but not yet published; only the `*_en` direction exists —
  no EN→X or X→Y pairs.
- Publisher: `/home/skyl/wordpack_seed/publish_word_pack.py` (NOTE: lives OUTSIDE the repo) —
  builds pair sqlite from a seed snapshot, zips with manifest, uploads to
  `s3://corpan-prod/artifacts/corpan/word-packs/` (`Cache-Control: immutable` on zips), and
  **merges** into `index.json` (`max-age=300`), never clobbering existing pairs.
- App-side: `contentPacks/wordPackCatalog.ts` (format v1, URL line 46; entry type lines 51–89
  keyed by `kind:"word-explanation"` + `nativeLang`/`targetLang` pair; `findWordPackForPair`
  line 270 is the single resolver for both Settings discovery and Phrase Flip JIT install).
  Caveat: `src/util/wordPack.ts:18` still has a stale `WORD_PACK_NATIVE_LANGS = {"es"}`
  fallback set from the first ship; the catalog path is the live one.

---

## 4. Narration/book pack schema (in-app reading)

### Catalog entry (`corpan-app/src/contentPacks/catalog.ts:84-107`, `CatalogNarrationEntry`)

`id, bookId, bookTitle, language, voiceId, voiceName, version, downloadUrl, sha256, sizeMb,
series, volume, tier(public|premium), purchase`, plus the Corpán-Plus two-ZIP fields:
`totalSegments, freeSegments, preview{url,sha256,sizeMb}, full{...,requires:"corpan.plus"}`.
Live wire adds `characterId, coverImageUrl, languageName, publishedAt`.
Live `catalog-v2.json`: **968 narration entries across 41 books** (e.g. AITW 2026-06-28 = 50
langs, zheng-yi-sao 39, science_atom 36, biomes series 23 each). Preview = public truncated ZIP
(first `min(total/3, 100)` segments); full ZIP is CloudFront-signed behind
`narrations/premium/*` (§5).

### Inside the pack ZIP (verified on monte-alban pack)

- `manifest.json` — `id: book_monte_alban, type: "book", entry: "dist/reader.js"` + metadata
  (series, volume, author, estimatedReadTime/ListenTime).
- `segments.json` — `{version:"2.0.0", book_id, total_segments, segments:[...]}`. Segment:
  `id ("ch00-004"), part, chapter, title, paragraph_id, sentence_index,
  block_type(heading|text), heading_level, text, text_markdown,
  tts:{text, pause_after_ms}` (headings level 1 = display-only, no tts).
  Per-language `segments_<lang>.json` are authored source (checked into git).
- `audio_manifest_<lang>.json` — `{language, voice, sample_rate, segments: {<segId>:
  {file:"audio/en/ch00-003.m4a", duration_ms, pause_after_ms,
  words:[{word, start_ms, end_ms}, ...]}}}` — **word-level timestamps against DISPLAY text**;
  this is what powers word-by-word highlight sync in earthgate/stargate readers.
- `audio/<lang>/<segId>.m4a` per segment.
- Pack-dir-only intermediates (not shipped): `alignment_<lang>.json`, `pipeline_state_<lang>.json`,
  `narration.yaml`.
- Reader detects preview via `is_preview` flag / `segments.length < total_segments` and
  dispatches `corpan:request-unlock` (see `corpan/CLAUDE.md` Plus section). Progress events:
  `corpan:segment-progress` window event feeds `store/progress.ts`.

**Journey-relevant: segments have deterministic, fine-grained ids (`chNN-SSS`) with word-level
audio alignment — directly addressable as activity atoms (listen-and-follow, dictation, shadow
reading).**

---

## 5. S3 / CloudFront layout

Bucket **`corpan-prod`** (variables.tf:13-17), CloudFront dist **`d38iwc9748jekz.cloudfront.net`**,
OAC, `origin_path = "/artifacts"` (`infra/terraform/main.tf:396`) — S3 key
`artifacts/X` serves as `https://d38iwc9748jekz.cloudfront.net/X`. Premium behavior:
`path_pattern narrations/premium/*` requires signed URLs via a trusted key group
(main.tf:412-421). Layout under `artifacts/`:

```
catalog-v2.json                        # narrations catalog (root)
narrations/*.zip                       # legacy public full zips
narrations/preview/*-preview.zip       # public truncated
narrations/premium/*.zip               # CloudFront-signed, Plus-gated
books/<book_id>/cover.jpg
corpan/phrase-packs/catalog.json + <id>-<ver>.zip     # phrase packs (own catalog)
corpan/word-packs/index.json + wordpan-<n>-en-<ver>.zip  # word packs (own index)
sources/voices/data/*.wav
```

Separate origin: the **v3 experience-pack catalog** is at
`https://encorpora.io/corpan/packs/catalog-v3.json` (`catalog.ts:540`), entries
`CatalogV3Entry` (`catalog.ts:128-177`) with `channel, packType, systemPack, platforms,
minOSVersion, min/maxAppVersion` gating + recommendation metadata (`categories, goodForClass,
recommendOrder, featuredFor, kidFriendly, languages, tagline`) — all catalog-driven so ranking
changes need no app release. `filterCatalogForApp` (`catalog.ts:616`) does version/channel/
platform filtering and per-id dedup.

Publishing invariants (PHRASE_PACK_AUTHORING.md, infra/PUBLISHING.md): **zips are immutable**
(`<id>-<version>.zip`, never overwrite; fix = version bump), catalogs are mutable JSON with
`max-age=300`, optional CloudFront invalidation, publisher writes S3 directly (no PR/CI for
phrase/word packs; the v3 catalog + catalog-v2 have their own flows — and NEVER run
`infra/patch-catalog.py`, it rebuilds from stale metadata).

---

## 6. Adding a NEW pack kind ("course pack") — the wordpan precedent, step by step

Wordpan proved the full path for a new artifact kind that is *not* in the main catalog and not on
Home. A `course-pack` (curriculum graph per target language) would clone it:

1. **Generate in dja**: new dir `dja/course_pack/` (sibling of `word_pack/`, `hanzi_pack/`) with
   `build_course_pack.py` producing one SQLite per target language (or per course). Convention:
   `pack_meta(key,value)` table with `schema_version`, plus domain tables (e.g.
   `course_node(id, unit, step, activity_type, params_json, prereq_json, skill_tags, ...)`).
   SQLite is the right container: the app already has a generic read-only query surface.
2. **Pack manifest**: data-only manifest like `packs/wordpan/manifest.json` —
   `{"id":"journey_es", "entryType":"data", "databases":{"main":"data/course.sqlite3"},
   "languages":[...], nameLocalized...}`. **Id must be underscore-canonical** (the installer
   derives ids from zip filenames mapping hyphens→underscores for non-`phrase-` packs; wordpan
   passes an explicit `packId` to `content_packs_install_from_url` to avoid the version-suffix
   mis-derivation — see `util/wordPack.ts:34` comments).
3. **Upload**: zip (`manifest.json` + `data/*.sqlite3`) to
   `s3://corpan-prod/artifacts/corpan/course-packs/<id>-<ver>.zip`, immutable cache headers.
4. **Own index, not main catalog**: write `artifacts/corpan/course-packs/index.json`
   (`{"version":1, "generatedAt":..., "packs":[{id, kind:"course", targetLang, name(+L),
   version, zipUrl, sha256, sizeMb, minAppVersion, channel:"preview"}]}`), `max-age=300`,
   accumulate-merge like `/home/skyl/wordpack_seed/publish_word_pack.py:81-106`.
5. **App-side catalog module**: copy `wordPackCatalog.ts` → `courseCatalog.ts`: format-version
   gate, `kind` discriminator drop-filter, `fetchJsonFresh` (ETag/304, timeout+retry, keep-cache
   on error — `contentPacks/catalogFetch.ts`), `visibleX(appVersion, devMode)` honoring
   `minAppVersion` + preview channel, plus a pair/target resolver.
6. **Install + query at runtime**: `content_packs_install_from_url(packId, zipUrl)` installs into
   `app_data_dir`; content read via **`content_packs_query_db`**
   (`src-tauri/src/lib.rs:1102`) — parameterized read-only SQL (`ensure_readonly_sql`), cached
   per-(pack,db) connections, `max_rows` bound. No Rust changes needed for a new kind.
7. **Ship preview first**: `channel:"preview"` + devMode, per the trunk-streaming rules.

---

## 7. SQLite bundling — what ships inside the app binary

- `dja/release.sqlite3` (46.8 MB) is **embedded at compile time**:
  `const EMBEDDED_DB: &[u8] = include_bytes!("../../../dja/release.sqlite3")`
  (`corpan-app/src-tauri/src/db.rs:6`). On launch it's written to
  `<data_dir>/release.sqlite3` when missing or size-changed, then opened **read-only with
  mmap** (`db.rs:16-56`; `query_only=ON, mmap_size=64MB`) — avoids the 82 MB deserialize
  alloc that caused startup ANRs.
- Rebuild flow: Django `db.sqlite3` → `python make_release_sqlite.py` → copy → app rebuild.
  **Base-corpus content updates therefore require an app-store release** (unlike every pack).
- All other SQLite (phrase packs, wordpan, hanzipan, future course packs) is downloaded into
  `app_data_dir/corpan-packs/<id>/` and opened read-only via `pack_db.rs` /
  `phrase_packs.rs`.
- Runtime sampling (`src-tauri/src/lib.rs` + `phrase_packs.rs`): `ORDER BY RANDOM()` over
  the union of base corpus + active phrase packs, uniform per entry
  (`pick_weighted_source`, `phrase_packs.rs:418`), with a **filter-relaxation ladder**
  (strict levels+domains → drop levels → drop all → bundled-corpus floor; `lib.rs:367-392`).

---

## 8. ORDERING / DIFFICULTY METADATA — gap analysis (most important)

### What exists today

| Signal | Where | Granularity | Quality caveat |
|---|---|---|---|
| CEFR level per phrase | `cor_entry.level`, phrase-pack `entries.level` | 7 buckets (A0–C2) for all ~25.8k phrases | LLM-labeled (`dja/cor/management/commands/label_cefr.py` — a LOCAL qwen2.5-7b / llama-3.2-3b run). Never human-calibrated; base-corpus distribution is mid-heavy (B1 34%, C2 only 20 entries). It's an ENGLISH-side label applied to all 54 translations of the entry — no per-target-language difficulty. |
| Domain tags | `cor_entry_domains` (13 codes), phrase-pack `category`/`topic` | per phrase / per pack | Topical, not pedagogical. |
| Pack-level level range | `pack_meta.level_min/max`, catalog `levelMin/levelMax` | per pack | Nearly useless as-is: every live pack advertises A0–C2. |
| Stable entry ids | phrase-pack `entries.id` = authoring order (immutable contract) | per phrase | Authoring order ≠ pedagogical order; the sampler ignores it (random). |
| Ordered sequences | Django `PackEntry.order`; book `segments[]` array order + `chNN-SSS` ids | per Django pack / per book segment | Django order never ships; book order is narrative order (usable for reading progression). |
| Recommendation metadata | v3 catalog `recommendOrder, goodForClass, categories, featuredFor, kidFriendly, languages` | per EXPERIENCE pack | Ranks experiences on Home, not content difficulty. |
| Origin confidence | word seed `origin_confidence` (high/med/low) | per word | Trust signal for etymology copy, not difficulty. |
| FTS index | `entries_fts` in v2+ phrase packs | per pack | Enables lexical lookup (e.g. find phrases containing a target word) — a real curriculum asset. |

### What does NOT exist (anywhere)

- **No frequency rank** — not on words (wordpan has 11,757 words but zero rank/zipf data), not
  on phrases. `grep -r frequency` across `dja` + `tools` hits only the CEFR labeler prompt text
  and hanzi build. A frequency-ordered vocabulary spine (Journey principle #4) must be built
  or imported (e.g. wordfreq/subtlex per language) — nothing on hand.
- **No lemma/wordform linkage** — wordpan keys on *surface* words ("running" ≠ "run");
  no phrase↔word join table (deriving "which phrases contain word W" requires tokenizing
  `entries_fts`/`cor_translation` at build time; EN-side FTS exists, target-side does not).
- **No per-target-language difficulty** — a phrase rated A2 in English is implicitly A2 in
  Mandarin and Arabic too. No script-awareness, no L1-contrastive difficulty.
- **No grammar/skill annotation** — no tense/structure/GSE-style tagging on any phrase; a
  curriculum graph node like "past perfect" has nothing to query against except raw text.
- **No prerequisite / progression structure** — explicitly acknowledged:
  `PHRASE_PACK_AUTHORING.md:670-681` ("Per-pack ordering of phrases. The sampler is random…
  There's no 'lesson 1, lesson 2' structure yet"; "difficulty subscore" listed as a future
  schema addition requiring a `schema_version` bump app-side).
- **No per-learner mastery data model on the content side** — progress/streaks are
  localStorage (`store/progress.ts`); there is a `docs/USER_DATA_DB_PLAN.md` plan but the
  content schemas carry no scheduling hooks (no item ids designed for FSRS keys — though
  `(packId, entryId)` and `(bookId, segId)` and `(word, lang)` are all stable and usable).

### Implication for the course-pack design

The existing corpus can be *addressed* (stable ids everywhere) but not *sequenced* — every
curriculum-bearing signal (frequency rank, lemmata, grammar tags, per-language difficulty,
prerequisite edges) must live in the NEW course-pack artifact (or a companion "annotations"
pack that overlays ranks/tags onto existing entry ids), generated in dja at build time. CEFR
labels are the only inherited difficulty signal and should be treated as weak priors pending
recalibration.

---

## 9. Quick reference — file paths

| Thing | Path |
|---|---|
| Django models | `corpan/dja/cor/models.py` |
| Pack fan-out service | `corpan/dja/cor/packs/service.py` |
| Release DB builder | `corpan/dja/make_release_sqlite.py`; output `corpan/dja/release.sqlite3` |
| CEFR labeler | `corpan/dja/cor/management/commands/label_cefr.py` |
| Phrase-pack builder / publisher | `corpan/tools/phrase-packs/build_phrase_pack.py`, `publish.py`; authoring doc `corpan/docs/PHRASE_PACK_AUTHORING.md` |
| Facet expansion plan | `corpan/tools/phrase-packs/facets.py` |
| Word-pack pipeline | `corpan/dja/word_pack/` (README/extract/generate/build); publisher `/home/skyl/wordpack_seed/publish_word_pack.py`; seed `/home/skyl/wordpack_seed/english_verified.json` |
| Hanzi precedent | `corpan/dja/hanzi_pack/` |
| App catalogs | `corpan-app/src/contentPacks/catalog.ts` (v2 narrations + v3 experiences), `phrasePackCatalog.ts`, `wordPackCatalog.ts`; fetch layer `catalogFetch.ts` |
| App stores | `corpan-app/src/store/phrasePacks.ts`, `settings.ts` (`phrasePackIds`, `baseCorpusEnabled`), `progress.ts` |
| Rust data layer | `corpan-app/src-tauri/src/db.rs` (embedded base DB), `phrase_packs.rs` (multi-pack sampler + relaxation ladder), `pack_db.rs` + `lib.rs:1102` (`content_packs_query_db`), `content_packs.rs` (install) |
| Infra | `corpan/infra/terraform/main.tf` (bucket `corpan-prod`, CF `d38iwc9748jekz`, origin_path `/artifacts`, premium signed path), `corpan/infra/PUBLISHING.md` |
| Journey north star | `corpan/docs/journey/NORTH_STAR.md` |

## 10. Open questions

- Who owns/where should the word-pack publisher live? It's currently outside the repo
  (`/home/skyl/wordpack_seed/publish_word_pack.py`) — a course-pack publisher should be
  in-repo from day one.
- CEFR label quality: labeled by a local 7B model; no validation corpus. Does Journey trust it
  as a placement prior, or re-label with a stronger model (codex/gpt-5.5, free) with
  per-target-language adjustment?
- Frequency data licensing/source per 54 languages (wordfreq is MIT and covers ~44 of them) —
  not yet investigated in-repo.
- `catalog-v3.json` publish flow (encorpora.io origin) was not traced end-to-end here (only the
  consumer side); course packs shouldn't need it if they follow the separate-index precedent.
- Whether a "course pack" should be per-(target) with L1 scaffolding injected from a second
  artifact, or per-(native,target) pair like wordpan — the wordpan pair-explosion (41 zips for
  ONE direction) argues for per-target spine + per-L1 overlay.
