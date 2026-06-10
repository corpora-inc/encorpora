/**
 * beatlounge — Transport: the play/stop control. Space toggles globally (when
 * focus isn't in a text field). ≥44px hit target, ARIA pressed state, springy
 * :active feedback. Stateless: parent owns `playing` + the toggle.
 */

import { useEffect } from "react"
import { Glyph } from "./glyphs"

export interface TransportProps {
  playing: boolean
  onToggle: () => void
  /** Bind Space to toggle at the document level (one owner — the Rail). */
  spaceToToggle?: boolean
  size?: "md" | "lg"
}

const isEditable = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT")

export const Transport = ({
  playing,
  onToggle,
  spaceToToggle = true,
  size = "md",
}: TransportProps) => {
  useEffect(() => {
    if (!spaceToToggle) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return
      if (isEditable(e.target)) return
      e.preventDefault()
      onToggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [spaceToToggle, onToggle])

  return (
    <button
      type="button"
      className={`bl-transport bl-transport--${size}${playing ? " is-playing" : ""}`}
      onClick={onToggle}
      aria-pressed={playing}
      aria-label={playing ? "Stop" : "Play"}
      title={playing ? "Stop (Space)" : "Play (Space)"}
    >
      <Glyph name={playing ? "stop" : "play"} size={size === "lg" ? 26 : 22} />
    </button>
  )
}
