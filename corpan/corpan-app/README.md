# Corpan

[![Star on GitHub](https://img.shields.io/github/stars/corpora-inc/encorpora?style=social)](https://github.com/corpora-inc/encorpora/stargazers)
[![Open Issues](https://img.shields.io/github/issues/corpora-inc/encorpora)](https://github.com/corpora-inc/encorpora/issues)
[![Last Commit](https://img.shields.io/github/last-commit/corpora-inc/encorpora)](https://github.com/corpora-inc/encorpora/commits)
[![Build with npm](https://img.shields.io/badge/built%20with-npm-blueviolet)](https://npm.io/)

Corpan is a precision language acceleration desktop app that turns curated bilingual corpora into an interactive study environment. The React + Tailwind UI is packaged with a Tauri runtime that embeds SQLite, premium on-device text-to-speech, and deterministic offline pipelines so your device becomes the most reliable tool for language acquisition.

**Available languages (auto-discovered from `public/locales`):** Arabic, Chinese (Simplified), Chinese (Traditional), English, French, German, Hindi, Hungarian, Italian, Japanese, Korean (polite), Persian, Polish, Portuguese (Brazil), Russian, Spanish, Vietnamese, Bengali

## Key Features
- Oxford 5000-complete corpus of real-world sentences with bilingual alignment, romanization, and localization metadata.
- CEFR-aligned progression engine that spans travel, business, education, culture, emergencies, technology, health, and more topical domains.
- Premium, on-device text-to-speech voices per language with deterministic cycling or randomization, plus script-specific romanization overlays.
- Stack presets that snapshot language order, CEFR scope, voices, romanization, and playback rate so multi-language sessions stay synchronized.
- Offline-first embedded SQLite corpus (`dja/db.sqlite3`), no ads, no subscriptions, and consistent behavior across platforms.
- Native desktop delivery via Tauri with safe-area aware layouts, startup onboarding, and a fully localized React UI sourced from `public/locales`.
- Open-source roadmap that invites community-driven corpora expansion and feature experimentation.

## Architecture
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 4, Zustand for stores, Framer Motion for transitions, i18next for localization.
- **Desktop shell:** Tauri 2 with plugins for safe-area insets, text-to-speech, and URL opening.
- **Data:** Prebuilt SQLite database deserialized in-memory for fast random access (`src-tauri/src/db.rs`).
- **Scripts:** Utilities under `scripts/` for locale maintenance and embedding generation.

```
├─ public/           # i18n bundles loaded at runtime
├─ src/              # React UI, Zustand stores, onboarding flow, stacks UX
├─ src-tauri/        # Rust commands, plugins, and embedded corpus wiring
├─ scripts/          # Maintenance utilities (Python, shell)
└─ dja/db.sqlite3    # Embedded corpus pulled into the Tauri bundle
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm 
- Rust toolchain (`rustup`) and the system packages required by [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).
- For Python-based helper scripts, Python 3.10+ with virtualenv (optional).

### Install dependencies
```bash
npm install
# or npm install
```

### Run it 🚂

#### Run the web UI in the browser
```bash
npm run dev
```

#### Run the desktop app with Tauri
```bash
npm run tauri dev
```

#### Run the android / ios app app with Tauri
```bash
npm run tauri <android>/<ios> dev
```

When the Tauri shell opens, you can complete the onboarding flow to create your first stack and begin exploring sentences.

#### Point a Tauri dev build at a local pack catalog

Current app builds (>= 0.10.0) install packs from the **v3** catalog
exclusively (`src/lib/offlineCache/resources.ts`); `VITE_GAME_CATALOG_URL`
only feeds a legacy v1/v2 fallback that's rarely reached. To test packs from
a local server, export `VITE_GAME_CATALOG_V3_URL` in the *same shell* before
the tauri command:

```bash
VITE_GAME_CATALOG_V3_URL=http://10.0.0.49:8000/corpan/packs/catalog-v3.json \
  npm run tauri android dev
```

- The served JSON must be **v3-shaped**: `{ "version": 3, "generatedAt": "...",
  "packs": [...] }`, with each entry's `minAppVersion` satisfied by the
  running app's version (see `package.json` `version`). A v1 array (plain
  `catalog.json`) fails to parse as v3 and silently falls back to
  production — it won't error, it'll just look like the override "didn't
  take."
- Android debug builds allow cleartext (`http://`) traffic
  (`usesCleartextTraffic` is `true` for the `debug` build type in
  `src-tauri/gen/android/app/build.gradle.kts`; release builds keep it
  `false`), so a plain `http://<lan-ip>:<port>` URL works as-is on a
  same-LAN device — no HTTPS or `adb reverse` needed. If the device can't
  reach the host over LAN (different subnet, VPN, isolated guest wifi), use
  `adb reverse tcp:8000 tcp:8000` and point the URL at
  `http://localhost:8000/...` instead (`localhost` cleartext is always
  allowed).
- The override is DEV-gated in code (`import.meta.env.DEV`) — it's a no-op
  in release/production builds regardless of what's in the environment.

## Building for Production
- Bundle the web assets only: `npm run build`
- Create a native desktop bundle (msi, dmg, AppImage, etc.): `npm run tauri build`

Artifacts land under `dist/` (web) and `src-tauri/target/` (desktop) respectively.

## Localization and Data
- UI text lives in `public/locales/<lang>/common.json`. Update `public/locales/locale.schema.json` to keep JSON shape in sync, and run the helper scripts in `public/locales/*.py` when adding languages.
- Sentence content and metadata ship inside `dja/db.sqlite3`. Replace this file when refreshing the corpus, then rebuild the Tauri bundle so the bytes are re-embedded.
- Speech voices are discovered at runtime. Use the Settings modal to pin or rotate voices for each language.

## Contributing
We welcome fixes and improvements:
1. Fork the repository and branch from the latest default branch.
2. Run `npm install` and verify changes with `npm tsc`, `npm build`, or `npm tauri dev`.
3. Include locale updates or database migrations when behavior changes depend on them.
4. Open a pull request describing the change, the rationale, and any manual testing performed.

For feature requests or bug reports, please open an issue with steps to reproduce and your platform details (OS, Corpan version, Tauri version).


If you have ideas for new corpora sources or learning features, start a discussion and we will help scope the work.

---

Enjoying Corpan? Please [⭐ star the repository](https://github.com/corpora-inc/encorpora) so more language learners can find it.
