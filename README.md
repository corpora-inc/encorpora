# encorpora

![Corpán](corpan/corpan-app/src-tauri/icons/512x512.png)

**encorpora** (“on corpora”) is Corpora Inc’s monorepo. Products, packs, content,
infrastructure and the marketing site all live here and ship from one trunk.

Development is trunk-based: short-lived branch → PR → automated adversarial review →
squash-merge to `main`. See [AGENTS.md](AGENTS.md) for the worker loop and the gates.

## What's in here

- **Corpán** (`corpan/`) — the language-learning app. Tauri (Rust) + React,
  shipping on iOS, Android and desktop. 54 interface locales
  (`corpan/corpan-app/public/locales/`) over a corpus of narrated, translated content.
- **Corpán Packs** (`corpan/packs/`) — the pack system and the packs themselves:
  games, readers, an on-device LLM tutor, a multiplayer city. Packs deploy
  over-the-air on merge to `main` and are versioned against app floors.
- **Dynawalla: Apprentice of Numbers** (`dynawalla/`, planned — not yet on `main`)
  — the newest product: children's mathematics, grades 1–6 plus an introduction
  to pre-algebra, set in an ancient-futurist world of astrolabes, gears and
  mechanical computers.
- **Books & publishing** (`books/`) — the authored source for narration packs.
- **Site** (`web/`) — encorpora.io, built and deployed to GitHub Pages.

Corpán and Dynawalla share `main`, and Dynawalla will share the native/Tauri plugin
layer under `corpan/plugins/`. Path filters decide what CI runs for a given change.

## Live Demos

Browse packs and content at:
**https://encorpora.io/**

- [Corpán Packs](https://encorpora.io/corpan/packs/)
- [Hover Runner](https://encorpora.io/corpan/packs/hover-runner/)

## Local Development

### Quick Start

```bash
# One-command setup
./web/scripts/setup.sh

# Start development server with hot reload
npm run dev
```

Visit **http://localhost:8000** - all changes auto-rebuild:
- web/io/ site (Next.js hot reload)
- Corpan pages (auto rebuild)
- Packs (auto rebuild)

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development guide.

### Production Build

```bash
npm run build  # Builds to web/io/out/
npm run serve  # Test locally
```

See [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) for deployment architecture.

## Contributing

Read [AGENTS.md](AGENTS.md) first — it is the runbook, and it applies to humans and
agents alike.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). You may read, modify and
use this code, including for personal, non-commercial and non-profit
educational use; offering it, or anything built on it, commercially requires a
license from Corpora Inc. Each version becomes Apache License 2.0 four years
after publication, and versions published before this change remain Apache
2.0 ([LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt)). [NOTICE](NOTICE) lists what it does
not cover: the Corpora, Corpán, ¡AHA! and Dynawalla trademarks, store art, voices,
music, and third-party material under its own license.

## Community

- YouTube: https://www.youtube.com/@corp%C3%A1n1
- Free2Z: https://free2z.cash/corpora

## Contact

team@encorpora.io
