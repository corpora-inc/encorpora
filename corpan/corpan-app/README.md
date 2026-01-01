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
