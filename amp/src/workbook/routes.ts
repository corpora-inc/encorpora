import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { skills } from "../curriculum/catalog.js";
import { lessons } from "../content/lessons.js";
import { templates } from "../math/engine.js";
import type { Authenticator } from "../server/auth.js";
import {
  ApiError,
  type LearnerTransaction,
  type Repository,
} from "../server/repository.js";
import { isTrialAccount } from "../server/trials.js";
import {
  composeWorkbook,
  workbookCode,
  workbookMinutes,
  type WorkbookMinutes,
} from "./compose.js";
import {
  workbookRequestSchema,
  type WorkbookRecord,
  type WorkbookSummary,
} from "./contracts.js";
import { workbookFooter, workbookHtml } from "./render.js";
import { RendererUnavailable, type WorkbookRenderer } from "./pdf.js";

const DAY = 86_400_000;
const templateVersion = new Map(templates.map((t) => [t.id, t.version]));
/** Problems regenerate from template and seed, so a workbook reprints
 * exactly only while every template is still at the version it named. */
export function workbookIsCurrent(spec: WorkbookRecord["spec"]): boolean {
  return spec.sections.every((s) =>
    s.items.every(
      (i) => templateVersion.get(i.templateId) === i.templateVersion,
    ),
  );
}
const skillTitle = (id: string) => skills.find((s) => s.id === id)?.title ?? id;
const lessonTitle = new Map(lessons.map((l) => [l.id, l.title]));

export function workbookSummary(record: WorkbookRecord): WorkbookSummary {
  return {
    id: record.id,
    date: record.date,
    number: record.number,
    minutes: record.minutes,
    paper: record.paper,
    code: record.code,
    createdAt: record.createdAt,
    estimatedMinutes: workbookMinutes(record.spec),
    problems: record.spec.sections.reduce((n, s) => n + s.items.length, 0),
    sections: record.spec.sections.map((s) => ({
      kind: s.kind,
      problems: s.items.length,
      title: s.lessonId ? (lessonTitle.get(s.lessonId) ?? null) : null,
    })),
  };
}

/** A new workbook is for a local calendar date near today: within a day of
 * the server's UTC date covers every time zone. Stored workbooks of any date
 * stay available. */
export function composableDate(date: string, now: number): boolean {
  const day = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(
    `${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`,
  );
  return Math.abs(day - today) <= DAY;
}

/** Composes from the learner's own evidence. A learner without answers
 * gets a workbook from the starting estimate (age or chosen starting point). */
async function compose(
  tx: LearnerTransaction,
  learnerId: string,
  input: { date: string; minutes: WorkbookMinutes; number: number },
  now: number,
) {
  const recent = await tx.recentAttempts();
  return composeWorkbook({
    templates,
    skills,
    lessons,
    frontier: await tx.frontier(now),
    evidence: await tx.skillEvidence(),
    recentTemplateIds: recent.map((a) => a.templateId),
    date: input.date,
    number: input.number,
    minutes: input.minutes,
    learnerKey: learnerId,
    now,
  });
}

