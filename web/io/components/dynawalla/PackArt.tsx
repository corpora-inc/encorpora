import { artFor } from "@/lib/dynawallaCatalog";
import type { Shape } from "@/lib/dynawalla/motifs";

/**
 * One shape, drawn.
 *
 * Geometry and alpha ride on SVG presentation attributes rather than a `style`
 * prop, matching the app: the colour comes from the class, which comes from
 * the stylesheet.
 */
function Drawn({ shape }: { shape: Shape }) {
  const className = `dw-art-${shape.ink}`;
  const opacity = shape.alpha === undefined ? undefined : String(shape.alpha);

  switch (shape.kind) {
    case "path":
      return (
        <path
          className={className}
          d={shape.d}
          opacity={opacity}
          strokeDasharray={shape.dash}
        />
      );
    case "circle":
      return (
        <circle
          className={className}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          opacity={opacity}
        />
      );
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
      );
  }
}

/**
 * A game's key art: generated, deterministic, different for every game.
 *
 * There is no cover art in the repository and no artist is coming, so the
 * picture is computed from the pack id — the same drawing here as on the
 * device, because recognition is the whole job of a thumbnail.
 *
 * Purely decorative: the game's name sits next to it, and a drawing that also
 * announced itself would say it twice.
 */
export function PackArt({
  packId,
  className,
}: {
  packId: string;
  className?: string;
}) {
  const art = artFor(packId);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={["dw-art", art.hueClassName, className]
        .filter(Boolean)
        .join(" ")}
    >
      <rect className="dw-art-ground" x="0" y="0" width="100" height="100" />
      {/* The bloom the drawing sits in: light, never paint. Full bleed rather
          than a disc, so the art is not given a round silhouette every card
          shares. */}
      <rect
        className="dw-art-fill"
        x="0"
        y="0"
        width="100"
        height="100"
        opacity="0.07"
      />
      {art.shapes.map((shape, index) => (
        <Drawn key={index} shape={shape} />
      ))}
    </svg>
  );
}
