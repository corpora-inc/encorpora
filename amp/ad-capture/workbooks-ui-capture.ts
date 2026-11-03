/**
 * Ad capture: the real AMP workbook screens for the synthetic third-grade
 * learner "Maya", on 2026-11-02, 30 minutes, Letter. Adapted from
 * scripts/verify-workbooks-ui.ts: the real Fastify routes (in memory) behind
 * the real web screens (Vite dev server) in Chromium. Only sign-in, /me and
 * the in-memory repository are fixtures. The workbook routes compose through
 * workbooks-ui-compose-shim.ts (learner key "third-grade", clock
 * 2026-11-02T15:00Z) so codes match the editor's printed PDFs.
 *
 *   cd amp && npx tsx ad-capture/workbooks-ui-capture.ts [phone|tablet]...
 */
import assert from "node:assert/strict";
import { register } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

register("./workbooks-ui-hooks.mjs", import.meta.url);

const DATE = "2026-11-02";
const NOW = Date.parse("2026-11-02T15:00:00Z");
const learnerId = "5d3c1b2a-0f9e-4d8c-8b7a-6e5f4d3c2b1a";
const LEARNER_KEY = "third-grade";
const MEDIA =
  "/Users/skyl/corpora-media/AMP-media/2026-11-02/amp-feature-ad-contest/entrants/anthropic/";
const OUT = `${MEDIA}captures/workbooks-ui/`;
const EDITOR = `${MEDIA}captures/workbooks/third-grade/`;
const calls: unknown[] = [];
(globalThis as any).__workbooksUiCompose = {
  keys: { [learnerId]: LEARNER_KEY },
  now: NOW,
  calls,
};

const { createServer } = await import("vite");
const { chromium } = await import("playwright");
type Page = import("playwright").Page;
type Locator = import("playwright").Locator;
const { buildApp } = await import("../src/server/app");
const { ApiError } = await import("../src/server/repository");
const { defaultPracticeSettings } = await import(
  "../src/learning/practice-settings"
);
const { sampleLearners, simulateLearner } = await import(
  "../src/workbook/synthetic"
);
const { retentionNotice } = await import("../src/family/contracts");
const { fixtureMe } = await import("../scripts/me-fixture");
const { composeWorkbook, workbookCode } = await import(
  "../src/workbook/compose"
);
const { skills } = await import("../src/curriculum/catalog");
const { lessons } = await import("../src/content/lessons");
const { templates, generateProblem, gradeAnswer } = await import(
  "../src/math/engine"
);
const { resultLabel } = await import("../src/workbook/result-labels");
type WorkbookRecord = import("../src/workbook/contracts").WorkbookRecord;
type Outcome = import("../src/server/repository").Outcome;

const editorSummary = JSON.parse(
  await readFile(`${EDITOR}summary.json`, "utf8"),
) as { rolls: { n: number; code: string }[] };
const editorCodes = editorSummary.rolls.map((r) => r.code);

const simulated = simulateLearner(
  sampleLearners.find((l: any) => l.id === LEARNER_KEY)!,
  NOW,
);
const rows: WorkbookRecord[] = [];
const attempts: Outcome[] = [];
// Paper results feed the learner's evidence and frontier, as the database
// projections do. Until a result is saved these equal the simulation, so
// today's rolls compose exactly as the editor's.
const { estimateFrontier, initialLevel } = await import("../src/learning/frontier");
const { projectSkillEvidence } = await import("../src/server/evidence");
const { templateGrade } = await import("../src/server/mixed-practice");
const { guessChanceOf } = await import("../src/math/guess-chance");
const live = () => [...simulated.attempts, ...attempts];
const liveFrontier = () => {
  if (!attempts.length) return simulated.frontier;
  const nodes = new Map(skills.map((s: any) => [s.id, s]));
  const byId = new Map(templates.map((t: any) => [t.id, t]));
  return estimateFrontier({
    start: initialLevel({ birthYear: 2017, now: NOW }),
    observations: live(),
    gradeOf: (id: string) => {
      const t = byId.get(id);
      return t ? templateGrade(t, nodes) : undefined;
    },
    strandOf: (id: string) =>
      (nodes.get((byId.get(id) as any)?.skillId ?? "") as any)?.strand ?? id,
    guessOf: guessChanceOf,
    now: Date.now(),
  } as any);
};
const problems = new Map<string, any>();
const tx = {
  hasAccess: async () => true,
  frontier: async () => liveFrontier(),
  frontierAfter: async () => liveFrontier(),
  frontierTrend: async () => [],
  skillEvidence: async () =>
    attempts.length ? projectSkillEvidence(live()) : simulated.evidence,
  recentAttempts: async () => live().slice(-12),
  recentSkips: async () => [],
  satMathFocus: async () => false,
  trialRemaining: async () => null,
  trialProgress: async () => null,
  masteredSkills: async () => [],
  birthYear: async () => 2017,
  startingPoint: async () => ({ band: null }),
  progress: async () => [],
  problem: async (id: string) => problems.get(id),
  workbooks: async (date?: string) =>
    rows
      .filter((r) => !date || r.date === date)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.number - a.number ||
          a.minutes - b.minutes,
      )
      .map((r) => ({ ...r })),
  workbook: async (workbookId: string) => {
    const found = rows.find((r) => r.id === workbookId);
    return found && { ...found };
  },
  saveWorkbook: async (record: WorkbookRecord) => {
    const found = rows.find(
      (r) =>
        r.date === record.date &&
        r.number === record.number &&
        r.minutes === record.minutes,
    );
    if (found) return { ...found };
    rows.push(record);
    return { ...record };
  },
  setWorkbookPaper: async (id: string, paper: WorkbookRecord["paper"]) => {
    rows.find((r) => r.id === id)!.paper = paper;
  },
  workbookByCode: async (code: string) => rows.find((r) => r.code === code),
  recentWorkbooks: async () => rows,
  practiceSettings: async () => defaultPracticeSettings(),
  attemptByRequest: async (requestId: string) =>
    attempts.find((a) => a.requestId === requestId),
  attemptByProblem: async (problemId: string) =>
    attempts.find((a) => a.problemId === problemId),
  saveProblem: async (p: any) => {
    problems.set(p.id, p);
  },
  saveAttempt: async (outcome: Outcome) => {
    attempts.push(outcome);
  },
};
const missingTx = new Set<string>();
const repository = {
  hasConsent: async () => true,
  list: async () => [{ id: learnerId, name: "Maya", birthYear: 2017 }],
  transaction: async (_account: string, id: string, run: (t: any) => any) => {
    if (id !== learnerId) throw new ApiError(404, "Learner not found");
    return run(
      new Proxy(tx, {
        get(target, key) {
          if (typeof key === "string" && !(key in target)) missingTx.add(key);
          return (target as any)[key];
        },
      }),
    );
  },
} as any;
const api = buildApp({
  repository,
  development: true,
  workbookRenderer: {
    render: async ({ format }: any) => Buffer.from(`%PDF-1.7 ${format}`),
  },
  authenticate: async () => "parent-one",
});

