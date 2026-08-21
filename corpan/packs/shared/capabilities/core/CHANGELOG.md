# Changelog — cap-core (@corpan/cap-core)

The capability-module core: the synced Journey activity contract, the
CapabilityHandle/CapabilityModule contract, the CapabilityHostApi slice
(+ the fleet's one copy of the STT types, moved from pronunciation-coach),
result plumbing (settle-once / active clock / abandoned synthesis), the
mock host, and the generic contract suite.

**Consumers to rebuild on change:** every capability + their consuming packs.

## 0.1.0 — Unreleased

- Capability contract per capability-modules.md §2 (result-never-rejects,
  pause/resume/dispose, startPaused, checkAvailability).
- `createMockCapabilityHost` (§7.1) + `runContractSuite` (§7.3).
- STT type slice moved from pronunciation-coach/src/game.ts (§2.1) with
  `sttErrCode`/`formatErr` helpers.
