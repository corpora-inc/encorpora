import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { parsePublishingArgs } from "../src/publishing/options.js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { bookFor } from "../src/books/catalog.js";
import { publicationSourceHashes } from "../src/publishing/source-manifest.js";
import { renderBook } from "../src/publishing/book.js";
const options = parsePublishingArgs(process.argv.slice(2));
const registered = bookFor(options.bookId);
if (!registered) throw new Error(`Unknown registered book: ${options.bookId}`);
const book = registered.content;
const output = resolve(options.outputDirectory);
const run = promisify(execFile);
const hash = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
const sourceHashes = await publicationSourceHashes(
  fileURLToPath(new URL("..", import.meta.url)),
  book.id,
);
// Require independent PDF tooling before writing publication artifacts.
await run("pdfinfo", ["-v"]);
await run("pdftotext", ["-v"]);
await mkdir(output, { recursive: true });
const html = renderBook(book);
await writeFile(resolve(output, "index.html"), html);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1200 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".page-content")).flatMap(
      (content) => {
        const bound = content.getBoundingClientRect();
        const children = Array.from(content.children).map((child) =>
          child.getBoundingClientRect(),
        );
        const textBounds: DOMRect[] = [];
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (
            !walker.currentNode.textContent?.trim() ||
            walker.currentNode.parentElement?.closest("svg")
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          textBounds.push(...Array.from(range.getClientRects()));
        }
        return [...children, ...textBounds].some(
          (r) =>
            r.bottom > bound.bottom + 1 ||
            r.right > bound.right + 1 ||
            r.left < bound.left - 1,
        )
          ? [content.parentElement!.id]
          : [];
      },
    ),
  );
  if (overflow.length)
    throw new Error(
      `Pages overflow; revise authored page composition: ${overflow.join(", ")}`,
    );
  const diagramOverflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll<SVGTextElement>("svg text")).flatMap(
      (text) => {
        const bounds = text.getBoundingClientRect(),
          svg = text.closest("svg")!.getBoundingClientRect();
        return bounds.left < svg.left - 1 ||
          bounds.right > svg.right + 1 ||
          bounds.top < svg.top - 1 ||
          bounds.bottom > svg.bottom + 1
          ? [{ page: text.closest("article")!.id, text: text.textContent }]
          : [];
      },
    ),
  );
  if (diagramOverflow.length)
    throw new Error(
      `Diagram labels overflow: ${JSON.stringify(diagramOverflow)}`,
    );
  await page.pdf({
    path: resolve(output, `${book.id}.pdf`),
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true,
  });
  const pdfPath = resolve(output, `${book.id}.pdf`);
  const { stdout: pdfInfo } = await run("pdfinfo", [pdfPath]);
  const physicalPages = Number(/^Pages:\s+(\d+)/m.exec(pdfInfo)?.[1]);
  if (physicalPages !== book.pages.length)
    throw new Error(`PDF page count mismatch: ${physicalPages}`);
  const { stdout: extractedText } = await run("pdftotext", [pdfPath, "-"], {
    maxBuffer: 8 * 1024 * 1024,
  });
  const normalizedText = extractedText.replace(/\s+/g, " ");
  const missingTitles = book.pages
    .filter((p) => !normalizedText.includes(p.title.replace(/\s+/g, " ")))
    .map((p) => p.id);
  if (missingTitles.length)
    throw new Error(
      `PDF text extraction missing page headings: ${missingTitles.join(", ")}`,
    );
  await writeFile(resolve(output, "extracted-text.txt"), extractedText);
  for (const kind of [
    "opening",
    "lesson",
    "workshop",
    "reflection",
    "solutions",
    "guide",
  ]) {
    const sample = page.locator(`.book-page.${kind}`).first();
    if (await sample.count())
      await sample.screenshot({ path: resolve(output, `sample-${kind}.png`) });
  }
  if (options.allPages) {
    await mkdir(resolve(output, "pages"), { recursive: true });
    const pages = page.locator(".book-page");
    for (let i = 0; i < (await pages.count()); i++)
      await pages.nth(i).screenshot({
        path: resolve(
          output,
          "pages",
          `page-${String(i + 1).padStart(3, "0")}.png`,
        ),
      });
  }
  await writeFile(
    resolve(output, "validation.json"),
    JSON.stringify(
      {
        book: book.id,
        version: book.version,
        contentSha256: hash(JSON.stringify(book)),
        pages: book.pages.length,
        physicalPdfPages: physicalPages,
        pdfTagged: /^Tagged:\s+yes/m.test(pdfInfo),
        extractedTextCharacters: extractedText.length,
        generatedAt: new Date().toISOString(),
        sourceHashes,
        sourceSha256: hash(JSON.stringify(sourceHashes)),
        htmlSha256: hash(html),
        pdfSha256: hash(await readFile(pdfPath)),
        overflow,
        diagramOverflow,
        review:
          "Automated layout validation only; independent mathematical and rendered-page review required.",
      },
      null,
      2,
    ),
  );
  console.log(`Published ${book.pages.length} pages to ${output}`);
} finally {
  await browser.close();
}
