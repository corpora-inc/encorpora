/** A returning parent adds a child, then starts that child's first practice.
 * Runs only against a disposable purchasePreview database and browser context.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture.js";

const fixture = await purchasePreview(
  Number(process.env.AMP_ADDED_CHILD_PREVIEW_PORT ?? 5050),
);
const browser = await secureChromium(rawChromium).launch();
const output =
  process.env.AMP_ADDED_CHILD_OUTPUT ?? "/tmp/amp-added-child-practice";
await mkdir(output, { recursive: true });
const results: unknown[] = [];
try {
  // Both have a family and no completed payment consent. Settings therefore
  // opens the same parent setup route used by the reported regression.
  for (const key of ["invoice", "returning"]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 850 },
    });
    try {
      const persona = fixture.personas.find((entry) => entry.key === key)!;
      assert.equal(
        (
          await context.request.post(
            fixture.origin + "/api/auth/sign-in/email",
            {
              headers: { origin: fixture.origin },
              data: { email: persona.email, password: fixture.password },
            },
          )
        ).status(),
        200,
      );
      const places = await (
        await context.request.get(fixture.origin + "/api/v1/families")
      ).json();
      const family = places.families.find(
        (entry: { role: string }) => entry.role === "holder",
      ).familyId as string;
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const routes: string[] = [];
      const batches: string[] = [];
      const errors: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame())
          routes.push(new URL(frame.url()).pathname);
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        const path = new URL(response.url()).pathname;
        if (response.ok() && /\/learners\/[^/]+\/batches$/.test(path))
          batches.push(path.split("/").at(-2)!);
      });
      await page.goto(fixture.origin + `/family/${family}/settings`);
      await page
        .getByRole("button", { name: "Add a child", exact: true })
        .click();
      await page.waitForURL("**/start/parent");
      await page
        .getByRole("heading", { name: "Add your kids", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Add a child", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: /^Name, Child 2/ })
        .fill("Morgan");
      await page
        .getByRole("button", { name: "Birth year, Morgan", exact: true })
        .click();
      await page.getByRole("radio", { name: "2015", exact: true }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.waitForURL("**/start/parent/ready");
      await page
        .getByRole("heading", { name: "Who’s practicing first?", exact: true })
        .waitFor();
      const children = (
        await fixture.db.query<{
          id: string;
          name: string;
          birth_year: number;
        }>(
          `SELECT id,name,birth_year FROM amp_learners
           WHERE account_id=$1 AND deleted_at IS NULL ORDER BY created_at,id`,
          [persona.accountId],
        )
      ).rows;
      assert.equal(
        children.length,
        2,
        "Adding a child preserves the existing child.",
      );
      assert.ok(children.some((child) => child.id === persona.learnerId));
      const child = children.find((entry) => entry.name === "Morgan")!;
      assert.equal(child.birth_year, 2015);
      const ready = "/start/parent/ready";
      const problem = page.getByLabel("Problem workspace", { exact: true });
      const loaded = () =>
        page.waitForResponse((response) => {
          const path = new URL(response.url()).pathname;
          return (
            response.ok() && path.endsWith(`/learners/${child.id}/batches`)
          );
        });
      routes.length = 0;
      const firstBatch = loaded();
      await page.locator(`[data-practice-here="${child.id}"]`).click();
      try {
        await firstBatch;
        await problem.waitFor();
        await page.waitForTimeout(300);
        assert.equal(new URL(page.url()).pathname, "/practice");
        assert.ok(!routes.includes("/start/parent"), JSON.stringify(routes));
        assert.deepEqual([...new Set(batches)], [child.id]);

        // Browser history must keep the parent's setup and the child's practice
        // as separate entries, including after a refresh of practice.
        await page.goBack();
        await page.waitForURL(fixture.origin + ready);
        await page
          .getByRole("heading", {
            name: "Who’s practicing first?",
            exact: true,
          })
          .waitFor();
        assert.equal(
          await page.evaluate(() => !!sessionStorage.getItem("amp.student")),
          false,
        );
        await page.goForward();
        await problem.waitFor();
        assert.equal(new URL(page.url()).pathname, "/practice");
        const reloadBatch = loaded();
        await page.reload();
        await reloadBatch;
        await problem.waitFor();
        assert.deepEqual([...new Set(batches)], [child.id]);
        assert.ok(!routes.includes("/start/parent"), JSON.stringify(routes));
        assert.deepEqual(errors, []);
        await page.screenshot({ path: `${output}/${key}-practice.png` });
        results.push({
          key,
          status: "passed",
          chosen: child.id,
          routes,
          batches,
        });
        console.log(
          `PASS added-child first practice, Back/Forward and reload: ${key}`,
        );
      } catch (error) {
        await page.screenshot({ path: `${output}/${key}-failure.png` });
        results.push({
          key,
          status: "failed",
          chosen: child.id,
          routes,
          batches,
          error: String(error),
        });
        throw error;
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await writeFile(`${output}/evidence.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await fixture.close();
}
