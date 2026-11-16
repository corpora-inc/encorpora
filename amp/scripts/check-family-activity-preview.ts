import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
const origin = "http://127.0.0.1:4980";
const output = "/tmp/rebuild-funded-purchase/family-activity";
await mkdir(output, { recursive: true });
const browser = await secureChromium(rawChromium).launch();
try {
  const context = await browser.newContext({ hasTouch: true });
  assert.equal(
    (
      await context.request.post(origin + "/api/auth/sign-in/email", {
        headers: { origin },
        data: {
          email: "paid@purchase-preview.example",
          password: "synthetic purchase preview passphrase",
        },
      })
    ).status(),
    200,
  );
  const places = await (
    await context.request.get(origin + "/api/v1/families")
  ).json();
  const family = places.families.find(
    (x: { role: string }) => x.role === "holder",
  ).familyId;
  const info = await (
    await context.request.get(origin + "/api/v1/families/" + family)
  ).json();
  const child = info.children[0];
  const api = origin + `/api/v1/families/${family}/children/${child.id}`;
  const record = await (await context.request.get(api + "/progress")).json();
  const shift = (offset: number) =>
    new Date(Date.parse(info.today.date + "T00:00:00Z") + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const time = await (
    await context.request.get(api + "/time?period=weeks&from=" + shift(-13))
  ).json();
  let mode: "several" | "single" | "empty" = "several";
  const value = (index: number, length: number) =>
    mode === "empty"
      ? 0
      : index === length - 1
        ? 10
        : mode === "several" && index === length - 3
          ? 5
          : 0;
  await context.route(api + "/progress", (route) =>
    route.fulfill({
      json: {
        ...record,
        weeks: record.weeks.map((week: object, index: number) => ({
          ...week,
          minutes: value(index, record.weeks.length),
        })),
      },
    }),
  );
  await context.route(api + "/time?*", (route) =>
    route.fulfill({
      json: {
        ...time,
        days: Array.from({ length: 14 }, (_, index) => ({
          day: shift(index - 13),
          minutes: value(index, 14),
          problems: value(index, 14),
        })),
      },
    }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const activity = page.locator('[aria-labelledby="child-time"]');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + `/family/${family}/kids/${child.id}`);
    for (const unit of ["Daily", "Weekly"]) {
      await activity.getByRole("radio", { name: unit, exact: true }).click();
      const chart = activity.getByRole("group", {
        name: unit + " practice time",
      });
      await chart.waitFor();
      const columns = chart.locator("[data-tip]");
      assert.equal(
        await columns.count(),
        3,
        "leading empty intervals removed; middle empty interval retained",
      );
      const middle = columns.nth(1);
      assert.match((await middle.getAttribute("data-tip"))!, /0 min/);
      assert.ok(
        await columns
          .first()
          .evaluate(
            (el) =>
              el.firstElementChild!.getBoundingClientRect().width >=
              el.getBoundingClientRect().width - 1,
          ),
        "bar fills its interval",
      );
      await middle.hover();
      await activity.locator("[data-tip-open]").waitFor();
      assert.equal(
        await activity.locator("[data-tip-open]").innerText(),
        await middle.getAttribute("data-tip"),
      );
      await page.keyboard.press("Escape");
      await middle.focus();
      assert.equal(
        await activity.locator("[data-tip-open]").innerText(),
        await middle.getAttribute("data-tip"),
      );
      await page.keyboard.press("Escape");
      await columns.last().tap();
      assert.equal(
        await activity.locator("[data-tip-open]").innerText(),
        await columns.last().getAttribute("data-tip"),
      );
      await page.keyboard.press("Escape");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await activity.screenshot({
        path: `${output}/${unit}-${width}.png`,
        animations: "disabled",
      });
      console.log(
        "PASS",
        unit,
        width,
        "wide bars, trimmed start, zero gap, hover/focus/tap",
      );
    }
  }
  for (const state of ["single", "empty"] as const) {
    mode = state;
    await page.reload();
    for (const unit of ["Daily", "Weekly"]) {
      await activity.getByRole("radio", { name: unit, exact: true }).click();
      if (state === "single")
        await activity.locator("[data-activity-summary]").waitFor();
      else await activity.getByText(/No practice in the past/).waitFor();
      assert.equal(await activity.locator("figure").count(), 0);
      console.log("PASS", unit, state, "compact summary");
    }
  }
  assert.deepEqual(errors, []);
  await context.close();
} finally {
  await browser.close();
}
