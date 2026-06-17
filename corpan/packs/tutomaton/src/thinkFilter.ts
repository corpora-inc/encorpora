/**
 * thinkFilter — strip a leading `<think>…</think>` reasoning block from a
 * streaming token feed.
 *
 * The 0.6B / 1.7B tutors are Qwen3 *hybrid* models: even with `/no_think` they
 * emit a (usually empty) `<think>…</think>` block before the answer. That block
 * must never reach the screen or TTS. A regex on the final text isn't enough —
 * tokens stream live into the transcript AND into the sentence buffer that feeds
 * speech, so we'd show/speak the reasoning before `</think>` ever arrives.
 *
 * This is a tiny state machine over the raw token stream. It is model-agnostic:
 * if the reply does NOT begin with `<think>` (the non-thinking Instruct 4B, or
 * any normal answer) it falls through to pass-through after at most a few
 * buffered characters, so it's safe to apply unconditionally.
 */

const OPEN = "<think>"
const CLOSE = "</think>"

export type ThinkFilter = {
  /** Feed one raw token; returns the visible substring to forward (may be ""). */
  push: (tok: string) => string
  /** Call at end-of-stream; returns any trailing visible text the filter held. */
  flush: () => string
}

export function makeThinkFilter(): ThinkFilter {
  // "lead": deciding whether the reply opens with <think>.
  // "think": inside the block, scanning for </think>.
  // "pass": everything from here is visible.
  let mode: "lead" | "think" | "pass" = "lead"
  let buf = ""
  // After a think block we drop the answer's leading whitespace even when it
  // arrives in a later token than the closing tag.
  let trimLeading = false

  const emit = (s: string): string => {
    if (!trimLeading) return s
    const out = s.replace(/^\s+/, "")
    if (out !== "") trimLeading = false
    return out
  }

  return {
    push(tok: string): string {
      if (mode === "pass") return emit(tok)
      buf += tok

      if (mode === "lead") {
        const trimmed = buf.replace(/^\s+/, "")
        if (trimmed === "") return "" // only whitespace so far
        if (trimmed.startsWith(OPEN)) {
          mode = "think"
          buf = trimmed.slice(OPEN.length) // keep remainder for the close scan
          // fall through into the think branch below
        } else if (OPEN.startsWith(trimmed)) {
          return "" // still ambiguous: `trimmed` is a prefix of "<think>"
        } else {
          mode = "pass"
          const out = buf
          buf = ""
          return out
        }
      }

      if (mode === "think") {
        const idx = buf.indexOf(CLOSE)
        if (idx === -1) {
          // Retain only a tail that could be the start of a split "</think>".
          const keep = Math.min(buf.length, CLOSE.length - 1)
          buf = buf.slice(buf.length - keep)
          return ""
        }
        mode = "pass"
        trimLeading = true
        const after = emit(buf.slice(idx + CLOSE.length))
        buf = ""
        return after
      }

      return ""
    },

    flush(): string {
      // Never saw a think block (short/whitespace-only lead) → emit what we held.
      if (mode === "lead" && buf.trim() !== "") {
        const out = buf
        buf = ""
        mode = "pass"
        return out
      }
      // Unclosed think block → drop it.
      return ""
    },
  }
}

/** One-shot convenience for non-streaming callers (e.g. cleaning a full reply). */
export function stripThink(text: string): string {
  const f = makeThinkFilter()
  return f.push(text) + f.flush()
}
