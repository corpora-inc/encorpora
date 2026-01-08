# encorpora

![Corpán](corpan/corpan-app/src-tauri/icons/512x512.png)

**encorpora** (“on corpora”) is Corpora Inc’s experimental lab.
The core software lives at `https://github.com/corpora-inc/corpora`.

This repo houses experiments that depend on Corpora. When something becomes stable and broadly useful, it graduates to the main `corpora` monorepo.

## Current focus

- **Corpán app**: the main product experience.
- **Corpán Packs**: SDK experiments + new interactive learning formats.
- **Hover Runner**: the reference pack prototype.
- **Books & publishing**

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

## What's next

We're actively exploring audio, video, ASR/STT, and richer media learning flows.
Stay tuned and jump in.

## Community

- YouTube: https://www.youtube.com/@corp%C3%A1n1
- Free2Z: https://free2z.cash/corpora

## Contact

team@encorpora.io
