# Corpán LLM Runtime + Tutomaton — Handoff

Spark → frontend-agent handoff for the on-device LLM tutor work. Everything builds toward Corpán 0.16.0; everything is `devOnly: true` until the polish pass clears it.

## TL;DR

Three artifacts, in order of stability:

1. **`tauri-plugin-corpan-llm`** — native plugin (Rust + iOS + Android). Scaffolded; needs vendored llama.cpp + Metal/Vulkan FFI on the polish machine.
2. **`llm-base-qwen3-4b-v1`** — shared 2.5 GB GGUF pack. **Already published to CDN.**
3. **`tutomaton-v1`** — single multilingual tutor pack with internal `LanguageManager`. **Pack shell + ES + ZH language modules already published to CDN.**

**Architecture is one pack, many languages.** Tutomaton's `manifest.json` declares a `languages[]` registry; each entry is a small module ZIP (sqlite + prompts + retriever) downloaded on first selection. Not one pack per language.

## CDN status — what's live

All four artifact ZIPs are publicly reachable:

```
https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/llm-base-qwen3-4b-v1-0.1.0-preview.zip    (1 MB)
https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/llm-base-qwen3-4b-v1-0.1.0-full.zip       (2.5 GB)
https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/tutomaton-v1-0.1.0-preview.zip            (1 MB)
https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/tutomaton-v1-0.1.0-full.zip               (10 KB)
https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages/es-0.1.0.zip                    (41 MB)
https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages/zh-0.1.0.zip                    (1 MB)
```

**Catalog promotion pending.** Spark's `corpan-publisher` IAM can write artifact ZIPs but not the root `catalog-v2.json`. Patched catalog (preserves 569 narrations + 29 books + 9 characters + 10 voiceProfiles, adds 2 `llmPacks` entries) is at:

```
corpan/infra/catalog-v2.tutomaton-patch.json
```

From the polish machine, two commands flip it live:

```bash
aws --profile <full-perms> s3 cp \
  corpan/infra/catalog-v2.tutomaton-patch.json \
  s3://corpan-prod/catalog-v2.json \
  --cache-control "public, max-age=60, stale-while-revalidate=300" \
  --content-type application/json

aws --profile <full-perms> cloudfront create-invalidation \
  --distribution-id E1RDNUCVE70SCI --paths /catalog-v2.json
```

## Live-reload dev loop (run on the dev-pairing machine)

Tutomaton's `dev:corpan` serves the pack tree over LAN to a real corpan-app running on a device under test (iOS/Android). Edit a TS file → vite rebuilds `dist/chat.js` → `manifest.devRevision` bumps → the running app reloads the pack module. **Not a browser preview.**

**One-time setup:**
```bash
git pull
cd corpan/packs/tutomaton
npm install
npm run bootstrap   # fetches ES corpus from CDN (41 MB), rebuilds ZH from build_corpus.py
```

**Then start the dev server:**
```bash
npm run dev:corpan
```

You'll see a banner like:

```
────────────────────────────────────────────────────────────────────────
 Tutomaton dev:corpan ready on port 8991

 Manifest URL (point your corpan-app dev to this):
   http://10.0.0.49:8991/packs/tutomaton/manifest.json

 Other entry points served:
   http://10.0.0.49:8991/packs/tutomaton/dist/chat.js
   http://10.0.0.49:8991/packs/tutomaton/languages/es/module.json
   http://10.0.0.49:8991/packs/tutomaton/languages/zh/module.json
────────────────────────────────────────────────────────────────────────
```

Copy the manifest URL into the corpan-app dev pack-loader. The device fetches it, then fetches the entry, language modules, etc. CORS + `Cache-Control: no-store` are wired so device reloads pick up your edits immediately.

