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
  const layout = useMemo(() => layoutScene(scene, { reveal }), [scene, reveal]);
  const label = useMemo(() => describeScene(scene, reveal), [scene, reveal]);
  return <SceneSvg layout={layout} label={label} kind={kind} medium={medium} />;
}
