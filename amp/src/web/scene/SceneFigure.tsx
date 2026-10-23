import { useMemo } from "react";
import { describeScene, layoutScene, type Scene } from "../../math/scene";
import { frameAt, visibleSteps } from "../../math/scene/timeline";
import { SceneSvg, type Medium } from "./SceneSvg";
import { COMPACT_WIDTH, useCompact } from "./useCompact";

/** A static scene: the start frame of a problem figure, or a lesson's
 * revealed model. Layout is pure, so server, print and screen agree. */
export function SceneFigure({
  scene,
  reveal = false,
  kind,
  medium = "screen",
  frame = "start",
  maxHeight,
}: {
  scene: Scene;
  reveal?: boolean;
  kind?: string;
  medium?: Medium;
  /** With steps: the start frame (a problem's givens) or the final frame. */
  frame?: "start" | "end";
  /** Relayout within a short answer sheet while retaining readable label sizes. */
  maxHeight?: number;
}) {
  // Callers often rebuild an equal scene each render (legacy adapters, typed
  // answers re-rendering the workspace): key the layout on content.
  const compact = useCompact() && medium === "screen";
  const fitted = {
    ...scene,
    ...(compact && { width: Math.min(scene.width ?? 360, COMPACT_WIDTH) }),
    ...(maxHeight !== undefined && {
      maxHeight: Math.min(scene.maxHeight ?? 320, maxHeight),
    }),
  };
  const key = JSON.stringify(fitted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => layoutScene(fitted, { reveal }), [key, reveal]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const label = useMemo(() => describeScene(scene, reveal), [key, reveal]);
  const steps = visibleSteps(scene.steps ?? [], reveal ? "lesson" : "hint");
  const states = steps.length
    ? frame === "start"
      ? frameAt(layout, steps, -1, 0, scene.steps)
      : frameAt(layout, steps, steps.length - 1, 1, scene.steps)
    : undefined;
  // Describe what is drawn: parts a timeline has not shown yet are omitted.
  const described = states
    ? describeScene(scene, reveal, (id) => states[id]?.opacity === 0)
    : label;
  return (
    <SceneSvg
      layout={layout}
      label={described}
      kind={kind}
      medium={medium}
      states={states}
    />
  );
}
