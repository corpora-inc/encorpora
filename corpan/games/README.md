# Corpan games (two-phase rollout)

This repo uses a two-phase approach for game delivery so the dev app matches the production app as closely as possible.

## Phase 1 (now): Manifest install flow
- Games are installed from a manifest URL (works in dev and release builds).
- In dev, the host polls for manifest changes and auto-reloads.
- In release, the same manifest URL flow is available but hidden behind a developer unlock.

### Developer unlock (manifest URL input)
- Open Settings.
- Scroll to the bottom past the company info.
- Tap the "Corpan" label 7 times.
- The manifest URL input appears at the bottom of Games.

Feature flags:
- `VITE_ENABLE_GAMES=true` shows the Games panel (prod override).
- Dev unlock persists via `localStorage` key `corpan:dev-games`.

## Phase 2 (next release): In-app purchase flow
- Store-based purchase flow (Apple/Google) + verify endpoint.
- Hidden in the UI for now until billing setup is released.

## Reference game
- `hover-runner` is the reference implementation.
