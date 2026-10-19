import assert from "node:assert/strict";
import test from "node:test";

// Node imports these for rendering, print export and tests: a stylesheet
// import here would crash under tsx. Global styles load in the web entry.
test("scene and lesson modules import under Node", async () => {
  for (const path of [
    "../src/web/scene/SceneSvg.tsx",
    "../src/web/scene/SceneFigure.tsx",
    "../src/web/scene/ScenePlayer.tsx",
    "../src/web/Figure.tsx",
    "../src/web/ProblemLesson.tsx",
    "../src/web/PracticeWorkspace.tsx",
    "../src/math/scene/index.ts",
    "../src/math/scene/timeline.ts",
    "../src/math/scene/explanations.ts",
  ])
    assert.ok(await import(path), path);
});
