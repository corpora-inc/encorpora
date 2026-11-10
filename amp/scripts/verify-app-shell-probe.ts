/** Regression checks for visible overlap detection behind the fixed shell bar. */
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { probe, settle } from "./app-shell-probe";

for (const engine of [secureChromium(chromium), webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 600 },
    });
    const html = (body: string) => `<style>
      body { margin: 0; height: 1400px }
      button { width: 100px; height: 44px }
      header { position: fixed; top: 0; left: 0; height: 56px; width: 100%; background: white; z-index: 10 }
      main { padding-top: 56px }
      </style><header data-app-bar><button>Menu</button></header><main data-shell-content>${body}</main>`;
    await page.setContent(
      html('<button style="position:absolute;top:180px">Scrolled</button>'),
    );
    await page.evaluate("globalThis.__name ??= (f) => f");
    await page.evaluate(() => scrollTo(0, 200));
    await settle(page, 30);
    assert.deepEqual(
      (await probe(page)).overlaps,
      [],
      "opaque header hides only the covered part",
    );
    await page
      .locator("main")
      .evaluate((el) =>
        el.insertAdjacentHTML(
          "beforeend",
          '<button style="position:absolute;top:350px;left:200px">First</button><button style="position:absolute;top:350px;left:200px">Second</button>',
        ),
      );
    assert.ok(
      (await probe(page)).overlaps.some(
        (pair) => pair.includes("First") && pair.includes("Second"),
      ),
      "visible control overlap must fail",
    );
    await page.setContent(
      html('<button style="position:absolute;top:0">Missing inset</button>'),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await settle(page, 30);
    assert.ok(
      (await probe(page)).overlaps.some(
        (pair) => pair.includes("Menu") && pair.includes("Missing inset"),
      ),
      "missing initial header inset must fail",
    );
    console.log(
      `${browser.browserType().name()}: overlap probe detects visible overlap and missing inset; excludes scrolled occlusion.`,
    );
  } finally {
    await browser.close();
  }
}
