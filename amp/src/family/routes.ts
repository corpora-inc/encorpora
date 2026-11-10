import {
  readOwnPractice,
  recordAdultActivity,
  startAdultPractice,
  startPracticeSchema,
} from "../account/adult.js";
import { accountSummary } from "../account/repository.js";
import { startPlace } from "../account/starter.js";
import { studentBearer } from "../schools/principal.js";
import { studentMe } from "../schools/student-me.js";
import { Readable } from "node:stream";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import {
  approve,
  createApproval,
  listApprovals,
  lookupApproval,
  mailApproval,
  openApproval,
  readApproval,
  removeApproval,
  renewApproval,
  type ApprovalKeys,
  type ApprovalMail,
} from "./approvals.js";
import { FamilyError } from "./contracts.js";
import { dismissFamilyNotice } from "./family-class.js";
import { FamilyRepository } from "./repository.js";
export interface FamilyRouteOptions {
  pool: Pool;
  authenticate: Authenticator;
  development?: boolean;
  /** Stripe namespace of the configured billing, for paid-purchase routing. */
  billingNamespace?: string | null;
  /** Approval links for another family's child (docs/families.md, step 5):
   * the key that derives them, where they point and the account mail path.
   * Absent: no approval links. */
  approvals?: ApprovalKeys & { mail?: ApprovalMail };
}
export async function registerFamilyRoutes(
  app: FastifyInstance,
  options: FamilyRouteOptions,
): Promise<FamilyRepository> {
  const repository = new FamilyRepository(options.pool, options.development);
  const empty = z.strictObject({});
  const learnerParams = z.strictObject({
    learnerId: z.string().min(1).max(200),
  });
  app.register(async (scope) => {
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof FamilyError)
        return reply.code(error.statusCode).send({ error: error.code });
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_family_request" });
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 500;
      return reply.code(status >= 400 && status < 500 ? status : 503).send({
        error:
          status === 401 ? "sign_in_required" : "family_service_unavailable",
      });
    });
    scope.addHook("onRequest", async (request, reply) => {
      reply.header("X-Request-Id", request.id);
      reply.header("Cache-Control", "no-store");
      reply.header("X-Content-Type-Options", "nosniff");
    });
    scope.get("/api/v1/me", async (request) => {
      const student = studentBearer(request);
      if (student) return studentMe(options.pool, student, options.development);
      let account: string;
      try {
        account = await options.authenticate(request);
      } catch (failure) {
        if (
          failure &&
          typeof failure === "object" &&
          "statusCode" in failure &&
          failure.statusCode === 401
        )
          return { signedIn: false, next: "sign-in" };
        throw failure;
      }
      return accountSummary(
        options.pool,
        repository,
        account,
        options.billingNamespace ?? null,
      );
    });
    // The adult's own practice: their record, starting it, and their time.
    scope.get("/api/v1/me/practice", async (request) => {
      const account = await options.authenticate(request);
      const practice = await readOwnPractice(repository, account);
      if (!practice) throw new FamilyError(404, "adult_practice_not_started");
      return practice;
    });
    scope.post("/api/v1/me/practice", async (request, reply) => {
      const account = await options.authenticate(request);
      const input = startPracticeSchema.parse(request.body);
      return reply
        .code(201)
        .send(await startAdultPractice(repository, account, input));
    });
    // "What brings you to AMP?": the place that answer needs, in one call.
    scope.post(
      "/api/v1/start",
      {
        bodyLimit: 4096,
        config: { rateLimit: { max: 30, timeWindow: "1 hour" } },
      },
      async (request) => {
        const account = await options.authenticate(request);
        return startPlace(repository, account, request.body);
      },
    );
    scope.post(
      "/api/v1/me/practice/activity",
      { bodyLimit: 4096 },
      async (request, reply) => {
        const account = await options.authenticate(request);
        if (!(await recordAdultActivity(options.pool, account, request.body)))
          throw new FamilyError(404, "adult_practice_not_started");
        return reply.code(204).send();
      },
    );
    // A child practices on this device as themselves, in their class; the
    // parent's own view returns when they sign out.
    scope.post(
      "/api/v1/family/learners/:learnerId/practice-here",
      async (request, reply) => {
        const account = await options.authenticate(request);
        const { learnerId } = learnerParams.parse(request.params);
        empty.parse(request.body ?? {});
        return reply
          .code(201)
          .send(await repository.practiceHere(account, learnerId));
      },
    );
    scope.post("/api/v1/family/class-notice/dismiss", async (request) => {
      const account = await options.authenticate(request);
      empty.parse(request.body ?? {});
      await dismissFamilyNotice(options.pool, account);
      return { dismissed: true };
    });
    const keys = options.approvals;
    if (keys) {
      const approvalParams = z.strictObject({
        approvalId: z.string().min(1).max(64),
      });
      // The family's teacher: who they've asked for, and each child's place.
      scope.get("/api/v1/family/approvals", async (request) => ({
        approvals: await listApprovals(
          options.pool,
          keys,
          await options.authenticate(request),
        ),
      }));
      scope.post(
        "/api/v1/family/approvals",
        { bodyLimit: 1024 },
        async (request, reply) => {
          const account = await options.authenticate(request);
          const sent = await createApproval(
            options.pool,
            keys,
            account,
            request.body,
          );
          const mailed = await mailApproval(
            options.pool,
            keys,
            keys.mail,
            sent,
          );
          return reply.code(201).send({ id: sent.id, mailed });
        },
      );
      scope.post(
        "/api/v1/family/approvals/:approvalId/resend",
        async (request) => {
          const account = await options.authenticate(request);
          const { approvalId } = approvalParams.parse(request.params);
          empty.parse(request.body ?? {});
          const sent = await renewApproval(options.pool, account, approvalId);
          return {
            mailed: await mailApproval(options.pool, keys, keys.mail, sent),
          };
        },
      );
      scope.post(
        "/api/v1/family/approvals/:approvalId/remove",
        async (request) => {
          const account = await options.authenticate(request);
          const { approvalId } = approvalParams.parse(request.params);
          empty.parse(request.body ?? {});
          return removeApproval(options.pool, account, approvalId);
        },
      );
      // The child's parent. Public: holding the token is the permission, and
      // it answers only the child's first name, the class and its teachers.
      scope.post(
        "/api/v1/family/approvals/lookup",
        { bodyLimit: 512 },
        async (request) => ({
          approval: await lookupApproval(options.pool, request.body),
        }),
      );
      scope.post(
        "/api/v1/family/approvals/open",
        { bodyLimit: 512 },
        async (request) =>
          openApproval(
            options.pool,
            keys,
            await options.authenticate(request),
            request.body,
          ),
      );
      scope.get("/api/v1/family/approvals/:approvalId", async (request) => {
        const account = await options.authenticate(request);
        const { approvalId } = approvalParams.parse(request.params);
        return {
          approval: await readApproval(
            options.pool,
            account,
            approvalId,
            options.development,
          ),
        };
      });
      scope.post(
        "/api/v1/family/approvals/:approvalId/approve",
        { bodyLimit: 512 },
        async (request) => {
          const account = await options.authenticate(request);
          const { approvalId } = approvalParams.parse(request.params);
          return approve(
            options.pool,
            account,
            approvalId,
            request.body,
            options.development,
          );
        },
      );
    }
    scope.get("/api/v1/family", async (request) =>
      repository.summary(await options.authenticate(request)),
    );
    scope.post("/api/v1/family/consent/withdraw", async (request) => {
      const account = await options.authenticate(request);
      empty.parse(request.body);
      await repository.withdraw(account);
      return { withdrawn: true };
    });
    scope.post("/api/v1/family/learners/:learnerId/rename", async (request) => {
      const account = await options.authenticate(request);
      const { learnerId } = learnerParams.parse(request.params);
      const { name } = z
        .strictObject({
          name: z
            .string()
            .trim()
            .min(1)
            .max(80)
            .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
        })
        .parse(request.body);
      await repository.rename(account, learnerId, name);
      return { renamed: true };
    });
    scope.post(
      "/api/v1/family/learners/:learnerId/delete-learning-data",
      async (request) => {
        const account = await options.authenticate(request);
        const { learnerId } = learnerParams.parse(request.params);
        z.strictObject({
          confirmation: z.literal("delete-learning-data"),
        }).parse(request.body);
        return repository.deleteLearning(account, learnerId);
      },
    );
    scope.post("/api/v1/family/delete-learning-data", async (request) => {
      const account = await options.authenticate(request);
      z.strictObject({ confirmation: z.literal("delete-learning-data") }).parse(
        request.body,
      );
      return repository.deleteLearning(account);
    });
    scope.post("/api/v1/family/export-ticket", async (request) => {
      const account = await options.authenticate(request);
      empty.parse(request.body);
      return { ticket: await repository.issueExportTicket(account) };
    });
    // Native form downloads stream without sharing authority through cookies or URLs.
    // Reject duplicate fields before converting to an object.
    scope.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string", bodyLimit: 1024 },
      (_request, body, done) => {
        const fields = [...new URLSearchParams(String(body))];
        if (fields.length !== 1 || fields[0]![0] !== "ticket")
          return done(new FamilyError(400, "invalid_family_request"));
        done(null, { ticket: fields[0]![1] });
      },
    );
    const ticketBody = z.strictObject({
      ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    });
    scope.post(
      "/api/v1/family/export",
      { bodyLimit: 1024 },
      async (request, reply) => {
        const { ticket } = ticketBody.parse(request.body);
        return streamExport(
          await repository.consumeExportTicket(ticket),
          reply,
        );
      },
    );
    scope.get("/api/v1/family/export", async (request, reply) =>
      streamExport(await options.authenticate(request), reply),
    );
    function streamExport(account: string, reply: FastifyReply) {
      const abort = new AbortController();
      const stream = Readable.from(repository.export(account, abort.signal));
      const timeout = setTimeout(() => {
        abort.abort();
        stream.destroy(new Error("Export time limit exceeded"));
      }, 120_000);
      timeout.unref();
      reply.raw.once("close", () => {
        abort.abort();
        stream.destroy();
        clearTimeout(timeout);
      });
      stream.once("close", () => clearTimeout(timeout));
      return reply
        .type("application/x-ndjson; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="amp-family-export-${new Date().toISOString().slice(0, 10)}.ndjson"`,
        )
        .send(stream);
    }
  });
  return repository;
}
