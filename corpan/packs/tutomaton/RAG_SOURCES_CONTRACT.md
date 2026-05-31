# Tutomaton RAG Sources — contract (v1)

> Status: **proposed, co-authored.** Frontend owner (this doc's author) + backend/publisher
> agent must both sign off before authoring sources or coding the registry against it.
> Goal: ship Tutomaton 0.16.0 with a registry that consumes **0..N** RAG sources per
> language, so new retrievers/corpora land later as **catalog content** (or pack-only
> updates) with no — or minimal — Tutomaton release. The frontend just consumes whatever
> sources the catalog/host surfaces.

## The three concepts

1. **A RAG source** = a self-describing unit (its own manifest) that exposes a sqlite +
   a retriever for one target language. Built-ins are bundled inside the Tutomaton pack
   today; future ones ship as separate packs to the CDN/catalog.
2. **SourceRegistry** (in the pack's `LanguageManager`) — for the active target language,
   gathers all sources (built-in + discovered installed packs), filters by the user's
   per-language enable prefs, and hands the enabled set to the retrieval loop.
3. **Retrieval loop** — merges across enabled sources under the rules in §4.

## 1. Source manifest (`manifest.json` of a source)

```jsonc
{
  "packType": "tutomaton-rag-source",        // REQUIRED — discovery key
  "id": "tutomaton-corpus-ar-msa-v1",        // REQUIRED — stable, unique; shows in settings + prefs
  "name": { "en": "Standard Arabic Core", "ar": "العربية الفصحى" }, // REQUIRED — localized
  "tutomatonLanguage": "ar",                 // REQUIRED — manifest code(s) this serves.
                                             //   string OR string[]. MUST match Tutomaton's
                                             //   language codes (e.g. "pt-BR","zh-Hant","ko-polite").
  "authoritative": true,                     // REQUIRED — may it theme-bypass the LLM? (§4)
  "categories": ["vocab","grammar","themes","idioms"], // OPTIONAL — informational/UX tags
  "priority": 100,                           // OPTIONAL — higher wins ties; default 0. Built-in core = 100.
  "schemaVersion": 1,                        // REQUIRED — retriever/db schema version
  "files": {
    "database": "data/ar-msa.sqlite3",       // relative to the source dir; "" if retriever needs no db
    "retriever": "retrieval/retriever.ts"    // relative; the code module (see §3)
  },
  "minTutomatonVersion": "0.1.0"             // REQUIRED — pack refuses sources it's too old for
}
```

Rules:
- **Exactly one `authoritative: true` source may "win" the theme-bypass per language.** If
  two authoritative sources are enabled, the higher `priority` (then lexﹰ id) wins; the
  others degrade to non-authoritative grounding for that turn. The registry enforces this.
- `id` is the persistence + settings key. Never reuse an id for different content; bump the
  `-vN` suffix.
- A source with `files.database: ""` is legal (e.g. the future phrase-pack bridge queries
  host APIs, not a bundled sqlite).

## 2. Where sources live

- **v1 built-ins:** bundled inside the Tutomaton pack at
  `languages/<code>/sources/<sourceId>/{manifest.json, data/*.sqlite3, retrieval/retriever.ts}`.
  No extra download. The pack's `retrievers.ts` statically imports each built-in retriever
  (IIFE bundle has no runtime import — same constraint as today).
- **Future sources:** separate packs on the CDN, installed by the user, discovered at
  runtime (§5). Their retriever ships **precompiled to JS** in the pack (the runtime can't
  compile TS); the source manifest's `files.retriever` points at the built artifact.
- es/zh today (the single-module shape) get migrated INTO this shape: their current
  `languages/<code>/{data,retrieval}` becomes `languages/<code>/sources/core/…` with a
  generated source manifest. Backwards-compat shim: if no `sources/` dir exists, the
  registry treats the legacy `languages/<code>/module.json` as a single authoritative core
  source (so we can migrate incrementally without breaking the others).

## 3. Retriever module contract (THE lock-in — both agents build to this)

Every source's retriever module exports exactly:

```ts
export type QueryFn = (sql: string, params: unknown[])
  => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
//                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//  CRITICAL: rows are OBJECT rows keyed by column name (host returns
//  Vec<HashMap<col,JsonValue>>). Access row.colname — NEVER row[0]. Positional
//  indexing returns undefined at runtime (this bug already shipped once; do not repeat).

export type RetrievalResult = {
  kind: "theme" | "lesson" | "lesson_diff" | "conjugation_one"
      | "conjugation_full" | "translation" | "vocab" | "idiom" | "none"
  reference: string | null     // the markdown block injected into the system prompt (or null)
  score?: number               // 0..1 confidence; optional. Used only for tie-break in v1 (§4)
  themeKey?: string            // set when kind === "theme"
  log: string[]                // debug breadcrumbs
}

export async function retrieve(text: string, queryFn: QueryFn): Promise<RetrievalResult>
export async function resolveTheme(themeKey: string, queryFn: QueryFn): Promise<string | null>
```

- The registry injects `queryFn` already scoped to **this source's** dbName (the registry
  owns the `(packId, dbName)` → sqlite resolution via `hostApi.queryPackDb`). Retrievers
  never construct dbNames themselves.
- Retrievers MUST be pure read functions: no DOM, no host calls beyond the given `queryFn`,
  no global state. Deterministic given (text, db).
- A retriever that can't ground returns `{ kind: "none", reference: null, log: [...] }`.

## 4. Merge rules — v1 (deliberately simple; do NOT over-build)

Per user turn, over the **enabled** sources for the active language:

1. **Theme bypass:** if the single authoritative source returns `kind === "theme"` with a
   non-null reference, that wins — deliver its canonical list, no LLM call. (Only the
   authoritative source may bypass. Non-authoritative theme hits are demoted to grounding.)
2. **Otherwise grounding:** collect every non-null `reference` from enabled sources. Take at
   most **2** — the authoritative source first (if it hit), then the highest-`priority`
   non-authoritative hit (tie-break by `score` if present, else id). Concatenate them as
   separate labeled blocks into the system prompt.
3. If nothing hits → ungrounded (`{kind:"none"}`), prompt-only as today.

**NOT in v1** (contract allows, frontend implements later): cross-source weighted score
merge, >2 blocks, dedup across sources. v1 = "authoritative wins bypass; ≤2 reference
blocks; first-by-priority." Keep it boring and correct.

## 5. Discovery + per-language enable prefs

- **Built-ins** are always discoverable (bundled). **Installed source packs** are
  discovered via a NEW host API (approved for 0.16.0 native):
  `hostApi.discoverPacksByType("tutomaton-rag-source") => Promise<SourceDescriptor[]>`
  where each descriptor carries `{ id, packId, name, tutomatonLanguage, authoritative,
  categories, priority, baseUrl }` read from the installed pack's manifest. (Native: extend
  `read_manifest_info` to also surface `packType` + these fields; add a
  `content_packs_list_installed_by_type` command + the hostApi wrapper.)
