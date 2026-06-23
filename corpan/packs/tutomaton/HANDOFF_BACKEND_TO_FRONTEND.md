# Tutomaton 0.16.0 multi-source RAG — backend → frontend handoff

This doc covers everything the frontend agent needs to know to land their half of the multi-source RAG migration. Backend's half is committed; sequence the coordinating frontend commit next.

> See also: `RAG_SOURCES_CONTRACT.md` (the locked architecture spec), `AUTHORING_GUIDE.md` (the per-source content authoring workflow), `/home/skyl/.claude/plans/you-remember-maria-our-immutable-boole.md` (the parent plan).

## TL;DR

1. The 6 published corpora migrated to `languages/<code>/sources/core/` shape (atomic — **no shim**).
2. `src/retrievers.ts` import paths need updating (one line per language, listed below).
3. SourceRegistry + merge rules from contract §4 replace the single-module activate path.
4. `tutomaton-phrase-bridge-v1` source pack code is written but needs registry wiring (pattern A, helpers param) — flagged below.
5. Backend never edits `manifest.json` going forward. When a new source publishes, backend hands you a registry entry dict; you paste it.

## What backend landed

### Contract augmented

`RAG_SOURCES_CONTRACT.md` gained §7–§11. Read these first:

- **§7 universal sources** — `tutomatonLanguage: "*"`, optional `requiredHostApis: string[]` for graceful degradation, universal sources MUST be non-authoritative.
- **§8 grounding framing** — wrap labeled `<reference type="canonical">` (authoritative) vs `<reference type="inspiration" from="…">` (non-authoritative). LLM stays creative against inspiration sources.
- **§9 catalog publishing** — built-ins inside Tutomaton ZIP; standalone source packs as their own catalog `entries[]` rows.
- **§10 ID naming** — locked: `tutomaton-corpus-<code>-core-v1`, `tutomaton-corpus-<code>-<variant>-v1`, `tutomaton-<adapter>-v1`.
- **§11 migration policy** — locked, no shim, atomic.

The open-items checklist at the bottom of the contract is now marked agreed-to.

### Universal kit refactored

- `languages/_template/sources/core/` — new shape; scaffolder copies from here.
- `languages/_template/sources/core/manifest.json.template` — source manifest scaffold.
- `languages/_template/schema_base.sql` — stays shared (referenced by all build scripts via `HERE.parents[2] / "_template"`).
- `scripts/bootstrap-language.py` rewritten — emits `languages/<code>/sources/core/...` only. Does NOT touch `module.json` or `prompts/` (your territory). Accepts hyphenated codes (`pt-BR`, `ko-polite`, `pa-Arab`, etc.).

### 6 published corpora migrated to source-pack shape

Each of `en, es, zh, fr, de, ja`:

```
languages/<code>/
├── module.json              ← yours, untouched
├── prompts/                 ← yours, untouched
│   ├── system_prompt.txt
│   └── grounding_instruction.txt
└── sources/
    └── core/                ← all moved here (mine)
        ├── manifest.json    ← NEW (the source manifest)
        ├── data/<x>.sqlite3
        ├── retrieval/retriever.ts
        ├── build_corpus.py
        ├── lesson_data.py
        ├── theme_data.py
        ├── l1_errors_data.py
        └── (en only) phrasal_verbs_data.py
```

`TEMPLATE_DIR` path inside `en/fr/de/ja` `build_corpus.py` was fixed from `HERE.parent / "_template"` → `HERE.parents[2] / "_template"`. Verified by rebuilding zh + fr corpus end-to-end after the move.

### `src/retrievers.ts` import paths you need to update

Old → new, one per language:

