import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { congruenceCase } from "../src/math/congruence-practice";
import { congruenceLessons } from "../src/content/congruence-lessons";
import { publicationHtml } from "../src/content/publications";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../artifacts/congruence-review/", import.meta.url);
await mkdir(output, { recursive: true });
const port = process.env.AMP_CONGRUENCE_REVIEW_PORT ?? "4338";
const base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["--import", "tsx", "scripts/content-review.ts"],
  {
    cwd: root,
    env: { ...process.env, AMP_REVIEW_PORT: port },
    stdio: "ignore",
  },
);
const browser = await chromium.launch({ headless: true });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Content review server exited");
    try {
      ready = (await fetch(`${base}/__review/catalog`)).ok;
    } catch {
      /* startup */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Content review server started");
  const seeds = new Map<string, string>();
  for (let i = 0; i < 512; i++) {
    const seed = `visual-${i}`,
      c = congruenceCase("triangle-congruence-criteria", seed);
    const key = c.tags.join("/");
    if (!seeds.has(key)) seeds.set(key, seed);
  }
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme });
      for (const frame of [
        "identify/SAS",
        "assess-claim/SSA",
        "identify/AAA",
        "complete-criterion/AAS",
      ]) {
        const seed = seeds.get(frame)!;
        await page.goto(
          `${base}/?template=triangle-congruence-criteria&seed=${seed}`,
        );
        await page.locator(".review-option").first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        const generated = congruenceCase(
          "triangle-congruence-criteria",
          seed,
        ).problem;
        await page.locator(`input[value="${generated.answer}"]`).check();
        await page
          .getByRole("button", { name: "Check answer", exact: true })
          .click();
        await page
          .getByRole("status")
          .filter({ hasText: "Correct." })
          .waitFor();
        await page
          .getByRole("button", { name: "Show hint", exact: true })
          .click();
        await page
          .getByRole("region", { name: "Hint or answer feedback", exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Show solution", exact: true })
          .click();
        await page
          .getByRole("region", { name: "Solution", exact: true })
          .waitFor();
        const sizes = await page.evaluate(() => ({
          width: innerWidth,
          content: document.documentElement.scrollWidth,
        }));
        assert.ok(
          sizes.content <= sizes.width + 1,
          `${width}/${theme}/${frame}: horizontal overflow`,
        );
        assert.equal(await page.locator(".katex-error").count(), 0);
        await page.screenshot({
          path: fileURLToPath(
            new URL(`${width}-${theme}-${frame.replace("/", "-")}.png`, output),
          ),
          fullPage: true,
        });
      }
    }
  assert.deepEqual(errors, []);
  // Render the actual publication typesetter, including its default worksheet
  // and answer-key bindings, on both supported paper formats.
  const print = await browser.newPage();
  for (const kind of ["lesson", "workbook", "solutions"] as const) {
    const html = publicationHtml(congruenceLessons[0]!, kind);
    await writeFile(new URL(`${kind}.html`, output), html);
    await print.setContent(html);
    await print.evaluate(() => document.fonts.ready);
    assert.equal(await print.locator(".katex-error").count(), 0);
    for (const format of ["Letter", "A4"] as const)
      await print.pdf({
        path: fileURLToPath(new URL(`${kind}-${format}.pdf`, output)),
        format,
        printBackground: true,
      });
  }
  console.log(
    "32 browser views passed (4 widths, 2 themes, 4 representative frames); 6 Letter/A4 publications rendered.",
  );
} finally {
  await browser.close();
  server.kill("SIGTERM");
}