- **User prefs** live in pack-local storage:
  `tutomaton.sources.<lang>.<sourceId> = "on" | "off"`. **Default ON** when a source is
  newly seen. Persisted via the pack's existing localStorage budget (tiny: ids only).
- A Settings UI to toggle sources per language is **post-v1** — the persistence shape is
  locked now so the UI can be added without migration.

## 6. What ships in 0.16.0 vs later

**0.16.0 (native + pack):**
- Native: `discoverPacksByType` host API + manifest fields (`packType`, `tutomatonLanguage`,
  `authoritative`, `categories`, `priority`).
- Pack: SourceRegistry replacing the single-module path; v1 merge (§4); per-language enable
  storage (no UI yet); legacy single-module shim (§2); built-in sources migrated to the
  `sources/<id>/` shape with generated source manifests.

**Later (pack-only or pure catalog content, no native release):**
- New source packs (slang/dialect/medical/persona) ship to the catalog; users install;
  Tutomaton discovers on next launch.
- Phrase-pack bridge adapter source (`files.database:""`, queries `hostApi.phrasePacks`).
- Settings UI to toggle sources.
- Score-weighted multi-source merge.

## Open items for the two agents to confirm
- [ ] Backend: author Arabic (and others) as `sources/<id>/` with this manifest + the
      object-row retriever contract (§3). Provide id, sha, db filename per source for the
      manifest + catalog.
- [ ] Frontend (me): build SourceRegistry + §4 merge + prefs storage + legacy shim; add the
      `discoverPacksByType` hostApi wrapper once the native command exists.
- [ ] Native: `packType`/source fields in `read_manifest_info`; `discoverPacksByType`
      command + hostApi method. (Frontend can stub the hostApi method to "[]" until native
      lands, so the pack works with built-ins only in the meantime.)
- [ ] Confirm: priority default (0) + built-in-core priority (100) acceptable.
