import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { generateProblem } from "../src/math/engine";
import { spokenMath } from "../src/web/MathText";

// Run against `npm run dev:content`; no database or learner records involved.
const base = `http://127.0.0.1:${process.env.AMP_REVIEW_PORT ?? 4313}`;
const output = "artifacts/radical-equation";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const families = [
    "radical-equation-isolated",
    "radical-equation-shifted",
    "radical-equation-check",
  ];
  for (const template of families) {
    const seed = "visual-0",
      generated = generateProblem(template, seed);
    await page.goto(`${base}/?${new URLSearchParams({ template, seed })}`);
    await page.locator(".review-prompt").waitFor();
    const action = (kind: string, extra = {}) =>
      page.request.post(`${base}/__review/action`, {
        data: { template, seed, action: kind, ...extra },
      });
    const publicProblem = await (await action("problem")).json();
    assert.equal(publicProblem.id, generated.public.id);
    for (const key of ["answer", "explanation", "hint", "choiceFeedback"])
      assert(!(key in publicProblem), key);
    assert.equal(
      (await (await action("check", { response: generated.answer })).json())
        .correct,
      true,
    );
    const wrong =
      generated.public.response.kind === "choice"
        ? generated.public.response.options.find(
            (o) => o.id !== generated.answer,
          )!.id
        : "99999";
    assert.equal(
      (await (await action("check", { response: wrong })).json()).correct,
      false,
    );
    if (generated.public.response.kind === "choice") {
      const correct = generated.public.response.options.find(
        (o) => o.id === generated.answer,
      )!;
      await page
        .getByRole("radio", { name: spokenMath(correct.label), exact: true })
        .check();
    } else
      await page
        .getByRole("textbox", { name: "Answer", exact: true })
        .fill(generated.answer);
    await page
      .getByRole("button", { name: "Check answer", exact: true })
      .click();
    await page.getByRole("status").filter({ hasText: "Correct." }).waitFor();
    await page.getByRole("button", { name: "Show hint", exact: true }).click();
    await page
      .getByRole("region", { name: "Hint or answer feedback" })
      .waitFor();
    assert.equal((await (await action("hint")).json()).hint, generated.hint);
    await page
      .getByRole("button", { name: "Show solution", exact: true })
      .click();
    await page.getByRole("region", { name: "Solution", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Show in-practice lesson", exact: true })
      .click();
    await page.locator(".problem-lesson").waitFor();
    await page
      .getByRole("button", { name: "Show full lesson", exact: true })
      .click();
    await page
      .frameLocator("iframe")
      .getByText("A worked example", { exact: true })
      .waitFor();
    for (const width of [320, 390, 768, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          (t) => document.documentElement.setAttribute("data-theme", t),
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          `${template}/${width}/${theme} overflow`,
        );
        await page.screenshot({
          path: `${output}/${template}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
  }
  assert.deepEqual(errors, []);
  await page.close();
  const printPage = await browser.newPage();
  await printPage.goto(
    `${base}/__review/reference?template=radical-equation-check&seed=visual-0`,
  );
  await printPage.evaluate(() => document.fonts.ready);
  for (const format of ["Letter", "A4"] as const) {
    await printPage.pdf({
      path: `${output}/lesson-${format}.pdf`,
      format,
      printBackground: true,
    });
  }
  await printPage.screenshot({ path: `${output}/lesson.png`, fullPage: true });
  await printPage.close();
  console.log(
    "Verified grading, hints, worked solutions and lessons for all three families at four widths in both themes; rendered Letter/A4 lessons.",
  );
} finally {
  await browser.close();
}