const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `export async function accessSession(){return {token:"parent-one",accountId:"parent-one"};}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  logLevel: "warn",
  plugins: [
    {
      name: "workbooks-capture-auth",
      enforce: "pre",
      load(id: string) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
      configureServer(server: any) {
        server.middlewares.use("/api/v1/events", (_q: any, response: any) => {
          response.statusCode = 204;
          response.end();
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 0 },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;

const me = fixtureMe(
  {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [
      {
        id: learnerId,
        name: "Maya",
        birthYear: 2017,
        deletedAt: null,
        access: [],
        stripeLinked: false,
        canPractice: true,
      },
    ],
    retained: retentionNotice,
  } as any,
  "parent-one",
);

const requests: { method: string; path: string; status: number }[] = [];
const unhandled = new Set<string>();
const batches: any[] = [];
/** Burst shots only: the next POST answers after this delay, so the real
 * stale (dimmed) state and its fade are on screen long enough to film. */
let delayNextPost = 0;
async function fixture(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/me")) return route.fulfill({ json: me });
    if (url.pathname.endsWith("/trials/current"))
      return route.fulfill({ json: { trial: null } });
    if (url.pathname.endsWith("/auth-config"))
      return route.fulfill({
        json: { mode: "accounts", passwords: true, providers: [] },
      });
    if (url.pathname.includes("/events"))
      return route.fulfill({ status: 204, body: "" });
    if (
      url.pathname.startsWith("/api/v1/learners") ||
      url.pathname.startsWith("/api/v1/catalog") ||
      url.pathname.startsWith("/api/v1/problem-lessons")
    ) {
      if (delayNextPost && request.method() === "POST") {
        const wait = delayNextPost;
        delayNextPost = 0;
        await new Promise((r) => setTimeout(r, wait));
      }
      const response = await api.inject({
        method: request.method() as "GET" | "POST",
        url: url.pathname + url.search,
        headers: {
          authorization: request.headers().authorization ?? "",
          ...(request.postData() ? { "content-type": "application/json" } : {}),
        },
        payload: request.postData() ?? undefined,
      });
      requests.push({
        method: request.method(),
        path: url.pathname + url.search,
        status: response.statusCode,
      });
      if (url.pathname.endsWith("/batches")) batches.push(response.json());
      return route.fulfill({
        status: response.statusCode,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([k, v]) => [k, String(v)]),
        ),
        body: response.rawPayload,
      });
    }
    unhandled.add(`${request.method()} ${url.pathname}`);
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return errors;
}

/** Fonts loaded, nothing busy or skeletal, two frames painted. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () =>
      document.fonts.status === "loaded" &&
      !document.querySelector("[aria-busy=true]") &&
      ![...document.querySelectorAll("[class*=skeleton]")].some(
        (e) => (e as HTMLElement).offsetParent,
      ),
  );
  await page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r(null))),
      ),
  );
  await page.waitForTimeout(250);
}

async function assertLayout(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  assert.equal(overflow, false, `${label}: horizontal overflow`);
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main a, main h1, main h2")]
      .filter((el) => (el as HTMLElement).offsetParent)
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent),
  );
  assert.deepEqual(clipped, [], `${label}: clipped text`);
}

type Box = { x: number; y: number; width: number; height: number };
type Named = { name: string; text?: string; onScreen: boolean; viewport: Box; page: Box };

const viewports = {
  phone: { width: 390, height: 844, scale: 3 },
  tablet: { width: 1024, height: 768, scale: 2 },
} as const;
const chosen = (process.argv.slice(2).filter((a) => a in viewports).length
  ? process.argv.slice(2).filter((a) => a in viewports)
  : Object.keys(viewports)) as (keyof typeof viewports)[];

type Entry = { n: number; how: "letter" | "typed" | "mark"; value: string; keystrokes?: boolean };
/** The problems of a stored workbook, regenerated from its spec as the
 * results route does, and the entries the capture makes (correct answers
 * from the generator, except the one marked Not yet). */
function plan(record: WorkbookRecord, choose: Record<number, "letter" | "typed" | "typed-keys" | "right" | "not-yet">) {
  let n = 0;
  const list = record.spec.sections.flatMap((s) =>
    s.items.map((item) => {
      const problem: any = generateProblem(item.templateId, item.seed);
      return { n: ++n, section: s.kind, item, problem };
    }),
  );
  const letter = (p: any) =>
    "ABCDEFGH"[p.public.response.options.findIndex((o: any) => o.id === p.answer)]!;
  const entries: Entry[] = Object.entries(choose).map(([key, how]) => {
    const p = list[Number(key) - 1]!.problem;
    const kind = p.public.response.kind;
    if (how === "letter") {
      assert.equal(kind, "choice", `problem ${key} is not a choice`);
      return { n: Number(key), how, value: letter(p) };
    }
    if (how === "typed" || how === "typed-keys") {
      assert(kind === "number" || kind === "fraction", `problem ${key} is not typed`);
      return { n: Number(key), how: "typed", value: p.answer, keystrokes: how === "typed-keys" };
    }
    return { n: Number(key), how: "mark", value: how };
  });
  return { list, entries };
}

const browser = await chromium.launch();
const report: any = {
  viewports: {},
};
try {
  for (const name of chosen) {
    const vp = viewports[name];
    const dir = `${OUT}${name}/`;
    await mkdir(`${dir}full`, { recursive: true });
    await mkdir(`${dir}bursts`, { recursive: true });
    rows.length = 0;
    attempts.length = 0;
    problems.clear();
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.scale,
      isMobile: true,
      hasTouch: true,
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "America/New_York",
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = await fixture(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Animation.enable");
    const states: any[] = [];
    let index = 0;
    const scale = vp.scale;
    const toDevice = (b: Box): Box => ({
      x: Math.round(b.x * scale),
      y: Math.round(b.y * scale),
      width: Math.round(b.width * scale),
      height: Math.round(b.height * scale),
    });
    async function measure(items: [string, Locator][]): Promise<Named[]> {
      const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
      const out: Named[] = [];
      for (const [label, locator] of items) {
        const count = await locator.count();
        for (let i = 0; i < count; i++) {
          const el = locator.nth(i);
          if (!(await el.isVisible())) continue;
          const b = (await el.boundingBox())!;
          const text = (await el.innerText().catch(() => ""))
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 120);
          out.push({
            name: count > 1 ? `${label}[${i}]` : label,
            text,
            onScreen:
              b.y + b.height > 0 && b.y < vp.height && b.x + b.width > 0 && b.x < vp.width,
            viewport: toDevice(b),
            page: toDevice({ ...b, x: b.x + scroll.x, y: b.y + scroll.y }),
          });
        }
      }
      return out;
    }
    async function shot(
      slug: string,
      description: string,
      items: [string, Locator][],
      options: { full?: boolean; settle?: boolean; bare?: boolean } = {},
    ) {
      if (options.settle !== false) await settle(page);
      await page.mouse.move(vp.width - 2, vp.height - 2);
      await assertLayout(page, `${name} ${slug}`);
      const file = options.bare ? slug : `${String(++index).padStart(2, "0")}-${slug}`;
      await page.screenshot({ path: `${dir}${file}.png` });
      const scroll = await page.evaluate(() => ({
        y: scrollY,
        height: document.documentElement.scrollHeight,
      }));
      let full: string | undefined;
      if (options.full && scroll.height > vp.height + 1) {
        full = `full/${file}-full.png`;
        // A pinned bar would print mid-page in a stitched full-page image;
        // there it sits in flow at the end of the list instead, and a
        // floating toast is left out (the viewport PNG shows it).
        const style = await page.addStyleTag({
          content: "[class*=saveBar]{position:static !important} [role=region][aria-label^=Notifications]{visibility:hidden !important}",
        });
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
        await page.screenshot({ path: `${dir}${full}`, fullPage: true });
        await style.evaluate((el) => (el as Element).remove());
      }
      states.push({
        file: `${file}.png`,
        ...(full ? { full } : {}),
        description,
        url: page.url().replace(origin, ""),
        scrollY: Math.round(scroll.y * scale),
        documentHeight: Math.round(scroll.height * scale),
        elements: await measure(items),
      });
      console.log(`${name} ${file}`);
    }
    /** Screenshots at an interval while `action` runs, with CSS and Web
     * Animations slowed by CDP. */
    async function burst(
      slug: string,
      description: string,
      action: () => Promise<unknown>,
      done: () => Promise<unknown>,
      { rate = 0.25, frames = 16, latency = 900, name = "" } = {},
      measureItems?: () => [string, Locator][],
    ) {
      const before = measureItems ? await measure(measureItems()) : [];
      delayNextPost = latency;
      await page.mouse.move(vp.width - 2, vp.height - 2);
      await cdp.send("Animation.setPlaybackRate", { playbackRate: rate });
      const folder = name ? `bursts/${name}/` : `bursts/${String(index + 1).padStart(2, "0")}-${slug}/`;
      await mkdir(`${dir}${folder}`, { recursive: true });
      const times: number[] = [];
      const started = Date.now();
      await action();
      for (let f = 0; f < frames; f++) {
        await page.screenshot({
          path: `${dir}${folder}${String(f).padStart(3, "0")}.png`,
          animations: "allow",
          timeout: 5000,
        });
        times.push(Date.now() - started);
      }
      await done();
      await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
      states.push({
        burst: folder,
        description,
        playbackRate: rate,
        simulatedLatencyMs: latency,
        frames,
        msSinceAction: times,
        elementsAtStart: before,
      });
    }

    // 1. Family → Learners.
    await page.goto(`${origin}/family/learners`);
    await page.getByRole("link", { name: "Make a workbook" }).waitFor();
    assert.equal(
      await page.evaluate(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }),
      DATE,
      "browser local date",
    );
    const entry = page.getByRole("region", { name: "Workbooks" });
    const learnerCard = page.locator("article.family-learner");
    await shot(
      "learners",
      "Family → Learners: Maya, with Make a workbook and Past workbooks",
      [
        ["Workbooks section", entry],
        ["Make a workbook", page.getByRole("link", { name: "Make a workbook" })],
        ["Past workbooks", page.getByRole("link", { name: "Past workbooks" })],
        ["Learner card", learnerCard],
        ["Learner name", learnerCard.locator("h3")],
      ],
      { full: true },
    );

    // 2. Make a workbook: today, 30 minutes, Letter (the editor's PDFs).
    await page.goto(
      `${origin}/learners/${learnerId}/workbooks/${DATE}?minutes=30&paper=letter`,
    );
    await page.getByRole("heading", { name: "No. 1" }).waitFor();
    const code = page.getByLabel("Workbook code").first();
    const dayItems = (): [string, Locator][] => [
      ["Title (date)", page.locator("main h1")],
      ["Length", page.getByRole("radiogroup").nth(0)],
      ["Length 30 min", page.getByRole("radio", { name: /^30 min/ })],
      ["Paper", page.getByRole("radiogroup").nth(1)],
      ["Paper Letter", page.getByRole("radio", { name: /^Letter/ })],
      ["Level", page.getByRole("radiogroup").nth(2)],
      ["Level At level", page.getByRole("radio", { name: /^At level/ })],
      ["Today's idea", page.getByRole("radiogroup").nth(3)],
      ["Today's idea Include", page.getByRole("radio", { name: /^Include/ })],
      ["Areas", page.getByRole("group", { name: "Areas" })],
      ["Area chip", page.getByRole("group", { name: "Areas" }).getByRole("button")],
      ["Download", page.getByRole("button", { name: /^Download/ })],
      ["Roll another", page.getByRole("button", { name: "Roll another" })],
      ["Workbook contents", page.getByLabel("Workbook contents")],
      ["Workbook number", page.getByLabel("Workbook contents").locator("h2")],
      ["Workbook code", code],
      ["Summary line", page.getByLabel("Workbook contents").locator("p").first()],
      ["Section row", page.getByLabel("Workbook contents").locator("ol li")],
      ["Enter results", page.getByRole("link", { name: "Enter results" })],
    ];
    await shot("make-no1", "Make a workbook: No. 1 (30 min, Letter, mixed, at level, with today's idea)", dayItems(), { full: true });
    const day: any[] = [];
    const readDay = async () => ({
      number: Number(
        (await page.getByLabel("Workbook contents").locator("h2").innerText()).replace(/\D/g, ""),
      ),
      code: (await code.innerText()).trim(),
      contents: (await page.getByLabel("Workbook contents").innerText())
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      url: page.url().replace(origin, ""),
    });
    day.push(await readDay());

    // 3. Roll another → No. 2, slowed.
    await burst(
      "roll-another",
      "Tap Roll another: No. 1 dims (stale) → No. 2 (CSS animations at 0.25×, 900 ms simulated latency on the POST)",
      () => page.getByRole("button", { name: "Roll another" }).evaluate((b: HTMLElement) => b.click()),
      () => page.getByRole("heading", { name: "No. 2" }).waitFor(),
      {},
      dayItems,
    );
    await shot("make-no2", "After Roll another: No. 2, a different code and summary", dayItems(), { full: true });
    day.push(await readDay());
    // More rolls, so history lists several from today and No. 8 (the
    // film's close-up pages) composes after Nos. 1–7, as the editor's did.
    for (const n of [3, 4, 5, 6, 7, 8]) {
      await page.getByRole("button", { name: "Roll another" }).click();
      await page.getByRole("heading", { name: `No. ${n}` }).waitFor();
      await settle(page);
      day.push(await readDay());
      if (n === 4) await shot("make-no4", "After two more rolls: No. 4", dayItems());
    }
    await shot("results8-make-no8", "After four more rolls: No. 8 (WS82-8FSH, the film's close-up pages)", dayItems(), { bare: true });

    // Earlier days for the history list, composed as the API would. Added
    // after today's rolls so today's rolls match the editor's PDFs.
    for (const [date, minutes] of [
      ["2026-10-30", 30],
      ["2026-10-29", 45],
    ] as const) {
      const spec = composeWorkbook({
        templates,
        skills,
        lessons,
        frontier: simulated.frontier,
        evidence: simulated.evidence,
        date,
        minutes,
        learnerKey: LEARNER_KEY,
        now: Date.parse(`${date}T15:00:00Z`),
      });
      rows.push({
        id: crypto.randomUUID(),
        date,
        number: 1,
        minutes,
        paper: "letter",
        spec,
        code: workbookCode(spec),
        createdAt: `${date}T15:00:00Z`,
      } as WorkbookRecord);
    }

    // 4. Past workbooks.
    await page.getByRole("link", { name: "Past workbooks" }).first().click();
    await page.waitForURL(new RegExp(`/learners/${learnerId}/workbooks$`));
    await page.getByRole("list", { name: "Workbooks" }).waitFor();
    const list = page.getByRole("list", { name: "Workbooks" });
    const historyItems = (): [string, Locator][] => [
      ["Title", page.locator("main h1")],
      ["Code entry field", page.getByLabel("Enter results with the workbook code")],
      ["Open", page.getByRole("button", { name: "Open", exact: true })],
      ["Workbook row", list.getByRole("listitem")],
      ["Workbook row code", list.locator("[class*=code]")],
      ["Enter results (row)", list.getByRole("link", { name: /^Enter results for workbook/ })],
      ["Download (row)", list.getByRole("button", { name: /^Download workbook/ })],
    ];
    await shot("history", "Past workbooks: today's eight and two earlier days, newest first", historyItems(), { full: true });
    const history = (await list.getByRole("listitem").allInnerTexts()).map((t) =>
      t.split("\n").map((s) => s.trim()).filter(Boolean),
    );

    // 5. Results, opened by typing the printed code key by key on Past
    // workbooks: blank, partly entered, saved.
    async function enterResults(o: {
      number: number;
      choose: Parameters<typeof plan>[1];
      /** File and folder names: numbered (No. 1) or results8-* (No. 8). */
      named: (slug: string) => { slug: string; bare: boolean; folder: string };
      centre: number;
      partly: string;
    }) {
      const record = rows.find((r) => r.date === DATE && r.number === o.number)!;
      const field = page.getByLabel("Enter results with the workbook code");
      await field.scrollIntoViewIfNeeded();
      await field.click();
      await settle(page);
      const codeFolder = `bursts/${o.named("type-code").folder}/`;
      await mkdir(`${dir}${codeFolder}`, { recursive: true });
      const typed = record.code; // as printed, with the dash
      const codeFrames: any[] = [];
      await page.screenshot({ path: `${dir}${codeFolder}000.png` });
      codeFrames.push({ file: "000.png", value: "" });
      for (let i = 0; i < typed.length; i++) {
        await page.keyboard.type(typed[i]!);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
        const f = `${String(i + 1).padStart(3, "0")}.png`;
        await page.screenshot({ path: `${dir}${codeFolder}${f}` });
        codeFrames.push({ file: f, value: typed.slice(0, i + 1) });
      }
      states.push({
        burst: codeFolder,
        description: `Typing the printed code ${typed} into "Enter results with the workbook code", one PNG per keystroke`,
        frames: codeFrames,
        elements: await measure(historyItems().slice(1, 3)),
      });
      const n1 = o.named("history-code-typed");
      await shot(n1.slug, `Code ${typed} typed; Open is enabled`, historyItems().slice(0, 3), { settle: false, bare: n1.bare });
      await page.getByRole("button", { name: "Open", exact: true }).click();
      await page.waitForURL(/\/results$/);
      await page.getByRole("list", { name: "Problems" }).waitFor();
      await page.getByRole("heading", { name: new RegExp(`^No\\. ${o.number} `) }).waitFor();
      const problemsList = page.getByRole("list", { name: "Problems" });
      const resultItems = (): [string, Locator][] => [
        ["Title", page.locator("main h1")],
        ["Workbook code", page.locator("main [class*=summary] [class*=code]")],
        ["Recorded summary", page.locator("main [class*=summary]").first()],
        ...Array.from({ length: 10 }, (_, k) => {
          const r = problemsList.getByRole("listitem").nth(k);
          const n = k + 1;
          return [
            [`Row ${n}`, r],
            [`Row ${n} answer field`, r.getByRole("textbox", { name: "Answer" })],
            [`Row ${n} letter picker`, r.getByRole("radiogroup", { name: /^Answer to problem/ })],
            [`Row ${n} letter`, r.getByRole("radiogroup", { name: /^Answer to problem/ }).getByRole("radio")],
            [`Row ${n} Right`, r.getByRole("radio", { name: "Right", exact: true })],
            [`Row ${n} Not yet`, r.getByRole("radio", { name: "Not yet", exact: true })],
            [`Row ${n} recorded result`, r.locator("[class*=recorded]")],
          ] as [string, Locator][];
        }).flat(),
        ["Save", page.getByRole("button", { name: /result|Saving/ })],
        ["Toast", page.getByText(/results? saved\. Progress is updated\./).first()],
      ];
      await page.evaluate(() => scrollTo(0, 0));
      const nb = o.named("results-blank");
      await shot(nb.slug, `Results for No. ${o.number}: nothing entered, Save disabled`, resultItems(), { full: true, bare: nb.bare });

      const { list: problemList, entries } = plan(record, o.choose);
      const row = (n: number) => problemsList.getByRole("listitem").nth(n - 1);
      const entered: any[] = [];
      for (const e of entries) {
        const r = row(e.n);
        await r.scrollIntoViewIfNeeded();
        if (e.how === "letter") {
          await r.getByRole("radio", { name: new RegExp(`^${e.value}:`) }).click();
        } else if (e.how === "typed" && e.keystrokes) {
          const input = r.getByRole("textbox", { name: "Answer" });
          await input.click();
          // Centre the row so the keystroke frames frame it well.
          await r.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await settle(page);
          const folder = `bursts/${o.named(`type-answer-${e.n}`).folder}/`;
          await mkdir(`${dir}${folder}`, { recursive: true });
          const frames: any[] = [];
          await page.screenshot({ path: `${dir}${folder}000.png` });
          frames.push({ file: "000.png", value: "" });
          for (let i = 0; i < e.value.length; i++) {
            await page.keyboard.type(e.value[i]!);
            await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(null)))));
            const f = `${String(i + 1).padStart(3, "0")}.png`;
            await page.screenshot({ path: `${dir}${folder}${f}` });
            frames.push({ file: f, value: e.value.slice(0, i + 1) });
          }
          states.push({
            burst: folder,
            description: `No. ${o.number}: typing ${e.value} into problem ${e.n}'s answer, one PNG per keystroke`,
            frames,
            elements: await measure([
              [`Results row ${e.n}`, r],
              [`Answer field ${e.n}`, input],
              ["Save", page.getByRole("button", { name: /result/ })],
            ]),
          });
        } else if (e.how === "typed") {
          await r.getByRole("textbox", { name: "Answer" }).fill(e.value);
        } else {
          await r
            .getByRole("radio", { name: e.value === "right" ? "Right" : "Not yet", exact: true })
            .click();
        }
        const p = problemList[e.n - 1]!;
        entered.push({
          n: e.n,
          section: p.section,
          templateId: p.item.templateId,
          label: resultLabel(p.item.templateId),
          prompt: p.problem.public.prompt,
          responseKind: p.problem.public.response.kind,
          entry: e.how,
          value: e.value,
          correctAnswer: p.problem.answer,
          expectedCorrect:
            e.how === "mark" ? e.value === "right" : e.how === "typed" ? gradeAnswer(p.problem, e.value) : true,
        });
      }
      const count = entries.length;
      // The Not yet row, centred, as the partly filled frame.
      await row(o.centre).evaluate((el) => el.scrollIntoView({ block: "center" }));
      const np = o.named("results-partly-filled");
      await shot(np.slug, `Results for No. ${o.number}: ${o.partly}; Save ${count} results`, resultItems(), { full: true, bare: np.bare });
      await page.evaluate(() => scrollTo(0, 0));
      const npt = o.named("results-partly-filled-top");
      await shot(npt.slug, "Same, scrolled to the top", resultItems(), { bare: npt.bare });

      // Save (the pinned button), slowed.
      const before = attempts.length;
      await burst(
        "save",
        `No. ${o.number}: tap Save ${count} results: Saving… → rows lock as recorded, toast (CSS animations at 0.25×, 900 ms simulated latency on the POST)`,
        () => page.getByRole("button", { name: /^Save \d+ results?$/ }).evaluate((b: HTMLElement) => b.click()),
        () => page.getByText(/results? saved\. Progress is updated\./).first().waitFor(),
        { name: o.named("save").folder },
        resultItems,
      );
      await row(o.centre).evaluate((el) => el.scrollIntoView({ block: "center" }));
      const ns = o.named("results-saved");
      await shot(ns.slug, `No. ${o.number} saved: ${count} results recorded and locked, toast says progress is updated`, resultItems(), { full: true, bare: ns.bare });
      const savedSummary = await page.locator("main [class*=summary]").first().innerText();
      const recordedTexts = await problemsList.locator("[class*=recorded]").allInnerTexts();
      await page.getByRole("button", { name: "Dismiss message" }).first().click();
      await page.getByText(/results? saved\. Progress is updated\./).first().waitFor({ state: "hidden" }).catch(() => {});
      await page.evaluate(() => scrollTo(0, 0));
      const nst = o.named("results-saved-top");
      await shot(nst.slug, `No. ${o.number} saved, toast dismissed, scrolled to the top: ${savedSummary}`, resultItems(), { bare: nst.bare });
      const recorded = attempts.slice(before).map((a) => ({
        problemId: a.problemId,
        templateId: a.templateId,
        response: a.response,
        correct: a.correct,
        evidenceSource: (a as any).evidenceSource,
        evidenceWeight: (a as any).evidenceWeight ?? 1,
      }));
      return { number: o.number, code: record.code, workbookId: record.id, entered, savedSummary, recordedTexts, recorded };
    }
    const numbered = (slug: string) => ({ slug, bare: false, folder: `${String(index + 1).padStart(2, "0")}-${slug}` });
    const results1 = await enterResults({
      number: 1,
      // Letter B for 1, typed answers for 2–5 (4 key by key), Right for 6,
      // Not yet for 7; 8–10 open.
      choose: { 1: "letter", 2: "typed", 3: "typed", 4: "typed-keys", 5: "typed", 6: "right", 7: "not-yet" },
      named: numbered,
      centre: 7,
      partly: "letter B for 1, answers typed for 2–5, Right for 6, Not yet for 7",
    });

    // 6. The learner's practice afterwards: the app's home, then Go.
    batches.length = 0;
    await page.goto(`${origin}/`);
    const go = page.getByRole("button", { name: "Go", exact: true });
    await go.waitFor();
    await shot("practice-home", "The learner's app afterwards: Maya, Go", [
      ["Learner switcher", page.getByRole("button", { name: /Maya/ }).first()],
      ["Go", go],
    ]);
    await go.click();
    await page.waitForURL(/\/practice$/);
    await page.getByRole("button", { name: "Check" }).waitFor();
    await shot("practice-next-problem", "Practice: the next problem after the paper results", [
      ["Skill title", page.locator("header").first()],
      ["Prompt", page.locator("main").getByText(/\?/).first()],
      ["Answer field", page.getByRole("textbox").first()],
      ["Answer option", page.locator("main").getByRole("radio")],
      ["Check", page.getByRole("button", { name: "Check" })],
      ["Hint", page.getByRole("button", { name: "Hint" })],
      ["Skip", page.getByRole("button", { name: "Skip" })],
      ["Lesson", page.getByRole("button", { name: "Lesson" })],
    ]);
    const printedToday = new Set(
      rows.filter((r) => r.date === DATE).flatMap((r) => r.spec.sections.flatMap((x) => x.items.map((i) => i.templateId))),
    );
    const served = batches.flatMap((b) => JSON.stringify(b).match(/"templateId":"[^"]+"/g) ?? []).map((m) => m.slice(14, -1));
    const practice = {
      url: page.url().replace(origin, ""),
      prompt: (await page.locator("main").innerText()).split("\n").slice(0, 4),
      servedTemplateIds: [...new Set(served)],
      servedPrintedToday: [...new Set(served)].filter((t) => printedToday.has(t)),
    };

    // 7. Results for No. 8 (the film's close-up pages), the same states.
    await page.goto(`${origin}/learners/${learnerId}/workbooks`);
    await page.getByRole("list", { name: "Workbooks" }).waitFor();
    const results8 = await enterResults({
      number: 8,
      // Letters for 1–3, Not yet for 4, typed 5 and 6, Right for 7 (two
      // comparison symbols), 780 typed key by key for 8; 9 and 10 open.
      choose: { 1: "letter", 2: "letter", 3: "letter", 4: "not-yet", 5: "typed", 6: "typed", 7: "right", 8: "typed-keys" },
      named: (slug) => ({ slug: `results8-${slug.replace(/^results-/, "")}`, bare: true, folder: `results8-${slug.replace(/^results-/, "")}` }),
      centre: 4,
      partly: "letters A, A, B for 1–3, Not yet for 4, 10 and 25 typed for 5–6, Right for 7, 780 typed for 8",
    });

    assert.deepEqual(
      errors.filter((e) => !/Failed to load resource/.test(e) || true),
      [],
      `${name}: console errors ${errors.join(" | ")}`,
    );
    await writeFile(
      `${dir}states.json`,
      JSON.stringify(
        {
          viewport: { cssWidth: vp.width, cssHeight: vp.height, deviceScaleFactor: vp.scale, pixelWidth: vp.width * vp.scale, pixelHeight: vp.height * vp.scale },
          colorScheme: "light",
          coordinates:
            "Device pixels. `viewport` boxes are relative to the PNG (the viewport at capture); `page` boxes are document coordinates, matching the full-page PNG. scrollY/documentHeight in device pixels.",
          states,
        },
        null,
        2,
      ),
    );
    report.viewports[name] = { day, history, results: [results1, results8], practice, consoleErrors: errors };
    await context.close();
  }
} finally {
  await browser.close();
  await vite.close();
  await api.close();
}
report.composeCalls = calls;
report.missingTx = [...missingTx];
report.unhandled = [...unhandled];
report.requests = requests;
report.editorCodes = editorCodes;
await writeFile(`${OUT}capture-run.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ editorCodes, day: Object.fromEntries(Object.entries(report.viewports).map(([k, v]: any) => [k, v.day.map((d: any) => d.code)])), missingTx: report.missingTx, unhandled: report.unhandled }, null, 2));

// capture.json: provenance and what the screens show.
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--", "."], { encoding: "utf8" })
  .split("\n").filter(Boolean);
const any: any = Object.values(report.viewports)[0];
const base = `/learners/${learnerId}`;
await writeFile(
  `${OUT}capture.json`,
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      commit,
      worktree: "/Users/skyl/Code/corpora/wt/anthropic-ad-capture",
      worktreeChanges: dirty,
      script: "amp/ad-capture/workbooks-ui-capture.ts (+ workbooks-ui-hooks.mjs, workbooks-ui-compose-shim.ts); copies in entrants/anthropic/capture/",
      run: "cd amp && npx tsx ad-capture/workbooks-ui-capture.ts [phone] [tablet]",
      adaptedFrom: "amp/scripts/verify-workbooks-ui.ts",
      browser: "Playwright Chromium, headless, isMobile + hasTouch, light, en-US, America/New_York",
      viewports: {
        phone: { css: "390x844", deviceScaleFactor: 3, png: "1170x2532" },
        tablet: { css: "1024x768", deviceScaleFactor: 2, png: "2048x1536" },
      },
      fixture: {
        server: "Real Fastify app (buildApp, src/server/app.ts) via api.inject behind Playwright routing for /api/v1/learners/**, /api/v1/catalog, /api/v1/problem-lessons; real web app from the Vite dev server (random 127.0.0.1 port, not 4310)",
        fixtures: "Sign-in (src/web/auth.ts stub: parent-one), /me (scripts/me-fixture.ts, one learner Maya, birth year 2017, can practice, consent active), /trials/current null, analytics 204, PDF renderer stand-in (never exercised)",
        repository: "In memory. Learner evidence = simulateLearner(sampleLearners 'third-grade', 2026-11-02T15:00Z) (src/workbook/synthetic.ts), the editor's profile. Paper results saved on screen are added to the attempts and the evidence/frontier/recent attempts are recomputed from them (projectSkillEvidence, estimateFrontier), as the database projections do",
        learnerId,
        composition: "Workbook routes compose through amp/ad-capture/workbooks-ui-compose-shim.ts: learnerKey (seed namespace) mapped from the fixture UUID to 'third-grade' and now = 2026-11-02T15:00Z, exactly the editor's inputs, so codes match the printed PDFs. Everything else (history, recent attempts, choices, numbering) comes from the real route",
        composeCalls: report.composeCalls.slice(0, 8),
        date: DATE,
        minutes: 30,
        paper: "letter",
        choices: "mixed, at level, today's idea included",
      },
      routes: {
        learners: "/family/learners",
        make: `${base}/workbooks/${DATE}?minutes=30&paper=letter`,
        rollAnother: `${base}/workbooks/${DATE}?minutes=30&paper=letter&number=2 (… 8)`,
        history: `${base}/workbooks`,
        results: `${base}/workbooks/<workbook No. 1 id>/results`,
        practiceHome: "/",
        practice: "/practice",
        api: [
          "POST /api/v1/learners/:id/workbooks",
          "GET /api/v1/learners/:id/workbooks[?date=]",
          "GET /api/v1/learners/:id/workbooks/areas",
          "GET /api/v1/learners/:id/workbooks?code=4QNJAZNG (and WS828FSH)",
          "GET|POST /api/v1/learners/:id/workbooks/:workbookId/results",
          "POST /api/v1/learners/:id/batches",
        ],
      },
      workbooks: any.day.map((d: any, i: number) => ({
        number: d.number,
        code: d.code,
        editorCode: editorCodes[i],
        matchesEditorPdf: d.code === editorCodes[i],
        editorPdf: `captures/workbooks/third-grade/roll-${d.number}.pdf`,
        shown: d.contents.filter((l: string) => l !== "Enter results"),
        url: d.url,
      })),
      historyList: any.history,
      historyNote: "Today's eight are the rolls above. Fri Oct 30 No. 1 (30 min) and Thu Oct 29 No. 1 (45 min) were composed for those dates by the same composer and added after today's rolls, so they did not enter today's history-aware composition (the editor's PDFs had no earlier workbooks)",
      results: any.results.map((r: any) => ({
        workbook: `No. ${r.number} · ${r.code}`,
        files: r.number === 1 ? "NN-results-*.png (07–11), bursts/06-type-code, 08-type-answer-4, 10-save" : "results8-*.png, bursts/results8-type-code, results8-type-answer-8, results8-save",
        openedBy: `Typing the printed code ${r.code} into "Enter results with the workbook code" on Past workbooks, then Open`,
        url: `${base}/workbooks/${r.workbookId}/results (workbook ids are random per run)`,
        entered: r.entered,
        recordedByServer: r.recorded,
        screenAfterSave: { summary: r.savedSummary, rows: r.recordedTexts },
        open: r.number === 1
          ? "Rows 8 (skip count, 475), 9 (story operations, marked) and 10 (challenge, 0) left open"
          : "Rows 9 (make both sides equal, 6) and 10 (fractional gap, 1) left open",
      })),
      practiceAfter: Object.fromEntries(
        Object.entries(report.viewports).map(([k, v]: any) => [k, v.practice]),
      ),
      consoleErrors: Object.fromEntries(
        Object.entries(report.viewports).map(([k, v]: any) => [k, v.consoleErrors]),
      ),
      unhandledRequests: report.unhandled,
      differencesAndNotes: [
        "Family → Learners 'Make a workbook' opens today's workbook at the default 45 minutes. To match the editor's 30-minute PDFs (and keep a 45-minute No. 1 out of today's history, which would change every roll), the capture opens the same route with ?minutes=30&paper=letter directly, as the 30 min control would",
        "Seed key and clock substituted in composition only (compose shim); in production the learner key is the learner's UUID, so a real Maya's codes would differ",
        "Burst sequences use CDP Animation.setPlaybackRate 0.25 and a 900 ms delay on that one POST so the real 'Rolling…' / 'Saving…' states and the contents fade are on screen long enough to film; all stills are without delay",
        "Full-page PNGs set the pinned Save bar to static so it prints after the list instead of mid-page, and hide the floating toast; viewport PNGs show both as on a device",
        "The practice problem after saving is drawn by the real planner from live evidence; it varies between runs (phone and tablet differ). servedPrintedToday lists any template printed in today's workbooks (held back for 24 h per the docs): none",
        "No. 8's results were entered after No. 1's and after the practice shots; its problems were composed before any results, after Nos. 1–7, as in the editor's PDFs",
        "Product observations at 390 px (live build, not changed): the 'Roll another' label runs to its right border; on Past workbooks the row title wraps 'Mon, Nov 2, 2026 · No.' / '4'; a reserved blank band sits under the code field (space kept for its error message)",
      ],
    },
    null,
    2,
  ),
);
console.log(`Wrote ${OUT}capture.json`);
