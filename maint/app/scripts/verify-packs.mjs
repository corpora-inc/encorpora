#!/usr/bin/env node
/**
 * Every screen that renders pack content, on the real packs (the dev packs
 * root: the ArduPilot pre-arm pack and the pump proof pack), so a pack shape
 * the fixture does not have fails here instead of reaching a person:
 *
 * - each tree's study view: the entry first, numbering in path order, every
 *   branch a control that moves to its step (focus lands on the target);
 * - the Describe index lists every table that applies to the unit;
 * - a job walked through the first branches of several trees, step by step;
 * - the manual's contents and sections, each reference table, practice with
 *   its rationale, and Connect with a message the pack maps;
 * - at 390 and 1280: no horizontal overflow; no console errors anywhere.
 *
 *   MAINT_REAL=1 MAINT_OFFSET=100 MAINT_IMPORT="A" scripts/loop.sh
 *   MAINT_PORT=4440 MAINT_ENGINE=http://127.0.0.1:4417 MAINT_HUB=http://127.0.0.1:4419 npx vite preview --bypass-lock &
 *   MAINT_UI_BASE=http://127.0.0.1:4441 node scripts/verify-packs.mjs
 *
 * Skips (exit 0, says so) when the dev packs root is not on this machine.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../../../amp/browser-security.mjs";

const root = process.env.MAINT_PACKS ?? path.join(os.homedir(), ".cache/harvest/packs/maint-dev/root");
if (!existsSync(root)) {
  console.log(`verify-packs: skipped, no dev packs at ${root}`);
  process.exit(0);
}
const base = process.env.MAINT_UI_BASE ?? "http://127.0.0.1:4441";
const WALK = Number(process.env.MAINT_PACKS_WALK ?? 12);

async function api(method, params = {}) {
  const r = await fetch(`${base}/api/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  const b = await r.json();
  if (!b.ok) throw new Error(`${method}: ${b.error.code}: ${b.error.message}`);
  return b.result;
}

const browser = await secureChromium(rawChromium).launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
page.setDefaultTimeout(15_000);
const noOverflow = async (what) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 1, `${what}: ${over}px of horizontal overflow`);
};
let checks = 0;

try {
  const packs = await api("pack.list");
  const assets = await api("asset.list");
  for (const { pack_id } of packs) {
    const info = await api("pack.info", { pack_id });
    const equipment = await api("equip.list", { pack_id });
    const unit = assets.find((a) => equipment.some((e) => e.equip_id === a.equip_id));
    assert.ok(unit, `${pack_id}: no unit in the preview fleet`);
    const trees = await api("tree.list", { pack_id, equip_id: unit.equip_id });

    // Study views: every tree.
    for (const [i, t] of trees.entries()) {
      const full = await api("tree.get", { pack_id, tree_id: t.tree_id });
      await page.goto(`${base}/learn/${encodeURIComponent(pack_id)}/tree/${encodeURIComponent(t.tree_id)}`);
      const items = page.locator("li[data-node]");
      await items.first().waitFor();
      assert.equal(await items.first().getAttribute("data-node"), full.tree.entry_node, `${t.tree_id}: the entry is not first`);
      assert.match(await items.first().innerText(), /^1\. /, `${t.tree_id}: numbering does not start at the entry`);
      const texts = await page.locator("ul[aria-label=Branches] >> text=/to step 0/").count();
      assert.equal(texts, 0, `${t.tree_id}: a branch points at no step`);
      // Every branch control moves to its step (the first dozen trees; the rest by structure).
      if (i < WALK) {
        const buttons = page.locator("ul[aria-label=Branches] button");
        for (let b = 0; b < (await buttons.count()); b++) {
          const btn = buttons.nth(b);
          const want = Number((await btn.innerText()).match(/to step (\d+)/)?.[1]);
          await btn.click();
          const at = await page.evaluate(() => document.activeElement?.getAttribute("data-node"));
          const atIndex = await items.evaluateAll((els, id) => els.findIndex((e) => e.getAttribute("data-node") === id), at);
          assert.equal(atIndex + 1, want, `${t.tree_id}: "${await btn.innerText()}" did not move to step ${want}`);
        }
      }
      checks++;
    }

    // The Describe index: every table that applies to the unit.
    await page.goto(`${base}/units/${encodeURIComponent(unit.asset_id)}/troubleshoot`);
    const index = page.locator("aside[aria-labelledby=index] li button");
    await index.first().waitFor();
    assert.equal(await index.count(), trees.length, `${pack_id}: the index lists ${await index.count()} of ${trees.length} tables`);
    await noOverflow(`${pack_id} describe`);
    checks++;

    // Jobs: the first branches of several trees, step by step, to the end or ten steps.
    for (const t of trees.slice(0, WALK)) {
      await page.goto(`${base}/units/${encodeURIComponent(unit.asset_id)}/troubleshoot`);
      await page.locator("aside[aria-labelledby=index] li button", { hasText: t.title }).first().click();
      for (let s = 1; s <= 10; s++) {
        await page.getByText(new RegExp(`^Step ${s}, `)).first().waitFor();
        const bar = page.getByLabel("Record the result").last();
        const keypad = page.getByRole("group", { name: "Measured value", exact: true });
        if (await keypad.count()) {
          for (const k of "12") await keypad.first().getByRole("button", { name: k, exact: true }).click();
          await page.getByRole("button", { name: "Record", exact: true }).click();
          continue;
        }
        const choice = bar.getByRole("button").first();
        if (!(await choice.count())) break;
        const label = await choice.innerText();
        if (/corrective action|Close|refer|Continue in/i.test(label) && !/^Continue$/i.test(label.trim())) break;
        await choice.click();
        // A branch that loops back still moves the job: the step count grows.
      }
      checks++;
    }

    // The manual: contents and the first sections.
    await page.goto(`${base}/manual/${encodeURIComponent(pack_id)}`);
    const sections = page.locator("main a[href*='/section/']");
    await sections.first().waitFor();
    for (let s = 0; s < Math.min(3, await sections.count()); s++) {
      await page.goto(`${base}/manual/${encodeURIComponent(pack_id)}`);
      await sections.nth(s).click();
      await page.locator("h1").first().waitFor();
      await noOverflow(`${pack_id} section ${s}`);
      checks++;
    }

    // Reference tables: every table renders every row.
    for (const t of await api("table.list", { pack_id })) {
      await page.goto(`${base}/manual/${encodeURIComponent(pack_id)}/reference/${encodeURIComponent(t.table_id)}`);
      await page.locator("li[data-row]").first().waitFor();
      assert.equal(await page.locator("li[data-row]").count(), t.rows, `${t.table_id}: rows`);
      await noOverflow(`${t.table_id}`);
      checks++;
    }

    // Practice: a question, answered, its rationale opening the manual.
    const items = await api("practice.items", { pack_id }).catch(() => null);
    if (items?.questions?.length) {
      await page.goto(`${base}/learn/${encodeURIComponent(pack_id)}/practice`);
      const choices = page.getByRole("list", { name: "Choices" });
      await choices.getByRole("button").first().click();
      const cite = choices.getByRole("link").first();
      if (await cite.count()) {
        await cite.click();
        await page.locator("h1").first().waitFor();
      }
      checks++;
    }
    void info;
  }

  // Connect: a message the pre-arm pack maps, to its entry and Start.
  const boat = assets.find((a) => a.asset_id === "boat-7");
  if (boat) {
    await page.goto(`${base}/units/boat-7/connect`);
    await page.getByRole("radio", { name: "Typed" }).click();
    await page.getByLabel("Code or message").fill("PreArm: Compass 2 not healthy");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Start here" }).first().click();
    await page.getByText("Step 1, symptom").waitFor();
    checks++;
  }

  // Narrow: the study view and Describe on a phone width.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/units/${encodeURIComponent(assets[0].asset_id)}/troubleshoot`);
  await page.locator("aside[aria-labelledby=index] li button").first().waitFor();
  await noOverflow("describe at 390");

  assert.deepEqual(errors, [], `console errors:\n${errors.join("\n")}`);
  console.log(`verify-packs: ${checks} checks on ${packs.map((p) => p.pack_id).join(", ")}`);
} finally {
  await browser.close();
}
