// Shared ASR contract + host-API surface. Barrel re-export.
//
// The provider-per-runtime architecture's single source of truth on the TS
// side. Pairs with the Rust `corpan-asr-contract` crate (wire gatekeeper)
// and corpan/docs/STT_MASTERPLAN.md (design). Pure transcription only;
// Parlometron scoring stays with tauri-plugin-stt.

export type {
  AsrProviderId,
  AsrLatencyClass,
  AsrCapability,
  AsrCaptureMode,
  AsrTranscript,
  AsrSession,
  AsrProvider,
} from "./contract"
export { ASR_COMMANDS } from "./contract"

export type {
  AssetKind,
  AssetRecord,
  ResidentRuntime,
  ModelBudget,
  FitsResult,
  EnsureAssetArgs,
  ModelsApi,
  AsrGoal,
  AsrPickArgs,
  AsrApi,
} from "./host"

export { rankProviders } from "./router"
export type { RouterBudget, WerHints } from "./router"

export { attachMicInput } from "./micInput"
export type {
  MicInputTarget,
  MicInputHost,
  MicStringKey,
} from "./micInput"

export { wireDictation, dictationResolver } from "./dictation"
export type { WireDictationOpts, DictationStrings } from "./dictation"
