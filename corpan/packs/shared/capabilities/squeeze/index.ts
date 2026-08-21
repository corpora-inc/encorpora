// cap-squeeze — the drag-to-rebuild sentence round as a capability module
// (capability-modules.md §4.2), extracted from juice-squeeze. React inside;
// the boundary is DOM (mount/dispose). The juice-squeeze pack is the first
// consumer of every moved piece (components, hooks, tokenizer, reading order,
// round transitions); the juice economy (vessel, jars, coins, levels) stays
// pack-side.
import "./styles.css"
import type {
  ActivitySpec,
  CapabilityAvailability,
  CapabilityHostApi,
  CapabilityModule,
} from "@shared/capabilities/core"
import { mountSqueeze, type CapSqueezeParams } from "./src/mount"

export type { CapSqueezeParams }
export { SqueezeRound, type SqueezeRoundProps, type SqueezeRoundEvent } from "./src/round"
export {
  createRoundStore,
  createRoundSlice,
  RoundStoreProvider,
  useRoundStore,
  useRoundStoreApi,
  emptyPhrase,
  emptyRoundFields,
  type RoundState,
  type RoundStateFields,
  type RoundActions,
  type RoundStoreApi,
  type PhraseMeta,
  type PhraseInput,
  type BlockState,
} from "./src/roundStore"
export { TargetPhrase } from "./src/components/TargetPhrase"
export { SentenceArea } from "./src/components/SentenceArea"
export { WordBank } from "./src/components/WordBank"
export { WordBlock, BLOCK_PALETTE, FRUIT_EMOJIS } from "./src/components/WordBlock"
export { useBlockSizing, type BlockSize } from "./src/hooks/useBlockSizing"
export { useFitText } from "./src/hooks/useFitText"
export { locateBlock, routeDragEnd, routeTap } from "./src/dnd"
export { flattenReadingOrder } from "./src/readingOrder"
export { isRTL, RTL_LANGUAGES } from "./src/rtl"
export {
  tokenizeText,
  tokenizeCJK,
  isCJKText,
  isOnlyPunctuation,
  joinForTTS,
  normalizeForTokenization,
} from "./src/tokenizer"
export { sharedFontSize, fontForWord } from "./src/blockSizing"
export { getNativeLanguageName } from "./src/languageNames"

const checkAvailability = async (
  _hostApi: CapabilityHostApi,
  _spec?: ActivitySpec,
): Promise<CapabilityAvailability> => ({ state: "ready" })

export const capability: CapabilityModule = {
  meta: {
    id: "cap-squeeze",
    version: "0.1.0",
    modelNeeds: [],
    cssPrefix: "capSqz",
    usesHostApis: ["speak", "getStackConfig"],
  },
  mount: mountSqueeze,
  checkAvailability,
}
