/** Exploration: practice, drawer, answer feedback, pathways detail, lessons. */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { startGradesFixture } from "./grades-fixture";

const out = "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/3ae28322-836f-4cbf-a397-7dcb7deee7e2/scratchpad/probe2/";
mkdirSync(out, { recursive: true });
const fx = await startGradesFixture();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = await fx.attach(page);
const snap = async (tag: string, full = false) => {
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + tag + ".png", fullPage: full });
  writeFileSync(out + tag + ".txt", page.url() + "\n" + (await page.locator("body").innerText()));
  console.log(tag, page.url());
};
await page.goto(fx.origin + "/");
await page.getByRole("button", { name: /^(Go|Continue)$/ }).click();
await page.locator(".problem-stage").waitFor();
await snap("practice-off");
await page.getByRole("button", { name: "Open AMP menu" }).click();
await page.getByRole("checkbox", { name: "Show grades and estimates" }).waitFor();
await snap("drawer-off");
const html = await page.locator("[role=dialog]").first().innerHTML();
writeFileSync(out + "drawer.html", html);
await page.getByRole("checkbox", { name: "Show grades and estimates" }).check({ force: true });
await snap("drawer-on");
await page.getByRole("button", { name: "Close AMP menu" }).click();
await snap("practice-on");
// Answer wrong to see feedback.
const evidence = (await import("../src/server/evidence")).projectSkillEvidence(fx.attempts);
writeFileSync(out + "skills.json", JSON.stringify(evidence.map((e) => [e.skillId, e.attempts, e.independentCorrect, e.status])));
console.log("problems", [...fx.problems.values()].map((p) => [p.public.templateId, p.public.response.kind, p.answer]));
for (const r of ["/lessons", "/pathways/" + evidence[5].skillId]) {
  await page.goto(fx.origin + r);
  await page.waitForTimeout(3000);
  await snap("route-on" + r.replace(/\//g, "_"), true);
}
await page.evaluate(() => localStorage.setItem("amp.curriculum-details", '{"state":{"shown":{}},"version":0}'));
for (const r of ["/lessons", "/pathways/" + evidence[5].skillId]) {
  await page.goto(fx.origin + r);
  await page.waitForTimeout(3000);
  await snap("route-off" + r.replace(/\//g, "_"), true);
}
console.log("errors", errors);
console.log("unhandled", [...fx.unhandled]);
await browser.close();
await fx.close();
process.exit(0);
