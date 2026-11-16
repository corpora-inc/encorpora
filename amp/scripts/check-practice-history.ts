import assert from "node:assert/strict";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
const origin =
  process.env.AMP_PURCHASE_PREVIEW_ORIGIN ?? "http://127.0.0.1:4980";
const browser = await secureChromium(rawChromium).launch();
try {
  for (const mode of ["self", "child", "film"]) {
    const context = await browser.newContext();
    await context.request.post(origin + "/api/auth/sign-in/email", {
      headers: { origin },
      data: {
        email: "paid@purchase-preview.example",
        password: "synthetic purchase preview passphrase",
      },
    });
    const places = await (
      await context.request.get(origin + "/api/v1/families")
    ).json();
    const family = places.families.find(
      (x: any) => x.role === "holder",
    ).familyId;
    const info = await (
      await context.request.get(origin + "/api/v1/families/" + family)
    ).json();
    const child = info.children[0];
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const stack =
      "skill:financial-literacy-elementary,skill:multi-operation-stories,skill:multiplicative-stories,lesson:story-operations-slots";
    const base =
      mode === "child" ? `/family/${family}/kids/${child.id}` : "/pathways";
    const target = base + "?open=" + encodeURIComponent(stack);
    const urls: string[] = [];
    page.on("pageerror", (e) => console.error("PAGEERROR", e));
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) urls.push(f.url().replace(origin, ""));
    });
    const batches: string[] = [];
    page.on("response", (response) => {
      const path = new URL(response.url()).pathname;
      if (/\/learners\/[^/]+\/batches$/.test(path) && response.ok())
        batches.push(path.split("/").at(-2)!);
    });
    try {
      await page.goto(origin + base);
      await page.goto(origin + target);
      await page
        .getByRole("dialog", {
          name: "Choose the operations of a story",
          exact: true,
        })
        .waitFor();
      urls.length = 0;
      if (mode === "film") {
        await page.locator("a.lesson-film-button").click();
        await page.waitForURL(/\/watch/);
        await page.goBack();
      } else {
        await page
          .getByRole(mode === "child" ? "button" : "link", {
            name: mode === "child" ? "Practice with " + child.name : "Practice",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Skip this problem and see its answer" })
          .waitFor();
        assert.equal(
          new URL(page.url()).searchParams.get("template"),
          "story-operations-slots",
        );
        urls.length = 0;
        await page.goBack();
      }
      await page.waitForTimeout(1200);
      assert.ok(
        urls.length <= 3,
        `Back must settle without a redirect loop: ${urls.join(" → ")}`,
      );
      assert.equal(new URL(page.url()).pathname, base);
      assert.equal(new URL(page.url()).searchParams.get("open"), stack);
      await page
        .getByRole("dialog", {
          name: "Choose the operations of a story",
          exact: true,
        })
        .waitFor();
      if (mode !== "film") {
        await page.goForward();
        await page
          .getByRole("button", { name: "Skip this problem and see its answer" })
          .waitFor();
        assert.equal(
          new URL(page.url()).searchParams.get("template"),
          "story-operations-slots",
        );
        await page.goBack();
        await page
          .getByRole("dialog", {
            name: "Choose the operations of a story",
            exact: true,
          })
          .waitFor();
        assert.equal(new URL(page.url()).searchParams.get("open"), stack);
      }

      const back = page.locator("[data-layer-close]:visible").last();
      if (await back.count()) {
        await back.click();
        await page.waitForTimeout(1200);

        assert.equal(
          new URL(page.url()).searchParams.get("open"),
          stack.split(",").slice(0, -1).join(","),
        );
      }
      if (mode === "child") {
        assert.ok(batches.length >= 2);
        assert.ok(batches.every((id) => id === child.id));
        await page
          .getByRole("button", {
            name: "Practice with " + child.name,
            exact: true,
          })
          .waitFor();
      }
      console.log(
        `PASS: ${mode} browser Back/Forward restores the nested curriculum and Close removes one layer.`,
      );
    } catch (e) {
      console.error(
        mode,
        String(e),
        (await page.locator("body").innerText()).slice(-2000),
      );
      throw e;
    }
    await context.close();
  }
} finally {
  await browser.close();
}
