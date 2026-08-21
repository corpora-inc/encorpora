# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**How work lands: read the root `AGENTS.md` first.** Development is trunk-based —
short-lived branch off `main`, PR, automated adversarial review, green checks,
squash-merge. No integration branches, no batching, no leaving work uncommitted for
someone else. This file covers the Corpán app itself; `AGENTS.md` covers the process.

## Release notes — read this before shipping

We track release notes per shippable unit. Conventions are in
`corpan/CHANGELOGS.md`. Summary:

- Every shippable unit (core app, each pack, each plugin, each
  narration series) keeps its own `CHANGELOG.md` next to its manifest.
- Format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
- **When you make a user-visible change to a unit, add a line to its
  `[Unreleased]` section before opening a PR.** No batching.
- When the version in the manifest changes, promote `[Unreleased]` to a
  dated, versioned entry and start a fresh `[Unreleased]` block.

If a change crosses units (e.g. a Corpán app feature that needs a
plugin bump), add the entry to *each* affected unit's changelog.

## Project Overview

Corpan is a cross-platform language learning application built with:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Tauri (Rust) for native desktop/mobile capabilities
- **Data Management**: Django backend (`dja/`) for content generation and SQLite database bundling
- **Packs**: Pluggable pack system with SDK for standalone development

The app delivers language learning content through mini-experiences packaged as downloadable content packs.

## Repository Structure

```
corpan-app/          # Main Tauri application
├── src/             # React frontend
│   ├── components/  # UI components (shadcn/ui + custom)
│   ├── store/       # Zustand state management
│   ├── util/        # Utilities (TTS, browser APIs)
│   └── contentPacks/# Pack loading logic
├── src-tauri/       # Rust backend
│   ├── src/         # Main Rust code (DB queries, Tauri commands)
│   ├── gen/         # Generated platform code (DO NOT EDIT)
│   ├── android/     # Android-specific config
│   └── ios/         # iOS-specific config
└── scripts/         # Build/generation scripts

dja/                 # Django content management
├── cor/             # Core app with models (Entry, Translation, Pack, Narrator)
│   ├── models.py    # Language, Domain, Entry, Translation, Narrator, Pack
│   ├── packs/       # Pack generation service
│   └── fixtures/    # Seed data for languages/domains
└── db.sqlite3       # Development database
└── release.sqlite3  # Production-ready database bundle

packs/               # Standalone pack packages
├── sdk/             # Corpan Pack SDK for pack development
└── hover-runner/    # Reference pack

plugins/             # 11 Rust crates (10 Tauri plugins + the corpan-asr-contract lib)
├── tauri-plugin-game-packs/   # LIVE: registers the corpan-pack:// URI scheme
├── tauri-plugin-corpan-llm/   # on-device LLM (vendored llama.cpp)
├── tauri-plugin-tts/          # text to speech
├── tauri-plugin-stt/          # speech to text (whisper)
├── tauri-plugin-asr-native/   # OS-native dictation
├── tauri-plugin-iap/          # in-app purchase (vendored, see VENDORING.md)
├── tauri-plugin-subscriptions/
├── tauri-plugin-haptics/
├── tauri-plugin-audio-keepalive/
├── tauri-plugin-radio-stream/
└── corpan-asr-contract/       # shared ASR types (not a Tauri plugin)
```

## Common Commands

### Frontend Development (corpan-app/)

```bash
# Type checking
npm run tsc

# Development mode (React only, without Tauri)
npm run dev

# Build frontend
npm run build

# Full Tauri development (with Rust backend)
npm run tauri dev

# Build for platform
npm run tauri build

# Access Tauri CLI directly
npm run tauri [command]
```

### Rust/Tauri Development (corpan-app/src-tauri/)

```bash
# Type check Rust code (run after editing plugins)
cargo check

# Format Rust code
cargo fmt

# Lint Rust code
cargo clippy
```

### Django Content Management (dja/)

```bash
# Run Django development server
python manage.py runserver

# Create/apply migrations
python manage.py makemigrations
python manage.py migrate

# Access Django admin (requires superuser)
python manage.py createsuperuser

# Create production database
python make_release_sqlite.py

# Add translations for a language
./add_translations.sh [language_code]
```

