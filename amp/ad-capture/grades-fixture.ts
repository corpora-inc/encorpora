/**
 * The real AMP web app (Vite dev server, real routes) against the real
 * Fastify learning API (buildApp) with an in-memory repository for one
 * synthetic learner, Maya (src/workbook/synthetic.ts "third-grade": 14 days
 * of real mixed practice). Sign-in and the family summary are fixtures, as in
 * scripts/verify-workbooks-ui.ts. No database, no shared ports.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import type { Page } from "playwright";
import { buildApp } from "../src/server/app";
import {
  ApiError,
  type LearnerTransaction,
  type Outcome,
  type Repository,
  type SavedProblem,
} from "../src/server/repository";
import {
  defaultPracticeSettings,
  type PracticeSettings,
} from "../src/learning/practice-settings";
import { sampleLearners, simulateLearner } from "../src/workbook/synthetic";
import { retentionNotice } from "../src/family/contracts";
import { fixtureMe } from "../scripts/me-fixture";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import { historicalTemplates } from "../src/math/historical-templates";
import { guessChanceOf } from "../src/math/guess-chance";
import { estimateFrontier, initialLevel } from "../src/learning/frontier";
import { projectSkillEvidence } from "../src/server/evidence";
import { templateGrade } from "../src/server/mixed-practice";
import { trendCounts } from "../src/learning/level-check";
import { masteredSkills } from "../src/server/trial-progress";
import type { WorkbookRecord } from "../src/workbook/contracts";

export const PROFILE = "third-grade";
export const learnerId = "5d3c1b2a-0f9e-4d8c-8b7a-6e5f4d3c2b1a";
const account = "parent-one";
const birthYear = 2017;

export async function startGradesFixture(now = Date.now()) {
  const profile = sampleLearners.find((l) => l.id === PROFILE)!;
  const simulated = simulateLearner(profile, now);
  const attempts: Outcome[] = [...simulated.attempts];
  const problems = new Map<string, SavedProblem>();
  const workbooks: WorkbookRecord[] = [];
  let settings: PracticeSettings = defaultPracticeSettings();
  const changes = new Map<string, { change: any; result: PracticeSettings }>();
  const byId = new Map(
    [...templates, ...historicalTemplates].map((t) => [t.id, t]),
  );
  const nodes = new Map(skills.map((s) => [s.id, s]));
  const start = initialLevel({ birthYear, now });
  const frontierOf = (list: readonly Outcome[], at = Date.now()) =>
    estimateFrontier({
      start,
      observations: list,
      now: at,
      gradeOf: (id) => {
        const t = byId.get(id);
        return t && templateGrade(t, nodes);
      },
      strandOf: (id) => nodes.get(byId.get(id)?.skillId ?? "")?.strand ?? id,
      guessOf: guessChanceOf,
    });

  const tx: LearnerTransaction = {
    practiceSettings: async () => settings,
    practiceChange: async (requestId) => changes.get(requestId),
    savePracticeChange: async (change, result) => {
      changes.set(change.requestId, { change, result });
      settings = result;
    },
    startingPoint: async () => ({
      band: null,
      policyVersion: null,
      excludedStrands: [],
    }),
    setStartingPoint: async () => undefined,
    setBirthYear: async () => undefined,
    satMathFocus: async () => false,
    setSatMathFocus: async () => undefined,
    frontier: async (at?: number) => frontierOf(attempts, at),
    recentAttempts: async () => attempts.slice(-12),
    skillEvidence: async () => projectSkillEvidence(attempts),
    attemptByRequest: async (id) => attempts.find((a) => a.requestId === id),
    attemptByProblem: async (id) => attempts.find((a) => a.problemId === id),
    progress: async (skillIds) => {
      const bySkill = new Map(
        projectSkillEvidence(attempts).map((e) => [e.skillId, e]),
      );
      return skillIds.map((skillId) => {
        const state = bySkill.get(skillId);
        return {
          skillId,
          attempts: state?.attempts ?? 0,
          independentCorrect: state?.independentCorrect ?? 0,
          recentIndependentCorrect: state?.recentIndependentCorrect ?? 0,
          status: state?.status ?? "new",
          lastPracticedAt: state?.lastPracticedAt ?? null,
          reviewDueAt:
            state?.reviewDueAt == null
              ? null
              : new Date(state.reviewDueAt).toISOString(),
          independentOccasions: state?.creditedRetrievals ?? 0,
          recent: (state?.recentOutcomes ?? []).map(
            ({ correct, assisted, createdAt }) => ({
              correct,
              assisted,
              at: createdAt,
            }),
          ),
        };
      });
    },
    problem: async (id) => problems.get(id),
    saveProblem: async (p) => {
      problems.set(p.public.id, p);
    },
    saveAttempt: async (o) => {
      attempts.push(o);
    },
    saveSkip: async (p) => {
      problems.set(p.public.id, p);
    },
    recentSkips: async () =>
      [...problems.values()]
        .filter((p) => p.skipped)
        .map((p) => ({
          templateId: p.public.templateId,
          skillId: p.public.skillId,
          createdAt: p.skippedAt!,
        }))
        .slice(-12) as any,
    hasAccess: async () => true,
    trialRemaining: async () => null,
    trialProgress: async () => null,
    masteredSkills: async () => masteredSkills(projectSkillEvidence(attempts)),
    frontierAfter: async (n) => frontierOf(attempts.slice(0, n)),
    frontierTrend: async () =>
      trendCounts(attempts.length).map((answered) => {
        const { level, sd } = frontierOf(attempts.slice(0, answered)).overall;
        return { answered, level, sd };
      }),
    trialPaywall: async () => {
      throw new ApiError(404, "Trial not found");
    },
    birthYear: async () => birthYear,
    flag: async () => undefined,
    saveFlag: async () => undefined,
    workbooks: async (date) =>
      workbooks.filter((r) => !date || r.date === date).map((r) => ({ ...r })),
    workbook: async (id) => workbooks.find((r) => r.id === id),
    saveWorkbook: async (r) => {
      workbooks.push(r);
      return r;
    },
    setWorkbookPaper: async () => undefined,
    workbookByCode: async (code) => workbooks.find((r) => r.code === code),
    recentWorkbooks: async () => [],
  };
  const repository = {
    hasConsent: async () => true,
    list: async () => [{ id: learnerId, name: "Maya", birthYear }],
    transaction: async <T>(
      _account: string,
      id: string,
      run: (t: LearnerTransaction) => Promise<T>,
    ) => {
      if (id !== learnerId) throw new ApiError(404, "Learner not found");
      return run(tx);
    },
  } as unknown as Repository;
  const api = buildApp({
    repository,
    development: true,
    authenticate: async () => account,
  });

  const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
  const auth = `export async function accessSession(){return {token:"${account}",accountId:"${account}"};}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
  const vite = await createServer({
    configFile: new URL("../vite.config.ts", import.meta.url).pathname,
    cacheDir: "node_modules/.vite-grades-capture",
    logLevel: "warn",
    plugins: [
      {
        name: "grades-capture-auth",
        enforce: "pre",
        load(id) {
          return id.split("?")[0] === authPath ? auth : undefined;
        },
        configureServer(server) {
          server.middlewares.use("/api/v1/events", (_q, response) => {
            response.statusCode = 204;
            response.end();
          });
        },
      },
    ],
    server: { host: "127.0.0.1", port: Number(process.env.GRADES_PORT ?? 4787), strictPort: true, hmr: false },
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
        recordedAt: "2026-10-01",
        withdrawnAt: null,
      },
      learners: [
        {
          id: learnerId,
          name: "Maya",
          birthYear,
          deletedAt: null,
          access: [],
          stripeLinked: false,
          canPractice: true,
        },
      ],
      retained: retentionNotice,
    },
    account,
  );
  const unhandled = new Set<string>();

  async function attach(page: Page) {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      if (path.endsWith("/v1/me")) return route.fulfill({ json: me });
      if (path.endsWith("/trials/current") && request.method() === "GET")
        return route.fulfill({ json: { trial: null } });
      if (path.endsWith("/auth-config"))
        return route.fulfill({
          json: { mode: "accounts", passwords: true, providers: [] },
        });
      if (path.includes("/events"))
        return route.fulfill({ status: 204, body: "" });
      const response = await api.inject({
        method: request.method() as "GET" | "POST",
        url: path + url.search,
        headers: {
          authorization: request.headers().authorization ?? "",
          ...(request.postData() ? { "content-type": "application/json" } : {}),
        },
        payload: request.postData() ?? undefined,
      });
      if (response.statusCode === 404) unhandled.add(`${request.method()} ${path}`);
      return route.fulfill({
        status: response.statusCode,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([k, v]) => [k, String(v)]),
        ),
        body: response.rawPayload,
      });
    });
    return errors;
  }
  return {
    origin,
    attach,
    attempts,
    problems,
    unhandled,
    simulated,
    /** Back to the synthetic history only: each viewport's session starts
     * from the same 252 answers. */
    reset: () => {
      attempts.splice(simulated.attempts.length);
      problems.clear();
      workbooks.length = 0;
      changes.clear();
      settings = defaultPracticeSettings();
    },
    close: async () => {
      await vite.close();
      await api.close();
    },
  };
}
