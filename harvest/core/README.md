# harvest-core

The on-device engine for verified knowledge packs: open a signed pack,
retrieve from it, answer from it, and check every answer against it. Rust
library `harvest_core` plus the `harvest` CLI. Corpus-agnostic: nothing here
knows what a pack is about. The interface with the pipeline, the app and the
evaluation harness is [`../CONTRACT.md`](../CONTRACT.md).

## Build and test

```sh
cd harvest/core
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

The toolchain is pinned in `rust-toolchain.toml`. SQLite (with FTS5) is
compiled in (`rusqlite/bundled`), so there is no system library, no OpenSSL
and nothing to download at runtime. Tests build a tiny signed fixture pack in
a temp directory; nothing is committed as binary.

The host links the library without the CLI:

```toml
harvest-core = { path = "../../harvest/core", default-features = false }
```

## The API the host calls

All types are `Send + Sync`; share them behind an `Arc`.

```rust
use harvest_core::{packs, Pack, Engine, AskOptions, Role, SearchOptions, TrustedKey};

// Keys: the publisher's ed25519 public key(s), compiled into the app.
let keys = vec![TrustedKey::parse(PACK_PUBLIC_KEY_B64)?];

// Install (atomic; refuses a downgrade; keeps the previous version).
let installed = packs::install_dir(&root, &downloaded_dir, &keys)?;      // or install_zip
let dir = packs::current(&root, "my-pack")?.expect("installed");

// Open: signature + SHA-256 of every file before any row is read.
// Verify::InstallStamp skips re-hashing files unchanged since install.
let pack = Arc::new(Pack::open_with(&dir, &keys, harvest_core::Verify::InstallStamp)?);

let engine = Engine::new(pack.clone());                 // lexical only
// .with_embedder(Arc::new(my_embedder))                // dense half, if ids match
// .with_reranker(Arc::new(my_reranker))                // optional hook
// .with_llm(Arc::new(my_llm_bridge))                   // model on (see below)

let hits = engine.retriever().search("query", &SearchOptions { k: 10, ..Default::default() })?;
let answer = engine.ask("question", &AskOptions { role: Role::Trainee, equip: Some("id".into()), ..Default::default() })?;
// `answer` serializes to exactly the `ask --json` object in CONTRACT.

// Audit: one hash-chained row per query in the device's records database.
let (answer, trace) = engine.ask_traced("question", &opts)?;
audit::append(&records_conn, &audit::AuditEntry::from_answer(pack.pack_id(), "question", &answer, &trace))?;
let report = audit::verify_chain(&records_conn)?;   // ok, first_bad, modes, bake_hit_rate

// Free-text grading and field notes (model optional).
let g = grade::grade(learner_text, &grade::Rubric::parse(&question.answer)?, Some(llm))?;
let n = notes::structure_note(note_text, &notes::NoteVocab::from_pack(&pack)?, Some(llm))?;
```

### The model

The engine asks a model only for small jobs with a JSON schema, and checks
every answer. The app implements `Llm` over its llama.cpp runtime, turning
`LlmRequest.schema` into a grammar. The CLI's `OpenAiCompatible` sends it as
`response_format: json_schema` to any OpenAI-compatible server.

```rust
pub trait Llm: Send + Sync {
    fn id(&self) -> String;                                  // exact model id, audited
    fn complete(&self, req: &LlmRequest) -> Result<String>;  // JSON matching req.schema
}
```

`ask` with a model runs this loop:

1. **Answer cache** first. A hit is `baked` and the model is not called.
2. **Expand** (`expansion` schema): up to four queries; `ambiguous` + `clarify`
   only when one more fact is needed. That returns `mode: "clarify"`, with the
   question as one text segment and `nearest` sections.
3. **Retrieve** the question plus its expansions (RRF over every list).
4. **Select** (`selection`, only when more than `max_sections + 1` sections qualify).
5. **Compose** (`answer_segments`) from those passages only. Limits are marked
   `must_quote_verbatim`.
6. **Check** in strict mode. If nothing supported survives, or the model errs,
   the deterministic answer is returned and `trace.model_error` says why.

| Module | What it does |
|---|---|
| `packs` | Manifest parse, ed25519 signature check, file hashes, atomic install from a directory or zip (zip-slip, symlink, entry-count and written-byte limits), downgrade refusal, `current` pointer, install stamp. |
| `pack` | A verified pack open read-only; typed rows (`section`, `fact`, `answer`, `equipment`, `applies_to`, `explanation`, `chunk`); `SCHEMA_V1` DDL (asserted equal to CONTRACT by a test). |
| `normalize` | Case/punctuation folding, number words to digits, one spelling per unit, Snowball stemming, synonym expansion from the pack, equipment mentions, safe FTS5 query building. |
| `embed` | `Embedder` trait; `HashingEmbedder` (deterministic, weight-free; for tests and as a floor); int8 quantization as packs store it. |
| `retrieval` | BM25 over `chunk_fts` + cosine over int8 `chunk_vec`, reciprocal-rank fusion, equipment filter/boost, `Reranker` hook. |
| `answer` | Model-off answer engine: answer cache → `baked`; best sections verbatim → `composed`; weak support → `declined` with nearest sections. |
| `check` | Support checker: verbatim quotes, existing cites, unsupported claims dropped by paragraph; strict mode adds content-overlap and verbatim-number rules. |
| `compose` | Prompts and schemas for expand, select and compose. |
| `llm` | `Llm` trait, `OpenAiCompatible` (CLI feature), `ScriptedLlm` for tests. |
| `audit` | Append-only, hash-chained `audit` table (triggers refuse UPDATE/DELETE); `verify_chain` recomputes every link and reports the bake hit rate. |
| `grade` | Rubric grading: keyword rules with the model off. With it on, the model judges and must quote the learner's own words as evidence. |
| `notes` | Field note → `{component, condition, action}`. Keywords with the model off; model output kept only when grounded in the vocabulary or the note. |
| `llama` | (feature `llama`) in-process GGUF embedder on the same `llama-cpp-2 =0.1.146` pin as the app's LLM plugin. |
| `fixture` | Fictional signed pack for tests (`harvest fixture <dir>`). Its key is public. Never trust it outside tests. |

### Embedder ids

`LlamaEmbedder::for_pack(gguf, &pack)` builds the id the pipeline writes,
`<model_name>@<first 16 hex of the GGUF's SHA-256>[/mrl<dim>]`, and applies
`embed_query_template`. A different file gets a different id, and the dense
half is refused. The pinned llama.cpp loads BERT-family GGUFs (nomic-embed
v1.5 tested). It does **not** load EmbeddingGemma 2 (`gemma-embedding2` is
newer than the pin), so using that model means bumping the pin together with
`tauri-plugin-corpan-llm`. On Linux, bindgen may need
`BINDGEN_EXTRA_CLANG_ARGS=-I/usr/lib/gcc/<triple>/<ver>/include`.