### Packs Development (packs/)

Each pack is a standalone package with its own build process. See `packs/sdk/README.md` for SDK usage.

## Architecture Notes

### Data Flow

1. **Content Creation**: Django admin (`dja/`) manages Entries, Translations, Packs, and Narrators
2. **Database Generation**: `make_release_sqlite.py` creates `release.sqlite3` for distribution
3. **App Bundling**: SQLite database is embedded in the Tauri app and accessed via Rust commands
4. **Runtime Queries**: React calls Tauri commands → Rust queries embedded SQLite → returns JSON

### Key Models (dja/cor/models.py)

- **Language**: Language codes (e.g., 'es', 'ko', 'ko-polite')
- **Domain**: Content categories (travel, business, etc.)
- **Entry**: English text with CEFR level and domains
- **Translation**: Language-specific translations with optional romanization
- **Narrator**: TTS voice for a language, with description Pack
- **Pack**: Ordered collection of Entries, optionally with Narrator and title
- **PackEntry**: Join table linking Pack to Entry with ordering

### Tauri Commands (corpan-app/src-tauri/src/lib.rs)

- `get_random_entry_with_translations`: Get one random entry with filters
- `get_random_entries_with_translations`: Get multiple random entries
- `get_entry_by_id_with_translations`: Get specific entry by ID

Filters: `levels` (CEFR), `domains`, `language_codes`

### State Management (corpan-app/src/store/)

- `settings.ts`: User preferences, onboarding, text size, languages, TTS
- `history.ts`: Learning history tracking
- `rating.ts`: App rating prompts
- `games.ts`: Installed packs management
- `translations.ts`: Translation cache

### Game System

Games are loaded dynamically:
1. Game manifests define entry point, styles, and metadata
2. Packs use the SDK (`packs/sdk/`) to register with the host
3. Host provides API (`hostApi`) for accessing entries, TTS, navigation
4. Games render into a container and handle their own UI/logic

Native delivery:
- **MVP**: downloadable content packs installed into app data directory

### Important Constraints

- **DO NOT EDIT** `corpan-app/src-tauri/gen/` - generated build output (exceptions must be documented and tracked)
- **Prefer editing** templates or plugins over generated code

## Development Workflow

### Making Frontend Changes

1. Edit React components in `corpan-app/src/`
2. Run `npm run tsc` to type check
3. Test with `npm run tauri dev`

### Making Rust Changes

1. Edit Rust code in `corpan-app/src-tauri/src/`
2. Run `cargo check` to verify compilation
3. Test with `npm run tauri dev` (from corpan-app/)

### Editing Tauri Plugins

1. Edit plugin code in `plugins/tauri-plugin-*/`
2. Run `cargo check` in `corpan-app/src-tauri/` to verify
3. Test with `npm run tauri dev`

### Adding Content

1. Work in Django admin (`dja/`)
2. Create Entries with Translations
3. Organize into Packs
4. Run `python make_release_sqlite.py` to bundle
5. Copy `release.sqlite3` to appropriate location for app rebuild

### Creating a New Game

1. Copy `packs/sdk/` to your pack directory
2. Implement `registerGame()` with your pack logic
3. Create manifest.json with pack metadata
4. Use `mountStandalone()` for browser development
5. Package for distribution as downloadable content packs (zip + manifest)

## Platform-Specific Notes

### iOS

- Content packs are downloaded and installed into app data directory.
- HTTPS downloads must be ATS compliant.
- `MANUAL.md` notes: Add `LSApplicationQueriesSchemes` to `gen/apple/Info.plist` for deep linking.

### Android

- Content packs are downloaded and installed into app data directory.
- `com.android.vending.BILLING` permission required for in-app purchases.
- Upload keystore: `corpan-app/src-tauri/upload-keystore.jks`

## Dependencies

- **tauri-plugin-tts**: in-repo at `plugins/tauri-plugin-tts/`, wired as a path
  dependency (`corpan-app/src-tauri/Cargo.toml:37`). Not an external checkout.
