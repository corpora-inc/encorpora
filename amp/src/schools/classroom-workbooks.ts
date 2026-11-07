import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import { skills } from "../curriculum/catalog.js";
import { ApiError, type Repository } from "../server/repository.js";
import { resultLabel } from "../workbook/result-labels.js";
import {
  paperProblemId,
  PaperEntryError,
  recordPaperResults,
} from "../workbook/results.js";
import type { WorkbookRenderer } from "../workbook/pdf.js";
import { workbookWorker } from "../workbook/off-thread.js";
import { workbookFooter } from "../workbook/render.js";
import {
  findOrMakeWorkbook,
  renderWorkbookPdf,
  workbookIsCurrent,
  workbookSummary,
} from "../workbook/routes.js";
import type { WorkbookRecord } from "../workbook/contracts.js";
import type {
  MarkedProblem,
  MarksView,
  StackSet,
  StackView,
} from "./classroom-contracts.js";
import { SchoolError } from "./contracts.js";
import { activeToday, schoolAccountId } from "./principal.js";
import { STUDENT_NAME } from "./sign-in.js";

/** A teacher's workbook stack. Each workbook is an ordinary one in the student's
 * own learner, so history, results and evidence work as they always do. */
const DAYS_AHEAD = 7;
const DAY = 86_400_000;
const shiftDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);

/** The school's calendar today, and the last day a new workbook can be for. */
export async function stackDates(pool: Pick<Pool, "query">, orgId: string) {
  const today: string = (
    await pool.query(
      "SELECT ((now() AT TIME ZONE timezone)::date)::text AS day FROM amp_orgs WHERE id=$1",
      [orgId],
    )
  ).rows[0].day;
  return { today, lastDate: shiftDays(today, DAYS_AHEAD) };
}

type StackStudent = {
  id: string;
  learner_id: string;
  name: string;
  seated: boolean;
};
/** Students in the class today, in the order a teacher reads them. */
async function stackRoster(
  pool: Pick<Pool, "query">,
  classId: string,
): Promise<StackStudent[]> {
  return (
    await pool.query(
      `SELECT p.id,p.learner_id,${STUDENT_NAME} AS name,
         EXISTS(SELECT 1 FROM amp_grants g WHERE g.learner_id=p.learner_id AND g.status='active'
           AND g.starts_at<=now() AND g.ends_at>now()) AS seated
       FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
       JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
       WHERE e.class_id=$1 AND e.role='student' AND ${activeToday("e", "o")}
       ORDER BY lower(${STUDENT_NAME}),p.id`,
      [classId],
    )
  ).rows;
}
async function studentInClass(
  pool: Pick<Pool, "query">,
  classId: string,
  personId: string,
) {
  const student = (await stackRoster(pool, classId)).find(
    (row) => row.id === personId,
  );
  if (!student) throw new SchoolError(404, "not_found");
  return student;
}

const RECENT_SETS = 12;
/** Workbooks are grouped by date, number and length: what one print made. */
async function recentSets(
  pool: Pick<Pool, "query">,
  learners: string[],
  today: string,
  date?: string,
): Promise<StackSet[]> {
  if (!learners.length) return [];
  return (
    await pool.query(
      `SELECT w.workbook_date::text AS date,w.number,w.minutes,w.spec->>'focusSkill' AS focus,count(*)::int AS students,
         count(*) FILTER (WHERE EXISTS(SELECT 1 FROM amp_attempts a
           WHERE a.learner_id=w.learner_id AND a.request_id LIKE 'paper:'||w.id||':%'))::int AS marked
       FROM amp_workbooks w
       WHERE w.learner_id=ANY($1::text[]) AND (
         ($3::date IS NOT NULL AND w.workbook_date=$3::date)
         OR ($3::date IS NULL AND w.workbook_date>=$2::date-60))
       GROUP BY w.workbook_date,w.number,w.minutes,w.spec->>'focusSkill'
       ORDER BY w.workbook_date DESC,w.number DESC,w.minutes
       LIMIT $4`,
      [learners, today, date ?? null, RECENT_SETS],
    )
  ).rows;
}

export async function stackView(
  pool: Pool,
  klass: { classId: string; orgId: string },
  canPrint: boolean,
  renderer: WorkbookRenderer | null | undefined,
  skill?: string,
): Promise<StackView> {
  const dates = await stackDates(pool, klass.orgId);
  const name = (
    await pool.query("SELECT name FROM amp_classes WHERE id=$1", [
      klass.classId,
    ])
  ).rows[0].name;
  const roster = await stackRoster(pool, klass.classId);
  return {
    class: { id: klass.classId, name },
    ...dates,
    canPrint,
    pdf: !!renderer,
    students: roster.map(({ id, name, seated }) => ({ id, name, seated })),
    recent: await recentSets(
      pool,
      roster.map((row) => row.learner_id),
      dates.today,
    ),
    focus: (() => {
      const found = skill
        ? skills.find((node) => node.id === skill)
        : undefined;
      return found ? { id: found.id, title: found.title } : null;
    })(),
  };
}

