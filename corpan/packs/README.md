# Corpan packs (two-phase rollout)

> **Building or running a pack locally?** See **[PACK_DEV.md](./PACK_DEV.md)** —
> the canonical boilerplate & dev standards (manifest contract, build config,
> the shared on-device dev server, asset fetching, the new-pack checklist). It
> exists so packs stop reinventing dev tooling. The shared dev harness lives in
> [`shared/dev/`](./shared/dev/README.md).

This repo uses a two-phase approach for pack delivery so the dev app matches the production app as closely as possible.

## Phase 1 (now): Manifest install flow
- Packs are installed from a manifest URL (works in dev and release builds).
- In dev, the host polls for manifest changes and auto-reloads.
- In release, the same manifest URL flow is available but hidden behind a developer unlock.

### Developer unlock (manifest URL input)
- Open Settings.
- Scroll to the bottom past the company info.
- Tap the "Corpan" label 7 times.
- The manifest URL input appears at the bottom of Packs.

Feature flags:
- `VITE_ENABLE_PACKS=true` shows the Packs panel (prod override).
- Dev unlock persists via `localStorage` key `corpan:dev-packs`.

## Phase 2 (next release): In-app purchase flow
- Store-based purchase flow (Apple/Google) + verify endpoint.
- Hidden in the UI for now until billing setup is released.

## Reference pack
- `hover-runner` is the reference implementation.
- `hanzipan` is the Mandarin character pack (pack-owned DB + handwriting surface).
