import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildLessonIndex,
  formatLessonIndex,
} from "../src/content/lesson-index-build";

/** Writes the lesson layer's index of problem types from the engine. */
export const LESSON_INDEX_PATH = fileURLToPath(
  new URL("../src/web/features/pathways/lesson-index.json", import.meta.url),
);
writeFileSync(LESSON_INDEX_PATH, formatLessonIndex(buildLessonIndex()));
console.log(`Wrote ${LESSON_INDEX_PATH}`);