type StoredWorkbook = {
  id: string;
  learner_id: string;
  minutes: 30 | 45 | 60;
  code: string;
  spec: WorkbookRecord["spec"];
};
const problemRows = (
  spec: WorkbookRecord["spec"],
  marks: Map<string, boolean>,
  workbookId: string,
): MarkedProblem[] => {
  let n = 0;
  return spec.sections.flatMap((section) =>
    section.items.map((item) => {
      const correct = marks.get(paperProblemId(workbookId, ++n));
      return {
        n,
        section: section.kind,
        label: resultLabel(item.templateId),
        mark: correct === undefined ? null : correct ? "right" : "not-yet",
      };
    }),
  );
};
const attemptsFor = async (
  pool: Pick<Pool, "query">,
  learners: string[],
  requestIds: string[],
) => {
  const attempts = await pool.query(
    `SELECT request_id,(outcome->>'correct')::boolean AS correct FROM amp_attempts
     WHERE learner_id=ANY($1::text[]) AND request_id=ANY($2::text[])`,
    [learners, requestIds],
  );
  return new Map<string, boolean>(
    attempts.rows.map((row) => [row.request_id, row.correct]),
  );
};

/** Every student's sheet for one print, from one read: marking a class must not
 * take a lock on each learner. */
export async function marksView(
  pool: Pool,
  classId: string,
  query: { date: string; set?: number },
  canMark: boolean,
): Promise<MarksView> {
  const name = (
    await pool.query("SELECT name FROM amp_classes WHERE id=$1", [classId])
  ).rows[0].name;
  const roster = await stackRoster(pool, classId);
  const learners = roster.map((row) => row.learner_id);
  // One print, one number: a number used for two lengths reads as the newest.
  const sets = (
    await recentSets(pool, learners, query.date, query.date)
  ).filter(
    (entry, index, all) =>
      all.findIndex((other) => other.number === entry.number) === index,
  );
  const set =
    sets.find((row) => row.number === query.set)?.number ??
    sets[0]?.number ??
    null;
  const stored =
    set === null
      ? []
      : ((
          await pool.query(
            `SELECT DISTINCT ON (w.learner_id) w.id::text AS id,w.learner_id,w.minutes,w.code,w.spec
             FROM amp_workbooks w
             WHERE w.learner_id=ANY($1::text[]) AND w.workbook_date=$2::date AND w.number=$3
             ORDER BY w.learner_id,w.created_at DESC`,
            [learners, query.date, set],
          )
        ).rows as StoredWorkbook[]);
  const requestIds = stored.flatMap((workbook) => {
    const count = workbook.spec.sections.reduce(
      (sum, section) => sum + section.items.length,
      0,
    );
    return Array.from({ length: count }, (_, index) =>
      paperProblemId(workbook.id, index + 1),
    );
  });
  const marks = await attemptsFor(pool, learners, requestIds);
  const byLearner = new Map(stored.map((row) => [row.learner_id, row]));
  return {
    class: { id: classId, name },
    date: query.date,
    set,
    sets,
    canMark,
    students: roster.map((student) => {
      const workbook = byLearner.get(student.learner_id);
      return {
        id: student.id,
        name: student.name,
        workbook: workbook
          ? {
              id: workbook.id,
              minutes: workbook.minutes,
              code: workbook.code,
              stale: !workbookIsCurrent(workbook.spec),
              problems: problemRows(workbook.spec, marks, workbook.id),
            }
          : null,
      };
    }),
  };
}

/** A learner transaction's refusals, in a school's words. */
function explained(error: unknown): unknown {
  if (error instanceof PaperEntryError)
    return new SchoolError(400, "invalid_school_request");
  if (error instanceof ApiError) {
    if (error.statusCode === 404) return new SchoolError(404, "not_found");
    if (error.statusCode === 403)
      return new SchoolError(409, "agreement_required");
    if (error.statusCode === 503)
      return new SchoolError(503, "workbook_renderer_unavailable", 5);
    if (error.statusCode === 400) return new SchoolError(400, "workbook_date");
  }
  return error;
}
const STALE = () => new SchoolError(410, "workbook_stale");

/** One student's workbook for the date. The number is the caller's, so a retry
 * finds what the first try made. */