```diff
- import * as es from "../languages/es/retrieval/retriever"
+ import * as es from "../languages/es/sources/core/retrieval/retriever"

- import * as zh from "../languages/zh/retrieval/retriever"
+ import * as zh from "../languages/zh/sources/core/retrieval/retriever"

- import * as en from "../languages/en/retrieval/retriever"
+ import * as en from "../languages/en/sources/core/retrieval/retriever"

- import * as fr from "../languages/fr/retrieval/retriever"
+ import * as fr from "../languages/fr/sources/core/retrieval/retriever"

- import * as de from "../languages/de/retrieval/retriever"
+ import * as de from "../languages/de/sources/core/retrieval/retriever"

- import * as ja from "../languages/ja/retrieval/retriever"
+ import * as ja from "../languages/ja/sources/core/retrieval/retriever"
```

The retriever code itself is unchanged (just moved). All 6 use the named-row access pattern (`row.colname`, never `row[0]`) — verified.

### Publisher: `source` subcommand added

`tools/llm-packs/publish.py source <path-to-source-dir> [--upload]`:

- Reads `<path>/manifest.json`, validates `packType: "tutomaton-rag-source"` + required fields
- Builds `<id>.zip` (filename is the source id from the manifest — id already carries `-vN`, no separate version suffix)
- If `--upload`: uploads to `s3://corpan-prod/artifacts/corpan/tutomaton-sources/<id>.zip`
- CDN URL pattern: `https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-sources/<id>.zip`
- Outputs a `registry_entry` dict — the metadata you paste

Existing subcommands (`base`, `pack`, `language`, `remove-from-catalog`) unchanged.

**Smoke-tested**: `publish.py source packs/tutomaton/languages/en/sources/core --out /tmp/x` builds `tutomaton-corpus-en-core-v1.zip` cleanly + emits a valid registry entry.

### `tutomaton-phrase-bridge-v1` authored

New standalone pack: `corpan/packs/tutomaton-phrase-bridge/{manifest.json, retrieval/retriever.ts, README.md}`. Code-only (~200 lines TS); no bundled sqlite; queries `hostApi.phrasePacks.getInstalled()` + `hostApi.queryPackDb` per pack at runtime; returns inspiration-voice grounding (non-authoritative, `priority: 20`).

**Needs your decision** — the bridge retriever uses an OPTIONAL THIRD `helpers` parameter that the registry passes only for bridge/universal sources (pattern A in `corpan/packs/tutomaton-phrase-bridge/README.md`). Other retrievers receive `undefined` and ignore it; standard contract is unchanged for them. If you'd prefer pattern B (multi-db queryFn variant), the bridge needs a small refactor of call sites — matching/formatting logic doesn't change. Until either is wired, the bridge gracefully returns `kind: "none"` with a log breadcrumb; nothing breaks.

Bridge ships in 0.17.0 (post-architecture), not 0.16.0 — sequence per the parent plan. So no rush on the registry wiring; just lock the pattern when you build SourceRegistry.

## What you need to do

For 0.16.0:

1. **Update `src/retrievers.ts` import paths** to the 6 new `sources/core/retrieval/retriever` paths (block above). Land coordinated with backend's migration commit so neither tree is broken in between.

2. **Build the SourceRegistry** in `src/languageManager.ts`:
   - For the active language, gather sources from two places:
     - **Built-ins**: walk `languages/<active>/sources/*/manifest.json` files (only `core/` exists today; future built-in variants land here). The retriever is statically imported via `src/retrievers.ts`.
     - **Discovered installed source packs**: via `hostApi.discoverPacksByType("tutomaton-rag-source")`. Stub this to return `[]` until native lands; nothing breaks. Source pack retrievers ship precompiled to JS (`.js`) per contract §2.
   - Apply per-language enable prefs: `tutomaton.sources.<lang>.<sourceId> = "on" | "off"` in localStorage. Default ON when a source is newly seen.
   - Honor `requiredHostApis` from §7.b — skip sources whose required capabilities aren't present.
   - Validate universal sources have `authoritative: false`; reject mismatch.

