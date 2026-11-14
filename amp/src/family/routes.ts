import type { StripeBillingConfig } from "../billing/stripe/config.js";
import {
  familyPlacesSchema,
  familyProjectionSchema,
  familyChildProgressSchema,
  familyChildTimeSchema,
  familyTeachingSchema,
} from "./projection-contracts.js";
import {
  familyProjection,
  familyChildProgress,
  familyChildTime,
  familyTeaching,
  listFamilies,
} from "./projection.js";
import { profileInput, setAccountProfile } from "../account/profile.js";
import {
  changeOwnStart,
  ownStartSchema,
  readOwnPractice,
  recordAdultActivity,
  startAdultPractice,
  startPracticeSchema,
} from "../account/adult.js";
import { optionalChildName } from "../learning/nickname.js";
import { accountSummary } from "../account/repository.js";
import {
  addClassStudent,
  childBirthYear,
  startPlace,
} from "../account/starter.js";
import { isSchoolAccount, studentBearer } from "../schools/principal.js";
import { timeQuerySchema } from "../schools/teacher-contracts.js";
import { timeCsv, fileSlug } from "../schools/exports.js";
import { HEARTBEAT_BODY_LIMIT } from "../schools/evidence.js";
import {
  createProfile,
  deleteProfile,
  practiceAtLevel,
  updateProfile,
} from "../account/practice-profiles.js";
import {
  createProfileSchema,
  practiceAtLevelSchema,
  updateProfileSchema,
} from "../learning/practice-profiles.js";
import { studentMe } from "../schools/student-me.js";
import { Readable } from "node:stream";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
import {
  inviteSecondParent,
  mailSecondParent,
  refuseSecondParentFor,
  refuseSecondParentOnly,
  removeSecondParent,
  resendSecondParent,
  secondParentOf,
  secondParentOwner,
} from "./second-parent.js";
import { SchoolError } from "../schools/contracts.js";
import { fileName, paperQuery, renderReportPdf } from "../reports/print.js";
import {
  adultStartPhrases,
  progressReportHtml,
} from "../reports/progress-report.js";
import type { WorkbookRenderer } from "../workbook/pdf.js";
export interface FamilyRouteOptions {
  pool: Pool;
  authenticate: Authenticator;
  development?: boolean;
  /** Stripe namespace of the configured billing, for paid-purchase routing. */
  billingNamespace?: string | null;
  billingConfig?: StripeBillingConfig | null;
  /** Approval links for another family's child (docs/families.md, step 5):
   * the key that derives them, where they point and the account mail path.
   * Absent: no approval links. */
  approvals?: ApprovalKeys & { mail?: ApprovalMail };
  /** Prints the adult's progress report. Absent: that PDF answers 503. */
  renderer?: WorkbookRenderer | null;
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
      if (error instanceof FamilyError || error instanceof SchoolError)
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
    const familyParams = z.strictObject({ family: z.uuid() });
    scope.get("/api/v1/families", async (request) => {
      const account = await options.authenticate(request);
      const { after } = z
        .strictObject({ after: z.uuid().optional() })
        .parse(request.query);
      return familyPlacesSchema.parse(
        await listFamilies(options.pool, account, after),
      );
    });
    scope.get("/api/v1/families/:family", async (request) => {
      const account = await options.authenticate(request);
      const { family } = familyParams.parse(request.params);
      return familyProjectionSchema.parse(
        await familyProjection(
          options.pool,
          account,
          family,
          options.development,
          options.billingConfig,
        ),
      );
    });
    scope.get("/api/v1/families/:family/teaching", async (request) => {
      const account = await options.authenticate(request);
      const { family } = familyParams.parse(request.params);
      return familyTeachingSchema.parse(
        await familyTeaching(options.pool, account, family),
      );
    });
    scope.get(
      "/api/v1/families/:family/children/:learner/progress",
      async (request) => {
        const account = await options.authenticate(request);
        const { family, learner } = familyParams
          .extend({ learner: z.string().min(1).max(200) })
          .parse(request.params);
        return familyChildProgressSchema.parse(
          await familyChildProgress(options.pool, account, family, learner),
        );
      },
    );
    for (const csv of [false, true]) {
      scope.get(
        `/api/v1/families/:family/children/:learner/${csv ? "time.csv" : "time"}`,
        async (request, reply) => {
          const account = await options.authenticate(request);
          const { family, learner } = familyParams
            .extend({ learner: z.string().min(1).max(200) })
            .parse(request.params);
          const { period, from } = timeQuerySchema.parse(request.query);
          const time = await familyChildTime(
            options.pool,
            account,
            family,
            learner,
            period,
            from,
          );
          if (!csv) return familyChildTimeSchema.parse(time);
          return reply
            .type("text/csv; charset=utf-8")
            .header(
              "Content-Disposition",
              `attachment; filename="${fileSlug(time.name, "time", time.range.from, "to", time.range.to)}.csv"`,
            )
            .send(
              timeCsv(
                time.days.map((day) => ({
                  identifier: null,
                  name: time.name,
                  ...day,
                })),
                time.group,
              ),
            );
        },
      );
    }
    scope.get(
      "/api/v1/families/:family/children/:learner/progress.pdf",
      async (request, reply) => {
        const account = await options.authenticate(request);
        const { family, learner } = familyParams
          .extend({ learner: z.string().min(1).max(200) })
          .parse(request.params);
        const { format } = paperQuery.parse(request.query);
        // Same ownership/second-parent authorization as the individual JSON read.
        const record = await familyChildProgress(
          options.pool,
          account,
          family,
          learner,
        );
        const { html, footer } = progressReportHtml({
          paper: format,
          name: record.name,
          first: record.name,
          subtitle: record.familyDisplayName ?? "Your family",
          facts: [],
          today: record.today,
          record,
        });
        const pdf = await renderReportPdf(
          options.renderer,
          { html, format, footer },
          request.log,
          "Progress report",
        );
        if (!pdf) throw new FamilyError(503, "report_unavailable");
        return reply
          .type("application/pdf")
          .header(
            "Content-Disposition",
            `attachment; filename="${fileName("amp-progress", record.name, record.today)}.pdf"`,
          )
          .send(pdf);
      },
    );
    scope.patch("/api/v1/me/profile", { bodyLimit: 2048 }, async (request) => {
      const account = await options.authenticate(request);
      return setAccountProfile(
        options.pool,
        account,
        profileInput.parse(request.body),
      );
    });
    // The adult's own practice: their record, starting it, and their time.
    scope.get("/api/v1/me/practice", async (request) => {
      const account = await options.authenticate(request);
      const practice = await readOwnPractice(repository, account);
      if (!practice) throw new FamilyError(404, "adult_practice_not_started");
      return practice;
    });
    // The adult's own record as a printed progress report, rendered for this
    // request and never stored.
    scope.get("/api/v1/me/practice/report.pdf", async (request, reply) => {
      const account = await options.authenticate(request);
      const { format } = paperQuery.parse(request.query);
      const practice = await readOwnPractice(repository, account);
      if (!practice) throw new FamilyError(404, "adult_practice_not_started");
      const today = practice.time.range.to;
      // An account with no name practices as "Me" (adultLearnerName).
      const named = practice.learner.name !== "Me";
      const { html, footer } = progressReportHtml({
        paper: format,
        own: true,
        name: named ? practice.learner.name : null,
        first: practice.learner.first,
        subtitle: practice.learner.start
          ? `Own practice, begun with ${adultStartPhrases[practice.learner.start]}`
          : "Own practice",
        facts: [],
        today,
        record: practice.record,
        time: practice.time,
      });
      const pdf = await renderReportPdf(
        options.renderer,
        { html, format, footer },
        request.log,
        "Progress report",
      );
      if (!pdf) throw new FamilyError(503, "report_unavailable");
      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="${fileName("amp-progress", named ? practice.learner.name : "", today)}.pdf"`,
        )
        .send(pdf);
    });
    scope.post("/api/v1/me/practice", async (request, reply) => {
      const account = await options.authenticate(request);
      const input = startPracticeSchema.parse(request.body);
      return reply
        .code(201)
        .send(await startAdultPractice(repository, account, input));
    });
    // Where the adult's own practice starts, corrected from the year they
    // were born, as it was set when they began.
    scope.post("/api/v1/me/practice/birth-year", async (request) => {
      const account = await options.authenticate(request);
      if (isSchoolAccount(account))
        throw new FamilyError(404, "adult_practice_not_started");
      return changeOwnStart(
        repository,
        account,
        ownStartSchema.parse(request.body),
      );
    });
    // Practice profiles (docs/families.md): the adult practicing as someone
    // else. Any adult account; never a student's session or a school's.
    const profileOwner = async (request: FastifyRequest) => {
      const account = await options.authenticate(request);
      if (isSchoolAccount(account))
        throw new FamilyError(404, "profile_not_found");
      return account;
    };
    const profileParams = z.strictObject({ profileId: z.uuid() });
    scope.post(
      "/api/v1/me/profiles",
      { bodyLimit: 4096 },
      async (request, reply) => {
        const account = await profileOwner(request);
        const input = createProfileSchema.parse(request.body);
        return reply
          .code(201)
          .send(await createProfile(repository, account, input));
      },
    );
    // "Practice at a level" (SPEC R5): the account's one level profile,
    // started again at this grade and pace.
    scope.put(
      "/api/v1/me/practice-at-level",
      { bodyLimit: 1024 },
      async (request) => {
        const account = await profileOwner(request);
        const input = practiceAtLevelSchema.parse(request.body);
        return practiceAtLevel(repository, account, input);
      },
    );
    scope.patch(
      "/api/v1/me/profiles/:profileId",
      { bodyLimit: 4096 },
      async (request) => {
        const account = await profileOwner(request);
        const { profileId } = profileParams.parse(request.params);
        const input = updateProfileSchema.parse(request.body);
        return updateProfile(repository, account, profileId, input);
      },
    );
    scope.delete("/api/v1/me/profiles/:profileId", async (request, reply) => {
      const account = await profileOwner(request);
      const { profileId } = profileParams.parse(request.params);
      await deleteProfile(repository, account, profileId);
      return reply.code(204).send();
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
    // A tutor adds a student from another family to their class: a nickname
    // or initials and a birth year. Their own parent names them by a link.
    scope.post(
      "/api/v1/family/class/students",
      {
        bodyLimit: 4096,
        config: { rateLimit: { max: 120, timeWindow: "1 hour" } },
      },
      async (request, reply) => {
        const account = await options.authenticate(request);
        return reply
          .code(201)
          .send(await addClassStudent(repository, account, request.body));
      },
    );
    scope.post(
      "/api/v1/me/practice/activity",
      { bodyLimit: HEARTBEAT_BODY_LIMIT },
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
        // The family's second parent hands her device to its child too.
        const owner =
          (await secondParentOwner(options.pool, account, learnerId)) ??
          account;
        return reply
          .code(201)
          .send(await repository.practiceHere(owner, learnerId, account));
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
      // The family's second parent (docs/families.md): the account holder
      // invites one, sends again and removes her.
      scope.get("/api/v1/family/second-parent", async (request) => ({
        secondParent: await secondParentOf(
          options.pool,
          keys,
          await options.authenticate(request),
        ),
      }));
      scope.post(
        "/api/v1/family/second-parent",
        {
          bodyLimit: 1024,
          config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
        },
        async (request, reply) => {
          const account = await options.authenticate(request);
          const sent = await inviteSecondParent(
            options.pool,
            keys,
            account,
            request.body,
          );
          return reply.code(201).send({
            mailed: await mailSecondParent(options.pool, keys, keys.mail, sent),
          });
        },
      );
      scope.post(
        "/api/v1/family/second-parent/resend",
        { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } },
        async (request) => {
          const account = await options.authenticate(request);
          empty.parse(request.body ?? {});
          const sent = await resendSecondParent(options.pool, keys, account);
          return {
            mailed: await mailSecondParent(options.pool, keys, keys.mail, sent),
          };
        },
      );
      scope.post("/api/v1/family/second-parent/remove", async (request) => {
        const account = await options.authenticate(request);
        empty.parse(request.body ?? {});
        return removeSecondParent(options.pool, account);
      });
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
          await refuseSecondParentOnly(options.pool, account);
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
      await refuseSecondParentOnly(options.pool, account);
      await repository.withdraw(account);
      return { withdrawn: true };
    });
    scope.post("/api/v1/family/learners/:learnerId/rename", async (request) => {
      const account = await options.authenticate(request);
      const { learnerId } = learnerParams.parse(request.params);
      await refuseSecondParentFor(options.pool, account, learnerId);
      // A parent's name for their own child; blank is "Child 2".
      const { name } = z
        .strictObject({ name: optionalChildName })
        .parse(request.body);
      await repository.rename(account, learnerId, name);
      return { renamed: true };
    });
    // A parent corrects their own child's birth year (docs/families.md).
    scope.post(
      "/api/v1/family/learners/:learnerId/birth-year",
      async (request) => {
        const account = await options.authenticate(request);
        const { learnerId } = learnerParams.parse(request.params);
        await refuseSecondParentFor(options.pool, account, learnerId);
        const { birthYear } = z
          .strictObject({ birthYear: childBirthYear })
          .parse(request.body);
        return repository.setBirthYear(account, learnerId, birthYear);
      },
    );
    scope.post(
      "/api/v1/family/learners/:learnerId/delete-learning-data",
      async (request) => {
        const account = await options.authenticate(request);
        const { learnerId } = learnerParams.parse(request.params);
        await refuseSecondParentFor(options.pool, account, learnerId);
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
