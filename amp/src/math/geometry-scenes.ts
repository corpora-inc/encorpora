import type { SemanticFigure } from "./contracts.js";
import { isPorted, legacyScene } from "./scene/legacy.js";
import { sceneSchema, type Scene } from "./scene/spec.js";

/** A geometry figure as a scene: the same data, drawn by one scene
 * component, with an optional timeline. */
export function geometryScene(
  figure: SemanticFigure,
  edit?: (scene: Scene) => Scene,
): SemanticFigure {
  if (figure.kind === "scene" || !isPorted(figure)) return figure;
  const scene = legacyScene(figure);
  return {
    kind: "scene",
    scene: sceneSchema.parse(edit ? edit(scene) : scene),
  };
}
