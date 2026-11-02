/**
 * App-shell audit: every screen outside the practice flow, with realistic
 * data, in Chromium and WebKit at the review widths, light and dark, plus a
 * phone-landscape smoke.
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_shell_fixture \
 *     npx tsx scripts/audit-app-shell-ui.ts [--engines chromium,webkit]
 *       [--production] [--routes home,progress] [--widths 390,1280]
 *
 * It measures and photographs; it does not fail. Findings and their ranking
 * live in docs/reviews/app-shell-polish/README.md, and the fixed ones are
 * asserted by verify-app-shell-ui.ts. Output: `report.jsonl` and one
 * screenshot per screen, size and theme under `artifacts/app-shell-audit/`.
 */
import AxeBuilder from "@axe-core/playwright";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import {
  focusWalk,
  probe,
  resetRecord,
  settle,
  shellRecord,
} from "./app-shell-probe";
import { shellScenarios, startShellFixture } from "./app-shell-fixture";

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const out = process.env.AMP_SHELL_AUDIT_OUT ?? "artifacts/app-shell-audit";
await mkdir(out, { recursive: true });
const report = `${out}/report.jsonl`;
await writeFile(report, "");
const fixture = await startShellFixture({
  production: process.argv.includes("--production"),
  webPort: Number(process.env.AMP_SHELL_WEB_PORT ?? 4920),
});
const { origin } = fixture;
const browserNames = (argument("engines") ?? "chromium,webkit").split(",");
const widths = (argument("widths") ?? "320,390,768,1024,1280")
  .split(",")
  .map(Number);
const viewports = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
].filter((v) => widths.includes(v.width));
const only = argument("routes")?.split(",");
const scenarios = shellScenarios(fixture).filter(
  (s) => !only || only.includes(s.id),
);
const launchers = { chromium, webkit } as const;
const settleReady = (page: import("playwright").Page) =>
  page
    .waitForLoadState("networkidle", { timeout: 6000 })
    .catch(() => undefined);

for (const name of browserNames) {
  const browser = await launchers[name as keyof typeof launchers].launch();
  for (const scenario of scenarios)
    for (const theme of ["light", "dark"] as const)
      for (const viewport of [
        ...viewports,
        ...(theme === "light" ? [{ width: 844, height: 390 }] : []),
      ]) {
        const context = await fixture.context(browser, scenario.state, {
          viewport,
          colorScheme: theme,
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        const errors: string[] = [];
        const failures: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text().slice(0, 200));
        });
        page.on("response", (r) => {
          if (r.status() >= 400 && r.url().includes("/api/"))
            failures.push(`${r.status()} ${new URL(r.url()).pathname}`);
        });
        const entry: Record<string, unknown> = {
          engine: name,
          scenario: scenario.id,
          path: scenario.path,
          theme,
          viewport: `${viewport.width}x${viewport.height}`,
        };
        const sampled =
          (viewport.width === 390 || viewport.width === 1280) &&
          viewport.height > 500;
        try {
          await page.goto(origin + scenario.path);
          await (scenario.ready?.(page) ?? settleReady(page));
          await settle(page, 900);
          entry.load = await shellRecord(page);
          if (scenario.then) {
            await resetRecord(page);
            await scenario.then(page);
            await settle(page, 400);
          }
          const at = new URL(page.url());
          entry.finalUrl = at.pathname + at.search;
          entry.probe = await probe(page);
          const file = `${out}/${name}/${scenario.id}-${viewport.width}x${viewport.height}-${theme}.png`;
          await mkdir(`${out}/${name}`, { recursive: true });
          await page.screenshot({ path: file });
          if (sampled)
            await page.screenshot({
              path: file.replace(".png", "-full.png"),
              fullPage: true,
            });
          // Accessibility and keyboard checks are sampled at a phone and a
          // desktop width.
          if (sampled) {
            const axe = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze();
            entry.axe = axe.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.length,
              sample: v.nodes
                .slice(0, 3)
                .map(
                  (n) =>
                    `${n.target.join(" ")} :: ${n.failureSummary?.split("\n")[1] ?? ""}`,
                ),
            }));
            if (!scenario.then) {
              entry.focus = await focusWalk(page);
              const before = {
                url: page.url(),
                heading: (entry.probe as { heading: string }).heading,
              };
              await page.reload();
              await (scenario.ready?.(page) ?? settleReady(page));
              await settle(page, 600);
              const after = {
                url: page.url(),
                heading: (await probe(page)).heading,
              };
              entry.refresh =
                before.url === after.url && before.heading === after.heading
                  ? "same"
                  : `${before.url} "${before.heading}" → ${after.url} "${after.heading}"`;
              entry.reloadLoad = await shellRecord(page);
            }
          }
        } catch (error) {
          entry.error = String(error).split("\n")[0];
          await page
            .screenshot({
              path: `${out}/${name}-${scenario.id}-${viewport.width}-${theme}-error.png`,
            })
            .catch(() => undefined);
        }
        entry.errors = [...new Set(errors)].slice(0, 8);
        entry.failures = [...new Set(failures)];
        await appendFile(report, JSON.stringify(entry) + "\n");
        console.log(
          `${name} ${scenario.id} ${entry.viewport} ${theme}: ${entry.error ?? "ok"}`,
        );
        await context.close();
      }
  await browser.close();
}

// Back and forward across the main screens restore each one.
{
  const browser = await chromium.launch();
  const context = await fixture.context(browser, "paid", {
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const stops = [
    "/",
    "/progress",
    "/pathways",
    `/pathways/${fixture.practisedSkill}`,
    "/inventory",
    "/lessons",
    "/family/learners",
    "/family/access",
  ];
  const label = async () =>
    `${new URL(page.url()).pathname} "${(await probe(page)).heading}"`;
  const forward: string[] = [];
  for (const stop of stops) {
    await page.goto(origin + stop);
    await settleReady(page);
    await settle(page, 500);
    forward.push(await label());
  }
  const back: string[] = [];
  for (let i = stops.length - 1; i > 0; i--) {
    await page.goBack();
    await settleReady(page);
    await settle(page, 500);
    back.push(await label());
  }
  await appendFile(
    report,
    JSON.stringify({ scenario: "history", forward, back }) + "\n",
  );
  await browser.close();
}
console.log(`Wrote ${report}`);
await fixture.close();
process.exit(0);
