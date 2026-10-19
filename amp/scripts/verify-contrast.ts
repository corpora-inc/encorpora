/**
 * Contrast sweep: visits every route and interactive state in light and dark,
 * at 390 and 1280 px, and measures every visible text node against its
 * effective background (axe color-contrast plus a direct measurement, with
 * hover/active/focus forced on every control through the DevTools protocol).
 *
 *   npm run test:contrast              report only (artifacts/contrast/)
 *   npm run test:contrast -- --strict  fail on any violation
 */
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { migrate } from "./migrate";

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw Error("AMP_TEST_DATABASE_URL is required for the sweep");
const strict = process.argv.includes("--strict");
const out = new URL("../artifacts/contrast/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const learner = await repository.create(
  "development-household",
  "Contrast sweep",
  2016,
);
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
  development: true,
});
await app.listen({ host: "127.0.0.1", port: 4393 });
const origin = "http://127.0.0.1:4392";
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  logLevel: "error",
  server: {
    fs: { strict: false },
    host: "127.0.0.1",
    port: 4392,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4393" } },
  },
});
await vite.listen();

type Violation = {
  theme: string;
  width: number;
  state: string;
  source: "measure" | "axe";
  target: string;
  text: string;
  ratio: number;
  required: number;
  fg: string;
  bg: string;
};
const violations: Violation[] = [];
const visited: string[] = [];

/** In-page measurement of every visible text node under `scope`. */
function measure(scope: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const rgba = (value: string): number[] => {
    // Computed colors arrive as rgb()/rgba() or, from color-mix, color(srgb …).
    const srgb =
      /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)$/.exec(
        value,
      );
    if (srgb)
      return [srgb[1], srgb[2], srgb[3]]
        .map((v) => Number(v) * 255)
        .concat(srgb[4] == null ? 1 : Number(srgb[4]));
    const rgb =
      /^rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)(?:,? \/? ?([\d.]+))?\)$/.exec(
        value,
      );
    if (rgb)
      return [rgb[1], rgb[2], rgb[3]]
        .map(Number)
        .concat(rgb[4] == null ? 1 : Number(rgb[4]));
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top: number[], bottom: number[]) =>
    [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
  const lum = (c: number[]) =>
    c
      .slice(0, 3)
      .map((v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      })
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const background = (element: Element) => {
    const layers: number[][] = [];
    for (let e: Element | null = element; e; e = e.parentElement) {
      const style = getComputedStyle(e);
      if (
        style.backgroundImage !== "none" &&
        !/url\(/.test(style.backgroundImage)
      )
        return null; // gradient: leave to axe and the screenshot review
      const c = rgba(style.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    let bg = rgba(getComputedStyle(document.documentElement).backgroundColor);
    if (bg[3] < 1) bg = over(bg, [255, 255, 255, 1]);
    for (const layer of layers.reverse()) bg = over(layer, bg);
    return bg;
  };
  const results: {
    target: string;
    text: string;
    ratio: number;
    required: number;
    fg: string;
    bg: string;
  }[] = [];
  const seen = new Set<Element>();
  const root = document.querySelector(scope);
  if (!root) return results;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    const element = node.parentElement;
    if (!text || !element || seen.has(element)) continue;
    seen.add(element);
    if (
      !element.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
      })
    )
      continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    if (element.closest(":disabled,[aria-disabled=true],[aria-hidden=true]"))
      continue;
    const style = getComputedStyle(element);
    const svg = element instanceof SVGElement;
    let fg = rgba(svg ? style.fill : style.color);
    const bg = background(element);
    if (!bg) continue;
    let opacity = 1;
    for (let e: Element | null = element; e; e = e.parentElement)
      opacity *= Number(getComputedStyle(e).opacity);
    fg = [...fg.slice(0, 3), fg[3] * opacity];
    const composed = over(fg, bg);
    const a = lum(composed),
      b = lum(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(style.fontSize),
      bold = Number(style.fontWeight) >= 700;
    const required = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    const hex = (c: number[]) =>
      "#" +
      c
        .slice(0, 3)
        .map((v) => Math.round(v).toString(16).padStart(2, "0"))
        .join("");
    if (ratio + 0.005 < required) {
      const cls =
        typeof element.className === "string"
          ? element.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      results.push({
        target: element.tagName.toLowerCase() + (cls ? "." + cls : ""),
        text: text.slice(0, 40),
        ratio: Math.round(ratio * 100) / 100,
        required,
        fg: hex(composed),
        bg: hex(bg),
      });
    }
  }
  return results;
}

const CONTROLS =
  "button:not(:disabled), a[href], summary, [role=tab], [role=option], [role=menuitem], input:not([type=hidden])";

async function record(
  page: Page,
  cdp: CDPSession,
  meta: { theme: string; width: number },
  state: string,
) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  visited.push(`${meta.theme} ${meta.width} ${state}`);
  const key = `${state}`;
  const push = (
    source: "measure" | "axe",
    list: Omit<Violation, "theme" | "width" | "state" | "source">[],
  ) =>
    violations.push(
      ...list.map((v) => ({ ...meta, state: key, source, ...v })),
    );
  await page.evaluate("window.__name = (fn) => fn");
  push("measure", await page.evaluate(measure, "body"));
  // Forced interactive states on every visible control.
  await page.evaluate((selector) => {
    document
      .querySelectorAll("[data-sweep]")
      .forEach((e) => e.removeAttribute("data-sweep"));
    let i = 0;
    for (const e of document.querySelectorAll(selector)) {
      const r = e.getBoundingClientRect();
      if (r.width && r.height && e.checkVisibility())
        e.setAttribute("data-sweep", String(i++));
    }
  }, CONTROLS);
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", {
    nodeId: root.nodeId,
    selector: "[data-sweep]",
  });
  for (const nodeId of nodeIds) {
    const { attributes } = await cdp.send("DOM.getAttributes", { nodeId });
    const id = attributes[attributes.indexOf("data-sweep") + 1];
    for (const forced of ["hover", "active", "focus-visible"]) {
      await cdp.send("CSS.forcePseudoState", {
        nodeId,
        forcedPseudoClasses:
          forced === "focus-visible" ? ["focus", "focus-visible"] : [forced],
      });
      const found = await page.evaluate(measure, `[data-sweep="${id}"]`);
      push(
        "measure",
        found.map((f) => ({ ...f, target: `${f.target}:${forced}` })),
      );
    }
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
  }
  const axe = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  for (const v of axe.violations)
    for (const node of v.nodes) {
      const data = node.any[0]?.data as
        | {
            contrastRatio?: number;
            expectedContrastRatio?: string;
            fgColor?: string;
            bgColor?: string;
          }
        | undefined;
      push("axe", [
        {
          target: String(node.target[0]),
          text: node.html
            .replace(/<[^>]+>/g, "")
            .trim()
            .slice(0, 40),
          ratio: data?.contrastRatio ?? 0,
          required: parseFloat(data?.expectedContrastRatio ?? "4.5"),
          fg: data?.fgColor ?? "",
          bg: data?.bgColor ?? "",
        },
      ]);
    }
  const name = `${meta.theme}-${meta.width}-${state.replace(/[^a-z0-9]+/gi, "-")}`;
  await page.screenshot({ path: `${out}${name}.png` });
}

