# Tutomaton 0.16.0 — frontend handoff: flip en/fr/de/ja from "bundled-but-off" to "live"

Backend finished republishing en/fr/de/ja with the post-migration `sources/core/` shape. All 4 ZIPs are live on CDN. This doc gives you the exact atomic patch for `packs/tutomaton/manifest.json` to flip them on.

After this lands, all 6 published corpora (en, es, zh, fr, de, ja) are first-class authoritative sources in the SourceRegistry. 0.16.0 ships with full coverage of the published corpus set, zero regressions for es/zh.

## TL;DR

For each of en, fr, de, ja: bump the `languages[]` entry, add a `databases[]` entry, add a `sources[]` block. Three edits per language; one commit. Backend won't touch the manifest (per [[manifest-owned-by-frontend]]).

## Why these ZIPs are different from what's on CDN today

The existing live `en-0.1.0.zip` etc. have the **pre-migration** internal layout (`data/english.sqlite3` at root). The new `en-0.2.0.zip` etc. have the **post-migration** shape (`sources/core/data/english.sqlite3`). Bumping to v0.2.0 lets you map `dbName: "tutomaton-en"` at the new path uniformly with how `bootstrap-languages.mjs` produces data locally.

es and zh ZIPs are NOT republished — they still ship OLD layout (es-0.1.0.zip, zh-0.2.0.zip) and the manifest's `databases` map points at their OLD paths. Mixed layout is fine; the SourceRegistry abstracts it via `dbName`.

## Verified

- All 4 new ZIPs uploaded successfully to `s3://corpan-prod/artifacts/corpan/tutomaton-languages/`
- ZIP shape inspected: `sources/core/{manifest.json, data/<x>.sqlite3, retrieval/retriever.ts, ...}` — correct
- Each retriever uses named-row access (`row.colname`) — verified, no positional access bugs
- `module.json.files.{database,retriever}` paths updated to new layout
- Sqlite schemas intact: en has 40 lessons + phrasal_verbs/modal_verbs; fr/de/ja have 8–12 lessons + vocabulary_themes/l1_errors

## Patch — `packs/tutomaton/manifest.json`

### 1. `languages[]` — bump 4 entries to v0.2.0

```diff
 {
   "code": "en",
   "displayName": { "en": "English", ... },
   "voiceLanguageCode": "en-US",
-  "contentVersion": "0.1.0",
-  "sizeMb": 1,
-  "moduleUrl": "https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages/en-0.1.0.zip",
-  "sha256": "c9f73f6395d4d43d8fd97d068b683f119c10ba4e12e5e3af14a2889b4be833d0"
+  "contentVersion": "0.2.0",
+  "sizeMb": 1,
+  "moduleUrl": "https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages/en-0.2.0.zip",
+  "sha256": "38765c2d93247bc2d22a147a4ca6674dc07627b7cc368fecb066f9e68b6544d0",
+  "sources": [
+    {
+      "id": "tutomaton-corpus-en-core-v1",
+      "authoritative": true,
+      "priority": 100,
+      "dbName": "tutomaton-en",
+      "bundled": true,
+      "categories": ["vocab", "grammar", "themes", "idioms"],
+      "schemaVersion": 1,
+      "minTutomatonVersion": "0.1.0"
+    }
+  ]
 }
```

Repeat for `fr`, `de`, `ja` with the values below.

### 2. `databases{}` — add 4 entries

```diff
 "databases": {
   "tutomaton-es": "languages/es/data/spanish.sqlite3",
-  "tutomaton-zh": "languages/zh/data/mandarin.sqlite3"
+  "tutomaton-zh": "languages/zh/data/mandarin.sqlite3",
+  "tutomaton-en": "languages/en/sources/core/data/english.sqlite3",
+  "tutomaton-fr": "languages/fr/sources/core/data/fr.sqlite3",
+  "tutomaton-de": "languages/de/sources/core/data/de.sqlite3",
+  "tutomaton-ja": "languages/ja/sources/core/data/ja.sqlite3"
 }
```

Note the path asymmetry — es/zh keep OLD path (`data/<x>.sqlite3`) because their CDN ZIPs are still OLD-shape; en/fr/de/ja use NEW path (`sources/core/data/<x>.sqlite3`) because their v0.2.0 ZIPs use the new shape. Both work; the SourceRegistry doesn't care.

### 3. `src/retrievers.ts` — no change needed

You already flipped these to `sources/core/retrieval/retriever` paths in commit e666295a. The 4 are imported but waiting for manifest sources[] to activate. Once the manifest changes above land, they're live with no code change.

## Per-language reference values

| Lang | Version | sha256 | moduleUrl | dbName | sources[].id |
|---|---|---|---|---|---|
| en | 0.2.0 | `38765c2d93247bc2d22a147a4ca6674dc07627b7cc368fecb066f9e68b6544d0` | `https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages/en-0.2.0.zip` | `tutomaton-en` → `languages/en/sources/core/data/english.sqlite3` | `tutomaton-corpus-en-core-v1` |
| fr | 0.2.0 | `cf07514a7207ed0bf3a233fc7657bc45fac8d451fa4806b940bd046b92f05919` | `https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages/fr-0.2.0.zip` | `tutomaton-fr` → `languages/fr/sources/core/data/fr.sqlite3` | `tutomaton-corpus-fr-core-v1` |
| de | 0.2.0 | `913d79243bc708f490e5596d07eaf3efc96d1b6e85c40af41db8bb4d0e6588a8` | `https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages/de-0.2.0.zip` | `tutomaton-de` → `languages/de/sources/core/data/de.sqlite3` | `tutomaton-corpus-de-core-v1` |
| ja | 0.2.0 | `6c94979be8ec0ad3a48837b70bbbbca89d1c18e4c753a3c6ea1e74bf6dbf160b` | `https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages/ja-0.2.0.zip` | `tutomaton-ja` → `languages/ja/sources/core/data/ja.sqlite3` | `tutomaton-corpus-ja-core-v1` |

Each source carries the same shape as the es/zh entries you already authored (authoritative core, priority 100, bundled true).

## Smoke checks after you land the patch

1. Activate English in Tutomaton; ask a grammar question ("when do I use 'present perfect' vs 'past simple'?") → should ground against `lessons` table, return a canonical reference block.
2. Activate French; ask theme query ("colors") → should hit vocabulary_themes, theme-bypass.
3. Activate German; ask vocab lookup ("the word for cat") → should ground against `words` table.
4. Activate Japanese; ask idiom query → should ground against `idioms` table.

If any retriever silently returns `kind: "none"` despite the right data being present, that's a row-access bug. Backend already verified named access in all 4 retriever.ts files, but worth a console-log check.

## What's NOT in this handoff

- **Arabic + Hindi + Korean + …** — backend deferred per "ship 0.16.0 first" pivot. These land as catalog content (no Tutomaton release per language) after 0.16.0.
- **Phrase bridge wiring** — sits at `kind: "none"` until you choose pattern A/B for the helpers param. Won't affect 0.16.0; can ship 0.17.0.
- **`hostApi.discoverPacksByType`** — your stub returning `[]` is correct for 0.16.0; built-ins-only mode.
- **es/zh changes** — none. Their CDN ZIPs + databases mappings stay exactly as they are today. Byte-identical grounding preserved.

## Contact

If anything in this handoff is wrong or unclear, ping in the next commit message. Backend is parked on Arabic until 0.16.0 ships.
