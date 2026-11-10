import { readFile } from "node:fs/promises";
import { z } from "zod";
import { lessons } from "../content/lessons";

/** A lesson's typeset PDFs, built into the API image by
 * scripts/build-pdf-release.ts. This file stays in src/server so the path
 * resolves the same from the source and from the bundled src/server/main.mjs. */
export const publicationFile = (filename: string) =>
  new URL(`../../artifacts/publications/${filename}`, import.meta.url);

/** Lesson, workbook and solutions, each in Letter and A4
 * (scripts/publication-documents.ts). */
const EDITIONS = 6;
const manifest = z.object({
  publications: z.array(
    z.object({
      lessonId: z.string(),
      kind: z.enum(["lesson", "workbook", "solutions"]),
      format: z.enum(["Letter", "A4"]),
    }),
  ),
});

/** Catalog lessons this server cannot hand out as PDFs: none in a release
 * image (its build fails on a missing one), every lesson on a server built
 * without them. Read from the build's manifest. */
export async function unpublishedLessonIds(
  warn: (message: string, error?: unknown) => void,
  file: URL = publicationFile("manifest.json"),
): Promise<string[]> {
  let built: z.infer<typeof manifest>;
  try {
    built = manifest.parse(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    warn("No lesson PDFs on this server, so lessons offer no print", error);
    return lessons.map((lesson) => lesson.id);
  }
  const editions = new Map<string, Set<string>>();
  for (const { lessonId, kind, format } of built.publications)
    editions
      .set(lessonId, editions.get(lessonId) ?? new Set())
      .get(lessonId)!
      .add(`${kind}-${format}`);
  const missing = lessons
    .filter((lesson) => (editions.get(lesson.id)?.size ?? 0) < EDITIONS)
    .map((lesson) => lesson.id);
  if (missing.length)
    warn(`${missing.length} lessons have no PDFs, so they offer no print`);
  return missing;
}
