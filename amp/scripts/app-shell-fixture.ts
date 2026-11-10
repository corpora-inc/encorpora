import { secureChromium } from "../browser-security.mjs";
/**
 * A realistic, disposable AMP for app-shell browser checks: the real API in
 * accounts mode (loopback only) against a fixture database, the web app
 * (dev server or the built bundle), and three parents created through the
 * real sign-up endpoint:
 *
 * - `paid`: consent, two learners with access, weeks of mixed practice for
 *   Jordan and none for Avery;
 * - `new`: just signed up, so `/` opens "What brings you to AMP?";
 * - `starter`: answered it as a parent of one child (an unnamed learner in
 *   the family's class, on the free problems) and skipped a few problems as
 *   that child.
 *
 * Every screen a test visits reads this data through the real routes.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer, preview } from "vite";
import { generateProblem, templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { PostgresRepository } from "../src/server/repository";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { shiftRecorder } from "./app-shell-probe";

export type ShellState = "guest" | "new" | "starter" | "paid";
type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

function startApi(url: string, origin: string, apiPort: number) {
  // `AMP_FIXTURE_COMPILED_API=1` runs what production runs (`npm run build:server`).
  const [command, ...args] = process.env.AMP_FIXTURE_COMPILED_API
    ? ["node", "--no-flush-bytecode", "src/server/main.mjs"]
    : ["npx", "tsx", "src/server/main.ts"];
  const child = spawn(command!, args, {
    env: {
      ...process.env,
      AMP_DATABASE_URL: url,
      AMP_AUTH_MODE: "accounts",
      AMP_HOSTED_PILOT_READY: "true",
      AMP_ACCOUNTS_URL: origin,
      AMP_ACCOUNTS_SECRET: "synthetic-app-shell-fixture-secret-0123456789",
      AMP_PORT: String(apiPort),
      AMP_HOST: "127.0.0.1",
      NODE_ENV: "development",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  // npx and tsx each fork; stop the whole group with this process.
  const stop = () => {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      // Already stopped.
    }
  };
  process.on("exit", stop);
  for (const event of ["uncaughtException", "unhandledRejection"] as const)
    process.on(event, (error) => {
      console.error(error);
      stop();
      process.exit(1);
    });
  return new Promise<() => void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("API did not start")), 90000);
    child.stdout!.on("data", (chunk: Buffer) => {
      if (String(chunk).includes("Server listening")) {
        clearTimeout(timer);
        resolve(stop);
      }
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      if (/error/i.test(String(chunk))) process.stderr.write(chunk);
    });
    child.on("exit", (code) => reject(Error(`API exited ${code}`)));
  });
}

/** An init script that makes `learnerId` this device's current learner
 * (learner-store.ts). */
const chooseLearner = (learnerId: string) =>
  `localStorage.setItem('amp.learner', JSON.stringify({state:{learnerId:${JSON.stringify(learnerId)}},version:1}))`;

