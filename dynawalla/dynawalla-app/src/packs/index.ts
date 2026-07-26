// The pack runtime, as one surface.
//
// A screen imports from here. The split inside is by question, not by layer:
// `gate` decides whether a pack may run, `install` decides what to put on disk,
// `catalog` reads what is on offer, `bridge` decides what a running pack may
// do, and `frame`/`PackFrame` are where it runs. `native` is the only module
// that touches Tauri, which is why every one of the others is testable in Node.

export { parseCatalog, CATALOG_SCHEMA } from "./catalog.ts"
export type { CatalogResult } from "./catalog.ts"

export { gateInstall, gateRun } from "./gate.ts"
export type { HostProfile, InstallVerdict, Refusal, RefusalCode, RunVerdict } from "./gate.ts"

export { installPack, planUpdates, readInstalled, removePack } from "./install.ts"
export type {
  Consent,
  FailureCode,
  InstallDeps,
  InstallFailure,
  InstallOutcome,
  InstalledPack,
  ReadResult,
  UpdateOffer,
} from "./install.ts"

export {
  createBridge,
  MAX_STORAGE_KEYS,
  MAX_STORAGE_KEY_LENGTH,
  MAX_STORAGE_VALUE_LENGTH,
} from "./bridge.ts"
export type { Bridge, BridgeOptions, HostServices } from "./bridge.ts"

export { mountPack } from "./frame.ts"
export type { MountOptions, MountedPack } from "./frame.ts"

export { PackFrame } from "./PackFrame.tsx"
export type { PackFrameProps } from "./PackFrame.tsx"

export { PACK_COMMANDS, tauriNative } from "./native.ts"
export type {
  InstallArgs,
  InstallProgress,
  InstalledPackRow,
  PackCommand,
  PackNative,
} from "./native.ts"
