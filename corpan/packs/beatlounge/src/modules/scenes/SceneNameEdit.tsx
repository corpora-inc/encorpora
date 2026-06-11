/**
 * beatlounge — SceneNameEdit: tap-to-rename a Scene's name inline (mirrors the
 * shared TrackNameEdit pattern). Reads as a quiet label; tapping turns it into
 * an input. Enter / blur commits a rename; Escape cancels; empty is ignored.
 */

import { useEffect, useRef, useState } from "react"

interface Props {
  name: string
  onRename: (name: string) => void
  /** Tap selects the scene to load — only fires when NOT entering edit mode. */
  onActivate?: () => void
}

export const SceneNameEdit = ({ name, onRename, onActivate }: Props) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!editing) setDraft(name)
  }, [name, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (!next || next === name) return
    onRename(next)
  }

  const cancel = () => {
    setDraft(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="bl-scenes-nameinput"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          else if (e.key === "Escape") cancel()
        }}
        aria-label="Scene name"
        spellCheck={false}
        autoComplete="off"
      />
    )
  }

  return (
    <button
      type="button"
      className="bl-scenes-name"
      title={onActivate ? `Load "${name}"` : name}
      onClick={onActivate}
      onDoubleClick={() => {
        setDraft(name)
        setEditing(true)
      }}
    >
      <span className="bl-scenes-nametext">{name}</span>
    </button>
  )
}
