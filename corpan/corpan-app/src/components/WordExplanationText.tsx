/**
 * Renders a phrase as tokenized inline words and shows a word-explanation
 * popover on LONG-PRESS (touch) / RIGHT-CLICK or long mouse-press (desktop).
 *
 * This is ADDITIVE over Phrase Flip's existing phrase-level TTS: a short
 * tap/click still bubbles up to the parent's `onClick` (which speaks the whole
 * phrase). Only a deliberate long-press / right-click opens the popover, and
 * that gesture stops propagation so it does NOT also fire TTS.
 *
 * The popover mirrors Hanzipan's etymology popover: native-first paragraph with
 * English fallback. When the (native→en) word pack isn't installed yet it shows
 * a friendly install prompt wired to the standard content-pack installer.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { tokenizePhrase, lookupKeyFor } from "@/util/wordTokens"
import {
  installWordPack,
  isWordPackInstalled,
  lookupWord,
  type WordExplanation,
} from "@/util/wordPack"

// Press longer than this (ms) without much movement = long-press intent.
const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 10

type PopState =
  | { kind: "idle" }
  | { kind: "loading"; word: string }
  | { kind: "explanation"; word: string; data: WordExplanation }
  | { kind: "missing"; word: string }
  | { kind: "needs-install"; word: string }
  | { kind: "installing"; word: string }
  | { kind: "install-failed"; word: string }

export function WordExplanationText({
  text,
  lang,
  packId,
  preferredLangs,
  className,
  style,
}: {
  text: string
  /** Language of THIS text (the word pack covers the en side). */
  lang: string
  /** The (native→en) word-pack id, or null if no pack covers the user. */
  packId: string | null
  /** Stack languages in store order (native first) for native-first lookup. */
  preferredLangs: string[]
  className?: string
  style?: React.CSSProperties
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [state, setState] = useState<PopState>({ kind: "idle" })

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const firedLongPress = useRef(false)

  // Clear any pending long-press timer on unmount so it can't fire setState
  // after the component is gone (e.g. swiping to the next phrase mid-press).
  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current)
    }
  }, [])

  const tokens = packId ? tokenizePhrase(text, lang) : null

  const runLookup = useCallback(
    async (rawWord: string, x: number, y: number) => {
      if (!packId) return
      const key = lookupKeyFor(rawWord)
      if (!key) return
      setAnchor({ x, y })
      setOpen(true)

      if (!(await isWordPackInstalled(packId))) {
        setState({ kind: "needs-install", word: key })
        return
      }
      setState({ kind: "loading", word: key })
      const data = await lookupWord(packId, key, preferredLangs)
      setState(
        data
          ? { kind: "explanation", word: key, data }
          : { kind: "missing", word: key },
      )
    },
    [packId, preferredLangs],
  )

  const doInstall = useCallback(
    async (word: string) => {
      if (!packId) return
      setState({ kind: "installing", word })
      try {
        await installWordPack(packId)
      } catch {
        setState({ kind: "install-failed", word })
        return
      }
      setState({ kind: "loading", word })
      const data = await lookupWord(packId, word, preferredLangs)
      setState(
        data
          ? { kind: "explanation", word, data }
          : { kind: "missing", word },
      )
    },
    [packId, preferredLangs],
  )

  // No pack covers this user (or non-en side): render plain text, fully
  // transparent to the parent's phrase-TTS click handler.
  if (!tokens) {
    return (
      <div className={className} style={style}>
        {text || <span className="opacity-30">—</span>}
      </div>
    )
  }

  const renderPopoverBody = () => {
    switch (state.kind) {
      case "loading":
        return (
          <p className="text-sm text-muted-foreground">
            {t("wordExplain.loading", { defaultValue: "Looking up…" })}
          </p>
        )
      case "explanation":
        return (
          <div className="space-y-1">
            <p className="text-sm font-semibold">{state.word}</p>
            <p className="text-sm leading-relaxed">{state.data.paragraph}</p>
          </div>
        )
      case "missing":
        return (
          <div className="space-y-1">
            <p className="text-sm font-semibold">{state.word}</p>
            <p className="text-sm text-muted-foreground">
              {t("wordExplain.notFound", {
                defaultValue: "No explanation for this word yet.",
              })}
            </p>
          </div>
        )
      case "needs-install":
        return (
          <div className="space-y-2">
            <p className="text-sm">
              {t("wordExplain.installPrompt", {
                defaultValue:
                  "Install Spanish explanations for English (≈3 MB) to see what words mean.",
              })}
            </p>
            <button
              type="button"
              className="w-full rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
              onClick={(e) => {
                e.stopPropagation()
                void doInstall(state.word)
              }}
            >
              {t("wordExplain.installCta", { defaultValue: "Install (≈3 MB)" })}
            </button>
          </div>
        )
      case "installing":
        return (
          <p className="text-sm text-muted-foreground">
            {t("wordExplain.installing", { defaultValue: "Installing…" })}
          </p>
        )
      case "install-failed":
        return (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              {t("wordExplain.installFailed", {
                defaultValue: "Couldn't install. Check your connection and try again.",
              })}
            </p>
            <button
              type="button"
              className="w-full rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
              onClick={(e) => {
                e.stopPropagation()
                void doInstall(state.word)
              }}
            >
              {t("wordExplain.retry", { defaultValue: "Try again" })}
            </button>
          </div>
        )
      default:
        return null
    }
  }

  const startPress = (word: string, x: number, y: number) => {
    firedLongPress.current = false
    pressStart.current = { x, y }
    clearTimer()
    pressTimer.current = setTimeout(() => {
      firedLongPress.current = true
      void runLookup(word, x, y)
    }, LONG_PRESS_MS)
  }

  const clearTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const maybeCancelOnMove = (x: number, y: number) => {
    const start = pressStart.current
    if (!start) return
    if (Math.abs(x - start.x) > MOVE_CANCEL_PX || Math.abs(y - start.y) > MOVE_CANCEL_PX) {
      clearTimer()
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // When the popover closes, clear the long-press latch so a later
        // genuine tap is never wrongly swallowed (the synthetic post-long-press
        // click may have landed outside the originating word).
        if (!next) firedLongPress.current = false
      }}
    >
      {/* Anchor: a 1px point positioned at the press location so the popover
          opens next to the pressed word rather than the whole block. */}
      <PopoverTrigger asChild>
        <span
          aria-hidden
          style={{
            position: "fixed",
            left: anchor?.x ?? 0,
            top: anchor?.y ?? 0,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      </PopoverTrigger>
      <div className={className} style={style}>
        {tokens.map((tok, i) => {
          if (!tok.isWord) {
            // Separators are not interactive; they pass clicks to the parent
            // (phrase TTS).
            return <span key={i}>{tok.text}</span>
          }
          const word = tok.text
          return (
            <span
              key={i}
              className="rounded-sm hover:bg-purple-400/15 active:bg-purple-400/25"
              style={{ cursor: "pointer" }}
              // Intentionally NOT role="button": these are gesture-annotated
              // words (long-press / right-click to explain), not keyboard-
              // activatable buttons. A short tap still bubbles to the parent
              // block's button (phrase TTS), which carries the accessible name.
              data-word-token
              // Touch / mouse long-press.
              onPointerDown={(e) => {
                if (e.pointerType === "mouse" && e.button !== 0) return
                startPress(word, e.clientX, e.clientY)
              }}
              onPointerMove={(e) => maybeCancelOnMove(e.clientX, e.clientY)}
              onPointerUp={() => clearTimer()}
              onClick={(e) => {
                // A long-press already opened the popover. The browser still
                // synthesizes a `click` after `pointerup`; swallow it so it does
                // NOT bubble to the parent block and fire phrase TTS. A genuine
                // short tap leaves `firedLongPress` false and bubbles normally
                // (preserving Phrase Flip's tap-to-speak).
                if (firedLongPress.current) {
                  e.stopPropagation()
                  e.preventDefault()
                  firedLongPress.current = false
                }
              }}
              onPointerCancel={clearTimer}
              onPointerLeave={clearTimer}
              // Desktop right-click = explain (a natural "what is this?" gesture).
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void runLookup(word, e.clientX, e.clientY)
              }}
            >
              {tok.text}
            </span>
          )
        })}
      </div>
      <PopoverContent
        side="bottom"
        align="center"
        className="max-w-[80vw] sm:max-w-sm"
        onClick={(e) => e.stopPropagation()}
        dir="auto"
      >
        {renderPopoverBody()}
      </PopoverContent>
    </Popover>
  )
}
