/**
 * Smoothness (docs/design/ia.md): a cold load of each main screen goes from
 * the boot wave to the screen whole, with at most one change after the wave
 * (one placeholder, then the content) and no layout shift. Recorded frame by
 * frame on a slow phone: a fresh browser, the cache off, the CPU slowed 4x
 * and a slow network.
 *
 * The people are the design preview's synthetic ones (an adult's own
 * practice three weeks in, a family with its class), seeded by
 * scripts/design-personas.ts. By default the check starts its own stack, as
 * CI runs it: the real API (accounts mode) on a fresh schema of
 * AMP_TEST_DATABASE_URL and Vite in front of it. Or point it at a running,
 * seeded preview:
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_test npx tsx scripts/verify-smooth-load-ui.ts [--port 4460]
 *   npx tsx scripts/verify-smooth-load-ui.ts --origin http://127.0.0.1:4700
 *     [--width 390] [--auth-origin <the origin the API trusts>]
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open as openFile } from "node:fs/promises";
import pg from "pg";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContextOptions,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const width = Number(argument("width") ?? 390);
const stack = argument("origin")
  ? null
  : await startStack(Number(argument("port") ?? 4460));
const origin = argument("origin") ?? stack!.origin;
// The origin the API trusts for sign-in, when this one is a second dev
// server in front of the same API.
const authOrigin = argument("auth-origin") ?? origin;

/** The real API on a fresh schema, Vite in front of it, and the two people
 * seeded through it. */