async function sweep(browser: Browser, theme: "light" | "dark", width: number) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent =
        "*,*::before,*::after{transition:none!important;animation-play-state:paused!important;caret-color:transparent!important}";
      document.head.append(style);
    });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const meta = { theme, width };
  /** A screen has painted its heading and finished its first data load. */
  const settle = async () => {
    await page.locator("h1, h2").first().waitFor();
    await page
      .locator(".app-loading, [aria-busy=true]")
      .first()
      .waitFor({ state: "detached", timeout: 5000 })
      .catch(() => undefined);
    await page.waitForTimeout(400);
  };
  const at = (state: string) => record(page, cdp, meta, state);
  const step = async (state: string, run: () => Promise<unknown>) => {
    try {
      await run();
      await at(state);
    } catch (error) {
      console.error(
        `Sweep step failed: ${theme} ${width} ${state}`,
        String(error).split("\n")[0],
      );
      await page
        .screenshot({
          path: `${out}failed-${theme}-${width}-${state.replace(/[^a-z0-9]+/gi, "-")}.png`,
        })
        .catch(() => undefined);
      violations.push({
        ...meta,
        state,
        source: "measure",
        target: "(step did not render)",
        text: String(error).slice(0, 80),
        ratio: 0,
        required: 0,
        fg: "",
        bg: "",
      });
    }
  };
  await step("home", async () => {
    await page.goto(origin);
    const learnerButton = page.getByRole("button", {
      name: "Learner",
      exact: true,
    });
    await learnerButton.waitFor();
    await learnerButton.click();
    await page
      .getByRole("dialog")
      .locator(`[role="option"][data-value=${JSON.stringify(learner.id)}]`)
      .click();
    await page.getByRole("button", { name: /^(Go|Continue)$/ }).waitFor();
  });
  await step("learner-select-open", async () => {
    await page.getByRole("button", { name: "Learner", exact: true }).click();
    await page.getByRole("option").first().waitFor();
  });
  await page.keyboard.press("Escape");
  await step("family-menu-open", async () => {
    await page.locator(".account-menu summary").click();
    await page.locator(".account-menu-content").waitFor();
  });
  await page
    .locator(".account-menu summary")
    .click()
    .catch(() => undefined);
  for (const route of ["/lessons", "/progress"])
    await step(route, async () => {
      await page.goto(origin + route);
      await settle();
    });
  await step("practice-problem", async () => {
    await page.goto(`${origin}/lessons?strand=data&topic=mean-data`);
    await page
      .getByRole("button", { name: "Practice this", exact: true })
      .click();
    await page.locator(".problem-stage").waitFor();
    await page.locator("#answer").waitFor();
  });
  await step("feedback-incorrect", async () => {
    await page.locator("#answer").fill("999");
    await page.getByRole("button", { name: "Check" }).click();
    await page.locator(".solution-panel").waitFor();
  });
  await step("feedback-correct", async () => {
    await page.route("**/attempts", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, correct: true, assisted: false },
      });
    });
    await page.getByRole("button", { name: "Next", exact: false }).click();
    await page.locator("#answer").waitFor();
    await page.locator("#answer").fill("1");
    await page.getByRole("button", { name: "Check" }).click();
    await page.locator(".solution-panel.correct").waitFor();
    await page.unroute("**/attempts");
  });
  await step("feedback-assisted", async () => {
    await page.getByRole("button", { name: "Next", exact: false }).click();
    await page.locator("#answer").waitFor();
    await page.route("**/attempts", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, correct: true, assisted: true },
      });
    });
    await page.locator("#answer").fill("1");
    await page.getByRole("button", { name: "Check" }).click();
    await page.locator(".solution-panel.correct").waitFor();
    await page.unroute("**/attempts");
  });
  for (const route of [
    "/family/learners",
    "/family/access",
    "/family/privacy",
    "/purchase",
    "/purchase/annual",
    "/purchase/funded",
  ])
    await step(route, async () => {
      await page.goto(origin + route);
      await settle();
    });
  await step("dialog-birth-year", async () => {
    await page.goto(`${origin}/family/learners`);
    await page
      .getByRole("button", { name: "Add learner", exact: false })
      .first()
      .click();
    await page.getByPlaceholder("First name or nickname").fill("Jordan");
    await page.getByRole("button", { name: "Birth year", exact: true }).click();
    await page.getByRole("dialog", { name: "Birth year" }).waitFor();
  });
  await step("toast-error", async () => {
    await page.getByRole("option", { name: "2018", exact: true }).click();
    await page.route("**/api/v1/learners", (r) =>
      r.fulfill({ status: 503, json: { error: "temporarily_unavailable" } }),
    );
    await page
      .getByRole("button", { name: "Add learner", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    await page.unroute("**/api/v1/learners");
  });
  await context.close();
}

const browser = await chromium.launch();
try {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  for (const theme of ["light", "dark"] as const)
    for (const width of [390, 1280]) {
      if (only && only !== `${theme}:${width}`) continue;
      console.log("Sweeping", theme, width);
      await sweep(browser, theme, width);
    }
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.end();
}

const unique = new Map<string, Violation>();
for (const v of violations)
  unique.set(`${v.theme}|${v.state}|${v.source}|${v.target}|${v.text}`, v);
const list = [...unique.values()];
await writeFile(
  `${out}report.json`,
  JSON.stringify({ visited, violations: list }, null, 2),
);
const lines = [
  `# Contrast sweep`,
  ``,
  `${visited.length} states visited; ${list.length} violation(s).`,
  ``,
  `| theme | width | state | source | element | text | ratio | needs | fg | bg |`,
  `|---|---|---|---|---|---|---|---|---|---|`,
  ...list.map(
    (v) =>
      `| ${v.theme} | ${v.width} | ${v.state} | ${v.source} | \`${v.target}\` | ${v.text.replace(/\|/g, "/")} | ${v.ratio} | ${v.required} | ${v.fg} | ${v.bg} |`,
  ),
];
await writeFile(`${out}report.md`, lines.join("\n") + "\n");
const byTheme = (t: string) => list.filter((v) => v.theme === t).length;
console.log(
  `Contrast sweep: ${visited.length} states, ${list.length} violation(s) (light ${byTheme("light")}, dark ${byTheme("dark")}). Report: artifacts/contrast/report.md`,
);
if (strict && list.length) process.exit(1);
process.exit(0);
