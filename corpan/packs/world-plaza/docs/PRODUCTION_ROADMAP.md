# World Plaza — Path to Production (0.1.0 and beyond)

Sequenced plan to take the pack from "great spike" to a shipped, supportable
product. Owner is away; this is the autonomous coordination plan. Build waves
first, then production. Each phase fans out to disjoint-file agents against the
frozen contracts (`docs/IMPLEMENTATION_CONTRACTS.md`); the orchestrator serializes
`game.ts`/`worldLook.ts`/`styles.css`/`contracts/*` integration.

## Status
- ✅ **Contracts frozen** (`CONTRACTS_VERSION 0.1.0`), 6 seams, ownership map.
- ✅ **Wave 1 built + integrated**: Track-state foundation, Economy (multi-currency
  wallet, moon-coin dead), Badges (XP→badge + case), IconRenderer (premium icons).
- 🔄 **NPC-prompt study** running (eval harness + LLM judge → data-backed prompt fixes).

## Build phases (finish the game)
### Wave 2 (now) — disjoint, against frozen contracts
- **Top-HUD (Slice 2)** — Status Capsule + Place Tag + chrome-visibility state machine,
  consuming the real `walletGlance`/`focusBadge`/`trackPair` glances.
- **Map (Slice 3b)** — minimap + premium full-screen map (player + remotes + quest markers).
- **Topology generator (Slice 4c)** — parameterized topologies + typed anchors (also
  supplies the `docks`/`city_gate` anchors the es-guadalajara quest wants).
- **Faces (Slice 4b)** — richer parametric face kit + emotion channel tied to mood beats.
### Wave 3 — after Wave 2 + the prompt study
- **Special NPCs (Slice 3a)** — clue→item→deliver dialogue; needs typed anchors (4c).
- **Immersion (Slice 1d)** — per-Track off/reveal/on resolver. ⚠️ touches `promptProgram`,
  so it lands AFTER the NPC-prompt study's fixes are applied (avoid clobber).
- **Localization L0** — string + prompt-instruction seams (en-only refactor). Also
  `promptProgram`-adjacent → after the study.
- **Track-manager full wiring** — the per-Track namespacing + the start-screen picker +
  in-game switcher (the foundation's UI; deferred from Wave 1 since it's invisible without it).
- **Prompt fixes** — apply the study's ranked recommendations (segue-once, anti-repetition).
### Wave 4 — depth (post-MVP)
- Economy E2-E4 (live ticker, player↔player exchange, order book — needs the server).
- Content fan-out P2-P4 (wardrobe, theme/era library, quest-generator, new ChallengeTools,
  the diegetic WorldExperience seam, Spark asset kit).
- Localization L2 (all 50, gated) + L3 (RTL/script/TTS-gap).
- Badges B2-B3 (full ~1000 catalog + level/story integration).
- Analytics pulse (pair × country × duration; read the existing Corpán opt-out).

## Production phases (ship it)
### P1 — Multiplayer hardening (`docs/MULTIPLAYER_PROD.md`, agent)
The Colyseus server exists + presence is proven two-window. For production: room
lifecycle + occupancy-band matchmaking + room directory, reconnect/TTL, rate limits,
horizontal scale (Redis), the Track-personal/room-shared invariant under load, mediated
chat routing safety, anti-cheat on movement/economy, and the deploy shape (containers +
managed Redis). Map (3b) shows remotes; this makes it real + safe + scalable.

### P2 — Map + Inventory to "perfect"
Polish the Wave-2 map + the inventory panel (the wallet/badge/give-deliver UI = the M4
that folds economy+badges) to A++ : interactions, give/receive flow, trade seam.

### P3 — 0.1.0 release engineering (`docs/RELEASE_ENGINEERING.md`, agent)
- **Pack build + manifest**: production `dist` build, `manifest.json` polish (id, version
  0.1.0, entry, styles, metadata, permissions), size budget, the two-zip preview/full +
  SHA-256 streaming-install path (`content_packs.rs`) the host already uses.
- **Catalog publish**: a `world-plaza` entry in `catalog-v2/v3` (S3/CDN) with name, blurb,
  artwork, categories, ranking, localized strings — per `feedback_catalog_driven_everything`
  (drive everything from catalog, thin in-app fallback). Honor the Plus/preview model if
  this pack is gated, else free. Generate the **catalog artwork** (cover/thumb — reuse the
  IconRenderer/Spark aesthetic; NEVER reuse another app's logo).
- **Changelog/versioning**: promote `[Unreleased]` → `0.1.0` per `CHANGELOGS.md`.

### P4 — CI/CD + web deploy (`docs/INFRA_DEPLOY.md`, agent)
- **GH Actions**: typecheck + tests + build the pack on PR; on tag, build + publish the
  pack zip + push the catalog entry. Server build/test. Contracts conformance gate.
- **GH Pages**: the standalone web build of the pack (the `mountStandalone` path) as a
  playable demo / marketing page — static export, CDN-cached.
- Asset pipeline hookup (Spark assets live outside the pack, served from the host public dir).

### P5 — Infra as code (`docs/INFRA_DEPLOY.md` cont.)
- **Terraform → AWS**: the realtime (Colyseus + Redis), durable API (server), object
  storage + CloudFront CDN for catalog + scene/theme/asset packs (mirrors the existing
  CloudFront posture), signed URLs for any Plus-gated content. Managed Redis/Postgres if
  the economy server needs durability. Observability (logs/metrics/errors). Cost-aware.

### P6 — Launch readiness
App-store/compliance doc (safety-by-architecture, age tiers — reuse the existing posture),
privacy (on-device + the anon aggregate pulse), the no-login/identity-via-OS model, a
smoke/QA pass on real devices (iPad pipeline), and a go/no-go checklist.

## Coordination rules (autonomous)
- Frozen contracts; disjoint file ownership; orchestrator serializes the integration files.
- Verify in the REAL embedded app where it matters (the standalone-vs-embedded trap).
- Don't touch `promptProgram`/`npcRuntime` until the prompt study's fixes are applied.
- Commit/push stays the OWNER's by default — do NOT commit or push; leave work staged for
  review unless explicitly handed control. (Memory: `feedback_git_workflow`.)
- No real-money economy; on-device privacy; localize new strings; no placeholders.
