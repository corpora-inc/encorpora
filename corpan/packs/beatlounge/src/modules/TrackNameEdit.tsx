/**
 * beatlounge — TrackNameEdit: the shared tap-to-rename track label.
 *
 * The founder's core gripe was not knowing (or being able to fix) what each
 * track WAS. Every surface that shows a track name uses this: the colored dot +
 * the name read as a quiet label; tapping it turns the name into an inline input
 * you can edit. Enter / blur commits ONE `setTrackProp({prop:"name"})` (one undo
 * step); Escape cancels; an empty name is ignored (keeps the old one). No
 * buttons, no copy — the affordance IS the name. Premium + minimal.
 */

import { useEffect, useRef, useState } from "react"
import type { BeatloungeStore } from "../store/store"
import type { Id } from "../model/document"
import "./TrackNameEdit.css"

interface Props {
  store: BeatloungeStore
  trackId: Id
  name: string
  /** Track accent color for the leading dot (omit to hide the dot). */
  color?: string
  /** Extra class on the wrapper (so each surface keeps its own name styling). */
  className?: string
}

export const TrackNameEdit = ({ store, trackId, name, color, className }: Props) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Keep the draft in sync when the name changes from elsewhere while idle.
  useEffect(() => {
    if (!editing) setDraft(name)
  }, [name, editing])

  // Focus + select the whole name the moment we enter edit mode.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (!next || next === name) return // empty or unchanged → keep the old name
    store.dispatch({ t: "setTrackProp", trackId, prop: "name", value: next })
  }

  const cancel = () => {
    setDraft(name)
    setEditing(false)
  }

  const cls = `bl-trackname${className ? ` ${className}` : ""}`

  if (editing) {
    return (
      <span className={`${cls} is-editing`} data-bl-nocapture>
        {color !== undefined && <span className="bl-dot" style={{ background: color }} />}
        <input
          ref={inputRef}
          className="bl-trackname-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            else if (e.key === "Escape") cancel()
          }}
          aria-label="Track name"
          spellCheck={false}
          autoComplete="off"
        />
      </span>
    )
  }

  return (
    <button
      type="button"
      className={cls}
      data-bl-nocapture
      title={name}
      aria-label={`Rename ${name}`}
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
    >
      {color !== undefined && <span className="bl-dot" style={{ background: color }} />}
      <span className="bl-trackname-text">{name}</span>
    </button>
  )
}