**Port convention (so multiple `dev:corpan` instances don't clash):**

| Pack | Port |
|---|---|
| stargate-reader | 8989 |
| earthgate-reader | 8990 |
| **tutomaton** | **8991** |

Override: `TUTOMATON_DEV_PORT=9001 npm run dev:corpan`. If the port is in use, the script prints a clear error and tells you to set the env var.

**Why polling (not `fs.watch`) in dev-corpan.mjs:** vite's `emptyOutDir: true` recreates `dist/` on each build, which invalidates `fs.watch` handles on Linux. The watcher polls `dist/chat.js` mtime instead. Don't "fix" it back.

**Chat won't generate tokens yet** — `window.__TAURI__` invocations land on stubbed plugin commands. Iterate freely on:
- Language picker UI / browse-languages affordance for not-yet-installed languages
- Chat bubble styles, streaming caret, scroll behavior
- Voice mode UI (mic pulse, recording animation)
- Onboarding modal copy + flow
- Settings panel
- Theme-bypass rendering

Once the desktop `llama-cpp-2` real-generation path is wired in `plugins/tauri-plugin-corpan-llm/src/state.rs` (currently stubbed to echo tokens), the chat will start producing real tokens in this loop too.

## Decisions locked in

- Plus-only, no per-language IAP
- `devOnly: true` initially; flip in catalog (no client release needed) to graduate
- Tutomaton = single pack with internal language management
- Two languages at v1: Spanish (full corpus, 41 MB module) + Mandarin (10 seed lessons, 1 MB module — proves N>1)
- GPU: stock llama.cpp Metal (iOS) / Vulkan (Android) + CPU fallback. *"Reliable and mainstream," not elite.*
- Voice mode: Whisper from existing `tauri-plugin-stt`; TTS from `tauri-plugin-tts`. Parlometron push-to-talk pattern.
- Shared base model: download once, every LLM-using pack on the device reuses it.
- Quant: Q4_K_M only at v1.

## Architecture

```
                      ┌─────────────────────────────────────┐
   stable substrate   │  tauri-plugin-corpan-llm  (NEW)     │
                      │  vendored llama.cpp + Metal/Vulkan  │
                      └────────────────┬────────────────────┘
                                       │ consumed by
                      ┌────────────────┴────────────────────┐
   shared content     │  llm-base-qwen3-4b-v1  (CDN)        │
                      │  2.5 GB GGUF (Q4_K_M)               │
                      └────────────────┬────────────────────┘
                                       │ depended on by
                      ┌────────────────┴────────────────────┐
   user-facing pack   │  tutomaton-v1  (CDN)                │
                      │  shell UI + LanguageManager         │
                      │                                     │
                      │  languages/ (lazy-downloaded):      │
                      │    es/  Spanish (41 MB module)      │
                      │    zh/  Mandarin (1 MB module)      │
                      │    fr/  …future…                    │
                      │    ja/  …future…  (×50 eventually)  │
                      └─────────────────────────────────────┘
```

Adding language N+1 = add a row to Tutomaton's `manifest.json` + author the module + `python3 tools/llm-packs/publish.py language packs/tutomaton <code> --sync-manifest --upload`. No new pack, no new Library entry, no new IAP, no new catalog churn.

## Critical paths

### Runtime plugin (scaffolded — needs native FFI)
- `corpan/plugins/tauri-plugin-corpan-llm/` — whole plugin
- `corpan/plugins/tauri-plugin-corpan-llm/README.md` — per-platform what's done / what's left

### Tutomaton pack
- `corpan/packs/tutomaton/manifest.json` — pack manifest + `languages[]` registry (already populated with real CDN URLs + sha256s)
- `corpan/packs/tutomaton/src/chat.ts` — shell chat UI + language picker
- `corpan/packs/tutomaton/src/languageManager.ts` — discover / download / cache / activate modules
- `corpan/packs/tutomaton/src/chat.css` — minimal styles (the place to start polish)
- `corpan/packs/tutomaton/languages/es/` — Spanish module (corpus + prompts + retriever)
- `corpan/packs/tutomaton/languages/zh/` — Mandarin module
- `corpan/packs/tutomaton/scripts/dev-corpan.mjs` — live-reload watcher
- `corpan/packs/tutomaton/scripts/bootstrap-languages.mjs` — fetch ES from CDN + rebuild ZH

### Local corpora (gitignored — bootstrap on fresh checkout)
- `corpan/packs/tutomaton/languages/es/data/spanish.sqlite3` — 157 MB. Bootstrap fetches from CDN.
- `corpan/packs/tutomaton/languages/es/data/core_vocab.json` — 52 KB. Bootstrap fetches with the sqlite.
- `corpan/packs/tutomaton/languages/zh/data/mandarin.sqlite3` — 130 KB. Bootstrap rebuilds from `languages/zh/build_corpus.py`.

### Base model (on Spark only)
- `/home/skyl/models/quantized/qwen3_4b_2507_stock/qwen3stock-q4_k_m.gguf` (2.5 GB, already on CDN)
- `/home/skyl/models/quantized/qwen3_4b_2507_stock/Modelfile.v4` — Spanish-pack system prompt is already a port of this

### Publisher
- `corpan/tools/llm-packs/publish.py` — subcommands: `base` / `pack` / `language` / `remove-from-catalog`. Catalog read via CDN (Spark IAM lacks GetObject); writes saved locally + S3 if perms allow.

### Catalog wiring
- `corpan/corpan-app/src/contentPacks/llmTypes.ts` — `CatalogLlmBase` (catalog `llmPacks[]`), `TutomatonLanguageModule` (in-pack registry type), `resolveLlmDeps()` helper

## Work remaining, ordered

### 1. Native FFI (biggest unknown — start here)
Plugin scaffold has TODO blocks at FFI boundaries. See `plugins/tauri-plugin-corpan-llm/README.md` for the per-platform punch list.

**Quick win for the frontend dev loop**: wire the desktop `llama-cpp-2` real-generation path in `src/state.rs` first (currently stubs echo tokens). That gets `npm run tauri dev` on the Spark doing real inference in the browser, so the frontend agent can test the full chat flow.

### 2. Tauri host app integration
`corpan-app/src-tauri/Cargo.toml`:
```toml
tauri-plugin-corpan-llm = { path = "../../plugins/tauri-plugin-corpan-llm" }
```
`corpan-app/src-tauri/src/lib.rs`:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_corpan_llm::init())
```
Also: a new `hostApi.installModuleZip({packId, subPath, url, sha256})` capability for the LanguageManager. Should reuse the existing pack-downloader code path scoped to `<packDataDir>/<subPath>/`. Currently `languageManager.ts` calls it conditionally — falls back to "module already bundled" if absent (works for dev where the bootstrap script puts files in place).

### 3. Catalog wiring
- `corpan-app/src/store/catalog.ts`: extend `CatalogV2` with `llmPacks?: CatalogLlmEntry[]`. Filter on `devOnly` everywhere catalog entries are surfaced.
- `corpan-app/src/contentPacks/install.ts`: when installing a regular pack with `dependsOn`, walk and resolve `llm-*` entries via `resolveLlmDeps()`. Queue downloads in order with a combined progress bar.
- `corpan-app/src-tauri/src/content_packs.rs`: install destination for `llm-base` packs is `<appDataDir>/corpan-packs/<packId>/`. The native plugin reads from there via `llm_load({modelPackId})`.

### 4. Tutomaton UI polish
Current `src/chat.ts` is a minimal shell:
- `<select>` for language picker → wants pill row with flags + native display names + "+ Add language" affordance for not-yet-installed langs
- Bare-bones bubble UI → premium message bubbles, streaming caret, scroll behavior
- Onboarding modal for first language pick (with download confirmation)
- Settings: TTS voice picker, voice mode toggle, GPU backend override, decoder temperature
- Voice mode push-to-talk is wired; the audio-level pulse animation isn't (borrow parlometron's RMS pulse)

### 5. Mandarin corpus expansion
Mandarin module ships with 10 HSK1–3 lessons + 10 themes (1 MB). Spanish ships 35 lessons + 25 themes + 522K conjugation rows (41 MB). Mandarin needs more lessons, themes, a CORE_VOCAB for top 300 hanzi, and native-Chinese query patterns in `languages/zh/retrieval/retriever.ts`.

Edit `languages/zh/build_corpus.py` → run `npm run bootstrap` to regen the sqlite → bump `languages/zh/module.json` `contentVersion` → `python3 tools/llm-packs/publish.py language packs/tutomaton zh --sync-manifest --upload`.

### 6. Publish updated artifacts (already done at v0.1.0)
When you cut new versions:
```bash
# Per language:
python3 tools/llm-packs/publish.py language packs/tutomaton <code> --sync-manifest --upload

