/**
 * beatlounge — the Command Bar: the HEADLINE natural-language surface.
 *
 * A text input + recent chips. On submit, the controller interprets the
 * utterance (4B model → keyword fallback) and PREVIEWS the result live on the
 * loop. While previewing, the user gets Keep / 🎲 Reroll / Undo ("turn over the
 * apple cart"). A thin view over `CommandBarController` — all logic lives there.
 *
 * Openable standalone: render <CommandBar controller={...} onClose={...} />.
 */

import { useEffect, useRef, useState } from "react"
import { Glyph } from "../../bl-ui"
import { ct } from "../../i18n/strings"
import type { CommandBarController, CommandBarState } from "./controller"
import { ActionsPicker } from "./ActionsPicker"
import { sourceLabel } from "./actionCatalog"
import "./styles.css"

export interface CommandBarProps {
  controller: CommandBarController
  /** Called when the user dismisses the bar (Escape / close button / backdrop). */
  onClose?: () => void
  /** A few example prompts shown when there's no history yet. */
  placeholderExamples?: string[]
}

const DEFAULT_EXAMPLES = ["more hihats", "make it darker", "latin feel", "tresillo on the kick", "loosen up the drums"]

export const CommandBar = ({ controller, onClose, placeholderExamples }: CommandBarProps) => {
  const [state, setState] = useState<CommandBarState>(controller.getState())
  const [text, setText] = useState("")
  const [browsing, setBrowsing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const examples = placeholderExamples ?? DEFAULT_EXAMPLES
  const hasPicker = controller.registry() !== undefined

  useEffect(() => controller.subscribe(setState), [controller])
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Honest, no-nag offline framing: when the on-device model isn't loaded, the
  // picker is the primary surface — open it by default. The text box still takes
  // typed (keyword) commands. No "download" / "coming soon" copy anywhere.
  useEffect(() => {
    if (!hasPicker) return
    let live = true
    void controller.llmAvailable().then((loaded) => {
      if (live && !loaded) setBrowsing(true)
    })
    return () => {
      live = false
    }
  }, [controller, hasPicker])

  const submit = (value: string) => {
    const u = value.trim()
    if (!u) return
    void controller.submit(u)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submit(text)
    } else if (e.key === "Escape") {
      e.preventDefault()
      if (state.phase === "preview") controller.cancel()
      else onClose?.()
    }
  }

  const thinking = state.phase === "thinking"
  const previewing = state.phase === "preview"

  return (
    <div className="bl-cmdbar" role="dialog" aria-label={ct("cmd.barAria")} data-bl-nocapture>
      <div className="bl-cmdbar-row">
        <span className="bl-cmdbar-glyph" aria-hidden>
          <Glyph name="command" size={18} />
        </span>
        <input
          ref={inputRef}
          className="bl-cmdbar-input"
          type="text"
          value={text}
          placeholder={ct("cmd.launcherLabel")}
          autoComplete="off"
          spellCheck={false}
          disabled={thinking}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={ct("cmd.describeChange")}
        />
        {thinking ? (
          <span className="bl-cmdbar-spinner" aria-label={ct("cmd.thinking")} />
        ) : (
          <button
            type="button"
            className="bl-cmdbar-go"
            onClick={() => submit(text)}
            disabled={!text.trim()}
            aria-label={ct("cmd.run")}
          >
            <Glyph name="play" size={16} />
          </button>
        )}
        {hasPicker && (
          <button
            type="button"
            className={`bl-cmdbar-browse${browsing ? " is-on" : ""}`}
            onClick={() => setBrowsing((b) => !b)}
            aria-pressed={browsing}
            aria-label={ct("cmd.browseActions")}
            title={ct("cmd.browseActions")}
          >
            <Glyph name="grid" size={18} />
          </button>
        )}
        {onClose && (
          <button type="button" className="bl-cmdbar-close" onClick={onClose} aria-label={ct("cmd.close")}>
            <Glyph name="chevron-down" size={18} />
          </button>
        )}
      </div>

      {previewing && state.result && (
        <div className="bl-cmdbar-preview" role="group" aria-label={ct("cmd.preview")}>
          <div className="bl-cmdbar-summary">
            <strong>{state.result.summary}</strong>
            <span className="bl-cmdbar-via">{ct("cmd.via", { source: sourceLabel(state.result.source) })}</span>
          </div>
          <div className="bl-cmdbar-actions">
            <button type="button" className="bl-cmdbar-keep" onClick={() => controller.keep()}>
              {ct("cmd.keep")}
            </button>
            <button
              type="button"
              className="bl-cmdbar-reroll"
              onClick={() => void controller.reroll()}
              title={ct("cmd.rerollHint")}
              aria-label={ct("cmd.reroll")}
            >
              <Glyph name="redo" size={16} />
            </button>
            <button type="button" className="bl-cmdbar-undo" onClick={() => controller.cancel()}>
              {ct("shell.undo")}
            </button>
          </div>
        </div>
      )}

      {!previewing && state.message && (
        <div className="bl-cmdbar-message" role="status">
          {state.message}
        </div>
      )}

      {!previewing && !thinking && !browsing && (
        <div className="bl-cmdbar-chips" aria-label={ct("cmd.suggestions")}>
          {(state.recent.length ? state.recent : examples).map((c) => (
            <button
              key={c}
              type="button"
              className="bl-cmdbar-chip"
              onClick={() => {
                setText(c)
                submit(c)
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {browsing && <ActionsPicker controller={controller} />}
    </div>
  )
}
