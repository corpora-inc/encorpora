/** Independent print layout inspection of exported HTML, before PDF text loss. */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

type Document = { file: string; format: "Letter" | "A4" };
const documents = JSON.parse(readFileSync(0, "utf8")) as Document[];
if (
  !Array.isArray(documents) ||
  !documents.length ||
  documents.some(
    (d) => typeof d.file !== "string" || !["Letter", "A4"].includes(d.format),
  )
)
  throw new Error("Expected print HTML files and paper formats");

const browser = await chromium.launch();
const page = await browser.newPage();
const requests: string[] = [];
await page.route(/^https?:/, async (route) => {
  requests.push(route.request().url());
  await route.abort();
});
await page.emulateMedia({ media: "print" });

async function inspect(html: string, format: "Letter" | "A4") {
  // Browser body margins remain in effect, just as in Chromium's PDF output.
  const width = Math.floor(
    (((format === "Letter" ? 215.9 : 210) - 36) / 25.4) * 96,
  );
  const pageHeight = (((format === "Letter" ? 279.4 : 297) - 36) / 25.4) * 96;
  await page.setViewportSize({ width, height: 1200 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(
    ({ width, pageHeight }) => {
      const issues: string[] = [];
      if (document.documentElement.scrollWidth > width + 1)
        issues.push("Document exceeds printable width; PDF may shrink or clip");
      for (const font of document.fonts)
        if (font.status === "error") issues.push(`Font failed: ${font.family}`);
      const elements = document.querySelectorAll<HTMLElement>(
        "article,section,p,li,h1,h2,footer,.print-choices,.print-math",
      );
      for (const element of elements) {
        const r = element.getBoundingClientRect();
        if (r.left < -1 || r.right > width + 1)
          issues.push(
            `Outside printable width: ${element.textContent?.slice(0, 80)}`,
          );
        if (element.scrollWidth > element.clientWidth + 2)
          issues.push(
            `Content overflows its box: ${element.textContent?.slice(0, 80)}`,
          );
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent);
          const bound = parent.getBoundingClientRect();
          if (
            (["hidden", "clip"].includes(style.overflowX) &&
              (r.left < bound.left - 2 || r.right > bound.right + 2)) ||
            (["hidden", "clip"].includes(style.overflowY) &&
              (r.top < bound.top - 2 || r.bottom > bound.bottom + 2))
          )
            issues.push(
              `Ancestor clips text: ${element.textContent?.slice(0, 80)}`,
            );
        }
      }
      for (const expression of document.querySelectorAll(".print-math")) {
        const parent = expression.closest("li,p,h2,strong");
        if (!parent) continue;
        const bound = (
          parent.tagName === "STRONG" ? parent.parentElement! : parent
        ).getBoundingClientRect();
        const r = expression.getBoundingClientRect();
        if (r.left < bound.left - 2 || r.right > bound.right + 2)
          issues.push(
            `Formula crosses its column: ${expression.getAttribute("data-plain")}`,
          );
      }
      for (const section of document.querySelectorAll(
        ".exercise,.example,.representation",
      ))
        if (section.getBoundingClientRect().height > pageHeight)
          issues.push(
            "A section kept together is taller than a printable page",
          );
      for (const svg of document.querySelectorAll<SVGSVGElement>(
        "svg.figure",
      )) {
        const v = svg.viewBox.baseVal;
        for (const label of svg.querySelectorAll("text")) {
          const b = label.getBBox();
          if (
            b.x < v.x - 1 ||
            b.y < v.y - 1 ||
            b.x + b.width > v.x + v.width + 1 ||
            b.y + b.height > v.y + v.height + 1
          )
            issues.push(`Figure label crosses view box: ${label.textContent}`);
        }
      }
      return issues;
    },
    { width, pageHeight },
  );
}

try {
  const valid =
    "<html><body><article><p>A short printed sentence.</p></article></body></html>";
  if ((await inspect(valid, "Letter")).length)
    throw new Error("Valid layout reference failed");
  const mutations = [
    `<p style="white-space:nowrap">${"Long printed text ".repeat(80)}TAIL</p>`,
    `<p style="width:80px;overflow:hidden;white-space:nowrap">${"Hidden text ".repeat(30)}TAIL</p>`,
    `<div style="height:5px;overflow:hidden"><p>Clipped paragraph</p></div>`,
    `<p style="position:relative;left:-800px">Missing left-hand text</p>`,
  ];
  for (const mutation of mutations)
    if (
      !(
        await inspect(
          `<html><body><article>${mutation}</article></body></html>`,
          "Letter",
        )
      ).length
    )
      throw new Error(
        "Layout oracle accepted a shrinking or clipped reference",
      );
  const cache = new Map<string, string>();
  for (const document of documents) {
    if (!cache.has(document.file))
      cache.set(document.file, readFileSync(document.file, "utf8"));
    const issues = await inspect(cache.get(document.file)!, document.format);
    if (issues.length)
      throw new Error(
        `${document.file} (${document.format}): ${issues.slice(0, 8).join("; ")}`,
      );
  }
  if (requests.length)
    throw new Error("Print HTML requested external resources");
  console.log(
    JSON.stringify({
      documents: documents.length,
      rejectedMutations: mutations.length,
    }),
  );
} finally {
  await browser.close();
}
