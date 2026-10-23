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
        "article,section,p,li,h1,h2,footer,figcaption,.print-choices,.print-math,.lesson-illustration",
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
        ".exercise,.example,.representation,.lesson-illustration",
      )) {
        if (section.classList.contains("exercise--solutions")) continue;
        if (section.getBoundingClientRect().height > pageHeight)
          issues.push("A section kept together is taller than a printable page");
      }
      const solutions = document.querySelector(".publication-kind")?.textContent?.trim() === "Worked solutions";
      for (const exercise of document.querySelectorAll<HTMLElement>(".exercise")) {
        if (!solutions && !exercise.classList.contains("exercise--solutions")) continue;
        if (!solutions || !exercise.classList.contains("exercise--solutions")) {
          issues.push("Solution exercise must use the breakable solution layout");
          continue;
        }
        const children = [...exercise.children] as HTMLElement[];
        const steps = children.find((child) => child.tagName === "OL" && !child.classList.contains("print-choices"));
        const answer = children.at(-1);
        const stepItems = steps ? [...steps.children] as HTMLElement[] : [];
        const question = steps ? children.slice(0, children.indexOf(steps)) : [];
        if (question[0]?.tagName !== "H2" || !steps || !stepItems.length ||
            !stepItems.every((item) => item.tagName === "LI") ||
            answer?.tagName !== "P" || !answer.querySelector("strong")?.textContent?.trim().startsWith("Answer:")) {
          issues.push("Solution exercise lacks a complete question, explanation, or answer group");
          continue;
        }
        if (getComputedStyle(exercise).breakInside !== "auto")
          issues.push("Solution exercise cannot flow across pages");
        const questionHeight = question.at(-1)!.getBoundingClientRect().bottom - question[0]!.getBoundingClientRect().top;
        if (questionHeight > pageHeight || question.some((item) => !["avoid", "avoid-page"].includes(getComputedStyle(item).breakAfter)))
          issues.push("Solution question and figure do not form one printable group");
        if (stepItems.some((item) => item.getBoundingClientRect().height > pageHeight || !["avoid", "avoid-page"].includes(getComputedStyle(item).breakInside)))
          issues.push("Solution explanation item can split or exceed a page");
        const lastStep = stepItems.at(-1)!;
        const conclusionHeight = answer.getBoundingClientRect().bottom - lastStep.getBoundingClientRect().top;
        if (conclusionHeight > pageHeight || !["avoid", "avoid-page"].includes(getComputedStyle(lastStep).breakAfter) ||
            !["avoid", "avoid-page"].includes(getComputedStyle(answer).breakBefore) || !["avoid", "avoid-page"].includes(getComputedStyle(answer).breakInside))
          issues.push("Final explanation and answer do not form one printable group");
      }
      for (const svg of document.querySelectorAll<SVGSVGElement>(
        "svg.figure,svg[data-lesson-illustration]",
      )) {
        const v = svg.viewBox.baseVal;
        for (const label of svg.querySelectorAll("text")) {
          // getBBox() is in the label's own (pre-transform) space; map its
          // corners into the view box so rotated axis titles are measured
          // where they are actually drawn.
          const local = label.getBBox();
          const toSvg = svg
            .getCTM()!
            .inverse()
            .multiply(label.getCTM()!);
          const corners = [
            [local.x, local.y],
            [local.x + local.width, local.y],
            [local.x, local.y + local.height],
            [local.x + local.width, local.y + local.height],
          ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(toSvg));
          const xs = corners.map((p) => p.x),
            ys = corners.map((p) => p.y);
          if (
            Math.min(...xs) < v.x - 1 ||
            Math.min(...ys) < v.y - 1 ||
            Math.max(...xs) > v.x + v.width + 1 ||
            Math.max(...ys) > v.y + v.height + 1
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
  const safeSolution = `<style>.exercise--solutions{break-inside:auto}.exercise--solutions>h2{break-after:avoid}.exercise--solutions>ol>li{break-inside:avoid}.exercise--solutions>ol>li:last-child{break-after:avoid}.exercise--solutions>p{break-before:avoid;break-inside:avoid}</style><article><p class="publication-kind">Worked solutions</p><section class="exercise exercise--solutions"><h2>1. A complete question</h2><ol><li>A reason.</li></ol><p><strong>Answer: one.</strong></p></section></article>`;
  if ((await inspect(safeSolution, "Letter")).length)
    throw new Error("Valid breakable solution reference failed");
  const mutations = [
    `<p style="white-space:nowrap">${"Long printed text ".repeat(80)}TAIL</p>`,
    `<p style="width:80px;overflow:hidden;white-space:nowrap">${"Hidden text ".repeat(30)}TAIL</p>`,
    `<div style="height:5px;overflow:hidden"><p>Clipped paragraph</p></div>`,
    `<p style="position:relative;left:-800px">Missing left-hand text</p>`,
    `<figure class="lesson-illustration" style="height:2000px;break-inside:avoid">Oversized lesson illustration</figure>`,
    `<svg data-lesson-illustration="test" viewBox="0 0 100 100"><text x="95" y="20">Clipped label</text></svg>`,
    `<svg data-lesson-illustration="test" viewBox="0 0 100 100"><text x="10" y="50" text-anchor="middle" transform="rotate(-90 10 50)">A rotated label far too long to fit</text></svg>`,
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
  const solutionMutations = [
    safeSolution.replace("exercise exercise--solutions", "exercise"),
    safeSolution.replace("<ol><li>A reason.</li></ol>", ""),
    safeSolution.replace("<p><strong>Answer: one.</strong></p>", ""),
    safeSolution.replace("<h2>1. A complete question</h2>", "<h2 style=\"height:2000px\">1. A complete question</h2>"),
    safeSolution.replace("<li>A reason.</li>", "<li style=\"height:2000px\">A reason.</li>"),
    safeSolution.replace("<li>A reason.</li>", "<li style=\"break-after:auto\">A reason.</li>"),
    safeSolution.replace("class=\"exercise exercise--solutions\"", "class=\"exercise exercise--solutions\" style=\"break-inside:avoid\""),
  ];
  for (const mutation of solutionMutations)
    if (!(await inspect(mutation, "Letter")).length)
      throw new Error("Layout oracle accepted a broken solution pagination group");
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
      rejectedMutations: mutations.length + solutionMutations.length,
    }),
  );
} finally {
  await browser.close();
}
