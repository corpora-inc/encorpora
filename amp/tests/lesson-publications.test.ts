import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { lessons } from "../src/content/lessons.js";
import { unpublishedLessonIds } from "../src/server/publications.js";

const editions = (lessonId: string) =>
  (["lesson", "workbook", "solutions"] as const).flatMap((kind) =>
    (["Letter", "A4"] as const).map((format) => ({
      lessonId,
      kind,
      format,
      filename: `${lessonId}-${kind}-${format}.pdf`,
    })),
  );

test("a lesson offers print only when all six of its PDFs were built", async () => {
  const [complete, partial] = lessons;
  const directory = await mkdtemp(join(tmpdir(), "amp-publications-"));
  const file = join(directory, "manifest.json");
  await writeFile(
    file,
    JSON.stringify({
      publications: [
        ...editions(complete!.id),
        ...editions(partial!.id).slice(1),
      ],
    }),
  );
  const warnings: string[] = [];
  const missing = await unpublishedLessonIds(
    (message) => warnings.push(message),
    pathToFileURL(file),
  );
  assert.ok(!missing.includes(complete!.id));
  assert.ok(missing.includes(partial!.id));
  assert.equal(missing.length, lessons.length - 1);
  assert.equal(warnings.length, 1);
});

test("a server built without PDFs offers print for no lesson", async () => {
  const warnings: string[] = [];
  const missing = await unpublishedLessonIds(
    (message) => warnings.push(message),
    pathToFileURL(join(tmpdir(), "amp-no-such-dir", "manifest.json")),
  );
  assert.equal(missing.length, lessons.length);
  assert.equal(warnings.length, 1);
});
