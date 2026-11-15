/**
 * First-screen performance for every kind of visitor, on a mid-range phone:
 * the production build (`npm run build`) served the way nginx serves it
 * (gzip, `/` from home.html, immutable assets), the real API on a fresh
 * schema with the design personas, Chromium with the CPU slowed 4x and a
 * slow 4G network (150 ms round trip, 1.6 Mbps down, 750 kbps up, as
 * Lighthouse's mobile profile). Every request goes over the network; the
 * cache is off.
 *
 * Per screen, the median of `--runs` cold loads:
 * - JS and CSS bytes on the wire before the largest paint, and in all;
 * - first contentful paint and largest contentful paint;
 * - long tasks (count, and total blocking time past 50 ms each);
 * - cumulative layout shift.
 *
 *     AMP_TEST_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/amp_scratch_x \
 *       npx tsx scripts/measure-first-screens.ts [--port 5020] [--runs 3]
 *       [--only pitch,sign-up] [--json out.json] [--dist dir] [--shots dir]
 *
 * It measures; it asserts nothing. The bundle budget is
 * scripts/check-bundle-budget.ts, run by `npm run build`.
 */
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, open as openFile, writeFile } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize } from "node:path";
import { createGzip } from "node:zlib";
import pg from "pg";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContextOptions,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("port") ?? 5020);
const apiPort = webPort + 1;
const runs = Number(argument("runs") ?? 3);
const only = argument("only")?.split(",");
const origin = `http://127.0.0.1:${webPort}`;
const dist = argument("dist") ?? new URL("../dist/", import.meta.url).pathname;
if (!existsSync(join(dist, "home.html")))
  throw new Error("Build first: npm run build");

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
  ".xml": "application/xml",
};
const compressible = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

/** dist/ as docker/nginx.conf serves it, and /api to the API. */
function serve() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", origin);
    if (url.pathname.startsWith("/api/")) {
      const upstream = http.request(
        {
          host: "127.0.0.1",
          port: apiPort,
          method: request.method,
          path: request.url,
          headers: request.headers,
        },
        (answer) => {
          response.writeHead(answer.statusCode ?? 502, answer.headers);
          answer.pipe(response);
        },
      );
      upstream.on("error", () => {
        response.statusCode = 502;
        response.end();
      });
      request.pipe(upstream);
      return;
    }
    const path = normalize(decodeURIComponent(url.pathname));
    let file: string;
    if (path === "/") file = "home.html";
    else if (path === "/pathways" || path === "/pathways/")
      file = "pathways/index.html";
    else if (
      existsSync(join(dist, path)) &&
      statSync(join(dist, path)).isFile()
    )
      file = path;
    else if (existsSync(join(dist, path, "index.html")))
      file = join(path, "index.html");
    else if (/\.[A-Za-z0-9]+$/.test(path)) {
      response.statusCode = 404;
      response.end();
      return;
    } else file = "index.html";
    const type = types[extname(file)] ?? "application/octet-stream";
    response.setHeader("Content-Type", type);
    response.setHeader(
      "Cache-Control",
      file.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    const stream = createReadStream(join(dist, file));
    if (
      compressible.test(type) &&
      /\bgzip\b/.test(String(request.headers["accept-encoding"]))
    ) {
      response.setHeader("Content-Encoding", "gzip");
      response.setHeader("Vary", "Accept-Encoding");
      // nginx's gzip_comp_level.
      stream.pipe(createGzip({ level: 6 })).pipe(response);
    } else stream.pipe(response);
  });
}

async function startStack() {
  const url = process.env.AMP_TEST_DATABASE_URL;
  if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
  assertTestDatabaseTarget(url);
  const schema = `amp_first_screens_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(scoped.href);
  await mkdir("artifacts/first-screens", { recursive: true });
  const log = await openFile("artifacts/first-screens/api.log", "w");
  const api = spawn("npx", ["tsx", "src/server/main.ts"], {
    env: {
      ...process.env,
      AMP_DATABASE_URL: scoped.href,
      AMP_AUTH_MODE: "accounts",
      AMP_HOSTED_PILOT_READY: "true",
      AMP_ACCOUNTS_URL: origin,
      AMP_ACCOUNTS_SECRET: randomBytes(32).toString("hex"),
      AMP_PORT: String(apiPort),
      AMP_HOST: "127.0.0.1",
      NODE_ENV: "development",
    },
    stdio: ["ignore", log.fd, log.fd],
    detached: true,
  });
  for (let i = 0; ; i++) {
    const up = await fetch(`http://127.0.0.1:${apiPort}/api/v1/auth-config`)
      .then((response) => response.ok)
      .catch(() => false);
    if (up) break;
    if (i > 120 || api.exitCode !== null)
      throw new Error("The API did not start: artifacts/first-screens/api.log");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const server = serve();
  await new Promise<void>((resolve) =>
    server.listen(webPort, "127.0.0.1", resolve),
  );
  const seeder = spawn("npx", ["tsx", "scripts/design-personas.ts"], {
    env: {
      ...process.env,
      AMP_DATABASE_URL: scoped.href,
      AMP_PREVIEW_ORIGIN: origin,
      AMP_PERSONAS: "signed-up,adult-new,adult-3wk,family,teacher-class",
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const code = await new Promise<number | null>((resolve) =>
    seeder.on("exit", resolve),
  );
  if (code !== 0) throw new Error(`Seeding failed (${code})`);
  return {
    async stop() {
      await new Promise((resolve) => server.close(resolve));
      if (api.pid && api.exitCode === null) process.kill(-api.pid, "SIGTERM");
      await log.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    },
  };
}

async function signIn(browser: Browser, persona: string) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin },
      data: { email: personaEmail(persona), password: PERSONA_PASSPHRASE },
    },
  );
  if (!response.ok())
    throw new Error(`${persona} signs in: ${response.status()}`);
  const state = await context.storageState();
  const session = await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json();
  const me = await (
    await context.request.get(`${origin}/api/v1/me`, {
      headers: { Authorization: `Bearer ${session.session.token}` },
    })
  ).json();
  await context.close();
  return { state, me };
}

