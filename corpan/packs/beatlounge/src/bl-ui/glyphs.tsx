/**
 * beatlounge — inline-SVG glyph set. NO emoji anywhere in the product.
 * Each glyph is a 24×24 stroke icon that inherits `currentColor`. The
 * `<Glyph name="…">` component renders one by id; modules reference glyphs by
 * the same string id in their `BeatloungeModule.glyph`.
 */

import type { CSSProperties } from "react"

export type GlyphName =
  | "play"
  | "stop"
  | "grid"
  | "sliders"
  | "command"
  | "drawer"
  | "chevron-down"
  | "chevron-left"
  | "undo"
  | "redo"
  | "mute"
  | "solo"
  | "metronome"
  | "wave"

const PATHS: Record<GlyphName, JSX.Element> = {
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2.2" fill="currentColor" stroke="none" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
    </>
  ),
  sliders: (
    <>
      <path d="M6 4v6M6 14v6" />
      <path d="M12 4v9M12 17v3" />
      <path d="M18 4v3M18 11v9" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="12" cy="15" r="2" />
      <circle cx="18" cy="9" r="2" />
    </>
  ),
  command: (
    <path d="M9 6a2.5 2.5 0 1 0-2.5 2.5H9V6zm0 0v3m0 0h6m-6 0v3m0 0H6.5A2.5 2.5 0 1 0 9 16.5V15m0 0h6m-6 0v-3m6 0V6a2.5 2.5 0 1 1 2.5 2.5H15m0 6v1.5A2.5 2.5 0 1 0 17.5 15H15z" />
  ),
  drawer: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2.4" />
      <path d="M4 10h16" />
      <path d="M9.5 14.5h5" />
    </>
  ),
  "chevron-down": <path d="M6 9.5l6 6 6-6" />,
  "chevron-left": <path d="M14.5 6l-6 6 6 6" />,
  undo: <path d="M9 7L5 11l4 4M5 11h9a4 4 0 0 1 0 8h-2" />,
  redo: <path d="M15 7l4 4-4 4M19 11h-9a4 4 0 0 0 0 8h2" />,
  mute: (
    <>
      <path d="M5 9.5h3l4-3.5v12l-4-3.5H5z" />
      <path d="M16 9.5l4 5M20 9.5l-4 5" />
    </>
  ),
  solo: (
    <path d="M14.5 7.2a3.5 3.5 0 0 0-5 1.1c-.8 1.5.2 2.7 2 3.4 1.9.7 3 1.9 2.1 3.5a3.5 3.5 0 0 1-5.1 1" />
  ),
  metronome: (
    <>
      <path d="M9.5 4.5h5l2.5 15h-10z" />
      <path d="M12 19.5V9l3-2.5" />
    </>
  ),
  wave: (
    <path d="M3 12h2l1.5-5 2 10 2-13 2 16 2-9 1.5 1H21" />
  ),
}

export const Glyph = ({
  name,
  size = 22,
  strokeWidth = 1.6,
  style,
  className,
}: {
  name: GlyphName
  size?: number
  strokeWidth?: number
  style?: CSSProperties
  className?: string
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
    style={style}
  >
    {PATHS[name]}
  </svg>
)
