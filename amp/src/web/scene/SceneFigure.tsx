import { useMemo } from "react";
import { describeScene, layoutScene, type Scene } from "../../math/scene";
import { SceneSvg, type Medium } from "./SceneSvg";

/** A static scene: the start frame of a problem figure, or a lesson's
 * revealed model. Layout is pure, so server, print and screen agree. */
export function SceneFigure({
  scene,
  reveal = false,
  kind,
  medium = "screen",
}: {
  scene: Scene;
  reveal?: boolean;
  kind?: string;
  medium?: Medium;
}) {
  // Callers often rebuild an equal scene each render (legacy adapters, typed
  // answers re-rendering the workspace): key the layout on content.
  const key = JSON.stringify(scene);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => layoutScene(scene, { reveal }), [key, reveal]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const label = useMemo(() => describeScene(scene, reveal), [key, reveal]);
  return <SceneSvg layout={layout} label={label} kind={kind} medium={medium} />;
}
