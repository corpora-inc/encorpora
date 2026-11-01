import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
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
  workbookPapers,
  workbookRequestSchema,
  type WorkbookRecord,
  type WorkbookSummary,
} from "./contracts.js";
import { workbookHtml } from "./render.js";

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

  /** The printable workbook as one self-contained HTML document. */
  app.get(
    "/api/v1/learners/:learnerId/workbooks/:workbookId/document",
    async (request, reply) => {
      const accountId = await account(request);
      const { learnerId, workbookId } = workbookParams.parse(request.params);
      const { paper } = z
        .object({ paper: z.enum(workbookPapers).optional() })
        .strict()
        .parse(request.query);
      const learnerName = (await options.repository.list(accountId)).find(
        (l) => l.id === learnerId,
      )?.name;
      const record = await options.repository.transaction(
        accountId,
        learnerId,
        async (tx) => {
          await access(tx);
          const found = await tx.workbook(workbookId);
          if (!found) throw new ApiError(404, "Workbook not found");
          return found;
        },
      );
      if (!workbookIsCurrent(record.spec))
        throw new ApiError(
          410,
          "Some problems in this workbook have been updated since it was made. Make today's workbook instead.",
        );
      const html = workbookHtml(record.spec, {
        lessons,
        skillTitle,
        learnerName,
        paper: paper ?? record.paper,
      });
      return reply
        .type("text/html; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="amp-workbook-${record.date}-${record.number}.html"`,
        )
        .send(html);
    },
  );
}