# Tutomaton shell (after manifest synced):
python3 tools/llm-packs/publish.py pack packs/tutomaton --upload --update-catalog

# Base GGUF (rarely):
python3 tools/llm-packs/publish.py base \
  --gguf <path> --pack-id llm-base-qwen3-4b-v1 --version <ver> \
  --upload --update-catalog
```
Catalog `--update-catalog` writes a patched copy locally on Spark; polish machine uploads + invalidates (see top of this doc).

## Open decisions

1. **Vulkan device probing on Android** — keep GPU enabled by default + per-device override. Watch field signal.
2. **Cold-start UX** — first `llm_load` on flagship = 3–5 sec mmap. Need a loading state. Consider an `llm-load-progress` event.
3. **Module uninstall semantics** — if user removes Tutomaton, prune the 2.5 GB base? Recommend: no.
4. **Whisper model size for voice** — Tutomaton currently recommends Large-v3-turbo (~1.5 GB). Consider shipping Small as default with "upgrade quality" pull.
5. **Plus check at first model load** — already gated at download via signed URLs (when signed URLs land). Consider re-checking at first load.
6. **Browse-languages UX inside Tutomaton** — current `<select>` doesn't telegraph "tap to download more languages." Design the discovery surface.

## What's NOT in scope

- Persona overlays — wait for user signal on the base tutor.
- Telemetry — opt-in, on-device-only when added; not v1.
- Q3_K_M variant — future addition.
- Other LLM-consuming packs (Q&A, story generation) — same plugin, separate pack design.
- True signed-URL gating of full ZIPs — currently public. Polish machine adds the signed-URL middleware when needed; for dev, public is fine.

## Verification checklist before flipping `devOnly: false`

- [ ] iPad Pro M2: install Tutomaton end-to-end (preview → Plus → base download → shell → Spanish module → chat → voice mode round-trip). 25+ t/s sustained.
- [ ] iPhone 15 Pro: same. 20+ t/s sustained.
- [ ] Pixel 8 Pro: same, Vulkan. 10+ t/s sustained.
- [ ] Pixel 6a: same, CPU fallback. 3+ t/s, no crashes.
- [ ] Add Mandarin from the language picker: only 1 MB module downloads. Sub-second swap into Mandarin chat.
- [ ] TTS toggle works in both languages with correct per-language voices (`es-MX` + `zh-CN`).
- [ ] Voice mode: push-to-talk → STT → chat → auto-TTS replay. iOS mic indicator releases cleanly on unmount.
- [ ] Cold-launch loading UX is acceptable.
- [ ] Low-memory device shows a clean error, not a crash.
- [ ] Uninstall Tutomaton does NOT prune the base. Reinstall skips base download.
- [ ] Adversarial prompts ("respond in English") are deflected per the system prompt.
