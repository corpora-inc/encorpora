import type { SVGProps } from "react";
import type { BillValue } from "../../math/scene/art";
import { billFaceUrl } from "./bill-art";

/** Original vector art with fixed paper/ink colors in both themes. The accent
 * outline stays inside the reserved edge, without recoloring or hiding the art. */
export function BillFace({
  value,
  x,
  y,
  w,
  h,
  edge,
  emphasis = 0,
  ...rest
}: {
  value: BillValue;
  x: number;
  y: number;
  w: number;
  h: number;
  edge: number;
  emphasis?: number;
} & Omit<SVGProps<SVGGElement>, "children">) {
  const ring = Math.min(3, w / 12, h / 12);
  return (
    <g {...rest}>
      <rect x={x} y={y} width={w} height={h} fill="var(--color-bill-paper)" />
      <image
        href={billFaceUrl[value]}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid meet"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke="var(--color-bill-edge)"
        strokeWidth={edge / 2}
      />
      {emphasis > 0 && (
        <rect
          data-bill-lit=""
          x={x - edge / 2 + ring / 2}
          y={y - edge / 2 + ring / 2}
          width={w + edge - ring}
          height={h + edge - ring}
          fill="none"
          stroke="var(--color-figure-accent)"
          strokeOpacity={emphasis}
          strokeWidth={ring}
        />
      )}
    </g>
  );
}