- **tauri-plugin-game-packs**: `plugins/tauri-plugin-game-packs/`. **Not legacy — it is
  on the hot path for every installed pack.** Besides the `list_game_packs` /
  `get_game_pack_manifest_url` commands, it registers the `corpan-pack://` custom URI
  scheme protocol handler (`src/lib.rs:45`) that serves every asset out of an installed
  pack's directory to the WebView. Remove it and no pack loads.
- **shadcn/ui**: UI components from Radix UI primitives
- **zustand**: State management
- **i18next**: Internationalization
- **framer-motion**: Animations

## Internationalization (i18n)

Locales live in `corpan-app/public/locales/<code>/common.json` (~54 locales).
The build gate `npm run check:i18n` (part of `npm run build`) requires **every
locale to carry every `en` key** — a missing key **fails the build**, it is not a
soft warning. So any new `t()` key must be filled into all locales before a PR
can go green.

**How we translate: agents do it directly.** When you add or change locale keys,
**translate them yourself using your own language skills and edit each
`common.json` directly.** Do NOT author or run the OpenAI/python translate
scripts (`public/locales/translate_*.py` / `add_*.py`) — that pattern is
retired. Fan out across subagents (each locale is an independent file, so
disjoint edits never conflict). Preserve `{{placeholders}}` and separators (e.g.
`·`) exactly; give point-of-sale/paywall copy real translations, not English
fallback; keep RTL scripts (ar, he, fa, ur, pa-Arab) intact. Verify with
`npm run check:i18n`.

## Corpán Plus (monetization) — architecture decisions

Subscription-only. **Per-book IAP is retired** (a month of à-la-carte books drew
zero buyers; per-book SKUs are operationally expensive). Existing per-book
owners stay entitled; no new per-book buy buttons are shown.

**Free tier = server-truncated, not client-gated.** Corpán is open source, so a
client-side "free up to segment N" check would be trivially bypassed. Instead
the publisher (`ttsctl publish --with-preview`) emits a *truncated preview ZIP*
(public, first `min(floor(total/3), 100)` segments) and a *full ZIP*
(CloudFront-signed, Plus-gated). The free user never receives the paid bytes.

**Three-shape catalog, clean runtime.** During the (permanent — people don't
update) transition, `catalog-v2.json` entries carry BOTH legacy fields
(`downloadUrl`/`tier`/`purchase`, for old runtimes) AND new fields
(`preview`/`full`/`totalSegments`/`freeSegments`, for new runtimes). The new
runtime reads ONLY the new fields; entries without them are skipped. The legacy
public ZIP stays published indefinitely for old clients, so the paywall is
intentionally "soft" until legacy publishing is ever sunset.

**Key code:**
- Install switch: `packs/shared/catalog/src/installManager.ts` (`isTwoZipEntry`)
  — subscriber → signed full ZIP; else → public preview ZIP.
- Paywall: `corpan-app/src/components/paywall/PaywallSheet.tsx` + `store/paywall.ts`,
  opened by the `corpan:request-unlock` window event (readers dispatch it at
  end-of-preview; Library/PackActions dispatch it for "Unlock with Plus").
- Reader preview detection: `is_preview` flag in segments.json (or
  `segments.length < total_segments`) → dispatch `corpan:request-unlock`.
- Onboarding: primary-language-FIRST so the userClass quiz + Plus pitch are
  localized. `OnboardingUserClass`/`OnboardingPlusPitch`; profile in
  `store/settings.ts` (`userClass`/`ageBand`/`goalIntensity`).
- Progress/streaks: `store/progress.ts` (localStorage only), fed by the
  `corpan:segment-progress` window event from readers. `StreakChip` is opt-in.
- Backfill existing catalog: `infra/scripts/backfill_two_zip.py` (dry-run first).

**Principles (strongly held design intent — NOT absolutes to ship in copy):**
ad-free in the app today and working to stay that way; no Corpán-specific login
(Apple/Google IAP identity only); on-device analytics; generous free tier;
localize every new string in ~50 langs; no Duolingo dark patterns (streak is
opt-in/dignified). These are direction, not user-facing promises. Don't ship
marketing copy that says "forever / never / no X ever / 100% / entirely / always"
— see `~/.claude/projects/-home-skyl/memory/feedback_no_absolutes_in_marketing.md`.