3. **Replace the single retrieval call in `src/chat.ts`** (currently around line 851, `rag = await lang.retrieve(userText)`) with the registry merge:
   - Theme bypass: if the single authoritative source returns `kind === "theme"` with non-null reference → that wins, render directly, no LLM call. Per contract §4 step 1.
   - Otherwise: collect non-null references from enabled sources, take at most 2 — authoritative first, then highest-`priority` non-authoritative (tie-break by score then id). Wrap them per §8 (`<reference type="canonical">` and `<reference type="inspiration" from="<name>">`). Concatenate into the system prompt. Per contract §4 step 2.
   - If nothing hits → `{kind: "none"}`, prompt-only, as today.

4. **Update `manifest.json`** to declare bundled built-in sources per language. Shape suggestion (your call on the exact field name):

   ```jsonc
   "languages": [
     {
       "code": "ar",
       "displayName": {…},
       "voiceLanguageCode": "ar-SA",
       "sources": [
         { "id": "tutomaton-corpus-ar-core-v1", "bundled": true }
       ]
     }
   ]
   ```

   Backend never touches this file. New source registrations (Arabic, Hindi, etc.) land via you pasting the registry entry returned by `publish.py source`.

5. **Add `hostApi.discoverPacksByType` stub** in `corpan-app/src/contentPacks/hostApi.ts` returning `Promise<[]>` until native lands. Wire the SourceRegistry through it.

6. **Zero-source handling** — the 40+ prompt-only stub languages (ar/bg/bn/ca/… with `module.json` + `prompts/` but no retriever and no data) keep working naturally: the registry returns an empty source list, merge produces `{kind:"none"}`, chat path delivers system_prompt + grounding_instruction with no `<reference>` block. Not a shim; it's the natural zero-source path.

## What you do NOT need to do

- Edit anything under `languages/<code>/sources/`. That's mine.
- Re-author retrievers — they're moved verbatim, no logic changes.
- Touch `tools/llm-packs/publish.py`.
- Touch the `_template/` or `bootstrap-language.py` scaffolder.
- Worry about `tools/gen_prompts.py` — already yours; per-language `prompts/` files at `languages/<code>/prompts/` are untouched by my migration.

## Open questions for you

1. **Bridge retriever signature — pattern A vs B?** Pattern A (optional `helpers` param) is what the bridge code is written to; pattern B (multi-db queryFn variant) is an alternative. Either works. Pick one when you build the registry; the bridge code adapts.

2. **Phrase-pack FTS5 indexes** — backend flagged this is a ~1-2 hour effort that would lift bridge top-3 precision from ~50% to ~80%. Currently the bridge uses LIKE matching (works, but noisy). Decision pending — backend will roll out FTS to phrase packs if you say so, otherwise bridge ships LIKE-only in 0.17.0 and can be upgraded later (dual-mode bridge code is already designed for it).

3. **Source manifest version field** — contract §1 doesn't have an explicit `contentVersion` field on source manifests; the `-vN` suffix in the `id` carries it. Publisher uses `<id>.zip` as the filename. Anything in your registry/install logic that needs a separate `version` field? If so, I'll add it to the manifest spec.

4. **Built-in source declarations in manifest.json** — what's the exact shape you want under `languages[<code>].sources[]`? My example above is illustrative; let me know the locked shape and I'll match it in the source manifests' canonical form.

## When this lands

Backend's migration commit: ready now, will land paired with your `src/retrievers.ts` path update so the tree is never broken.

Post-0.16.0 (catalog content, no Tutomaton release required):
- `tutomaton-phrase-bridge-v1` ships first (validates the source-pack catalog publish flow + universal-source convention). Optional pre-step: FTS5 in phrase packs.
- Arabic ships next as `tutomaton-corpus-ar-core-v1` (premium quality).
- Then Hindi, Korean, Vietnamese, Bengali, Tamil, Telugu, Marathi, Persian, Urdu, Hebrew, Cantonese.

Backend authors these as standalone source packs; for each, backend hands you a `registry_entry` dict via the publisher output. You add to catalog. No Tutomaton release per new source.

## Contact

Backend tasks tracked in TaskList #35–#43. Plan file: `/home/skyl/.claude/plans/you-remember-maria-our-immutable-boole.md`.
