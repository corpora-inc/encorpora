/** Exploration: which routes exist for Maya and what text each shows. */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { startGradesFixture } from "./grades-fixture";

const out = "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/3ae28322-836f-4cbf-a397-7dcb7deee7e2/scratchpad/probe/";
mkdirSync(out, { recursive: true });
const fx = await startGradesFixture();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = await fx.attach(page);
const routes = (process.argv[2] ?? "/,/progress,/pathways,/inventory,/lessons").split(",");
for (const shown of [false, true]) {
  for (const r of routes) {
    await page.goto(fx.origin + r);
    await page.waitForTimeout(2500);
    const tag = `${shown ? "on" : "off"}${r.replace(/\//g, "_") || "_root"}`;
    await page.screenshot({ path: out + tag + ".png", fullPage: true });
    writeFileSync(out + tag + ".txt", page.url() + "\n" + (await page.locator("body").innerText()));
    console.log(tag, page.url(), await page.getByRole("checkbox", { name: "Show grades and estimates" }).count());
  }
  if (!shown) {
    await page.goto(fx.origin + "/");
    await page.waitForTimeout(1500);
    const ls = await page.evaluate(() => Object.keys(localStorage));
    console.log("localStorage", ls);
    const box = page.getByRole("checkbox", { name: "Show grades and estimates" });
    if (await box.count()) await box.first().check({ force: true });
    else {
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("amp.curriculum-details") ?? '{"state":{"shown":{}},"version":0}');
        console.log(JSON.stringify(s));
      });
    }
    console.log("after check", await page.evaluate(() => localStorage.getItem("amp.curriculum-details")));
  }
}
console.log("errors", errors);
console.log("unhandled", [...fx.unhandled]);
await browser.close();
await fx.close();
process.exit(0);
