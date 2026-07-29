// The pack SDK's public surface.
//
// A pack imports from here and from nowhere else. The host imports the same
// modules — one copy of the contract, so a change that would break a pack
// cannot typecheck in the host either.

export {
  CAPABILITIES,
  CAPABILITY_IDS,
  METHODS,
  SESSION_METHODS,
  capabilityOf,
  isCapability,
  isMethod,
  labelOf,
  permits,
} from "./capabilities.ts"
export type { Capability, Method, CapabilityMethod, SessionMethod } from "./capabilities.ts"

export {
  MANIFEST_SCHEMA,
  MAX_DOWNLOAD_BYTES,
  MAX_FILES,
  MAX_INSTALLED_BYTES,
  INTEGRITY_PATTERN,
  PACK_ID_PATTERN,
  isSafeRelativePath,
  localizedDescription,
  localizedName,
  parseManifest,
} from "./manifest.ts"
export type { ManifestResult, PackManifest } from "./manifest.ts"

export {
  MAX_REQUESTS_PER_SECOND,
  PROTOCOL_VERSION,
  SDK_VERSION,
  TRANSITION_KINDS,
  isConnect,
  isHostEvent,
  isResponse,
  isTransitionKind,
  numberParam,
  parseRequest,
  stringParam,
  unitParam,
} from "./protocol.ts"
export type {
  Connect,
  ErrorCode,
  HapticCue,
  HostEvent,
  HostEventName,
  Item,
  ItemChoice,
  Judgement,
  LearnerSummary,
  ParsedRequest,
  Request,
  Response,
  Settings,
  SoundCue,
  TransitionKind,
} from "./protocol.ts"

export { compareSemver, compareVersions, isSemver, parseSemver, satisfies, sdkCompatible } from "./semver.ts"
export type { HostRange, Semver } from "./semver.ts"

export { PackError, connect } from "./guest.ts"
export type { HostClient, ItemRequest } from "./guest.ts"

// `connect()` installs the guard itself — a pack never has to call this. It is
// exported so the host and the dev harness can install the same one, and so a
// pack that runs unframed on purpose still has a way to.
export {
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SLOP_PX,
  DRAG_SLOP_PX,
  TapZoomGuard,
  installTapZoomGuard,
} from "./tapzoom.ts"
export type { GuardTouch, GuardTouchEvent, TapGuardOptions, TapGuardTarget } from "./tapzoom.ts"
