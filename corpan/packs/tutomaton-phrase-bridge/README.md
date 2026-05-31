# Tutomaton phrase-pack bridge (`tutomaton-phrase-bridge-v1`)

A Tutomaton RAG source pack (per `corpan/packs/tutomaton/RAG_SOURCES_CONTRACT.md`) that adapts the user's already-installed Corpán phrase packs into per-turn grounding for whatever Tutomaton target language is active. ~20K phrases per phrase pack × full ~50-language translation matrix = millions of aligned source/target pairs the tutor can ground against, at zero authoring cost.

## What it does

Per user turn:

1. Calls `hostApi.phrasePacks.getInstalled()` to enumerate installed phrase packs.
2. For each pack, queries its sqlite via `hostApi.queryPackDb` with a token-LIKE search on `entries.english`, joined to `translations` for the active target language.
3. Collects matches across packs, dedups by English source, formats as an "Examples from your phrase library" markdown block.
4. Returns it as **non-authoritative grounding** (per contract §8) — the registry wraps it `<reference type="inspiration" from="Phrase library bridge">` and the per-language grounding instruction teaches the LLM to treat it as material to riff on, not "the answer."

## Why this shape

| Question | Answer |
|---|---|
| Authoritative? | **No** — universal sources (`tutomatonLanguage: "*"`) MUST be non-authoritative per contract §7. The per-language `core` source remains the curated authority. |
| Bundled sqlite? | **No** (`files.database: ""`) — bridge queries the user's installed phrase packs at runtime. The pack ships code + manifest only (~10 KB). |
| Why no embeddings / vector NN? | On-device cost is prohibitive (50-150 MB embedding model + ~30 MB index per pack). FTS-equivalent LIKE search covers the vast majority of tutor queries which are short and lexical. Vector ranking can be added later as a v2 pack with no Tutomaton release. |
| Ranking? | v1 is token-AND LIKE matching with per-pack LIMIT, dedup by English text. No score-weighted merge — registry's v1 merge rule (§4) takes ≤2 grounding blocks regardless. |
| Coverage gaps? | Bumpy. If the user has only "cinema" + "cooking" phrase packs and asks about "democracy", bridge misses → falls through to LLM-only. That's fine; it's additive. |

## Retriever signature note — needs frontend coordination

Contract §3 specifies `retrieve(text, queryFn)` where `queryFn` is scoped to **this source's** dbName. The bridge has no bundled sqlite and needs to query N installed phrase packs, each with its own packId. It can't use the scoped-to-one queryFn.

This pack's `retrieval/retriever.ts` is written to **pattern (A)** — an optional third `helpers` parameter the registry passes only to universal/bridge sources, carrying `{ targetLanguage, hostApi: { phrasePacks, queryPackDb } }`. Other retrievers receive `undefined` and ignore it; the standard contract is unchanged for them.

Until the frontend agent decides between pattern (A) (add `helpers` param) and pattern (B) (multi-db queryFn variant), and wires the registry to pass through what the bridge needs:

- Build will succeed; Tutomaton won't crash.
- Bridge returns `kind: "none"` with a log breadcrumb when `helpers` isn't passed.
- Once the registry wires up pattern (A) or equivalent, the bridge starts contributing immediately with no code change here. If pattern (B) is chosen instead, the bridge needs a small refactor to use the extended queryFn — call sites change, matching/formatting logic doesn't.

Flagged for frontend agent in the handoff doc.

## Phrase pack schema reference

```sql
CREATE TABLE entries (
  id       INTEGER PRIMARY KEY,
  english  TEXT NOT NULL,
  level    TEXT
);

CREATE TABLE translations (
  entry_id       INTEGER NOT NULL,
  language_code  TEXT NOT NULL,
  text           TEXT NOT NULL,
  romanization   TEXT,
  PRIMARY KEY (entry_id, language_code)
) WITHOUT ROWID;

CREATE TABLE pack_meta (
  id, version, schema_version, name, description, category, topic,
  level_min, level_max, entry_count, language_codes, authored_at, icon, accent_color
);
```

The bridge's SQL:

```sql
SELECT e.english, t.text AS target, t.romanization
FROM entries e
JOIN translations t ON t.entry_id = e.id
WHERE t.language_code = ? AND english LIKE ? AND english LIKE ? AND …
LIMIT 3
```

Per pack: ~5-20 ms in practice. Across 10 installed packs in parallel: well under 200 ms total.

## Building + publishing

Same as any source pack:

```bash
cd corpan
python3 tools/llm-packs/publish.py source packs/tutomaton-phrase-bridge --upload
```

The publisher:
1. Reads `packs/tutomaton-phrase-bridge/manifest.json`
2. ZIPs the whole `tutomaton-phrase-bridge/` directory (manifest + retrieval/retriever.ts + this README)
3. Uploads as `tutomaton-phrase-bridge-v1.zip` to `s3://corpan-prod/artifacts/corpan/tutomaton-sources/`
4. Prints the registry entry the frontend agent pastes into the catalog

After it's on the catalog + discoverable via `hostApi.discoverPacksByType`, every Tutomaton user with phrase packs installed picks up the bridge automatically. Per-language enable pref defaults ON; users can disable it per language in Settings (when that UI lands).

## Content updates

Per contract §1, `id`s are irreversible. The bridge has no content — only code. When the retriever logic changes (better ranking, embedding support, etc.), bump the manifest id to `-v2` and republish. Catalog will route users to the new bridge; old `-v1` can stay on CDN for back-compat or be GC'd later.

## See also

- `corpan/packs/tutomaton/RAG_SOURCES_CONTRACT.md` — the lock-in contract (sections §7-§11 cover universal sources + non-authoritative framing + naming + migration)
- `corpan/packs/tutomaton/AUTHORING_GUIDE.md` — phase-by-phase source authoring workflow
- `corpan/tools/phrase-packs/build_phrase_pack.py` — source of the phrase pack schema this bridge queries
- `corpan/corpan-app/src/contentPacks/hostApi.ts` — `hostApi.phrasePacks` shape (already exists; `queryPackDb` already used by Tutomaton)
