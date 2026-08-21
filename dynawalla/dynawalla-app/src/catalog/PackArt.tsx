import { useMemo } from "react"

import { artOf, hueClass, rngFrom } from "./art.ts"
import { shapesOf, type Shape } from "./motifs.ts"

/**
 * One shape, drawn.
 *
 * Everything that varies per element — alpha, dash, geometry — rides on a
 * presentation ATTRIBUTE, never on a `style` prop. Under `style-src 'self'`
 * an inline style is discarded in the shipped build while working perfectly in
 * dev; a presentation attribute is not CSS and the policy does not touch it.
 * The colour comes from the class, which comes from the stylesheet.
 */
function Drawn({ shape }: { shape: Shape }) {
  const className = `dw-art-${shape.ink}`
  const opacity = shape.alpha === undefined ? undefined : String(shape.alpha)

  switch (shape.kind) {
    case "path":
      return (
        <path className={className} d={shape.d} opacity={opacity} strokeDasharray={shape.dash} />
      )
    case "circle":
      return (
        <circle className={className} cx={shape.cx} cy={shape.cy} r={shape.r} opacity={opacity} />
      )
    case "rect":
      return (
        <rect
          className={className}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.radius}
          opacity={opacity}
        />
      )
  }
}

/**
 * A game's key art: generated, deterministic, and different for every game.
 *
 * There is no cover art in this repository and no artist is coming, so the
 * picture on a card is computed from the pack id — the same picture on every
 * device and every launch, because a thumbnail a child cannot learn to
 * recognise is not doing the one job a thumbnail has.
 *
 * Purely decorative: the card's accessible name is the game's name, sitting
 * right under it, and a drawing that also announced itself would say it twice.
 */
export function PackArt({ packId, className }: { packId: string; className?: string }) {
  const shapes = useMemo(() => {
    const spec = artOf(packId)
    return { spec, shapes: shapesOf(spec.motif, rngFrom(spec.seed)) }
  }, [packId])

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={["dw-art", hueClass(shapes.spec.hue), className].filter(Boolean).join(" ")}
    >
      <rect className="dw-art-ground" x="0" y="0" width="100" height="100" />
      {/* The bloom the whole drawing sits in: light, never paint. A wash of the
          card's own hue across the whole field, so the art reads as lit from
          inside rather than printed on the void.

          Full bleed rather than a disc, and that is the second time this has
          been corrected: a large faint circle behind every drawing gave all
          twenty-seven cards the same round silhouette, which is the note the
          arch-shaped niches were rejected for. A card's outline is a square
          like every other card's; only what is drawn inside it differs. */}
      <rect className="dw-art-fill" x="0" y="0" width="100" height="100" opacity="0.07" />
      {shapes.shapes.map((shape, index) => (
        <Drawn key={index} shape={shape} />
      ))}
    </svg>
  )
}
