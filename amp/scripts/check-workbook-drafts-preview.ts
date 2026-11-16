/** Real local routes: configuring workbooks never adds history or spends allowance. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture";
import { localDate } from "../src/web/features/workbooks/model";

const fixture = await purchasePreview(
  Number(process.env.AMP_WORKBOOK_PREVIEW_PORT ?? 5030),
);
const browser = await secureChromium(rawChromium).launch();
const output = "/tmp/rebuild-funded-purchase/workbook-drafts";
await mkdir(output, { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const persona = fixture.personas.find((p) => p.key === "returning")!;
  assert.equal(
    (
      await context.request.post(fixture.origin + "/api/auth/sign-in/email", {
        headers: { origin: fixture.origin },
        data: { email: persona.email, password: fixture.password },
      })
    ).status(),
    200,
  );
  const base = `/api/v1/learners/${persona.learnerId}/workbooks`;
  const read = async () =>
    (await context.request.get(fixture.origin + base)).json();
  const used = async () =>
    (
      await fixture.db.query(
        "SELECT free_workbooks_used FROM amp_learners WHERE id=$1",
        [persona.learnerId],
      )
    ).rows[0].free_workbooks_used;
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `${fixture.origin}/learners/${persona.learnerId}/workbooks/${localDate()}`,
  );
  const download = page.getByRole("button", {
    name: "Download workbook",
    exact: true,
  });
  const ready = async () => {
    await download.waitFor();
    await page.waitForFunction(
      () =>
        !(
          document.querySelector(
            "[data-workbook-actions] button:last-child",
          ) as HTMLButtonElement
        )?.disabled,
    );
  };
  await ready();
  assert.equal((await read()).workbooks.length, 0);
  for (const length of ["30 min", "60 min"]) {
    await page.getByRole("radio", { name: new RegExp(length) }).click();
    await ready();
    assert.equal((await read()).workbooks.length, 0);
    assert.equal(await used(), 0);
  }
  for (const name of ["Easier", "Leave out"]) {
    await page.getByRole("radio", { name, exact: true }).click();
    await ready();
  }
  await page.getByRole("button", { name: "Roll another", exact: true }).click();
  await ready();
  assert.equal((await read()).workbooks.length, 0);
  assert.equal(await used(), 0);
  await page.screenshot({
    path: output + "/unsaved-options.png",
    fullPage: true,
  });
  const downloadEvent = page.waitForEvent("download");
  await download.click();
  const file = await downloadEvent;
  await file.saveAs(output + "/" + file.suggestedFilename());
  let history = await read();
  assert.equal(history.workbooks.length, 1);
  assert.equal(history.workbooks[0].minutes, 60);
  assert.equal(history.workbooks[0].choices.lean, "easier");
  assert.equal(history.workbooks[0].choices.lesson, false);
  assert.equal(await used(), 1);
  const first = history.workbooks[0];
  const firstResult = await context.request.post(
    `${fixture.origin}${base}/${first.id}/results`,
    {
      headers: { origin: fixture.origin },
      data: { entries: [{ n: 1, mark: "right" }] },
    },
  );
  assert.equal(firstResult.status(), 200, await firstResult.text());
  await page.getByRole("radio", { name: /30 min/ }).click();
  await ready();
  assert.equal((await read()).workbooks.length, 1);
  await page
    .getByRole("button", { name: "Enter results", exact: true })
    .click();
  await page.waitForURL("**/results");
  history = await read();
  assert.equal(history.workbooks.length, 2);
  assert.equal(await used(), 2);
  const original = history.workbooks.find(
    (w: { id: string }) => w.id === first.id,
  );
  assert.equal(original.code, first.code);
  assert.equal(original.minutes, 60);
  assert.equal(original.entered, 1);
  assert.deepEqual(errors, []);
  console.log(
    "PASS workbook draft options: 45 → 30 → 60, level, lesson, roll leave 0 history and 0 allowance; Download issues once; Enter results issues next; original results preserved.",
  );
} finally {
  await browser.close();
  await fixture.close();
}