export async function startShellFixture({
  production = false,
  webPort = 4920,
}: { production?: boolean; webPort?: number } = {}) {
  const url = process.env.AMP_TEST_DATABASE_URL;
  if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
  assertTestDatabaseTarget(url);
  await migrate(url);
  const apiPort = webPort + 1;
  const origin = `http://127.0.0.1:${webPort}`;
  const stopApi = await startApi(url, origin, apiPort);
  const serverOptions = {
    watch: { ignored: ["**/artifacts/**"] },
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${apiPort}` } },
  };
  const apiEnvironment = process.env.NODE_ENV;
  const vite = production
    ? await preview({ preview: serverOptions })
    : await createServer({ server: serverOptions });
  // Preview mutates NODE_ENV; keep this process's environment unchanged.
  if (apiEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = apiEnvironment;
  if ("listen" in vite) await vite.listen();

  const pool = new pg.Pool({ connectionString: url });
  const repository = new PostgresRepository(url, { development: false });

  async function signUp(browser: Browser, label: string) {
    const context = await browser.newContext();
    const email = `${label}-${randomUUID().slice(0, 8)}@example.com`;
    const response = await context.request.post(
      `${origin}/api/auth/sign-up/email`,
      {
        headers: { Origin: origin },
        data: {
          email,
          password: "synthetic long fixture passphrase",
          name: "",
        },
      },
    );
    if (!response.ok())
      throw Error(`sign-up ${response.status()} ${await response.text()}`);
    const session = await (
      await context.request.get(`${origin}/api/auth/get-session`)
    ).json();
    const state = await context.storageState();
    await context.close();
    return { email, account: `amp|${session.user.id as string}`, state };
  }

  /** A few weeks of mixed practice across grades 2–6, most of it right. */
  async function seedPractice(account: string, learnerId: string) {
    const candidates = skills
      .filter((s) => ["2", "3", "4", "5", "6"].includes(s.gradeBand))
      .map((s) => templates.find((t) => t.skillId === s.id))
      .filter((t): t is (typeof templates)[number] => !!t);
    const chosen = candidates.filter((_, i) => i % 4 === 0).slice(0, 48);
    const now = Date.now(),
      hour = 3600000;
    await repository.transaction(account, learnerId, async (tx) => {
      let i = 0;
      for (const template of chosen)
        for (let k = 0; k < 3; k++, i++) {
          const p = generateProblem(template.id, randomUUID());
          await tx.saveProblem(p);
          const correct = i % 5 !== 2;
          const wrong =
            p.public.response.kind === "choice"
              ? p.public.response.options.find((o) => o.id !== p.answer)!.id
              : p.answer === "99999"
                ? "99998"
                : "99999";
          await tx.saveAttempt({
            id: randomUUID(),
            requestId: randomUUID(),
            problemId: p.public.id,
            skillId: p.public.skillId,
            templateId: template.id,
            response: correct ? p.answer : wrong,
            correct,
            assisted: i % 11 === 0,
            answer: p.answer,
            explanation: p.explanation,
            createdAt: new Date(
              now - (chosen.length * 3 - i) * 6 * hour,
            ).toISOString(),
          });
        }
    });
    return chosen.map((t) => t.skillId);
  }

  const setup = await chromium.launch();
  const paidParent = await signUp(setup, "paid");
  await pool.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [paidParent.account],
  );
  const jordan = await repository.create(paidParent.account, "Jordan", 2015);
  const avery = await repository.create(paidParent.account, "Avery", 2018);
  for (const learner of [jordan, avery])
    await pool.query(
      "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '20 days',now()+interval '345 days')",
      [`fixture-${learner.id}`, learner.id],
    );
  const practised = await seedPractice(paidParent.account, jordan.id);
  const fresh = await signUp(setup, "new");
  const starter = await signUp(setup, "starter");
  let starterLearner: string;
  {
    // The starter parent answers "What brings you to AMP?" with one child,
    // then skips a few problems as that child, so the Overview has evidence
    // to show.
    const context = await setup.newContext({ storageState: starter.state });
    const session = await (
      await context.request.get(`${origin}/api/auth/get-session`)
    ).json();
    const answered = await context.request.post(`${origin}/api/v1/start`, {
      headers: {
        authorization: `Bearer ${session.session.token as string}`,
        Origin: origin,
      },
      data: { as: "parent", children: [{ birthYear: 2014 }] },
    });
    if (!answered.ok())
      throw Error(`starter ${answered.status()} ${await answered.text()}`);
    const chosen = ((await answered.json()) as { learnerId?: string })
      .learnerId;
    if (!chosen) throw Error("The starter made no learner");
    starterLearner = chosen;
    await context.addInitScript(chooseLearner(starterLearner));
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto(`${origin}/practice`);
    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: /^Skip/ }).click();
      await page.getByRole("button", { name: /^Next/ }).click();
      const more = await page
        .getByRole("button", { name: /^Skip/ })
        .waitFor({ timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      if (!more) break;
    }
    starter.state = await context.storageState();
    await context.close();
  }
  const states: Record<ShellState, StorageState | undefined> = {
    guest: undefined,
    new: fresh.state,
    starter: starter.state,
    paid: paidParent.state,
  };
  // Sign-in endpoints allow 60 requests a minute per address, which a sweep
  // of hundreds of page loads exceeds. Each state's real session response is
  // read once here and replayed, so every screen still gets its real session.
  const sessions = {} as Record<ShellState, unknown>;
  for (const state of Object.keys(states) as ShellState[]) {
    const context = await setup.newContext({ storageState: states[state] });
    sessions[state] = await (
      await context.request.get(`${origin}/api/auth/get-session`)
    ).json();
    await context.close();
  }
  await setup.close();
  return {
    origin,
    pool,
    paid: { ...paidParent, jordan, avery },
    starter: { ...starter, learnerId: starterLearner },
    practisedSkill: practised[3]!,
    lessonId:
      lessons.find((l) => l.id.includes("fraction"))?.id ?? lessons[0]!.id,
    /** A browser context signed in as `state`, recording layout movement. */
    async context(
      browser: Browser,
      state: ShellState,
      options: Parameters<Browser["newContext"]>[0] = {},
    ) {
      const context = await browser.newContext({
        ...options,
        storageState: states[state],
      });
      await context.addInitScript(shiftRecorder);
      await context.route("**/api/auth/get-session*", (route) =>
        route.fulfill({ json: sessions[state] }),
      );
      if (state === "paid")
        await context.addInitScript(chooseLearner(jordan.id));
      if (state === "starter")
        await context.addInitScript(chooseLearner(starterLearner));
      return context;
    },
    async close() {
      await pool.end();
      await repository.pool.end();
      stopApi();
      await vite.close?.();
    },
  };
}
export type ShellFixture = Awaited<ReturnType<typeof startShellFixture>>;

export type Scenario = {
  id: string;
  path: string;
  state: ShellState;
  /** Something that shows the screen has settled. */
  ready?: (page: Page) => Promise<unknown>;
  /** Interaction after load (open a drawer, expand a section). */
  then?: (page: Page) => Promise<unknown>;
};

const heading = (name: RegExp | string) => (page: Page) =>
  page.getByRole("heading", { name }).first().waitFor();

/** Every screen outside the practice flow. */
export function shellScenarios(f: ShellFixture): Scenario[] {
  return [
    {
      id: "landing",
      path: "/",
      state: "guest",
      ready: heading(/See how far your child can go in math/),
    },
    {
      id: "sign-in",
      path: "/sign-in",
      state: "guest",
      ready: heading(/^Sign in$/),
    },
    {
      id: "sign-up",
      path: "/sign-up",
      state: "guest",
      ready: heading(/Create your account/),
    },
    {
      id: "forgot-password",
      path: "/sign-in/forgot",
      state: "guest",
      ready: heading(/Reset your password/),
    },
    {
      // Ads and email still link to /try: a visitor without an account
      // signs up.
      id: "try-start",
      path: "/try",
      state: "guest",
      ready: heading(/Create your account/),
    },
    {
      id: "account-ready",
      path: "/account/ready",
      state: "new",
      ready: heading(/account is ready/),
    },
    {
      // Signed in, /try opens `/`, which asks a new account the starter's
      // question.
      id: "try-start-signed-in",
      path: "/try",
      state: "new",
      ready: heading(/What brings you to AMP\?/),
    },
    {
      // A parent's first child, a few problems in: their Overview.
      id: "starter-overview",
      path: "/overview",
      state: "starter",
      ready: (p) => p.locator('.frontier-map[aria-busy="false"]').waitFor(),
    },
    {
      // The Overview has its own address; `/` opens a family's class.
      id: "home",
      path: "/overview",
      state: "paid",
      // The retained chart settles when its actual frontier has loaded.
      ready: (p) => p.locator('.frontier-map[aria-busy="false"]').waitFor(),
    },
    {
      id: "drawer",
      path: "/overview",
      state: "paid",
      ready: (p) => p.locator(".frontier-map").waitFor(),
      then: async (p) => {
        await p.locator("[data-navigation-trigger]").click();
        await p.getByRole("dialog").waitFor();
        await p.getByRole("link", { name: /^Progress/ }).waitFor();
        await p.waitForTimeout(400);
      },
    },
    {
      id: "progress",
      path: "/progress",
      state: "paid",
      ready: (p) => p.locator(".progress-skill-card").first().waitFor(),
    },
    {
      id: "pathways",
      path: "/pathways",
      state: "paid",
      ready: (p) => p.locator("[data-app-bar] [data-tabs]").waitFor(),
    },
    {
      id: "pathway-skill",
      path: `/pathways/${f.practisedSkill}`,
      state: "paid",
      ready: (p) => p.getByRole("button", { name: "Close skill" }).waitFor(),
    },
    {
      id: "inventory",
      path: "/inventory",
      state: "paid",
      ready: (p) => p.locator("[data-app-bar] [data-tabs]").waitFor(),
    },
    {
      id: "lessons",
      path: "/lessons",
      state: "paid",
      ready: heading(/^Lessons$/),
    },
    {
      id: "lesson-reader",
      path: `/lessons/${f.lessonId}`,
      state: "paid",
      ready: (p) => p.locator(".lesson-reader h2").first().waitFor(),
    },
    {
      id: "family-learners",
      path: "/family/learners",
      state: "paid",
      ready: (p) => p.locator(".family-body").waitFor(),
    },
    {
      id: "family-access",
      path: "/family/access",
      state: "paid",
      ready: (p) => p.locator(".family-body").waitFor(),
    },
    {
      id: "family-privacy",
      path: "/family/privacy",
      state: "paid",
      ready: (p) => p.locator(".family-body").waitFor(),
    },
    {
      id: "family-security",
      path: "/family/security",
      state: "paid",
      ready: (p) => p.locator(".family-body").waitFor(),
    },
    {
      id: "workbooks",
      path: `/learners/${f.paid.jordan.id}/workbooks`,
      state: "paid",
      ready: heading(/^Workbooks$/),
    },
    { id: "purchase", path: "/purchase", state: "paid" },
    { id: "birth-year", path: "/profile/birth-year", state: "paid" },
  ];
}
