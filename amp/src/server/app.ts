import { satPracticeEligible } from "../curriculum/sat.js";
import {
  assertPracticePolicy,
  type PracticePolicy,
} from "../learning/practice-policy.js";
import fp from "fastify-plugin";
import { registerBookRoutes } from "../books/routes.js";
import { readFile } from "node:fs/promises";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { z, ZodError } from "zod";
import { createHash, randomUUID } from "node:crypto";
import {
  clientCanDraw,
  figureCapabilities,
  responseCapabilities,
  generatedProblemSchema,
  type PublicProblem,
  type ProblemHint,
} from "../math/contracts";
import {
  generateProblemFor,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../math/engine";
import { skills } from "../curriculum/catalog";
import { auditCurriculum } from "../curriculum/audit";
import {
  ApiError,
  type Outcome,
  type Repository,
  type SavedProblem,
} from "./repository";
import type { Authenticator } from "./auth";
import { planMixedPractice } from "./mixed-practice";
import { SKIP_USES_FREE_PROBLEM } from "../learning/skip";
import { isTrialAccount, trialLimits } from "./trials";
import { hasProblemLesson, problemLesson } from "../content/problem-lessons";
import { lessons } from "../content/lessons";
import { startingBands } from "../learning/starting-point";
import { buildInfo } from "./build-info";
import { brand } from "../brand";
import { FLAG_RATE_LIMIT, problemFlagSchema } from "../feedback/problem-flags";
import {
  canonicalSelection,
  normalizeSelection,
} from "../math/selection-response";
import { canonicalPointSet, normalizePointPlot } from "../math/point-plot";
import {
  canonicalMultiPart,
  multiPartFeedback,
  multiPartMarks,
  normalizeMultiPart,
} from "../math/multi-part-choice";
import {
  markStructuredWork,
  normalizeStructuredWork,
  structuredWorkFeedback,
} from "../math/structured-work";
import { recordProblemFlag } from "../feedback/record";
import {
  publicJson,
  sendPublicJson,
  type PublicJson,
} from "./public-content-cache";
const idSchema = z.string().uuid();
const paramsSchema = z.object({ learnerId: idSchema });
const birthYearSchema = z.number().int().min(1900).max(2100);
const attemptSchema = z
  .object({
    problemId: z.string().min(1).max(160),
    requestId: idSchema,
    response: z.string().trim().min(1).max(200),
    hintViewed: z.boolean().optional(),
  })
  .strict();
/** Strips one-time secrets (password-reset and verification tokens, OAuth
 * codes) from a URL before it is logged. */
export function redactUrl(url: string) {
  const parsed = new URL(url, "http://local");
  const path = parsed.pathname.replace(
    /^(\/api\/auth\/reset-password\/)[^/]+/,
    "$1[redacted]",
  );
  for (const key of [
    "token",
    "code",
    "state",
    "callbackURL",
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "oppref",
    "fbc",
    "fbp",
  ])
    if (parsed.searchParams.has(key))
      parsed.searchParams.set(key, "[redacted]");
  return path + (parsed.search ? decodeURIComponent(parsed.search) : "");
}

/** Requests per minute per credential, or per address when anonymous. */
export const GLOBAL_RATE_LIMIT = 600;
type AppOptions = {
  /** Trusted service configuration, never accepted from a practice request. */
  practicePolicy?: PracticePolicy;
  repository: Repository;
  authenticate: Authenticator;
  development?: boolean;
  logger?: boolean;
  bookPublicationDirectory?: string;
  /** Load-balancer addresses (CIDRs) whose X-Forwarded-For is believed, so
   * rate limits apply per visitor rather than per proxy. Empty: none. */
  trustedProxies?: readonly string[];
};
export function buildApp(options: AppOptions) {
  if (options.practicePolicy) assertPracticePolicy(options.practicePolicy);
  if (options.development && process.env.NODE_ENV === "production")
    throw new Error("Development mode is forbidden in production");
  const app = Fastify({
    logger: options.logger
      ? {
          serializers: {
            req: (request) => ({
              method: request.method,
              url: redactUrl(request.url),
              remoteAddress: request.ip,
            }),
          },
        }
      : false,
    bodyLimit: 32 * 1024,
    // Router errors occur before hooks; mark them private too.
    frameworkErrors: (error, _request, reply) => {
      const status = error.statusCode ?? 500;
      const body = JSON.stringify({
        error: status < 500 ? "Bad Request" : "Internal Server Error",
        code: error.code,
        message:
          status < 500 ? error.message : "Unable to complete the request",
        statusCode: status,
      });
      reply.raw.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      reply.raw.end(body);
    },
    trustProxy: options.trustedProxies?.length
      ? [...options.trustedProxies]
      : false,
  });
  // Apply this before the rate limiter so even an early 429 cannot be cached.
  // Only the two successful public-content routes override it.
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    if (reply.statusCode >= 400) {
      reply.header("Cache-Control", "no-store");
      reply.removeHeader("ETag");
      reply.removeHeader("Content-Encoding");
      reply.removeHeader("Vary");
    }
    return payload;
  });
  // Signed-in requests are limited per credential, so a household or co-op
  // behind one address is not throttled as one client; anonymous requests
  // are limited per client address.
  app.register(rateLimit, {
    max: GLOBAL_RATE_LIMIT,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      const credential = request.headers.authorization;
      return credential
        ? `credential:${createHash("sha256").update(credential).digest("hex")}`
        : `address:${request.ip}`;
    },
  });
  // Routes load after the limiter so its per-route hook sees every route;
  // fastify-plugin keeps hooks and the error handler on the root instance.
  app.register(fp(async (app) => routes(app, options)));
  return app;
}

