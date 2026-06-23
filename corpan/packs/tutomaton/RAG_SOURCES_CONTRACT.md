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
- es/zh today (the single-module shape) get **migrated outright** INTO this shape: their
  current `languages/<code>/{data,retrieval}` becomes `languages/<code>/sources/core/…`
  with a source manifest. **No legacy/compat shim** — we are pre-initial-release and the
  only users, so the registry assumes the `sources/<id>/` shape everywhere and we convert
  every existing language in the same pass. Don't accumulate tech debt for a back-compat
  case that has no real users.

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
  storage (no UI yet); ALL built-in languages migrated outright to the `sources/<id>/`
  shape (no legacy shim — pre-release, no users to keep compatible).

**Later (pack-only or pure catalog content, no native release):**
- New source packs (slang/dialect/medical/persona) ship to the catalog; users install;
  Tutomaton discovers on next launch.
- Phrase-pack bridge adapter source (`files.database:""`, queries `hostApi.phrasePacks`).
- Settings UI to toggle sources.
- Score-weighted multi-source merge.

## Open items for the two agents to confirm
- [x] Backend: author Arabic (and others) as `sources/<id>/` with this manifest + the
      object-row retriever contract (§3). Provide id, sha, db filename per source for the
      manifest + catalog. — **agreed; backend additionally migrates the 6 published
      corpora (en, es, zh, fr, de, ja) atomically; see §11.**
- [x] Frontend (me): build SourceRegistry + §4 merge + prefs storage + ~~legacy shim~~;
      add the `discoverPacksByType` hostApi wrapper once the native command exists.
      — **agreed; per §11, the §2 backwards-compat shim is dropped (no legacy code surface
      for initial release).**
- [x] Native: `packType`/source fields in `read_manifest_info`; `discoverPacksByType`
      command + hostApi method. (Frontend can stub the hostApi method to "[]" until native
      lands, so the pack works with built-ins only in the meantime.) — **agreed.**
- [x] Confirm: priority default (0) + built-in-core priority (100) acceptable.
      — **agreed; bridge / non-authoritative defaults sit at priority 20 (see §7).**

---

# Augmentations (v1, append-only — backend's additions, frontend co-signed by plan)

These sections (§7–§11) extend the contract without rewriting §1–§6. They cover the
universal-source convention (phrase-pack bridge case), the prompt convention that
keeps the LLM creative against non-authoritative grounding, where source packs land
in the catalog, the locked source-id naming, and the locked migration policy
(no shim, atomic migration of the 6 published corpora).

## §7. Universal sources (`tutomatonLanguage: "*"`)

Some sources serve every active target language by their nature. The canonical
example is the future phrase-pack bridge (every phrase pack already carries the
full ~50 target-language matrix; the bridge serves Arabic for an English-L1
learner and Korean for a Spanish-L1 learner from the same code path). They declare:

```jsonc
{
  "packType": "tutomaton-rag-source",
  "id": "tutomaton-phrase-bridge-v1",
  "tutomatonLanguage": "*",          // matches any active target language
  "authoritative": false,            // §7 universal sources MUST be non-authoritative
  "categories": ["examples", "translations"],
  "priority": 20,                    // default for non-authoritative; below per-language cores (100)
  "schemaVersion": 1,
  "files": { "database": "", "retriever": "retrieval/retriever.js" },
  "minTutomatonVersion": "0.1.0",
  "requiredHostApis": ["phrasePacks", "queryPackDb"]   // NEW; see §7.b
}
```

### §7.a — Registry rule additions for universal sources

- `tutomatonLanguage: "*"` is discovered for **every** language. Enable-pref is still
  keyed per-language (`tutomaton.sources.<lang>.<sourceId>`). The user can disable the
  bridge for Arabic but keep it on for Korean. Same source row in the manifest, one
  pref entry per (lang, sourceId) pair.
- The registry MUST reject any source manifest with
  `tutomatonLanguage: "*"` AND `authoritative: true` — a single source can't claim
  theme-bypass authority over every language. Log + skip.
- For the merge in §4 step 2 ("highest-priority non-authoritative wins"), universal
  sources compete with per-language non-authoritative sources by `priority` alone.
  Tie-break on `score` then `id` as in v1.

### §7.b — `requiredHostApis: string[]` (optional, new field)

Each entry names a capability the source's retriever expects on `hostApi`
(e.g. `"phrasePacks"`, `"queryPackDb"`, `"installModuleZip"`). The registry, on
discovery, checks each capability on the active `hostApi` and silently skips the
source if any are missing. Rationale: lets `0.16.0` ship without `phrasePacks`
discovery being usable yet; the bridge ships in `0.17.0` (or later) and slots in
the moment the host meets its needs. No Tutomaton release needed; no crash if
the capability set drifts later.

## §8. Non-authoritative grounding framing (prompt convention)

§4 specifies what gets merged. This addendum specifies how it's labeled into the
system prompt so source authors and grounding-instruction authors share one mental
model.

When the SourceRegistry composes the system prompt:

- The **authoritative** source's reference (if any, at most one per turn) is wrapped:
  ```
  <reference type="canonical" from="<source name>">
  …markdown…
  </reference>
  ```
  The LLM treats this as the corpus's curated answer — the right vocabulary, the
  right grammar, the right idiom.