Dense retrieval runs only when `Embedder::id()` equals `pack_meta.embedder_id`
and `Embedder::dim()` equals `pack_meta.embed_dim`. On any mismatch it is
refused (`SearchResult.dense = mismatch`) and retrieval stays lexical; vectors
from different models are never compared.

## Pack conventions this crate relies on

These fill gaps CONTRACT leaves open. The pipeline writes packs this way.

- **Signature.** `sig` is base64 ed25519 over the canonical JSON of the
  manifest with the `signature` member removed: keys sorted, no whitespace,
  non-ASCII raw. In Python:
  `json.dumps(m, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()`.
  No floats in a manifest. `key_id` is the lowercase hex of the first 8 bytes
  of SHA-256 over the raw 32-byte public key.
- **Versions** compare by their numeric fields: `2026.11.27-1 < 2026.11.27-2 < 2026.11.28-1`.
- **int8 vectors.** `scale = max|v| / 127`, `vec[i] = round(v[i] / scale)` as
  signed bytes, `dim` bytes per row. Vectors are L2-normalized before
  quantizing.
- **Chunk → section.** `section`: `ref_id` is the section id. `explanation`:
  `<section_id>:<level>` (or a bare section id).
  `fact`, `term`: their `section_id`. `answer`, `question`, `diagram`: first of
  `section_ids`. `proc_step`: `ref_id` is `<proc_id>#<ord>`.
- **Equipment.** A row with no `applies_to` applies to all equipment. A chunk
  inherits `applies_to` from its section or nearest ancestor section.
- **Synonyms (optional table).** `CREATE TABLE synonym (phrase TEXT NOT NULL,
  canonical TEXT NOT NULL, lang TEXT NOT NULL)`: when a query contains
  `phrase`, `canonical` is searched too and satisfies the phrase's words.
- **Rubrics** (`question.answer` for `free_text`): `{"points":[{"id","text","keywords":[phrase | [alternatives…]],"weight"}],"pass":0.7}`.
- **Note vocabulary** (optional `pack_meta.note_vocab`): `{"components":[{"name","aliases"}],"conditions":[…],"actions":[…]}`, merged over built-in generic conditions and actions.
- **Answer cache.** Put the canonical question among the aliases. A hit needs
  alias similarity ≥ `AskOptions::cache_threshold` (default 0.75; Dice over
  content stems, halved when the numbers differ). The evaluation lane
  calibrates it.

## CLI

```
harvest verify  <pack-dir> [--pubkey KEY] [--json]
harvest search  <pack-dir> "<query>" [--k 10] [--equip ID] [--json]
harvest ask     <pack-dir> "<question>" [--role operator] [--equip ID] [--llm off|http://host:port/v1]
                [--llm-model NAME] [--embedder auto|none|hashing|<file.gguf>] [--audit <records-db>] [--json]
harvest audit   <records-db> [--json]      # verify the chain; modes and bake hit rate
harvest fixture <dir>
```

`KEY` is a base64 or hex public key, or a file holding one; it defaults to
`$HARVEST_PUBKEY`. Without a trusted key nothing opens. Exit codes: 0 ok, 1
engine error (with `{"ok":false,"error":…}` under `--json`), 2 usage.
