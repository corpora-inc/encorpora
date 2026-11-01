/**
 * A realistic, disposable AMP for app-shell browser checks: the real API in
 * accounts mode (loopback only) against a fixture database, the web app
 * (dev server or the built bundle), and three parents created through the
 * real sign-up endpoint:
 *
 * - `paid`: consent, two learners with access, weeks of mixed practice for
 *   Jordan and none for Avery;
 * - `fresh`: just signed up;
 * - `trial`: in the free assessment with a few problems seen.
 *
 * Every screen a test visits reads this data through the real routes.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer, preview } from "vite";
import { generateProblem, templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { PostgresRepository } from "../src/server/repository";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { shiftRecorder } from "./app-shell-probe";

export type ShellState = "guest" | "new" | "trial" | "paid";
type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

function startApi(url: string, origin: string, apiPort: number) {
  const child = spawn("npx", ["tsx", "src/server/main.ts"], {
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
  const trial = await signUp(setup, "trial");
  {
    // The trial parent picks a birth year and skips a few problems, so the
    // map and the plan screen have evidence to show.
    const context = await setup.newContext({ storageState: trial.state });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto(`${origin}/try`);
    await page.getByRole("button", { name: "2014", exact: true }).click();
    await page.getByRole("button", { name: "Start practicing" }).click();
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
    trial.state = await context.storageState();
    await context.close();
  }
  await setup.close();

  const states: Record<ShellState, StorageState | undefined> = {
    guest: undefined,
    new: fresh.state,
    trial: trial.state,
    paid: paidParent.state,
  };
  return {
    origin,
    pool,
    paid: { ...paidParent, jordan, avery },
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
      if (state === "paid")
        await context.addInitScript(
          `localStorage.setItem('amp.learner', JSON.stringify({state:{learnerId:${JSON.stringify(jordan.id)}},version:1}))`,
        );
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
      ready: heading(/Try one math problem/),
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
      id: "try-start",
      path: "/try",
      state: "guest",
      ready: heading(/Math that adapts/),
    },
    {
      id: "account-ready",
      path: "/account/ready",
      state: "new",
      ready: heading(/account is ready/),
    },
    {
      id: "try-start-signed-in",
      path: "/try",
      state: "new",
      ready: heading(/See how AMP adapts/),
    },
    {
      id: "trial-map",
      path: "/try/map",
      state: "trial",
      ready: (p) => p.locator(".frontier-map").waitFor(),
    },
    {
      id: "trial-plans",
      path: "/try/plans",
      state: "trial",
      ready: heading(/Choose a plan/),
    },
    {
      id: "home",
      path: "/",
      state: "paid",
      // Settled once the working level has loaded (aria-busy clears).
      ready: (p) =>
        p.locator(".home-level:not([aria-busy=true])").first().waitFor(),
    },
    {
      id: "drawer",
      path: "/",
      state: "paid",
      ready: (p) => p.locator(".frontier-map").waitFor(),
      then: async (p) => {
        await p.locator("[data-navigation-trigger]").click();
        await p.getByRole("dialog").waitFor();
        await p.getByRole("link", { name: /Your level/ }).waitFor();
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
      ready: (p) => p.locator("[data-progress-views]").waitFor(),
    },
    {
      id: "pathway-skill",
      path: `/pathways/${f.practisedSkill}`,
      state: "paid",
      ready: (p) => p.locator("h1").first().waitFor(),
    },
    {
      id: "inventory",
      path: "/inventory",
      state: "paid",
      ready: (p) => p.locator("[data-progress-views]").waitFor(),
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
      ready: (p) => p.locator(".family-tabs").waitFor(),
    },
    {
      id: "family-access",
      path: "/family/access",
      state: "paid",
      ready: (p) => p.locator(".family-tabs").waitFor(),
    },
    {
      id: "family-privacy",
      path: "/family/privacy",
      state: "paid",
      ready: (p) => p.locator(".family-tabs").waitFor(),
    },
    {
      id: "family-security",
      path: "/family/security",
      state: "paid",
      ready: (p) => p.locator(".family-tabs").waitFor(),
    },
    { id: "purchase", path: "/purchase", state: "paid" },
    { id: "birth-year", path: "/profile/birth-year", state: "paid" },
  ];
}
