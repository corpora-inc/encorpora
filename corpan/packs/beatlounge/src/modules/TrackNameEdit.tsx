/**
 * beatlounge — TrackNameEdit: the shared track label.
 *
 * The founder's core gripe was not knowing (or being able to fix) what each
 * track WAS. Every surface that shows a track name uses this: the colored dot +
 * the name read as a quiet label; editing turns the name into an inline input.
 * Enter / blur commits ONE `setTrackProp({prop:"name"})` (one undo step); Escape
 * cancels; an empty name is ignored (keeps the old one). Premium + minimal.
 *
 * TWO interaction modes, chosen by whether `onTap` is supplied:
 *   • DEFAULT (no `onTap`) — tap enters rename (legacy; for surfaces where the
 *     name is purely a label).
 *   • TAP-TO-SWITCH (`onTap` given) — a quick TAP calls `onTap` (the common
 *     action, e.g. switch tracks); a deliberate LONG-PRESS (~450ms hold) enters
 *     rename. This is what the instruments track switcher wants: tapping a chip
 *     switches to it; holding the name renames it. The decision rule is the pure
 *     `resolveRelease` (./instruments/longPress).
 */

import { useEffect, useRef, useState } from "react"
import type { BeatloungeStore } from "../store/store"
import type { Id } from "../model/document"
import { LONG_PRESS_MS, isDrag, type PressStart } from "./instruments/longPress"
import "./TrackNameEdit.css"

interface Props {
  store: BeatloungeStore
  trackId: Id
  name: string
  /** Track accent color for the leading dot (omit to hide the dot). */
  color?: string
  /** Extra class on the wrapper (so each surface keeps its own name styling). */
  className?: string
  /** When supplied: a quick TAP calls this (e.g. switch tracks) and rename is
   *  promoted to a LONG-PRESS. Omit ⇒ tap renames (legacy). */
  onTap?: () => void
}

export const TrackNameEdit = ({ store, trackId, name, color, className, onTap }: Props) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Long-press bookkeeping (only used when onTap is supplied).
  const pressRef = useRef<PressStart | null>(null)
  const heldRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const clearHold = () => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  // Cancel any pending hold timer on unmount (no stray rename after teardown).
  useEffect(() => clearHold, [])

  const startEdit = () => {
    setDraft(name)
    setEditing(true)
  }

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

  // Legacy: tap renames (no switch action wired).
  if (!onTap) {
    return (
      <button
        type="button"
        className={cls}
        data-bl-nocapture
        title={name}
        aria-label={`Rename ${name}`}
        onClick={startEdit}
      >
        {color !== undefined && <span className="bl-dot" style={{ background: color }} />}
        <span className="bl-trackname-text">{name}</span>
      </button>
    )
  }

  // Tap-to-switch: quick tap ⇒ onTap; long-press ⇒ rename. Pointer-driven so a
  // hold can promote to rename without firing the tap.
  return (
    <button
      type="button"
      className={cls}
      data-bl-nocapture
      title={name}
      aria-label={`${name} — tap to switch, hold to rename`}
      onPointerDown={(e) => {
        pressRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
        heldRef.current = false
        clearHold()
        timerRef.current = window.setTimeout(() => {
          heldRef.current = true
          timerRef.current = null
          startEdit()
        }, LONG_PRESS_MS)
      }}
      onPointerMove={(e) => {
        const s = pressRef.current
        if (s && isDrag(s, e.clientX, e.clientY)) clearHold() // drifted ⇒ a scroll
      }}
      onPointerUp={() => {
        clearHold()
        // The hold timer already entered rename ⇒ the release is a no-op.
        if (!heldRef.current && pressRef.current) onTap()
        pressRef.current = null
      }}
      onPointerCancel={() => {
        clearHold()
        pressRef.current = null
      }}
      onClick={(e) => e.preventDefault()}
    >
      {color !== undefined && <span className="bl-dot" style={{ background: color }} />}
      <span className="bl-trackname-text">{name}</span>
    </button>
  )
}
