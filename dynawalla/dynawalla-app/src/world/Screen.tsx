import { strings, fill } from "../app/strings.ts"
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
 */
function paint(piece: Piece): { fill: string; stroke: string; width: number } {
  return piece.kind === "panel"
    ? { fill: "var(--dw-line-strong)", stroke: "none", width: 0 }
    : { fill: "var(--dw-ground-deep)", stroke: "var(--dw-field-ink)", width: 0.35 }
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
export function WorldScreen({ placed, className }: { placed: number; className?: string }) {
  const pieces = screenPieces(placed)
  const box = screenBox(placed)

  return (
    <svg
      id="dw-world"
      role="img"
      aria-label={fill(strings.world.cut, { apertures: placed })}
      className={className}
      viewBox={`0 0 ${String(box.width)} ${String(box.height)}`}
      focusable="false"
    >
      {/* Chrome, 1 of CHROME_NODES: the stone plate the screen is cut from. */}
      <rect
        x="0"
        y="0"
        width={box.width}
        height={box.height}
        fill="var(--dw-ground-raised)"
        stroke="var(--dw-line-cut)"
        strokeWidth="0.5"
      />
      {/* Chrome, 2 of CHROME_NODES: the sill the courses are laid on. */}
      <rect
        x="0"
        y={box.height - 1}
        width={box.width}
        height="1"
        fill="var(--dw-line-strong)"
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