async function startStack(webPort: number) {
  const url = process.env.AMP_TEST_DATABASE_URL;
  if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
  assertTestDatabaseTarget(url);
  const apiPort = webPort + 1;
  const origin = `http://127.0.0.1:${webPort}`;
  const schema = `amp_smooth_ui_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(scoped.href);
  await mkdir("artifacts/smooth-load", { recursive: true });
  const log = await openFile("artifacts/smooth-load/api.log", "w");
  const api = spawn("npx", ["tsx", "src/server/main.ts"], {
    env: {
      ...process.env,
      AMP_DATABASE_URL: scoped.href,
      AMP_AUTH_MODE: "accounts",
      AMP_HOSTED_PILOT_READY: "true",
      AMP_ACCOUNTS_URL: origin,
      // A fresh secret each run: nothing here outlives the process.
      AMP_ACCOUNTS_SECRET: randomBytes(32).toString("hex"),
      AMP_PORT: String(apiPort),
      AMP_HOST: "127.0.0.1",
      NODE_ENV: "development",
    },
    stdio: ["ignore", log.fd, log.fd],
    // Its own process group, so stopping it stops npx's children too and
    // nothing else.
    detached: true,
  });
  for (let i = 0; ; i++) {
    const up = await fetch(`http://127.0.0.1:${apiPort}/api/v1/auth-config`)
      .then((response) => response.ok)
      .catch(() => false);
    if (up) break;
    if (i > 120 || api.exitCode !== null)
      throw new Error("The API did not start: artifacts/smooth-load/api.log");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const vite = await createServer({
    cacheDir: "node_modules/.vite-smooth-load",
    server: {
      host: "127.0.0.1",
      port: webPort,
      strictPort: true,
      proxy: { "/api": `http://127.0.0.1:${apiPort}` },
    },
  });
  await vite.listen();
  // Asynchronously: Vite answers the seeder's requests from this process,
  // so this process must keep running while it seeds.
  const seeder = spawn("npx", ["tsx", "scripts/design-personas.ts"], {
    env: {
      ...process.env,
      AMP_DATABASE_URL: scoped.href,
      AMP_PREVIEW_ORIGIN: origin,
      AMP_PERSONAS: "adult-3wk,family",
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const code = await new Promise<number | null>((resolve) =>
    seeder.on("exit", resolve),
  );
  if (code !== 0) throw new Error(`Seeding the two people failed (${code})`);
  return {
    origin,
    async stop() {
      await vite.close();
      if (api.pid && api.exitCode === null) process.kill(-api.pid, "SIGTERM");
      await log.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    },
  };
}

type Frame = {
  t: number;
  bar: boolean;
  busy: number;
  skeleton: number;
  text: string;
};

/** Every animation frame: whether the frame (bar) is up, what's waiting
 * (busy, skeletons) and the screen's visible words; and every layout shift. */
const recorder = () => {
  const w = window as unknown as {
    __frames: unknown[];
    __shifts: number[];
  };
  w.__frames = [];
  w.__shifts = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[])
        if (!entry.hadRecentInput) w.__shifts.push(entry.value);
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    // An engine without layout-shift entries records frames only.
  }
  const tick = () => {
    const main = document.querySelector("main");
    w.__frames.push({
      t: performance.now(),
      bar: !!document.querySelector("[data-app-bar]"),
      busy: document.querySelectorAll('[aria-busy="true"]').length,
      skeleton: document.querySelectorAll(".amp-skeleton").length,
      text: (main?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function signIn(browser: Browser, persona: string) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: authOrigin },
      data: { email: personaEmail(persona), password: PERSONA_PASSPHRASE },
    },
  );
  assert.ok(response.ok(), `${persona} signs in: ${response.status()}`);
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

async function coldLoad(
  browser: Browser,
  state: BrowserContextOptions["storageState"],
  path: string,
) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    storageState: state,
  });
  await context.addInitScript(recorder);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 80,
    downloadThroughput: 750_000,
    uploadThroughput: 250_000,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(origin + path, { waitUntil: "load", timeout: 90_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2500);
  const frames = (await page.evaluate(
    () => (window as unknown as { __frames: Frame[] }).__frames,
  )) as Frame[];
  const shifts = (await page.evaluate(
    () => (window as unknown as { __shifts: number[] }).__shifts,
  )) as number[];
  await context.close();
  // What the screen showed, from the first frame with the app's own frame
  // up (before it is the boot wave), as distinct states.
  const states: Frame[] = [];
  for (const frame of frames.filter((f) => f.bar)) {
    const last = states.at(-1);
    if (
      last &&
      last.busy === frame.busy &&
      last.skeleton === frame.skeleton &&
      last.text === frame.text
    )
      continue;
    states.push(frame);
  }
  return { states, cls: shifts.reduce((sum, value) => sum + value, 0) };
}

const failures: string[] = [];
const browser = await chromium.launch();
try {
  const adult = await signIn(browser, "adult-3wk");
  const family = await signIn(browser, "family");
  const home = family.me.familyClass as { orgId: string; classId: string };
  assert.ok(home, "the family persona has its class");
  const place = `/school/${home.orgId}/classes/${home.classId}`;
  const routes: [string, typeof adult, string][] = [
    ["me", adult, "/me"],
    ["profiles", adult, "/me/profiles"],
    ["pathways", adult, "/pathways"],
    ["inventory", adult, "/inventory"],
    ["family today", family, `${place}/today`],
    ["map", family, `${place}/map`],
    ["people", family, `${place}/roster`],
    ["settings", family, `${place}/settings`],
  ];
  for (const [name, who, path] of routes) {
    const { states, cls } = await coldLoad(browser, who.state, path);
    const changes = Math.max(0, states.length - 1);
    const trail = states
      .map(
        (s) =>
          `${Math.round(s.t)}ms busy=${s.busy} skeleton=${s.skeleton} "${s.text.slice(0, 50)}"`,
      )
      .join(" → ");
    console.log(`${name}: ${changes} change(s), CLS ${cls.toFixed(3)}`);
    if (changes > 1)
      failures.push(
        `${name}: the screen changed ${changes} times after the wave: ${trail}`,
      );
    if (cls > 0.001) failures.push(`${name}: layout shift ${cls.toFixed(3)}`);
  }
} finally {
  await browser.close();
  await stack?.stop();
}
assert.deepEqual(failures, [], failures.join("\n"));
console.log(`Smooth loads verified at ${width} px.`);