export async function makeStudentWorkbook(
  pool: Pool,
  learning: Repository,
  klass: { classId: string; orgId: string },
  personId: string,
  input: {
    date: string;
    minutes: 30 | 45 | 60;
    paper: WorkbookRecord["paper"];
    number: number;
    skill?: string;
  },
) {
  const student = await studentInClass(pool, klass.classId, personId);
  const { today, lastDate } = await stackDates(pool, klass.orgId);
  const at = Date.now();
  try {
    return await learning.transaction(
      schoolAccountId(personId),
      student.learner_id,
      async (tx) => {
        if (!(await tx.hasAccess())) throw new SchoolError(409, "needs_seat");
        const { skill, ...rest } = input;
        const made = await findOrMakeWorkbook(
          tx,
          student.learner_id,
          { ...rest, ...(skill ? { focusSkill: skill } : {}) },
          at,
          {
            allowed: (date) => {
              if (date < today || date > lastDate)
                throw new SchoolError(400, "workbook_date");
            },
          },
        );
        return { status: made.status, body: workbookSummary(made.record) };
      },
    );
  } catch (error) {
    throw explained(error);
  }
}

/** The page's QR opens a teacher's marking route, not a parent's. */
function markingUrl(
  origin: string,
  place: { orgId: string; classId: string },
  record: { date: string; number: number },
  personId: string,
): string | undefined {
  if (!origin) return undefined;
  const base = new URL(origin);
  if (base.protocol !== "https:" && base.hostname !== "localhost")
    return undefined;
  return new URL(
    `/school/${place.orgId}/classes/${place.classId}/workbooks/${record.date}?set=${record.number}&student=${personId}`,
    base.origin,
  ).href;
}

/** One student's workbook as a PDF: rendered per request, never stored, and
 * outside the learner transaction. */
export async function studentWorkbookPdf(
  pool: Pool,
  learning: Repository,
  renderer: WorkbookRenderer | null | undefined,
  log: FastifyBaseLogger,
  origin: string,
  klass: { classId: string; orgId: string },
  personId: string,
  workbookId: string,
  format: "Letter" | "A4" | undefined,
) {
  const student = await studentInClass(pool, klass.classId, personId);
  try {
    const record = await learning.transaction(
      schoolAccountId(personId),
      student.learner_id,
      async (tx) => {
        if (!(await tx.hasAccess())) throw new SchoolError(409, "needs_seat");
        const found = await tx.workbook(workbookId);
        if (!found) throw new SchoolError(404, "not_found");
        return found;
      },
    );
    if (!workbookIsCurrent(record.spec)) throw STALE();
    const paperFormat = format ?? (record.paper === "a4" ? "A4" : "Letter");
    const resultsUrl = markingUrl(origin, klass, record, personId);
    const html = await workbookWorker(log).html({
      spec: record.spec,
      learnerName: student.name,
      paper: paperFormat === "A4" ? "a4" : "letter",
      ...(resultsUrl ? { resultsUrl } : {}),
    });
    const pdf = await renderWorkbookPdf(
      renderer,
      { html, format: paperFormat, footer: workbookFooter(record.spec) },
      log,
    );
    return { pdf, record, format: paperFormat };
  } catch (error) {
    throw explained(error);
  }
}

/** Saves a teacher's marks through the same path as a parent's, with the same
 * weights. Anything already recorded stays as it was, so saving twice is safe. */
export async function saveStudentMarks(
  pool: Pool,
  learning: Repository,
  classId: string,
  personId: string,
  workbookId: string,
  entries: { n: number; mark: "right" | "not-yet" }[],
) {
  const student = await studentInClass(pool, classId, personId);
  try {
    return await learning.transaction(
      schoolAccountId(personId),
      student.learner_id,
      async (tx) => {
        if (!(await tx.hasAccess())) throw new SchoolError(409, "needs_seat");
        const record = await tx.workbook(workbookId);
        if (!record) throw new SchoolError(404, "not_found");
        if (!workbookIsCurrent(record.spec)) throw STALE();
        const recorded = await recordPaperResults(
          tx,
          record,
          entries,
          new Date(),
          { by: "teacher" },
        );
        const ids = entries.length
          ? record.spec.sections
              .flatMap((section) => section.items)
              .map((_, index) => paperProblemId(record.id, index + 1))
          : [];
        const marks = new Map<string, boolean>();
        for (const id of ids) {
          const attempt = await tx.attemptByRequest(id);
          if (attempt) marks.set(id, attempt.correct);
        }
        return {
          recorded,
          problems: problemRows(record.spec, marks, record.id),
        };
      },
    );
  } catch (error) {
    throw explained(error);
  }
}
