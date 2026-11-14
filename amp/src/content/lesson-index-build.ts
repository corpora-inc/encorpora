import { templates } from "../math/engine";

/**
 * Every problem type's title and skill, as the lesson layer reads them before
 * any request (src/web/features/pathways/lesson-index.json): a cold link to a
 * lesson lays out its title and actions on the first frame. Built from the
 * engine's catalogue by `npm run build:lesson-index` (and by the build);
 * `tests/lesson-index.test.ts` fails when the committed copy drifts.
 *
 * Whether a type has a film is not here: the film catalogue the same chunk
 * already carries (content/films) answers that, so publishing a film never
 * needs this rebuilt.
 */
export type LessonIndex = Record<string, [title: string, skill: string]>;

export function buildLessonIndex(): LessonIndex {
  return Object.fromEntries(
    [...templates]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((type) => [type.id, [type.title, type.skillId]]),
  );
}

/** One entry per line, so a change reads as a one-line diff. */
export function formatLessonIndex(index: LessonIndex) {
  const lines = Object.entries(index).map(
    ([id, entry]) => `  ${JSON.stringify(id)}: ${JSON.stringify(entry)}`,
  );
  return `{\n${lines.join(",\n")}\n}\n`;
}
