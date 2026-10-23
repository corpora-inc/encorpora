import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { generateProblem, templates } from "../src/math/engine";
import { figureCapabilities } from "../src/math/contracts";

// Creates only a fresh nameless test trial against a local development server.
const origin = new URL(
  process.env.AMP_MAP_TEST_ORIGIN ?? "http://127.0.0.1:4364",
);
assert(
  ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname),
  "Use a loopback test server",
);
const config = await fetch(new URL("/api/v1/auth-config", origin)).then((r) =>
  r.json(),
);
assert.equal(config.mode, "development", "Use an isolated development server");
let token = "";
async function api(path: string, body?: unknown) {
  const response = await fetch(new URL(`/api/v1${path}`, origin), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: `Trial ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert(response.ok, `Local test request failed (${response.status})`);
  return response.json();
}
const trial = await api("/trials", { birthYear: 2016 });
token = trial.token;
const path = `/learners/${trial.learnerId}`;
const chosen = [
  ...new Map(templates.map((t) => [t.skillId, t])).values(),
].slice(0, 3);
let firstRequest: {
  problemId: string;
  requestId: string;
  response: string;
} | null = null;
async function complete(index: number) {
  const batch = await api(`${path}/batches`, {
    templateId: chosen[index % chosen.length]!.id,
    count: 1,
    responseCapabilities: ["single-choice-v1"],
    figureCapabilities: [...figureCapabilities],
  });
  const problem = batch.problems[0],
    generated = generateProblem(problem.templateId, problem.seed);
  assert.equal(
    generated.public.id,
    problem.id,
    "Local frontend and API use the same immutable problem version",
  );
  const request = {
    problemId: problem.id,
    requestId: randomUUID(),
    response: generated.answer,
  };
  const result = await api(`${path}/attempts`, request);
  assert.equal(result.correct, true);
  assert.equal(result.assisted, false);
  firstRequest ??= request;
}
for (let i = 0; i < 3; i++) await complete(i);
await api(`${path}/attempts`, firstRequest);
const saved = await api(`${path}/progress`);
assert.equal(
  saved.skills.reduce(
    (sum: number, s: { independentCorrect: number }) =>
      sum + s.independentCorrect,
    0,
  ),
  3,
  "Retry does not duplicate earned illumination",
);
const out = "artifacts/pathways-integration";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await page.addInitScript("window.__name = (fn) => fn");
  await page.clock.install();
  await page.addInitScript(
    (token) => localStorage.setItem("amp.trial", token),
    token,
  );
  await page.goto(
    new URL(`/pathways?context=trial&skill=${chosen[0]!.skillId}`, origin).href,
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector('[role="meter"]')
        ?.getAttribute("aria-valuenow") === "0.5",
  );
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const canvas = (await page.locator(".pathways-canvas").boundingBox())!;
  await page.mouse.move(
    canvas.x + canvas.width * 0.5,
    canvas.y + canvas.height * 0.55,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + canvas.width * 0.55,
    canvas.y + canvas.height * 0.58,
    { steps: 8 },
  );
  await page.mouse.up();
  await complete(0);
  await page.clock.fastForward(30_100);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[role="meter"]')
        ?.getAttribute("aria-valuenow") === "1",
  );
  await page.screenshot({ path: `${out}/earned-illumination.png` });
  const progress = await api(`${path}/trial-progress`);
  for (let i = 4; i < progress.placement; i++) await complete(i);
  await page.goto(new URL("/try/map", origin).href);
  const image = page.getByRole("img", { name: /Your AMP curriculum map/ });
  await image.waitFor();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        if (!file) throw new Error("Map image missing");
        (window as any).sharedMap = {
          name: file.name,
          type: file.type,
          size: file.size,
          text: data.text,
          url: data.url,
        };
      },
    });
  });
  await page
    .getByRole("button", { name: "Share your assessment", exact: true })
    .click();
  const shared = await page.evaluate(() => (window as any).sharedMap);
  assert.equal(shared.type, "image/png");
  assert(shared.size > 10_000);
  assert.equal(shared.url, "https://amp.corpora.inc/try");
  assert(!JSON.stringify(shared).includes(token));
  assert(!JSON.stringify(shared).includes(trial.learnerId));
  const imageBytes = await image.evaluate(async (el) => {
    const response = await fetch((el as HTMLImageElement).src);
    const bytes = await response.arrayBuffer();
    return Array.from(new Uint8Array(bytes));
  });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(`${out}/assessment-map-card.png`, Buffer.from(imageBytes));
  await page.screenshot({
    path: `${out}/assessment-share.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "See your illuminated pathways →", exact: true })
    .click();
  await page.locator(".pathways-canvas canvas").waitFor();
  await page.screenshot({ path: `${out}/whole-earned-map.png` });
  console.log(
    "Real persisted trial attempts: idempotent credit, 0.5→1 illumination refresh, assessment map invitation, native PNG sharing and identity-free card passed.",
  );
} finally {
  await browser.close();
}
