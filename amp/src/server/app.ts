import { registerBookRoutes } from "../books/routes.js";
import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { z, ZodError } from "zod";
import { randomUUID } from "node:crypto";
import { generatedProblemSchema, type PublicProblem } from "../math/contracts";
import {
  generateProblem,
  gradeAnswer,
  normalizeAnswer,
  templates,
} from "../math/engine";
import { skills } from "../curriculum/catalog";
import { auditCurriculum } from "../curriculum/audit";
import { ApiError, type Outcome, type Repository } from "./repository";
import type { Authenticator } from "./auth";
import { planMixedPractice } from "./mixed-practice";
import { lessons } from "../content/lessons";
const idSchema = z.string().uuid();
const paramsSchema = z.object({ learnerId: idSchema });
const attemptSchema = z
  .object({
    problemId: z.string().min(1).max(160),
    requestId: idSchema,
    response: z.string().trim().min(1).max(200),
  })
  .strict();
export function buildApp(options: {
  repository: Repository;
  authenticate: Authenticator;
  development?: boolean;
  logger?: boolean;
  bookPublicationDirectory?: string;
}) {
  if (options.development && process.env.NODE_ENV === "production")
    throw new Error("Development mode is forbidden in production");
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 32 * 1024,
    trustProxy: false,
  });
  app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  app.addHook("onRequest", async (request, reply) => {
    if (request.url !== "/api/v1/catalog" && request.url !== "/api/v1/health")
      reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
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
  async function parent(request: Parameters<Authenticator>[0]) {
    const account = await options.authenticate(request);
    if (!options.development && !(await options.repository.hasConsent(account)))
      throw new ApiError(
        403,
        "Verified parent consent is required. Contact support to complete pilot enrollment.",
      );
    return account;
  }
  app.get("/api/v1/health", async () => ({
    ok: true,
    product: "AMP",
    version: 1,
  }));
  app.get("/api/v1/catalog", async () => ({
    templates,
    lessons,
    skills,
    coverage: auditCurriculum(),
    mode: options.development ? "development" : "hosted",
  }));
  app.get("/api/v1/learners", async (request) => ({
    learners: await options.repository.list(await parent(request)),
  }));
  app.post("/api/v1/learners", async (request, reply) => {
    const account = await parent(request);
    const { name } = z
      .object({ name: z.string().trim().min(1).max(60) })
      .strict()
      .parse(request.body);
    return reply.code(201).send(await options.repository.create(account, name));
  });
  app.get("/api/v1/learners/:learnerId/progress", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    return options.repository.transaction(account, learnerId, async (tx) => ({
      skills: await tx.progress([...new Set(templates.map((t) => t.skillId))]),
    }));
  });
  app.post("/api/v1/learners/:learnerId/batches", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const input = z
      .object({
        templateId: z.string().max(100).optional(),
        count: z.number().int().min(1).max(5).default(3),
      })
      .strict()
      .parse(request.body ?? {});
    return options.repository.transaction(account, learnerId, async (tx) => {
      if (!options.development && !(await tx.hasAccess()))
        throw new ApiError(403, "An active student license is required");
      const focused = input.templateId
        ? templates.find((t) => t.id === input.templateId)
        : undefined;
      if (input.templateId && !focused)
        throw new ApiError(400, "Unknown problem family");
      const selected = focused
        ? Array.from({ length: input.count }, () => ({
            template: focused,
            reason: "focus",
            strand:
              skills.find((skill) => skill.id === focused.skillId)?.strand ??
              "math",
          }))
        : planMixedPractice({
            templates,
            skills,
            attempts: await tx.recentAttempts(),
            evidence: await tx.skillEvidence(),
            count: input.count,
            seed: randomUUID(),
          });
      const problems: PublicProblem[] = [];
      for (const choice of selected) {
        const problem = generatedProblemSchema.parse(
          generateProblem(choice.template.id, randomUUID()),
        );
        await tx.saveProblem(problem);
        problems.push(problem.public);
      }
      return {
        problems,
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
      return { hint: problem.hint };
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
      if (
        !lessons.some((lesson) =>
          lesson.templateIds.includes(problem.public.templateId),
        )
      )
        throw new ApiError(404, "Lesson not found");
      problem.lessonViewed = true;
      await tx.saveProblem(problem);
      return { recorded: true };
    });
  });
  app.post("/api/v1/learners/:learnerId/attempts", async (request) => {
    const account = await parent(request);
    const { learnerId } = paramsSchema.parse(request.params);
    const input = attemptSchema.parse(request.body);
    if (normalizeAnswer(input.response) === null)
      throw new ApiError(
        400,
        "Enter a number, decimal, or fraction such as 3/4",
      );
    return options.repository.transaction(account, learnerId, async (tx) => {
      const duplicate = await tx.attemptByRequest(input.requestId);
      if (duplicate) {
        if (
          duplicate.problemId !== input.problemId ||
          duplicate.response !== input.response
        )
          throw new ApiError(
            409,
            "This submission identifier was already used",
          );
        return duplicate;
      }
      const problem = await tx.problem(input.problemId);
      if (!problem) throw new ApiError(404, "Problem not found");
      const answered = await tx.attemptByProblem(input.problemId);
      if (answered)
        throw new ApiError(409, "This problem has already been answered");
      const outcome: Outcome = {
        id: randomUUID(),
        problemId: input.problemId,
        requestId: input.requestId,
        skillId: problem.public.skillId,
        templateId: problem.public.templateId,
        response: input.response,
        correct: gradeAnswer(problem, input.response),
        assisted: !!problem.hintViewed || !!problem.lessonViewed,
        explanation: problem.explanation,
        answer: problem.answer,
        createdAt: new Date().toISOString(),
      };
      await tx.saveAttempt(outcome);
      return outcome;
    });
  });
  registerBookRoutes(app, {
    repository: options.repository,
    parent,
    development: options.development,
    publicationDirectory: options.bookPublicationDirectory,
  });
  return app;
}
