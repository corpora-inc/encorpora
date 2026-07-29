import { CHROME_NODES, screenBox, screenPieces, type Piece } from "./construction.ts"

/**
 * The material each scale of piece is cut in.
 *
 * A cut aperture is a **hole**, not a highlight: the deep field behind the
 * screen, with the lit edge of the stone catching celestial light along its
 * rim. That is how a pierced screen reads from the lit side, and it is why the
 * drawing survives both themes — in dark, where field and ground are nearly the
 * same basalt, the rim is what carries it. Nothing here is legible by colour
 * alone.
 *
 * The four scales are the same hole drawn at four levels of fusion, so they are
 * deliberately the same material. A finished course does not look different
 * from a fresh cell; it is just one node instead of a hundred.
 *
 * The plan is the exception, and it is not stone at all: an incised setting-out
 * line, no fill, drawn under everything. It is what a mason marks before
 * cutting, and it is why an empty plate is not what a child sees on the day
 * they start.
 */
function paint(piece: Piece): { fill: string; stroke: string; width: number } {
  if (piece.kind === "plan") return { fill: "none", stroke: "var(--dw-line-strong)", width: 0.3 }
  return piece.kind === "panel"
    ? { fill: "var(--dw-line-strong)", stroke: "none", width: 0 }
    : { fill: "var(--dw-aperture)", stroke: "var(--dw-aperture-rim)", width: 0.35 }
}

/**
 * The screen the child has cut, at whatever size it is given.
 *
 * Draws exactly `screenPieces(placed).length + CHROME_NODES` SVG elements —
 * the identity `construction.ts` asserts, and the reason `Q-02`'s node cap is a
 * property of the model rather than a thing somebody has to remember. The two
 * chrome elements are the plate and its rim; they are counted below so the
 * count in the model cannot drift from the count in the DOM.
 */
export function WorldScreen({
  placed,
  label,
  className,
}: {
  placed: number
  /** The text alternative, written by the surface that asked for the drawing. */
  label: string
  className?: string
}) {
  const pieces = screenPieces(placed)
  const box = screenBox(placed)

  return (
    <svg
      id="dw-world"
      role="img"
      aria-label={label}
      className={className}
      viewBox={`0 0 ${String(box.width)} ${String(box.height)}`}
      focusable="false"
    >
      {/* Chrome, 1 of CHROME_NODES: the stone plate the screen is cut from.
          Inset by half its own stroke, because an SVG stroke is centred on the
          path: at x = 0 half of it fell outside the viewBox and was clipped, so
          the plate was drawn a device pixel wider than its own frame down the
          left and right and read as a misregistered print. `ground-sunk` and
          not `ground-raised`: in light the plate was pure white on a violet
          page with near-black apertures cut in it, which is the highest
          contrast pair in the app spent on a decorative drawing. Stone, not
          paper. */}
      <rect
        x="0.25"
        y="0.25"
        width={box.width - 0.5}
        height={box.height - 0.5}
        fill="var(--dw-ground-sunk)"
        stroke="var(--dw-line-strong)"
        strokeWidth="0.5"
      />
      {/* Chrome, 2 of CHROME_NODES: the sill the courses are laid on. Half a
          unit and inside the plate. A full unit of `line-strong` running the
          whole width and a fraction PAST it read as a failed drop shadow
          rather than as the course the work stands on. */}
      <rect
        x="0.25"
        y={box.height - 0.75}
        width={box.width - 0.5}
        height="0.5"
        fill="var(--dw-line-cut)"
      />
      {pieces.map((piece) => {
        const material = paint(piece)
        return (
          <path
            key={piece.key}
            d={piece.d}
            fill={material.fill}
            stroke={material.stroke}
            strokeWidth={material.width}
          />
        )
      })}
    </svg>
  )
}

/** Exported so the boundary between the model's count and the DOM's is one number. */
export const CHROME_IN_MARKUP = CHROME_NODES
