# Corpan games delivery plan (production)

## Goal
Build a world-class, end-to-end delivery system for Corpan games:
- Clean user flow: browse -> purchase -> download -> install -> launch.
- Stable, persistent on-device storage with offline play.
- Signed, verifiable packs with automatic updates.
- Minimal infra, CLI-controlled, GitOps-friendly.
- No regressions in dev (manifest URL install continues to work).

## Target user flow
1. User sees a catalog of available games.
2. User purchases a game (IAP) or redeems a code.
3. App verifies purchase with minimal backend.
4. App downloads a signed pack and installs it locally.
5. Game launches immediately from local storage.
6. Updates are detected and delivered cleanly (foreground or background).

## Architecture overview (MVP-first)
- Catalog (MVP): baked into the app bundle for launch day (no network required).
  - Optional remote override via a single JSON URL for fast iteration.
  - Keeps the door open to a full catalog service when multiple games ship.
- Purchase verification (minimal): a single receipt-verify endpoint that returns a signed pack URL.
- Pack storage: object storage (S3-compatible) with immutable, versioned pack URLs.
- Pack signing: CI creates hash + signature and publishes metadata alongside packs.
- Client: download, verify signature, unpack to app data dir, launch via local scheme.

## Client responsibilities
- Keep a local index of installed packs (id, version, hash, installPath).
- Verify signature before install (fail closed).
- Install into versioned directories and atomically switch to active version.
- Cache downloads and allow retries.
- Provide a reliable launch path from local storage even when offline.

## Platform permissions (MVP)
- Android: `INTERNET` for downloads, app storage for pack files.
- iOS: HTTPS downloads (ATS-compliant); app support directory storage.
- Desktop: network access and app data directory storage (default).

## Update strategy
- Catalog returns latest version + required minimum app version.
- Client compares installed version to catalog version.
- If update available:
  - Download new pack to staging.
  - Verify signature and hash.
  - Swap active version atomically.
  - Keep previous version for rollback until next successful launch.

## Pack format
- Pack is a bundle with manifest + assets:
  - manifest.json
  - app.js
  - app.css
  - assets/*
- Signed metadata:
  - manifest.json
  - manifest.sig (Ed25519 or ECDSA signature)
  - manifest.hash (SHA-256)

## Minimal backend (phase 1)
- /verify-purchase: verifies receipt and returns signed download URL.
- /catalog (optional): only if we want remote updates to the catalog in prod.
  - If omitted, the app uses the baked-in catalog.

## CLI/CI workflow (GitOps)
- Build pack: bundle assets + manifest.
- Compute hash + signature.
- Upload to storage with immutable versioned path.
- Update catalog.json via CI (PR or direct publish).

## Compatibility and dev safety
- Existing manifest URL install remains available for local dev.
- If no catalog URL is configured, the app uses the baked-in catalog.
- Platform packs (ODR/PAD): optional future add-on, not required for MVP.
  - Prefer S3 + signed packs for GitOps friendliness and simpler ops.
  - Add ODR/PAD later only if platform policy requires it.

## Next engineering steps (MVP today)
1. Keep baked-in catalog + update signaling in app UI.
2. Implement local install index + versioned storage layout.
3. Add receipt verification endpoint (Lambda + S3).
4. Implement pack download + signature verification (fail closed).
5. Integrate CI pipeline for pack publish (hash/sign/upload).
   - Remote catalog update remains optional until we have multiple games.
