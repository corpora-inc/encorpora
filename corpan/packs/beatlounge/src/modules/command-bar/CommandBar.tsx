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
import type { ResultSource } from "../../llm/runtime"
import type { CommandBarController, CommandBarState } from "./controller"
import "./styles.css"

export interface CommandBarProps {
  controller: CommandBarController
  /** Called when the user dismisses the bar (Escape / close button / backdrop). */
  onClose?: () => void
  /** A few example prompts shown when there's no history yet. */
  placeholderExamples?: string[]
}

const DEFAULT_EXAMPLES = ["more hihats", "make it darker", "latin feel", "tresillo on the kick", "loosen up the drums"]

const sourceLabel = (source: ResultSource): string => {
  switch (source) {
    case "model":
    case "model-repair":
      return "assistant"
    case "keyword":
    case "keyword-no-llm":
      return "keywords"
    default:
      return ""
  }
}

export const CommandBar = ({ controller, onClose, placeholderExamples }: CommandBarProps) => {
  const [state, setState] = useState<CommandBarState>(controller.getState())
  const [text, setText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const examples = placeholderExamples ?? DEFAULT_EXAMPLES

  useEffect(() => controller.subscribe(setState), [controller])
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    <div className="bl-cmdbar" role="dialog" aria-label="Command bar" data-bl-nocapture>
      <div className="bl-cmdbar-row">
        <span className="bl-cmdbar-glyph" aria-hidden>
          <Glyph name="command" size={18} />
        </span>
        <input
          ref={inputRef}
          className="bl-cmdbar-input"
          type="text"
          value={text}
          placeholder="Tell the loop what to do…"
          autoComplete="off"
          spellCheck={false}
          disabled={thinking}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Describe a change"
        />
        {thinking ? (
          <span className="bl-cmdbar-spinner" aria-label="Thinking" />
        ) : (
          <button
            type="button"
            className="bl-cmdbar-go"
            onClick={() => submit(text)}
            disabled={!text.trim()}
            aria-label="Run"
          >
            Go
          </button>
        )}
        {onClose && (
          <button type="button" className="bl-cmdbar-close" onClick={onClose} aria-label="Close">
            <Glyph name="chevron-down" size={18} />
          </button>
        )}
      </div>

      {previewing && state.result && (
        <div className="bl-cmdbar-preview" role="group" aria-label="Preview">
          <div className="bl-cmdbar-summary">
            <strong>{state.result.summary}</strong>
            <span className="bl-cmdbar-via">via {sourceLabel(state.result.source)}</span>
          </div>
          <div className="bl-cmdbar-actions">
            <button type="button" className="bl-cmdbar-keep" onClick={() => controller.keep()}>
              Keep
            </button>
            <button
              type="button"
              className="bl-cmdbar-reroll"
              onClick={() => void controller.reroll()}
              title="Try another take"
            >
              <span aria-hidden>🎲</span> Reroll
            </button>
            <button type="button" className="bl-cmdbar-undo" onClick={() => controller.cancel()}>
              Undo
            </button>
          </div>
        </div>
      )}

      {!previewing && state.message && (
        <div className="bl-cmdbar-message" role="status">
          {state.message}
        </div>
      )}

      {!previewing && !thinking && (
        <div className="bl-cmdbar-chips" aria-label="Suggestions">
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
    </div>
  )
}
