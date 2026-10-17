import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { lessons } from "../src/content/lessons";
import {
  publicationHtml,
  type PublicationKind,
} from "../src/content/publications";
const output = new URL("../artifacts/publications/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const manifest: {
  lessonId: string;
  kind: PublicationKind;
  format: string;
  filename: string;
  sha256: string;
  bytes: number;
}[] = [];
try {
  const page = await browser.newPage();
  for (const lesson of lessons) {
    for (const kind of ["lesson", "workbook", "solutions"] as const) {
      const html = publicationHtml(lesson, kind);
      await writeFile(new URL(`${lesson.id}-${kind}.html`, output), html);
      await page.setContent(html);
      for (const format of ["Letter", "A4"] as const) {
        const filename = `${lesson.id}-${kind}-${format}.pdf`;
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
      }
    }
  }
  await writeFile(
    new URL("manifest.json", output),
    JSON.stringify({ edition: "1", publications: manifest }, null, 2),
  );
  console.log(
    `Built ${manifest.length} PDFs from ${lessons.length} shared lesson sources.`,
  );
} finally {
  await browser.close();
}
