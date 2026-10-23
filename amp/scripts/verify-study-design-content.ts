import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { GeneratedProblem } from "../src/math/contracts";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { studyDesignCase } from "../src/math/study-design-practice";
const dir = new URL("../artifacts/study-design/", import.meta.url).pathname;
await mkdir(dir, { recursive: true });
const representatives = new Map<
  string,
  { seed: string; problem: GeneratedProblem }
>();
for (let i = 0; i < 200; i++) {
  const seed = `visual-${i}`,
    c = studyDesignCase(seed);
  if (!representatives.has(c.frame))
    representatives.set(c.frame, { seed, problem: c.problem });
}
const port = 4366;
const server = spawn(
  process.execPath,
  ["--import", "tsx", "scripts/content-review.ts"],
  {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, AMP_REVIEW_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
await new Promise<void>((resolve, reject) => {
  server.stdout.on("data", (chunk) => {
    if (String(chunk).includes("AMP content review:")) resolve();
  });
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  server.once("error", reject);
  server.once("exit", (code) =>
    reject(new Error(`Review server exited: ${code}`)),
  );
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const results = [];
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      for (const [frame, { seed, problem }] of representatives) {
        await page.goto(
          `http://127.0.0.1:${port}/?template=scope-of-inference-choice&seed=${seed}`,
        );
        await page.getByRole("radio").first().waitFor();
        assert.equal(await page.getByRole("radio").count(), 4);
        await page
          .getByRole("button", { name: "Show hint", exact: true })
          .click();
        await page.getByText(problem.hint, { exact: true }).waitFor();
        assert.equal(problem.public.response.kind, "choice");
        if (problem.public.response.kind !== "choice")
          throw new Error("Expected choices");
        const wrong = problem.public.response.options.find(
          (o) => o.id !== problem.answer,
        )!;
        await page.locator(`input[value="${wrong.id}"]`).check();
        await page
          .getByRole("button", { name: "Check answer", exact: true })
          .click();
        await page.getByText(/Try again/).waitFor();
        await page.locator(`input[value="${problem.answer}"]`).check();
        await page
          .getByRole("button", { name: "Check answer", exact: true })
          .click();
        await page.getByText("Correct.", { exact: true }).waitFor();
        await page
          .getByRole("button", { name: "Show in-practice lesson", exact: true })
          .click();
        await page.locator(".problem-lesson").waitFor();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        assert.equal(overflow, false, `${width} ${theme} ${frame}`);
        if (frame === "combined")
          await page.screenshot({
            path: `${dir}${width}-${theme}.png`,
            fullPage: true,
          });
        results.push({ width, theme, frame, overflow });
      }
    }
  assert.deepEqual(errors, []);
  await page.goto(
    `http://127.0.0.1:${port}/__review/reference?template=scope-of-inference-choice&seed=visual-0`,
  );
  await page.emulateMedia({ media: "print", colorScheme: "light" });
  for (const format of ["Letter", "A4"] as const) {
    await page.pdf({
      path: `${dir}lesson-${format}.pdf`,
      format,
      printBackground: true,
    });
  }
  await writeFile(
    `${dir}checks.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(
    `Verified ${results.length} frame/viewport/theme interactions; Letter and A4 exported to ${dir}`,
  );
} finally {
  await browser.close();
  server.kill();
}