function routes(app: FastifyInstance, options: AppOptions) {
  // Fastify's default 404 logs the raw URL; this one logs it redacted.
  app.setNotFoundHandler((request, reply) => {
    request.log.info(
      `Route ${request.method}:${redactUrl(request.url)} not found`,
    );
    return reply.code(404).send({ error: "Not found" });
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: "Invalid request",
        details: error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      });
    if (error instanceof ApiError)
      return reply.code(error.statusCode).send({ error: error.message });
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode < 500
    )
      return reply.code(error.statusCode).send({ error: error.message });
    app.log.error(error);
    return reply
      .code(500)
      .send({ error: "Unable to complete the request. Please try again." });
  });
  // Practice routes also accept an anonymous trial token. Family, billing,
  // consent and export routes are registered with the parent authenticator
  // alone, so a trial token can never reach them.
  async function learningAccount(request: Parameters<Authenticator>[0]) {
    const trial = request.headers.authorization?.match(
      /^Trial ([A-Za-z0-9_-]{20,100})$/,
    )?.[1];
    if (!trial) return options.authenticate(request);
    const account = await options.repository.trialAccount(trial);
    if (!account) throw new ApiError(401, "This free trial has ended");
    return account;
  }
  async function parent(request: Parameters<Authenticator>[0]) {
    const account = await learningAccount(request);
    if (!options.development && !(await options.repository.hasConsent(account)))
      throw new ApiError(
        403,
        "Verified parent consent is required. Open Family → Privacy → Learning consent to review enrollment.",
      );
    return account;
  }
  // `commit` and `builtAt` name the running release (null in a local build).
  const build = buildInfo();
  app.get("/api/v1/health", async () => ({
    ok: true,
    product: brand.name,
    version: 1,
    ...build,
  }));
  // Identity binding precedes learning consent; this endpoint grants no access.
  app.get("/api/v1/session", async (request) => ({
    accountId: await options.authenticate(request),
  }));
  const lessonCache = new Map<string, PublicJson>();
  app.get("/api/v1/problem-lessons/:templateId", async (request, reply) => {
    const { templateId } = z
      .object({ templateId: z.string().max(100) })
      .parse(request.params);
    if (!hasProblemLesson(templateId))
      throw new ApiError(404, "Lesson not found");
    let cached = lessonCache.get(templateId);
    if (!cached) {
      cached = publicJson({ lesson: problemLesson(templateId, "library") });
      lessonCache.set(templateId, cached);
    }
    return sendPublicJson(request, reply, cached);
  });
  let catalogCache: PublicJson | undefined;
  app.get("/api/v1/catalog", async (request, reply) => {
    catalogCache ??= publicJson({
      templates,
      lessons,
      skills,
      coverage: auditCurriculum(),
      mode: options.development ? "development" : "hosted",
      // The free practice a visitor gets before the paywall.
      trial: options.repository.limits ?? trialLimits(),
    });
    return sendPublicJson(request, reply, catalogCache);
  });
  app.get("/api/v1/learners", async (request) => ({
    learners: await options.repository.list(await parent(request)),
  }));
  app.post("/api/v1/learners", async (request, reply) => {
    const account = await parent(request);
    if (isTrialAccount(account))
      throw new ApiError(403, "Create an account to add learners");
    const { name, birthYear } = z
      .object({
        name: z.string().trim().min(1).max(60),
        birthYear: birthYearSchema.optional(),
      })
      .strict()
      .parse(request.body);
    return reply
      .code(201)
      .send(await options.repository.create(account, name, birthYear));
  });
  app.get("/api/v1/learners/:learnerId/progress", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const { skill } = z
      .object({ skill: z.string().min(1).max(100).optional() })
      .parse(request.query);
    const available = [...new Set(templates.map((t) => t.skillId))];
    return options.repository.transaction(account, learnerId, async (tx) => ({
      asOf: new Date().toISOString(),
      // Answer feedback needs one skill, not the full learning inventory.
      skills: await tx.progress(
        skill ? available.filter((id) => id === skill) : available,
      ),
    }));
  });
  app.get("/api/v1/learners/:learnerId/frontier", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    return options.repository.transaction(account, learnerId, async (tx) => {
      // Estimates, uncertainty and evidence counts per strand.
      return tx.frontier();
    });
  });
  app.post("/api/v1/learners/:learnerId/practice-settings", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const { satMathFocus } = z
      .object({ satMathFocus: z.boolean() })
      .strict()
      .parse(request.body);
    return options.repository.transaction(account, learnerId, async (tx) => {
      await tx.setSatMathFocus(satMathFocus);
      return { satMathFocus };
    });
  });
  app.get("/api/v1/learners/:learnerId/starting-point", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    return options.repository.transaction(account, learnerId, async (tx) => {
      const { band, policyVersion } = await tx.startingPoint();
      return { band, policyVersion };
    });
  });
  app.post("/api/v1/learners/:learnerId/starting-point", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const { band } = z
      .object({ band: z.enum(startingBands) })
      .strict()
      .parse(request.body);
    return options.repository.transaction(account, learnerId, async (tx) => {
      await tx.setStartingPoint(band);
      const { policyVersion } = await tx.startingPoint();
      return { band, policyVersion };
    });
  });
  app.post(
    "/api/v1/trials",
    { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const { birthYear } = z
        .object({ birthYear: birthYearSchema })
        .strict()
        .parse(request.body);
      return reply
        .code(201)
        .send(await options.repository.createTrial(birthYear));
    },
  );
  app.post("/api/v1/trials/adopt", async (request) => {
    const account = await options.authenticate(request);
    const { token, name } = z
      .object({
        token: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/),
        name: z.string().trim().min(1).max(60),
      })
      .strict()
      .parse(request.body);
    return options.repository.adoptTrial(account, token, name);
  });
  app.post("/api/v1/learners/:learnerId/birth-year", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const { birthYear } = z
      .object({ birthYear: birthYearSchema })
      .strict()
      .parse(request.body);
    return options.repository.transaction(account, learnerId, async (tx) => {
      await tx.setBirthYear(birthYear);
      return { birthYear };
    });
  });
  /** The free run: phase, totals, skills mastered, the map before and
   * after practice, and the overall level over the run. Only an anonymous
   * trial has one. */
  app.get("/api/v1/learners/:learnerId/trial-progress", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    return options.repository.transaction(account, learnerId, async (tx) => {
      const progress = await tx.trialProgress();
      if (!progress) throw new ApiError(404, "Trial not found");
      const placed = progress.totals.answered >= progress.placement;
      return {
        ...progress,
        mastered: await tx.masteredSkills(),
        frontier: {
          placement: placed ? await tx.frontierAfter(progress.placement) : null,
          current: await tx.frontier(),
        },
        trend: await tx.frontierTrend(),
      };
    });
  });
  /** Records that the paywall was shown, at the limit or by choice. */
  app.post("/api/v1/learners/:learnerId/trial-paywall", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    return options.repository.transaction(account, learnerId, async (tx) => {
      await tx.trialPaywall();
      return { recorded: true };
    });
  });
  app.post("/api/v1/learners/:learnerId/batches", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const input = z
      .object({
        templateId: z.string().max(100).optional(),
        count: z.number().int().min(1).max(5).default(3),
        responseCapabilities: z
          .array(z.enum(responseCapabilities))
          .max(responseCapabilities.length)
          .default([]),
        figureCapabilities: z
          .array(z.enum(figureCapabilities))
          .max(figureCapabilities.length)
          .default([]),
      })
      .strict()
      .parse(request.body ?? {});
    return options.repository.transaction(account, learnerId, async (tx) => {
      // A trial practices until its allowance is used, then sees the paywall.
      const trialRemaining = await tx.trialRemaining();
      if (trialRemaining !== null) {
        if (trialRemaining <= 0) throw new ApiError(402, "trial-complete");
      } else if (!options.development && !(await tx.hasAccess()))
        throw new ApiError(403, "An active student license is required");
      const focused = input.templateId
        ? templates.find((t) => t.id === input.templateId)
        : undefined;
      if (input.templateId && !focused)
        throw new ApiError(400, "Unknown problem family");
      // Scripted openers come from this list too: an opener the client
      // cannot draw gives way to its slot's next drawable item, or to
      // adaptive selection (learning/placement.ts).
      const supported = templates.filter((template) =>
        clientCanDraw(template, input),
      );
      if (focused && !supported.includes(focused))
        throw new ApiError(
          400,
          "This problem needs an updated app. Refresh the page to try it.",
        );
      const count =
        trialRemaining === null
          ? input.count
          : Math.min(input.count, trialRemaining);
      const satMathFocus = await tx.satMathFocus();
      const selected = focused
        ? Array.from({ length: count }, () => ({
            template: focused,
            reason: "focus",
            strand:
              skills.find((skill) => skill.id === focused.skillId)?.strand ??
              "math",
          }))
        : planMixedPractice({
            policy: options.practicePolicy,
            templates: satMathFocus
              ? supported.filter(satPracticeEligible)
              : supported,
            skills,
            attempts: await tx.recentAttempts(),
            evidence: await tx.skillEvidence(),
            frontier: await tx.frontier(),
            skips: await tx.recentSkips(),
            count,
            seed: randomUUID(),
            learnerKey: learnerId,
          });
      const problems: PublicProblem[] = [];
      const hints: Record<string, ProblemHint> = {};
      for (const choice of selected) {
        const problem: SavedProblem = generatedProblemSchema.parse(
          generateProblemFor(
            choice.template.id,
            randomUUID(),
            input.figureCapabilities,
          ),
        );
        await tx.saveProblem(problem);
        problems.push(problem.public);
        hints[problem.public.id] = {
          hint: problem.hint,
          ...(problem.hintCue ? { cue: problem.hintCue } : {}),
        };
      }
      return {
        problems,
        // Keep the public-problem protocol unchanged for installed clients.
        // Downloading help is not evidence that the learner used it.
        hints,
        ...(trialRemaining !== null ? { trialRemaining } : {}),
        selection: selected.map((choice, i) => ({
          problemId: problems[i].id,
          reason: choice.reason,
          strand: choice.strand,
        })),
        lesson:
          lessons.find((l) =>
            l.templateIds.includes(selected[0].template.id),
          ) ?? null,
      };
    });
  });
  app.get(
    "/api/v1/learners/:learnerId/publications/:lessonId/:kind",
    async (request, reply) => {
      const account = await parent(request);
      const { learnerId, lessonId, kind } = z
        .object({
          learnerId: idSchema,
          lessonId: z.string().max(100),
          kind: z.enum(["lesson", "workbook", "solutions"]),
        })
        .parse(request.params);
      const { format } = z
        .object({ format: z.enum(["Letter", "A4"]).default("Letter") })
        .parse(request.query);
      if (!lessons.some((l) => l.id === lessonId))
        throw new ApiError(404, "Lesson not found");
      await options.repository.transaction(account, learnerId, async (tx) => {
        if (!options.development && !(await tx.hasAccess()))
          throw new ApiError(403, "An active student license is required");
      });
      const filename = `${lessonId}-${kind}-${format}.pdf`;
      try {
        const pdf = await readFile(
          new URL(`../../artifacts/publications/${filename}`, import.meta.url),
        );
        return reply
          .type("application/pdf")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(pdf);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        )
          throw new ApiError(
            503,
            "This publication is being prepared. Please try again later.",
          );
        throw error;
      }
    },
  );
  /** Skip: a neutral pass. The worked answer is shown; no attempt is written,
   * so the frontier, evidence and mastery never see it (learning/skip.ts). */
  app.post("/api/v1/learners/:learnerId/skips", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const { problemId } = z
      .object({ problemId: z.string().min(1).max(160) })
      .strict()
      .parse(request.body);
    return options.repository.transaction(account, learnerId, async (tx) => {
      const problem = await tx.problem(problemId);
      if (!problem) throw new ApiError(404, "Problem not found");
      if (await tx.attemptByProblem(problemId))
        throw new ApiError(409, "This problem has already been answered");
      if (!problem.skipped) {
        const trialRemaining = await tx.trialRemaining();
        if (
          SKIP_USES_FREE_PROBLEM &&
          trialRemaining !== null &&
          trialRemaining <= 0
        )
          throw new ApiError(402, "trial-complete");
        if (
          trialRemaining === null &&
          !options.development &&
          !(await tx.hasAccess())
        )
          throw new ApiError(403, "An active student license is required");
        problem.skipped = true;
        problem.skippedAt = new Date().toISOString();
        await tx.saveSkip(problem);
      }
      // A retried skip returns the same reveal.
      const reveal: Outcome = {
        id: `skip:${problem.public.id}`,
        problemId: problem.public.id,
        requestId: `skip:${problem.public.id}`,
        skillId: problem.public.skillId,
        templateId: problem.public.templateId,
        response: "",
        correct: false,
        assisted: false,
        explanation: problem.explanation,
        answer: problem.answer,
        createdAt: problem.skippedAt!,
        skipped: true,
      };
      return reveal;
    });
  });
  app.post("/api/v1/learners/:learnerId/hints", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const { problemId } = z
      .object({ problemId: z.string().max(160) })
      .strict()
      .parse(request.body);
    return options.repository.transaction(account, learnerId, async (tx) => {
      const problem = await tx.problem(problemId);
      if (!problem) throw new ApiError(404, "Problem not found");
      problem.hintViewed = true;
      await tx.saveProblem(problem);
      return {
        hint: problem.hint,
        ...(problem.hintCue ? { cue: problem.hintCue } : {}),
      };
    });
  });
  app.post("/api/v1/learners/:learnerId/lesson-support", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const { problemId } = z
      .object({ problemId: z.string().min(1).max(160) })
      .strict()
      .parse(request.body);
    return options.repository.transaction(account, learnerId, async (tx) => {
      const problem = await tx.problem(problemId);
      if (!problem) throw new ApiError(404, "Problem not found");
      if (!hasProblemLesson(problem.public.templateId))
        throw new ApiError(404, "Lesson not found");
      // Reading the lesson before answering counts as assistance.
      if (!(await tx.attemptByProblem(problemId))) {
        problem.lessonViewed = true;
        await tx.saveProblem(problem);
      }
      return {
        recorded: true,
        lesson: problemLesson(
          problem.public.templateId,
          problem.public.seed,
          problem.public.prompt,
          problem.public.response,
          problem,
        ),
      };
    });
  });
  app.post("/api/v1/learners/:learnerId/attempts", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const input = attemptSchema.parse(request.body);
    return options.repository.transaction(account, learnerId, async (tx) => {
      const duplicate = await tx.attemptByRequest(input.requestId);
      if (duplicate) {
        // A complete stored selection has already passed validation. Compare
        // sets on retries without depending on instance retention or option order.
        const selected = canonicalSelection(duplicate.response);
        const plotted = canonicalPointSet(duplicate.response);
        // An ordered answer that happens to be stored in sorted order is
        // indistinguishable from a set, so ask the problem whether order counts.
        const stored =
          plotted !== null && plotted === duplicate.response
            ? await tx.problem(duplicate.problemId)
            : null;
        const orderedPlot =
          stored?.public.response.kind === "point-plot" &&
          stored.public.response.ordered;
        const parts = canonicalMultiPart(duplicate.response);
        // Structured work is stored in its canonical form; a retry is the same
        // when the problem normalizes it to that form (spacing, ≤ or <=).
        const workProblem =
          duplicate.response !== input.response &&
          duplicate.response.startsWith("[")
            ? await tx.problem(duplicate.problemId)
            : null;
        const sameWork =
          workProblem?.public.response.kind === "structured-work" &&
          normalizeStructuredWork(
            workProblem.public.response,
            input.response,
          ) === duplicate.response;
        const sameResponse =
          duplicate.response === input.response ||
          (selected !== null &&
            canonicalSelection(input.response) === selected) ||
          // Sets are stored sorted; an ordered answer keeps its slots, so a
          // reordered retry of labeled images is a different submission.
          (plotted !== null &&
            !orderedPlot &&
            plotted === duplicate.response &&
            canonicalPointSet(input.response) === plotted) ||
          // Multi-part answers are keyed by blank, so key order is not a change.
          (parts !== null && canonicalMultiPart(input.response) === parts) ||
          sameWork;
        if (duplicate.problemId !== input.problemId || !sameResponse)
          throw new ApiError(
            409,
            "This submission identifier was already used",
          );
        return duplicate;
      }
      // Problems fetched in advance cannot extend a trial's allowance.
      const trialRemaining = await tx.trialRemaining();
      if (trialRemaining !== null && trialRemaining <= 0)
        throw new ApiError(402, "trial-complete");
      if (
        trialRemaining === null &&
        !options.development &&
        !(await tx.hasAccess())
      )
        throw new ApiError(403, "An active student license is required");
      const problem = await tx.problem(input.problemId);
      if (!problem) throw new ApiError(404, "Problem not found");
      if (!isValidResponse(problem.public, input.response))
        throw new ApiError(
          400,
          problem.public.response.kind === "choice"
            ? "Choose one of the displayed answers"
            : problem.public.response.kind === "multi-select"
              ? `Choose ${problem.public.response.selectionCount} of the displayed answers`
              : problem.public.response.kind === "point-plot"
                ? `Place ${problem.public.response.pointCount} different ${problem.public.response.pointCount === 1 ? "point" : "points"} on the grid`
                : problem.public.response.kind === "multi-part-choice"
                  ? `Choose one of the displayed options for each of the ${problem.public.response.blanks.length} parts`
                  : problem.public.response.kind === "figure-choice"
                    ? `Choose one of the displayed ${problem.public.response.noun === "Graph" ? "graphs" : "number lines"}`
                    : problem.public.response.kind === "structured-work"
                      ? problem.public.response.mode === "order"
                        ? "Place every step once, in an order"
                        : "Complete every step with a valid entry"
                      : "Enter a number, decimal, or fraction such as 3/4",
        );
      const response =
        problem.public.response.kind === "multi-select"
          ? normalizeSelection(problem.public.response, input.response)!
          : problem.public.response.kind === "point-plot"
            ? normalizePointPlot(problem.public.response, input.response)!
            : problem.public.response.kind === "multi-part-choice"
              ? normalizeMultiPart(problem.public.response, input.response)!
              : problem.public.response.kind === "structured-work"
                ? normalizeStructuredWork(
                    problem.public.response,
                    input.response,
                  )!
                : input.response;
      const answered = await tx.attemptByProblem(input.problemId);
      if (answered)
        throw new ApiError(409, "This problem has already been answered");
      // A skip showed the answer: it can no longer be answered for credit.
      if (problem.skipped)
        throw new ApiError(
          409,
          "This problem was skipped and its answer shown. Continue to the next problem.",
        );
      // Persist locally revealed help with the answer, in this transaction.
      // A false or missing client flag can never clear server-recorded help.
      if (input.hintViewed && !problem.hintViewed) {
        problem.hintViewed = true;
        await tx.saveProblem(problem);
      }
      // A multi-part answer earns credit only when every part is right; the
      // attempt records which parts were wrong in its first feedback line.
      const multiPart =
        problem.public.response.kind === "multi-part-choice"
          ? problem.public.response
          : null;
      const partFeedback = multiPart
        ? multiPartFeedback(multiPart, problem.answer, response)
        : null;
      // Structured work is marked row by row on the server; credit needs
      // every row, and the first feedback lines name the rows to recheck.
      const work =
        problem.public.response.kind === "structured-work" &&
        problem.workGrading
          ? {
              response: problem.public.response,
              grading: problem.workGrading,
            }
          : null;
      const workFeedback = work
        ? structuredWorkFeedback(work.response, work.grading, response)
        : [];
      const outcome: Outcome = {
        id: randomUUID(),
        problemId: input.problemId,
        requestId: input.requestId,
        skillId: problem.public.skillId,
        templateId: problem.public.templateId,
        response,
        correct: gradeAnswer(problem, response),
        assisted: !!problem.hintViewed || !!problem.lessonViewed,
        explanation: problem.choiceFeedback?.[response]
          ? [problem.choiceFeedback[response]!, ...problem.explanation]
          : partFeedback
            ? [partFeedback, ...problem.explanation]
            : workFeedback.length
              ? [...workFeedback, ...problem.explanation].slice(0, 20)
              : problem.explanation,
        answer: problem.answer,
        createdAt: new Date().toISOString(),
        ...(multiPart
          ? {
              parts: multiPartMarks(multiPart, problem.answer, response).map(
                (mark) => mark.correct,
              ),
            }
          : {}),
        ...(work
          ? {
              parts: markStructuredWork(work.response, work.grading, response)
                .rows,
            }
          : {}),
        ...(problem.variant ? { variant: problem.variant } : {}),
      };
      const before = await tx.masteredSkills();
      await tx.saveAttempt(outcome);
      // A mastery moment: this answer made a previously missed skill
      // review-ready. Shown once, with the answer; never stored.
      const mastered =
        !before.includes(outcome.skillId) &&
        (await tx.masteredSkills()).includes(outcome.skillId);
      return mastered
        ? {
            ...outcome,
            mastered: {
              skillId: outcome.skillId,
              title:
                skills.find((skill) => skill.id === outcome.skillId)?.title ??
                outcome.skillId,
            },
          }
        : outcome;
    });
  });
  /** "Report a problem" on a resolved problem. First-party only. */
  app.post(
    "/api/v1/learners/:learnerId/problem-flags",
    { config: { rateLimit: { max: FLAG_RATE_LIMIT, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const account = await parent(request);
      const { learnerId } = paramsSchema.parse(request.params);
      const input = problemFlagSchema.parse(request.body);
      const saved = await options.repository.transaction(
        account,
        learnerId,
        (tx) =>
          recordProblemFlag(tx, input, {
            trial: isTrialAccount(account),
            apiCommit: build.commit,
          }),
      );
      return reply.code(201).send(saved);
    },
  );
  registerBookRoutes(app, {
    repository: options.repository,
    parent,
    development: options.development,
    publicationDirectory: options.bookPublicationDirectory,
  });
}