export function registerWorkbookRoutes(
  app: FastifyInstance,
  options: {
    repository: Repository;
    parent: Authenticator;
    development?: boolean;
    now?: () => number;
    /** Null or absent: PDF requests answer 503 (and are logged). */
    renderer?: WorkbookRenderer | null;
  },
) {
  const now = options.now ?? Date.now;
  const learnerParams = z.object({ learnerId: z.string().uuid() }).strict();
  const workbookParams = learnerParams
    .extend({ workbookId: z.string().uuid() })
    .strict();
  /** Workbooks are part of a paid learner's practice; a free trial has none. */
  async function account(request: Parameters<Authenticator>[0]) {
    const accountId = await options.parent(request);
    if (isTrialAccount(accountId))
      throw new ApiError(403, "Create an account to print workbooks");
    return accountId;
  }
  async function access(tx: LearnerTransaction) {
    if (!options.development && !(await tx.hasAccess()))
      throw new ApiError(403, "An active student license is required");
  }

  app.get("/api/v1/learners/:learnerId/workbooks", async (request) => {
    const accountId = await account(request);
    const { learnerId } = learnerParams.parse(request.params);
    const { date } = z
      .object({ date: workbookRequestSchema.shape.date.optional() })
      .strict()
      .parse(request.query);
    return options.repository.transaction(accountId, learnerId, async (tx) => {
      await access(tx);
      return { workbooks: (await tx.workbooks(date)).map(workbookSummary) };
    });
  });

  /** Same date, number and length: the same workbook, stored the first time.
   * No number: the next one for that date ("Another one"). */
  app.post("/api/v1/learners/:learnerId/workbooks", async (request, reply) => {
    const accountId = await account(request);
    const { learnerId } = learnerParams.parse(request.params);
    const input = workbookRequestSchema.parse(request.body);
    const at = now();
    const result = await options.repository.transaction(
      accountId,
      learnerId,
      async (tx) => {
        await access(tx);
        const sameDay = await tx.workbooks(input.date);
        const number =
          input.number ?? Math.max(0, ...sameDay.map((w) => w.number)) + 1;
        if (number > 999)
          throw new ApiError(409, "This day already has 999 workbooks");
        const existing = sameDay.find(
          (w) => w.number === number && w.minutes === input.minutes,
        );
        if (existing) {
          if (existing.paper !== input.paper) {
            await tx.setWorkbookPaper(existing.id, input.paper);
            existing.paper = input.paper;
          }
          return { status: 200, body: workbookSummary(existing) };
        }
        if (!composableDate(input.date, at))
          throw new ApiError(
            400,
            "Workbooks can be made for today only. Open today's workbook instead.",
          );
        const spec = await compose(
          tx,
          learnerId,
          { date: input.date, minutes: input.minutes, number },
          at,
        );
        const saved = await tx.saveWorkbook({
          id: randomUUID(),
          date: input.date,
          number,
          minutes: input.minutes,
          paper: input.paper,
          spec,
          code: workbookCode(spec),
          createdAt: new Date(at).toISOString(),
        });
        return { status: 201, body: workbookSummary(saved) };
      },
    );
    // Answer only after the transaction commits.
    return reply.code(result.status).send(result.body);
  });

  /** The printed workbook as a PDF, rendered on first request and kept
   * briefly (RETENTION.workbookPdfHours). Rendering happens outside the
   * learner transaction; a renderer that is down answers 503. */
  app.get(
    "/api/v1/learners/:learnerId/workbooks/:workbookId/pdf",
    async (request, reply) => {
      const accountId = await account(request);
      const { learnerId, workbookId } = workbookParams.parse(request.params);
      const query = z
        .object({ format: z.enum(["Letter", "A4"]).optional() })
        .strict()
        .parse(request.query);
      const learnerName = (await options.repository.list(accountId)).find(
        (l) => l.id === learnerId,
      )?.name;
      const lookup = await options.repository.transaction(
        accountId,
        learnerId,
        async (tx) => {
          await access(tx);
          const record = await tx.workbook(workbookId);
          if (!record) throw new ApiError(404, "Workbook not found");
          if (!workbookIsCurrent(record.spec))
            throw new ApiError(
              410,
              "Some problems in this workbook have been updated since it was made. Make today's workbook instead.",
            );
          const format =
            query.format ?? (record.paper === "a4" ? "A4" : "Letter");
          const html = workbookHtml(record.spec, {
            lessons,
            skillTitle,
            learnerName,
            paper: format === "A4" ? "a4" : "letter",
          });
          const key = {
            workbookId,
            format,
            documentSha256: createHash("sha256").update(html).digest("hex"),
          } as const;
          return { record, html, key, cached: await tx.workbookPdf(key) };
        },
      );
      let pdf = lookup.cached;
      if (!pdf) {
        const started = Date.now();
        try {
          if (!options.renderer)
            throw new RendererUnavailable("No workbook renderer configured");
          pdf = await options.renderer.render({
            html: lookup.html,
            format: lookup.key.format,
            footer: workbookFooter(lookup.record.spec),
          });
        } catch (error) {
          request.log.error(
            {
              err: error instanceof Error ? error.message : String(error),
              durationMs: Date.now() - started,
            },
            "Workbook PDF render failed",
          );
          throw new ApiError(
            503,
            "Your workbook is being prepared; try again in a minute.",
          );
        }
        request.log.info(
          { durationMs: Date.now() - started, bytes: pdf.length },
          "Workbook PDF rendered",
        );
        const rendered = pdf;
        await options.repository.transaction(accountId, learnerId, (tx) =>
          tx.saveWorkbookPdf(lookup.key, rendered),
        );
      }
      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="amp-workbook-${lookup.record.date}-${lookup.record.number}-${lookup.key.format}.pdf"`,
        )
        .send(pdf);
    },
  );
}
