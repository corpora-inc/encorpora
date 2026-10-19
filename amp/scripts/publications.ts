import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, type Browser } from "playwright";
import { lessons } from "../src/content/lessons";
import {
  publicationHtml,
  type PublicationKind,
} from "../src/content/publications";

// Incremental: a document's PDFs are re-rendered only when its print HTML
// changed or a PDF is missing, so `npm run review:math` can always rebuild
// what it reviews. `--force` re-renders everything (CI starts clean anyway).
const force = process.argv.includes("--force");
const output = new URL("../artifacts/publications/", import.meta.url);
await mkdir(output, { recursive: true });
type Entry = {
  lessonId: string;
  kind: PublicationKind;
  format: string;
  filename: string;
  sha256: string;
  bytes: number;
};
const read = (name: string) =>
  readFile(new URL(name, output)).catch(() => null);
const previous = new Map<string, Entry>();
if (!force) {
  const existing = await read("manifest.json");
  if (existing)
    for (const entry of (
      JSON.parse(existing.toString("utf8")) as { publications: Entry[] }
    ).publications)
      previous.set(entry.filename, entry);
}
const manifest: Entry[] = [];
const expected = new Set(["manifest.json"]);
let browser: Browser | null = null;
let rendered = 0;
try {
  for (const lesson of lessons) {
    for (const kind of ["lesson", "workbook", "solutions"] as const) {
      const html = publicationHtml(lesson, kind);
      const htmlName = `${lesson.id}-${kind}.html`;
      expected.add(htmlName);
      const formats = (["Letter", "A4"] as const).map((format) => ({
        format,
        filename: `${lesson.id}-${kind}-${format}.pdf`,
      }));
      for (const { filename } of formats) expected.add(filename);
      const kept = formats.map(({ filename }) => previous.get(filename));
      const current =
        (await read(htmlName))?.toString("utf8") === html &&
        kept.every(Boolean) &&
        (
          await Promise.all(
            kept.map(async (entry) => {
              const pdf = await read(entry!.filename);
              return (
                !!pdf &&
                createHash("sha256").update(pdf).digest("hex") === entry!.sha256
              );
            }),
          )
        ).every(Boolean);
      if (current) {
        manifest.push(...(kept as Entry[]));
        continue;
      }
      await writeFile(new URL(htmlName, output), html);
      browser ??= await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html);
      for (const { format, filename } of formats) {
        const pdf = await page.pdf({
          format,
          printBackground: true,
          tagged: true,
        });
        await writeFile(new URL(filename, output), pdf);
        manifest.push({
          lessonId: lesson.id,
          kind,
          format,
          filename,
          sha256: createHash("sha256").update(pdf).digest("hex"),
          bytes: pdf.length,
        });
        rendered++;
      }
      await page.close();
    }
  }
  // Documents of removed or renamed lessons must not linger to be reviewed.
  for (const name of await readdir(output))
    if (!expected.has(name)) await rm(new URL(name, output), { force: true });
  await writeFile(
    new URL("manifest.json", output),
    JSON.stringify({ edition: "1", publications: manifest }, null, 2),
  );
  console.log(
    `Built ${manifest.length} PDFs from ${lessons.length} shared lesson sources (${rendered} re-rendered).`,
  );
} finally {
  await browser?.close();
}
