import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
const origin =
  process.env.AMP_PURCHASE_PREVIEW_ORIGIN ?? "http://127.0.0.1:4980";
const output = "/tmp/rebuild-funded-purchase/curriculum";
await mkdir(output, { recursive: true });
const browser = await secureChromium(rawChromium).launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
const batches: {
  learnerId: string;
  body: Record<string, unknown>;
  problems: { id: string; templateId: string; skillId: string }[];
}[] = [];
page.on("response", async (response) => {
  if (
    /\/learners\/[^/]+\/batches$/.test(new URL(response.url()).pathname) &&
    response.ok()
  ) {
    batches.push({
      learnerId: new URL(response.url()).pathname.split("/").at(-2)!,
      body: response.request().postDataJSON(),
      problems: (await response.json()).problems,
    });
  }
});
try {
  const login = await context.request.post(`${origin}/api/auth/sign-in/email`, {
    headers: { origin },
    data: {
      email: "paid@purchase-preview.example",
      password: "synthetic purchase preview passphrase",
    },
  });
  assert.equal(login.status(), 200);
  const places = await (
    await context.request.get(`${origin}/api/v1/families`)
  ).json();
  const family = places.families.find(
    (entry: { role: string }) => entry.role === "holder",
  ).familyId;
  const info = await (
    await context.request.get(`${origin}/api/v1/families/${family}`)
  ).json();
  const learner = info.children[0].id;
  const path = `/family/${family}/kids/${learner}`;
  const layer = `${path}?open=skill%3Awhole-division%2Clesson%3Adivide-by-one-digit`;
  await page.goto(origin + layer);
  await page
    .getByRole("dialog", { name: "Divide by one digit", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Practice with Avery", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Divide by one digit", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page.getByText("Explore a problem type", { exact: true }).count(),
    0,
  );
  const practice = page.getByRole("button", {
    name: "Practice with Avery",
    exact: true,
  });
  assert.equal(await page.getByRole("menu").count(), 0);
  for (const theme of ["light", "dark"])
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      await page.evaluate(() => document.fonts.ready);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        animations: "disabled",
        path: `${output}/lesson-${width}-${theme}.png`,
      });
      const bounds = await practice.boundingBox();
      assert.ok(
        bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
      );
      assert.ok(bounds && bounds.height >= 44);
      assert.equal(
        await page
          .getByRole("dialog", { name: "Divide by one digit", exact: true })
          .locator("[data-layer-close]")
          .count(),
        1,
      );
    }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("button", { name: "Practice with Avery", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(
    new URL(page.url()).searchParams.get("template"),
    "divide-by-one-digit",
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByRole("button", { name: "Back to family", exact: true })
      .waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `${output}/child-practice-${width}.png`,
      animations: "disabled",
    });
  }
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Skip this problem and see its answer" })
      .click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("button", { name: "Skip this problem and see its answer" })
      .waitFor();
  }
  await page.reload();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.ok(batches.length >= 4);
  assert.ok(batches.every((batch) => batch.learnerId === learner));
  assert.ok(
    batches.every(
      (batch) =>
        batch.body.templateId === "divide-by-one-digit" &&
        batch.problems.every((p) => p.templateId === "divide-by-one-digit"),
    ),
    JSON.stringify(batches),
  );
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .click();
  const mixed = page.waitForResponse(
    (res) =>
      res.url().endsWith("/batches") &&
      !res.request().postDataJSON().templateId &&
      res.ok(),
  );
  await page
    .getByRole("button", { name: "Mixed practice", exact: true })
    .click();
  await mixed;
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(new URL(page.url()).search, "");
  await page
    .getByRole("button", { name: "Back to family", exact: true })
    .click();
  await page.waitForURL(origin + layer);
  await page.goto(`${origin}${path}?open=skill%3Awhole-division`);
  await page
    .getByRole("button", { name: "Practice with Avery", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(batches.at(-1)?.body.templateId, undefined);
  assert.equal(batches.at(-1)?.problems[0]?.skillId, "whole-division");
  await page
    .getByRole("button", { name: "Back to family", exact: true })
    .click();
  await page.goto(`${origin}${path}?open=area%3Aoperations`);
  await page
    .getByRole("button", { name: "Practice with Avery", exact: true })
    .waitFor();
  assert.equal(await page.locator("[data-film-card]").count(), 0);
  assert.equal(await page.getByText(/Show all.*videos/).count(), 0);
  await page.goto(`${origin}${path}?open=skill%3Amultiplication-meaning`);
  await page.locator("[data-film-card]").first().waitFor();
  assert.ok(
    (
      await page.locator("[data-film-card]").first().getAttribute("href")
    )?.includes("/watch"),
  );
  await page.locator("[data-film-card]").first().click();
  await page.waitForURL(/\/lessons\/[^/]+\/watch/);
  await page.goto(`${origin}${path}?open=area%3Aoperations`);

  await page
    .getByRole("button", { name: "Practice with Avery", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(batches.at(-1)?.body.recoveryStrand, "operations");
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(batches.at(-1)?.body.recoveryStrand, "operations");
  await page
    .getByRole("button", { name: "Back to family", exact: true })
    .click();
  await page.goto(origin + path);
  await page
    .getByRole("heading", { name: "Current estimates", exact: true })
    .waitFor();
  await page.getByRole("radio", { name: "Daily", exact: true }).waitFor();
  assert.equal(await page.locator("h1").count(), 1);
  await page
    .locator("[data-activity-summary], [aria-labelledby=child-time] figure")
    .first()
    .waitFor();
  assert.ok(
    await page
      .locator("[aria-labelledby='child-time']")
      .evaluate(
        (el) =>
          el.getBoundingClientRect().height <
          (el.querySelector("figure") ? 240 : 150),
      ),
  );
  assert.equal(
    await page
      .getByRole("radio", { name: "Daily", exact: true })
      .getAttribute("aria-checked"),
    "true",
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      animations: "disabled",
      path: `${output}/overview-${width}.png`,
      fullPage: false,
    });
  }
  // Optional adult practice starts from the family and keeps its own record.
  await page.goto(`${origin}/family/${family}`);
  await page
    .getByRole("button", { name: "Practice as yourself", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Try problems as/ }).count(),
    0,
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      animations: "disabled",
      path: `${output}/family-${width}.png`,
      fullPage: true,
    });
  }
  const beforeSelf = batches.length;
  await page
    .getByRole("button", { name: "Practice as yourself", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  const me = await (await context.request.get(`${origin}/api/v1/me`)).json();
  const own = me.adultPractice.learner.id;
  assert.notEqual(own, learner);
  assert.equal(batches.at(-1)?.learnerId, own);
  assert.equal(batches.at(-1)?.body.templateId, undefined);
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.ok(
    batches.slice(beforeSelf).every((batch) => batch.learnerId === own),
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByRole("link", { name: "Back to family", exact: true })
      .waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      animations: "disabled",
      path: `${output}/own-practice-${width}.png`,
    });
  }
  await page.getByRole("link", { name: "Back to family", exact: true }).click();
  await page.waitForURL(/\/family/);
  await page.goto(origin + "/");
  await page.waitForURL(/\/family/);
  // Once signed in as yourself, curriculum Practice is a direct link.
  await page.goto(`${origin}/pathways?open=lesson%3Adivide-by-one-digit`);
  await page.getByRole("link", { name: "Practice", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Practice", exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: one lesson title; direct child practice; family remains home; optional own practice; separate adult/child records; no area video dump; skill videos; child handoff; repeated problem type and reload; mixed practice; whole skill; area series; parent return; daily default; responsive lessons.",
  );
} catch (error) {
  await page.screenshot({
    animations: "disabled",
    path: `${output}/failure.png`,
  });
  console.error("At", page.url());
  console.error((await page.locator("body").innerText()).slice(-3200));
  throw error;
} finally {
  await browser.close();
}