/** Installed before any page script. A string, not a function: the
 * TypeScript loader adds helpers to functions that the page doesn't have. */
const observe = `(() => {
  const perf = (window.__perf = { lcp: 0, fcp: 0, longTasks: [], cls: 0 });
  const watch = (type, take) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(take)).observe({ type, buffered: true });
    } catch {}
  };
  watch("largest-contentful-paint", (entry) => { perf.lcp = entry.startTime; });
  watch("paint", (entry) => { if (entry.name === "first-contentful-paint") perf.fcp = entry.startTime; });
  watch("longtask", (entry) => { perf.longTasks.push(entry.duration); });
  watch("layout-shift", (entry) => { if (!entry.hadRecentInput) perf.cls += entry.value; });
  // Ready: the screen's own content is up and nothing on it waits (no boot
  // wave, no busy region, no skeleton). LCP alone misses screens whose
  // largest text fades in; this is what a person sees as "loaded".
  perf.ready = 0;
  const tick = () => {
    const main = document.querySelector("main") ?? document.getElementById("root");
    const settled =
      !document.querySelector(".app-loading") &&
      !document.querySelector('[aria-busy="true"]') &&
      !document.querySelector(".amp-skeleton") &&
      !!main && main.innerText.trim().length > 0;
    if (settled) {
      if (!perf.ready) perf.ready = performance.now();
    } else perf.ready = 0;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

type Sample = {
  url: string;
  fcp: number;
  lcp: number;
  ready: number;
  longTasks: number;
  blocking: number;
  cls: number;
  jsBeforeLcp: number;
  cssBeforeLcp: number;
  js: number;
  css: number;
  requestsBeforeLcp: number;
  /** After the press (`then`): until it showed, and the JS it fetched. */
  action: number;
  actionJs: number;
  /** Requests for the two boot answers; 2 means no duplicate. */
  bootRequests: number;
};

async function coldLoad(
  browser: Browser,
  state: BrowserContextOptions["storageState"] | undefined,
  path: string,
  /** A press after the screen settles, and what shows when it is done. */
  then?: { button: string; until: string },
): Promise<Sample> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    storageState: state,
  });
  await context.addInitScript({ content: observe });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const requests = new Map<
    string,
    { type: string; url: string; start: number; end: number; bytes: number }
  >();
  let navigationStart = 0;
  cdp.on("Network.requestWillBeSent", (event) => {
    if (!navigationStart && event.type === "Document")
      navigationStart = event.timestamp;
    requests.set(event.requestId, {
      type: event.type ?? "Other",
      url: event.request.url,
      start: event.timestamp,
      end: 0,
      bytes: 0,
    });
  });
  cdp.on("Network.loadingFinished", (event) => {
    const request = requests.get(event.requestId);
    if (request) {
      request.end = event.timestamp;
      request.bytes = event.encodedDataLength;
    }
  });
  await page.goto(origin + path, { waitUntil: "load", timeout: 120_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(3000);
  const perf = (await page.evaluate("window.__perf")) as {
    lcp: number;
    fcp: number;
    ready: number;
    longTasks: number[];
    cls: number;
  };
  let action = 0,
    actionJs = 0;
  if (then) {
    const before = new Set(requests.keys());
    const pressed = Date.now();
    try {
      // A button or a link: whichever the screen offers.
      await page
        .locator("a, button")
        .filter({ hasText: then.button })
        .first()
        .click({ timeout: 15_000 });
      await page.locator(then.until).first().waitFor({ timeout: 60_000 });
      action = Date.now() - pressed;
    } catch (error) {
      action = -1;
      console.warn(`${path}: "${then.button}" did not finish`, error);
      await page.screenshot({ path: "artifacts/first-screens/press.png" });
    }
    await page.waitForLoadState("networkidle").catch(() => undefined);
    actionJs = [...requests]
      .filter(([id, r]) => !before.has(id) && /\.js(\?|$)/.test(r.url))
      .reduce((n, [, r]) => n + r.bytes, 0);
  }
  const url = new URL(page.url()).pathname;
  const shots = argument("shots");
  if (shots)
    await page.screenshot({
      path: `${shots}/${url.replaceAll("/", "_") || "_"}.png`,
    });
  await context.close();
  const finished = [...requests.values()].filter((r) => r.end > 0);
  const atMs = (t: number) => (t - navigationStart) * 1000;
  if (process.argv.includes("--verbose"))
    for (const r of [...finished].sort((a, b) => a.end - b.end))
      console.log(
        `  ${Math.round(atMs(r.start))}-${Math.round(atMs(r.end))} ms ${(r.bytes / 1024).toFixed(1)} KB ${new URL(r.url).pathname}`,
      );
  const kind = (r: { type: string; url: string }) =>
    r.type === "Script" || /\.js(\?|$)/.test(r.url)
      ? "js"
      : r.type === "Stylesheet" || /\.css(\?|$)/.test(r.url)
        ? "css"
        : "other";
  const sum = (list: typeof finished, k: string) =>
    list.filter((r) => kind(r) === k).reduce((n, r) => n + r.bytes, 0);
  // The bytes a person waited for: those that arrived before the screen was
  // ready (or its largest paint, if that came later).
  const shown = Math.max(perf.lcp, perf.ready);
  const beforeLcp = finished.filter((r) => atMs(r.end) <= shown);
  return {
    url,
    fcp: perf.fcp,
    lcp: perf.lcp,
    ready: perf.ready,
    longTasks: perf.longTasks.length,
    blocking: perf.longTasks.reduce((n, d) => n + Math.max(0, d - 50), 0),
    cls: perf.cls,
    jsBeforeLcp: sum(beforeLcp, "js"),
    cssBeforeLcp: sum(beforeLcp, "css"),
    js: sum(finished, "js"),
    css: sum(finished, "css"),
    requestsBeforeLcp: beforeLcp.length,
    action,
    actionJs,
    bootRequests: [...requests.values()].filter((r) =>
      /\/api\/(v1\/auth-config|auth\/get-session)$/.test(r.url),
    ).length,
  };
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

const stack = await startStack();
const browser = await secureChromium(rawChromium).launch();
const results: Record<string, Sample & { runs: number }> = {};
try {
  const people = Object.fromEntries(
    await Promise.all(
      ["signed-up", "adult-new", "adult-3wk", "family", "teacher-class"].map(
        async (slug) => [slug, await signIn(browser, slug)] as const,
      ),
    ),
  );
  const family = people.family!.me.familyClass as {
    orgId: string;
    classId: string;
  };
  const screens: [
    string,
    string | null,
    string,
    { button: string; until: string }?,
  ][] = [
    ["pitch", null, "/"],
    ["sign-up", null, "/sign-up"],
    ["start", "signed-up", "/start"],
    [
      "family today",
      "family",
      `/school/${family.orgId}/classes/${family.classId}/today`,
    ],
    ["teacher class", "teacher-class", "/"],
    [
      "first problem",
      "adult-new",
      "/",
      { button: "Start practicing", until: "[data-problem-id]" },
    ],
    ["pathways", "adult-3wk", "/pathways"],
  ];
  for (const [name, who, path, then] of screens) {
    if (only && !only.includes(name)) continue;
    const samples: Sample[] = [];
    for (let i = 0; i < runs; i++)
      samples.push(
        await coldLoad(
          browser,
          who ? people[who]!.state : undefined,
          path,
          then,
        ),
      );
    const pick = (key: keyof Omit<Sample, "url">) =>
      median(samples.map((s) => s[key]));
    const row = {
      url: samples.at(-1)!.url,
      runs,
      fcp: pick("fcp"),
      lcp: pick("lcp"),
      ready: pick("ready"),
      longTasks: pick("longTasks"),
      blocking: pick("blocking"),
      cls: pick("cls"),
      jsBeforeLcp: pick("jsBeforeLcp"),
      cssBeforeLcp: pick("cssBeforeLcp"),
      js: pick("js"),
      css: pick("css"),
      requestsBeforeLcp: pick("requestsBeforeLcp"),
      action: pick("action"),
      actionJs: pick("actionJs"),
      bootRequests: pick("bootRequests"),
    };
    results[name] = row;
    const kb = (n: number) => `${Math.round(n / 1024)} KB`;
    console.log(
      `${name.padEnd(14)} ${row.url.padEnd(28)} FCP ${Math.round(row.fcp)} ms  LCP ${Math.round(row.lcp)} ms  ready ${Math.round(row.ready)} ms  ` +
        `JS ${kb(row.jsBeforeLcp)} / CSS ${kb(row.cssBeforeLcp)} before shown (JS ${kb(row.js)} / CSS ${kb(row.css)} in all)  ` +
        `long tasks ${row.longTasks} (TBT ${Math.round(row.blocking)} ms)  CLS ${row.cls.toFixed(3)}  boot requests ${row.bootRequests}` +
        (then
          ? `  then "${then.button}" → ${Math.round(row.action)} ms, JS ${kb(row.actionJs)}`
          : ""),
    );
  }
} finally {
  await browser.close();
  await stack.stop();
}
const out = argument("json");
if (out) await writeFile(out, JSON.stringify(results, null, 2));
