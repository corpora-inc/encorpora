import React from "react";
import { SceneFigure } from "../web/scene/SceneFigure";
import { scene } from "../math/scene/author";
import { iso } from "../math/scene/components/iso-solid";
import { quadrantScene } from "../math/scene/legacy";
import type { Element, Point, Scene } from "../math/scene/spec";

export type VolumeCoordinateIllustrationKind =
  "volume-layers" | "prism-composite" | "ordered-pair-path";

const label = (
  id: string,
  at: Point,
  text: string,
  align: [-1 | 0 | 1, -1 | 0 | 1],
): Element => ({
  type: "text",
  id,
  at,
  text,
  font: "sans",
  align,
  halo: true,
});

/** Exact lesson models, built as scenes and drawn revealed: every cube,
 * edge and gridline at true proportion. */
export function VolumeCoordinateIllustration({
  kind,
}: {
  kind: VolumeCoordinateIllustrationKind;
}) {
  const caption =
    kind === "volume-layers"
      ? "A 4 by 3 by 2 prism lifted apart into its two layers. Each layer holds 4 × 3 = 12 cubes, so the prism holds 2 × 12 = 24."
      : kind === "prism-composite"
        ? "A stepped solid pulled apart into two rectangular prisms of the same 2 cm depth: 3 × 2 × 5 = 30 and 4 × 2 × 2 = 16, together 46 cubic centimeters."
        : "To reach (2, 5), go 2 across from 0, then 5 up. Going 5 across and 2 up reaches a different point, (5, 2).";
  return (
    <figure
      className="lesson-illustration"
      data-lesson-illustration={kind}
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <SceneFigure scene={scenes[kind]()} reveal kind={kind} />
      <figcaption style={{ fontSize: "0.875rem", marginTop: 8 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

const scenes: Record<VolumeCoordinateIllustrationKind, () => Scene> = {
  "volume-layers": () => {
    const lift = 1.4;
    return scene(
      {
        type: "isoSolid",
        id: "prism",
        solid: { form: "cubes", length: 4, width: 3, height: 2, lift },
      },
      label("layer0", iso(4, 0, 0.5), "4 × 3 = 12", [-1, 0]),
      label("layer1", iso(4, 0, 1 + lift + 0.5), "12 more", [-1, 0]),
    ).build({ width: 360, title: "A prism lifted apart into its layers" });
  },
  "prism-composite": () => {
    const apart = 1.4;
    return scene(
      {
        type: "isoSolid",
        id: "prism",
        solid: {
          form: "composite",
          width: 2,
          parts: [
            { length: 3, height: 5 },
            { length: 4, height: 2 },
          ],
          unit: "cm",
          apart,
        },
      },
      label("tall", iso(1.5, 0, 5), "3 × 2 × 5 = 30", [-1, 1]),
      label("short", iso(3 + apart + 4, 2, 0), "4 × 2 × 2 = 16", [0, -1]),
    ).build({ width: 360, title: "A stepped solid as two prisms" });
  },
  "ordered-pair-path": () => {
    const base = quadrantScene(6, [
      { x: 2, y: 5, label: "A" },
      { x: 5, y: 2, label: "B" },
    ]);
    const walk = (
      id: string,
      pts: Point[],
      stroke: "warm" | "axis",
      dash?: "dash",
    ): Element => ({
      type: "polyline",
      id,
      points: pts,
      stroke,
      width: stroke === "warm" ? 4 : 2.5,
      ...(dash ? { dash } : {}),
    });
    return {
      ...base,
      elements: [
        ...base.elements,
        walk(
          "toA",
          [
            [0, 0],
            [2, 0],
            [2, 5],
          ],
          "warm",
        ),
        walk(
          "toB",
          [
            [0, 0],
            [5, 0],
            [5, 2],
          ],
          "axis",
          "dash",
        ),
        { ...label("across", [1, 0], "2", [0, 1]), offset: [0, -8] } as Element,
        { ...label("up", [2, 2.5], "5", [-1, 0]), offset: [10, 0] } as Element,
      ],
      title: "Across 2, then up 5",
    };
  },
};
