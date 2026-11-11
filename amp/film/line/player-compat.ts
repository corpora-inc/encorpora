import type { SemanticFigure } from "../../src/math/contracts";
import { layoutScene } from "../../src/math/scene";
import { isPorted, legacyScene } from "../../src/math/scene/legacy";

// The frozen grading player predates the large-coordinate layout correction.
export const MIN_PLAYER_SCALE = 0.01;

export function sceneOf(figure: SemanticFigure | null | undefined) {
  return figure?.kind === "scene" ? figure.scene
    : figure && isPorted(figure) ? legacyScene(figure) : null;
}

export function compatibleExample(figure: SemanticFigure | null | undefined) {
  const scene = sceneOf(figure);
  return !scene || layoutScene(scene, { reveal: true }).scale >= MIN_PLAYER_SCALE;
}

export function checkPlayedExample(payload: {
  script: { shots: { figure?: { example?: boolean } | unknown }[] };
  figure?: SemanticFigure | null;
}) {
  const usesExample = payload.script.shots.some(shot =>
    !!shot.figure && typeof shot.figure === "object" && "example" in shot.figure && shot.figure.example === true);
  if (usesExample && !compatibleExample(payload.figure)) {
    throw new Error("The chosen example needs a scene scale below the installed player's 0.01 minimum. Use a compatible seed or draw this picture with the implemented kit primitives.");
  }
}