- Each **non-authoritative** reference is wrapped:
  ```
  <reference type="inspiration" from="<source name>">
  …markdown…
  </reference>
  ```
  The LLM treats these as **real examples, used as inspiration** — not the answer
  to deliver verbatim. The user wants creative, flexible, in-the-moment tutoring.
  References ground; the model composes.

Per-language `prompts/grounding_instruction.txt` (owned by backend, per-language)
teaches the model this distinction in language-natural prose. Source authors writing
the reference markdown write in a "this is a useful example" voice, not a "this is
the answer" voice — especially for non-authoritative sources.

Example bridge reference (markdown the bridge retriever returns):

```markdown
## Examples from your phrase library

Here are real alignments to Arabic from phrase packs you already have. Use these
as inspiration; tailor your reply to what the user actually needs.

- "I'd like a coffee, please." → "أريد قهوة، من فضلك" *(from your "cooking" pack)*
- "Where is the bathroom?" → "أين الحمام؟" *(from your "travel" pack)*
```

The LLM is free to ignore, riff on, or quote any of this — informed by the
per-language grounding instruction. Whatever it produces is its own composition.

## §9. Source-pack catalog publishing

Built-in sources (bundled with Tutomaton) live inside the Tutomaton pack ZIP and
need no separate catalog entry — the Tutomaton manifest's per-language
`sources[]` array lists them with `bundled: true`.

Standalone source packs (everything else: phrase-bridge, slang/dialect/medical,
future per-language corpora published after the initial Tutomaton ZIP ships):

- Each ships as its own catalog `entries[]` row with `packType: "tutomaton-rag-source"`.
- Two-ZIP gating + tier follow existing catalog conventions (preview public,
  full Plus-gated when applicable).
- S3 prefix: `s3://corpan-prod/artifacts/corpan/tutomaton-sources/<id>-<version>.zip`
- CDN URL: `https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-sources/<id>-<version>.zip`
- Publisher: backend's `tools/llm-packs/publish.py source <path>` subcommand handles
  build + upload + reports `{sha256, sizeMb, url}` for the frontend agent to register
  in the catalog (the catalog patch — not the Tutomaton manifest, see §9.a).

### §9.a — Tutomaton's manifest vs the catalog

- The Tutomaton pack manifest (`packs/tutomaton/manifest.json`) declares **only the
  built-in (bundled) sources** under each `languages[<code>].sources[]`. These ship
  with the pack ZIP, no extra download.
- Standalone source packs (post-ship additions) DO NOT appear in Tutomaton's
  manifest. They appear in the **catalog** as standalone entries. Tutomaton's
  SourceRegistry discovers them at runtime via `hostApi.discoverPacksByType(…)`.
- Boundary: **frontend agent owns** the Tutomaton manifest (per
  `[[manifest-owned-by-frontend]]` feedback); backend never edits it. For a new
  standalone source pack, backend publishes the ZIP + delivers
  `{sha256, sizeMb, url, manifest excerpt}` to the frontend agent, who lands the
  catalog patch.

## §10. Source ID naming convention (locked, irreversible)

Per §1, source `id`s are irreversible (bump `-vN` for content changes, never reuse).
The convention, locked for this contract:

| Source kind | Pattern | Examples |
|---|---|---|
| Built-in per-language core | `tutomaton-corpus-<code>-core-v1` | `tutomaton-corpus-en-core-v1`, `tutomaton-corpus-ar-core-v1`, `tutomaton-corpus-zh-core-v1` |
| Future per-language variants | `tutomaton-corpus-<code>-<variant>-v1` | `tutomaton-corpus-es-slang-v1`, `tutomaton-corpus-ar-egyptian-v1`, `tutomaton-corpus-es-medical-v1` |
| Universal adapters | `tutomaton-<adapter-name>-v1` | `tutomaton-phrase-bridge-v1`, `tutomaton-ipa-bridge-v1` (hypothetical future) |

`<code>` follows Tutomaton's manifest codes exactly (e.g. `pt-BR`, `zh-Hant`,
`ko-polite`). The `-core-` slot is what differentiates the built-in authoritative
corpus from future variants of the same language. The `-v1` suffix exists so the
content version can advance (`-v2`, `-v3`) without colliding with prior ids in
user prefs or the catalog.

## §11. Migration policy (locked — no backwards-compat shim)

Per user direction, the initial Tutomaton release ships clean — no legacy code
surface, no two-shape coexistence. Backend migrates the 6 published corpora
(en, es, zh, fr, de, ja) **atomically** to the source-pack shape in a single
commit. Frontend's coordinating commit updates `src/retrievers.ts` import paths
to `../languages/<code>/sources/core/retrieval/retriever`.

Consequences:

- The §2 "backwards-compat shim for legacy `languages/<code>/module.json`" is
  **dropped** from frontend's SourceRegistry implementation. The registry only
  handles source-pack-shaped sources.
- Pre-existing prompt-only stub languages (the ~40 ar/bg/bn/ca/… directories
  that have `module.json` + `prompts/` but no retriever and no data) keep
  working naturally — they have **zero sources** in the registry, so the merge
  produces `{kind: "none"}` and the chat path delivers the system_prompt +
  grounding_instruction with no `<reference>` block. This is not a special case;
  it's the natural zero-source path.
- Migration coordination: backend delivers (1) moved files for all 6 corpora,
  (2) generated `sources/core/manifest.json` for each, (3) the exact list of
  new import paths for `src/retrievers.ts` (frontend's commit). Backend and
  frontend's commits land paired so neither tree is broken between them.
