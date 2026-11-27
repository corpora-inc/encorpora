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

let hits = engine.retriever().search("query", &SearchOptions { k: 10, ..Default::default() })?;
let answer = engine.ask("question", &AskOptions { role: Role::Trainee, equip: Some("id".into()), ..Default::default() })?;
// `answer` serializes to exactly the `ask --json` object in CONTRACT.
```

| Module | What it does |
|---|---|
| `packs` | Manifest parse, ed25519 signature check, file hashes, atomic install from a directory or zip (zip-slip, symlink, entry-count and written-byte limits), downgrade refusal, `current` pointer, install stamp. |
| `pack` | A verified pack open read-only; typed rows (`section`, `fact`, `answer`, `equipment`, `applies_to`, `explanation`, `chunk`); `SCHEMA_V1` DDL (asserted equal to CONTRACT by a test). |
| `normalize` | Case/punctuation folding, number words to digits, one spelling per unit, Snowball stemming, synonym expansion from the pack, equipment mentions, safe FTS5 query building. |
| `embed` | `Embedder` trait; `HashingEmbedder` (deterministic, weight-free; for tests and as a floor); int8 quantization as packs store it. |
| `retrieval` | BM25 over `chunk_fts` + cosine over int8 `chunk_vec`, reciprocal-rank fusion, equipment filter/boost, `Reranker` hook. |
| `answer` | Model-off answer engine: answer cache → `baked`; best sections verbatim → `composed`; weak support → `declined` with nearest sections. |
| `check` | Support checker: verbatim quotes, existing cites, unsupported claims dropped by paragraph; strict mode adds content-overlap and verbatim-number rules. |
| `fixture` | Fictional signed pack for tests (`harvest fixture <dir>`). Its key is public. Never trust it outside tests. |

### Embedder ids

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
- **Answer cache.** Put the canonical question among the aliases. A hit needs
  alias similarity ≥ `AskOptions::cache_threshold` (default 0.75; Dice over
  content stems, halved when the numbers differ). The evaluation lane
  calibrates it.

## CLI

```
harvest verify  <pack-dir> [--pubkey KEY] [--json]
harvest search  <pack-dir> "<query>" [--k 10] [--equip ID] [--json]
harvest ask     <pack-dir> "<question>" [--role operator] [--equip ID] [--llm off] [--json]
harvest fixture <dir>
```

`KEY` is a base64 or hex public key, or a file holding one; it defaults to
`$HARVEST_PUBKEY`. Without a trusted key nothing opens. Exit codes: 0 ok, 1
engine error (with `{"ok":false,"error":…}` under `--json`), 2 usage.
