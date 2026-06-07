/**
 * mockHost — a standalone HostApi that runs the entire NPC dialogue loop in the
 * browser WITHOUT the 2.4 GB Qwen3 model. The mock `llm.chat` streams a canned,
 * in-character reply token-by-token (including a sample `<<tool>{…}</tool>>`
 * control block on the appropriate turn), and `speak()` is a no-op logger. Use
 * it for vite dev + the Playwright QA harness.
 *
 * It deliberately mirrors the real plugin's surface: status/isInstalled report
 * the model as present-and-loaded so the broker takes the "ready" path.
 */

import type {
  HostApi,
  LlmApi,
  LlmChatHandle,
  LlmChatHandlers,
  LlmChatMessage,
} from "./hostTypes"
import { LLM_MODEL_PACK_ID } from "./modelBroker"

export type MockHostOptions = {
  /** ms between streamed tokens (default 28). */
  tokenDelayMs?: number
  /** Override the canned reply turns. Each string is one full NPC turn; may
   *  contain a `<<tool>{…}</tool>>` block. They cycle. */
  scriptedTurns?: string[]
}

/** Default canned dialogue — a Spanish café baker (matches content/npc/roles +
 *  content/quests/es-cafe). Turn 2 demonstrates a parsed tool-call. */
const DEFAULT_TURNS: string[] = [
  "¡Buenos días, viajero! Bienvenido a mi café. ¿Te gustaría un café con pan dulce? (Good morning!)",
  'Perfecto. Repite conmigo: "Un café, por favor." ¡Tú puedes! Vamos a practicar.\n<<tool>{"kind":"callTool","tool":"repeat-after","spec":{"phrase":"Un café, por favor."}}</tool>>',
  '¡Muy bien! Lo dijiste perfecto. Te has ganado un poco de práctica.\n<<tool>{"kind":"reward","xp":15,"coins":3}</tool>>',
  "¿Algo más? Si quieres, te enseño cómo pedir el pan. Pregúntame: ¿Cuánto cuesta el pan?",
]

let sessionCounter = 0

export function createMockHost(opts: MockHostOptions = {}): HostApi {
  const tokenDelay = opts.tokenDelayMs ?? 28
  const turns = opts.scriptedTurns ?? DEFAULT_TURNS
  let turnIndex = 0

  /** Tokenize so the stream looks word-by-word but never splits the control
   *  block mid-delimiter (we emit the whole `<<tool>…</tool>>` as one chunk). */
  function tokenize(reply: string): string[] {
    const toolMatch = reply.match(/<<tool>[\s\S]*?<\/tool>>/)
    if (!toolMatch) return chunkProse(reply)
    const block = toolMatch[0]
    const before = reply.slice(0, toolMatch.index!)
    const after = reply.slice(toolMatch.index! + block.length)
    return [...chunkProse(before), block, ...chunkProse(after)].filter((t) => t.length > 0)
  }

  function chunkProse(s: string): string[] {
    if (!s) return []
    // keep trailing spaces attached so the reconstruction is exact
    return s.match(/\S+\s*|\s+/g) ?? [s]
  }

  const llm: LlmApi = {
    async status() {
      return { loaded: true, modelId: LLM_MODEL_PACK_ID, backend: "mock", availableMemoryMb: 4096 }
    },
    async isInstalled(packId: string) {
      return packId === LLM_MODEL_PACK_ID
    },
    async load() {
      /* instant in the mock */
    },
    async unload() {
      /* instant */
    },
    async chat(
      _args: { messages: LlmChatMessage[] },
      handlers: LlmChatHandlers,
    ): Promise<LlmChatHandle> {
      const sessionId = `mock-${++sessionCounter}`
      const reply = turns[turnIndex % turns.length]
      turnIndex += 1
      const tokens = tokenize(reply)

      let cancelled = false
      let i = 0
      let full = ""
      const tick = () => {
        if (cancelled) return
        if (i >= tokens.length) {
          handlers.onDone(full, { totalTokens: tokens.length, elapsedMs: tokens.length * tokenDelay })
          return
        }
        const tk = tokens[i++]
        full += tk
        try {
          handlers.onToken(tk)
        } catch (e) {
          console.error("[wp/mockHost] onToken threw:", e)
        }
        setTimeout(tick, tokenDelay)
      }
      // start async so the caller gets the handle first
      setTimeout(tick, tokenDelay)

      return {
        sessionId,
        cancel: async () => {
          cancelled = true
        },
      }
    },
  }

  return {
    isMock: true,
    async speak(uiCode: string, text: string) {
      console.info(`[wp/mockHost] speak(${uiCode}):`, text)
    },
    async stopSpeech() {
      /* no-op */
    },
    llm,
  }
}
