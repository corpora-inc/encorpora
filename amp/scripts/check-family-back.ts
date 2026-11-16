import assert from "node:assert/strict";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
const origin =
  process.env.AMP_PURCHASE_PREVIEW_ORIGIN ?? "http://127.0.0.1:4980";
const browser = await secureChromium(rawChromium).launch();
try {
  for (const [source, width] of [
    ["family", 390],
    ["child", 390],
    ["curriculum", 390],
    ["family", 1280],
    ["child", 1280],
    ["curriculum", 1280],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
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
      (x: any) => x.role === "holder",
    ).familyId;
    const child = (
      await (
        await context.request.get(origin + "/api/v1/families/" + family)
      ).json()
    ).children[0];
    const stack =
      "skill:financial-literacy-elementary,skill:multi-operation-stories,skill:multiplicative-stories,lesson:story-operations-slots";
    const base = `/family/${family}`;
    const target =
      source === "family"
        ? base
        : `${base}/kids/${child.id}` +
          (source === "curriculum" ? "?open=" + encodeURIComponent(stack) : "");
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const routes: string[] = [];
    const batches: string[] = [];
    const errors: string[] = [];
    const unauthorized: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame() && routes.length < 50)
        routes.push(f.url().replace(origin, ""));
    });
    page.on("response", (r) => {
      const path = new URL(r.url()).pathname;
      if (r.status() === 401 && path.startsWith("/api/v1/families"))
        unauthorized.push(path);
      if (r.ok() && /\/learners\/[^/]+\/batches$/.test(path))
        batches.push(path.split("/").at(-2)!);
    });
    const startButton = (
      source === "curriculum"
        ? page.getByRole("dialog", {
            name: "Choose the operations of a story",
            exact: true,
          })
        : page
    ).getByRole("button", { name: "Practice with " + child.name, exact: true });
    await page.goto(origin + target);
    await startButton.click();
    await page
      .getByRole("button", { name: "Skip this problem and see its answer" })
      .waitFor();
    const practice = page.url();
    for (let i = 0; i < 3; i++) {
      routes.length = 0;
      await page.goBack();
      try {
        await page.waitForURL(origin + target);
        await startButton.waitFor();
      } catch (e) {
        console.error(source, "Back failed", { url: page.url(), routes });
        throw e;
      }
      assert.equal(
        await page.evaluate(() => !!sessionStorage.getItem("amp.student")),
        false,
      );
      assert.ok(routes.length <= 2, JSON.stringify(routes));
      await page.goForward();
      try {
        await page
          .getByRole("button", { name: "Skip this problem and see its answer" })
          .waitFor();
      } catch (e) {
        console.error("Forward failed", {
          url: page.url(),
          routes,
          errors,
          body: await page.locator("body").innerText(),
          state: await page.evaluate(() => history.state),
        });
        throw e;
      }
      assert.equal(page.url(), practice);
      assert.equal(
        await page.evaluate(() => !!sessionStorage.getItem("amp.student")),
        true,
      );
    }
    await page.reload();
    await page
      .getByRole("button", { name: "Skip this problem and see its answer" })
      .waitFor();
    await page.goBack();
    await page.waitForURL(origin + target);
    await startButton.waitFor();
    assert.ok(batches.length >= 4);
    assert.ok(
      batches.every((id) => id === child.id),
      "Forward/reload must keep the child's learning record",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(
      unauthorized,
      [],
      "A handoff must not ask for parent screens using the child session",
    );
    console.log(
      `PASS: ${source} at ${width}px → child practice → Back/Forward three times → reload → Back; exact originating page and child record.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
