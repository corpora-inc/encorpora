// The pack SDK's public surface.
//
// A pack imports from here and from nowhere else. The host imports the same
// modules — one copy of the contract, so a change that would break a pack
// cannot typecheck in the host either.

export {
  CAPABILITIES,
  CAPABILITY_IDS,
  METHODS,
  NATIVE_CAPABILITIES,
  SESSION_BUDGET_MS,
  SESSION_METHODS,
  STREAM_METHODS,
  budgetOf,
  capabilityOf,
  isCapability,
  isMethod,
  isNativeBacked,
  labelOf,
  opensStream,
  permits,
} from "./capabilities.ts"
export type {
  Capability,
  Method,
  CapabilityMethod,
  NativeCapability,
  SessionMethod,
  StreamMethod,
} from "./capabilities.ts"

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
  ORIENTATION_DEADZONE_DEG,
  ORIENTATION_FULL_TILT_DEG,
  ORIENTATION_MAX_HZ,
  PROTOCOL_VERSION,
  SDK_VERSION,
  STREAM_END_REASONS,
  TRANSITION_KINDS,
  isConnect,
  isHostEvent,
  isOrientation,
  isResponse,
  isStreamEnd,
  isStreamUpdate,
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
  Orientation,
  ParsedRequest,
  Request,
  Response,
  Settings,
  SoundCue,
  StreamEnd,
  StreamEndReason,
  StreamUpdate,
  TransitionKind,
} from "./protocol.ts"

export { compareSemver, compareVersions, isSemver, parseSemver, satisfies, sdkCompatible } from "./semver.ts"
export type { HostRange, Semver } from "./semver.ts"

export { PackError, connect } from "./guest.ts"
export type { HostClient, ItemRequest, TiltReader } from "./guest.ts"

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
