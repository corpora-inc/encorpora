import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app.js";
import {
  ApiError,
  type LearnerTransaction,
  type Outcome,
  type Repository,
  type SavedProblem,
} from "../src/server/repository.js";
import { estimateFrontier } from "../src/learning/frontier.js";
import {
  planMixedPractice,
  templateGrade,
} from "../src/server/mixed-practice.js";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { templates, generateProblem } from "../src/math/engine.js";
import { skills } from "../src/curriculum/catalog.js";
import { guessChanceOf } from "../src/math/guess-chance.js";
import type { WorkbookRecord } from "../src/workbook/contracts.js";
import { workbookProblems } from "../src/workbook/compose.js";
import {
  PAPER_MARK_WEIGHT,
  workbookTemplateIds,
} from "../src/workbook/results.js";
import { defaultPracticeSettings } from "../src/learning/practice-settings.js";
import { shortResultLabels as shortLabels } from "../src/workbook/result-labels.js";
import { sampleLearners, simulateLearner } from "../src/workbook/synthetic.js";

const learnerId = "3c2b1a0f-9e8d-4c7b-8a6f-5e4d3c2b1a0f";
const today = new Date().toISOString().slice(0, 10);
const headers = { authorization: "Bearer parent" };
const url = `/api/v1/learners/${learnerId}/workbooks`;

function memory() {
  const simulated = simulateLearner(
    sampleLearners.find((l) => l.id === "third-grade")!,
    Date.now(),
  );
  const rows: WorkbookRecord[] = [];
  const problems = new Map<string, SavedProblem>();
  const attempts: Outcome[] = [];
  const repository = {
    hasConsent: async () => true,
    list: async () => [{ id: learnerId, name: "Sample", birthYear: 2017 }],
    transaction: async <T>(
      account: string,
      id: string,
      run: (tx: LearnerTransaction) => Promise<T>,
    ) => {
      if (account !== "parent" || id !== learnerId)
        throw new ApiError(404, "Learner not found");
      // Transactions roll back on error, as Postgres does.
      const snapshot = attempts.length;
      const saved = new Map(problems);
      try {
        return await run({
          hasAccess: async () => true,
          practiceSettings: async () => defaultPracticeSettings(),
          frontier: async () => simulated.frontier,
          skillEvidence: async () => simulated.evidence,
          recentAttempts: async () => simulated.attempts.slice(-12),
          workbooks: async (date?: string) =>
            rows.filter((r) => !date || r.date === date).map((r) => ({ ...r })),
          workbook: async (wid: string) => rows.find((r) => r.id === wid),
          workbookByCode: async (code: string) =>
            rows.find((r) => r.code === code),
          recentWorkbooks: async () => rows,
          saveWorkbook: async (record: WorkbookRecord) => {
            rows.push(record);
            return record;
          },
          setWorkbookPaper: async () => undefined,
          attemptByRequest: async (requestId: string) =>
            attempts.find((a) => a.requestId === requestId),
          attemptByProblem: async (problemId: string) =>
            attempts.find((a) => a.problemId === problemId),
          problem: async (pid: string) => problems.get(pid),
          saveProblem: async (p: SavedProblem) => {
            problems.set(p.public.id, p);
          },
          saveAttempt: async (o: Outcome) => {
            attempts.push(o);
          },
        } as unknown as LearnerTransaction);
      } catch (error) {
        attempts.length = snapshot;
        problems.clear();
        for (const [k, v] of saved) problems.set(k, v);
        throw error;
      }
    },
  } as unknown as Repository;
  const app = buildApp({
    repository,
    development: true,
    authenticate: (async (request: { headers: Record<string, unknown> }) =>
      String(request.headers.authorization ?? "").replace(
        /^Bearer /,
        "",
      )) as never,
  });
  return { app, rows, attempts, problems };
}

test("results are graded by the app's grader, stored as paper evidence, and idempotent", async () => {
  const { app, rows, attempts, problems } = memory();
  const made = (
    await app.inject({
      method: "POST",
      url,
      headers,
      payload: { date: today, minutes: 45, paper: "letter" },
    })
  ).json();
  const view = await app.inject({ url: `${url}/${made.id}/results`, headers });
  assert.equal(view.statusCode, 200, view.body);
  const body = view.json();
  const generated = workbookProblems(rows[0]!.spec);
  assert.equal(body.rows.length, generated.length);
  assert.ok(body.rows.every((r: { recorded: unknown }) => r.recorded === null));
  const specItems = rows[0]!.spec.sections.flatMap((s) => s.items);
  assert.deepEqual(
    body.rows.map((r: { label: string }) => r.label),
    specItems.map(
      (i) =>
        templates.find((t) => t.id === i.templateId)!.title.length > 0 &&
        (shortLabels[i.templateId] ??
          templates.find((t) => t.id === i.templateId)!.title),
    ),
  );
  const typed = body.rows.findIndex(
    (r: { entry: string }) => r.entry === "number",
  );
  const choice = body.rows.findIndex(
    (r: { entry: string }) => r.entry === "choice",
  );
  assert.ok(typed >= 0, "the workbook has a typed answer to grade");
  const others = body.rows
    .map((_: unknown, i: number) => i)
    .filter((i: number) => i !== typed && i !== choice)
    .slice(0, 2);
  const entries = [
    { n: typed + 1, answer: generated[typed]!.answer },
    { n: others[0] + 1, mark: "right" },
    { n: others[1] + 1, mark: "not-yet" },
    ...(choice >= 0
      ? [
          {
            n: choice + 1,
            answer: body.rows[choice].options.find(
              (o: { id: string }) => o.id !== generated[choice]!.answer,
            ).id,
          },
        ]
      : []),
  ];
  const saved = await app.inject({
    method: "POST",
    url: `${url}/${made.id}/results`,
    headers,
    payload: { entries },
  });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().recorded, entries.length);
  assert.equal(attempts.length, entries.length);
  const byN = (n: number) =>
    attempts.find((a) => a.requestId === `paper:${made.id}:${n}`)!;
  const graded = byN(typed + 1);
  assert.equal(graded.correct, true);
  assert.equal(graded.assisted, false);
  assert.equal(graded.evidenceSource, "paper");
  assert.equal(graded.evidenceWeight, undefined, "graded answers weigh 1");
  assert.equal(
    graded.templateId,
    rows[0]!.spec.sections.flatMap((s) => s.items)[typed]!.templateId,
  );
  assert.equal(byN(others[0] + 1).correct, true);
  assert.equal(byN(others[0] + 1).evidenceWeight, PAPER_MARK_WEIGHT);
  assert.equal(byN(others[1] + 1).correct, false);
  if (choice >= 0) {
    assert.equal(byN(choice + 1).correct, false);
    const row = saved.json().rows[choice];
    assert.equal(row.recorded.method, "answer");
    assert.match(row.recorded.response, /^[A-D]$/);
  }
  const instance = problems.get(`paper:${made.id}:${typed + 1}`)!;
  assert.equal(instance.public.prompt, generated[typed]!.public.prompt);
  assert.deepEqual((instance.selection as { reason: string }).reason, "paper");

  // Entering the same results again, or different ones for recorded rows,
  // adds nothing.
  const again = await app.inject({
    method: "POST",
    url: `${url}/${made.id}/results`,
    headers,
    payload: {
      entries: entries.map((e) =>
        "mark" in e
          ? { n: e.n, mark: e.mark === "right" ? "not-yet" : "right" }
          : e,
      ),
    },
  });
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().recorded, 0);
  assert.equal(attempts.length, entries.length);
  assert.equal(byN(others[0] + 1).correct, true);

  // Lookup by printed code: any case, dash optional.
  const code = made.code as string;
  const found = await app.inject({
    url: `${url}?code=${code.toLowerCase().replace("-", "")}`,
    headers,
  });
  assert.equal(found.json().workbooks[0].id, made.id);
  const none = await app.inject({ url: `${url}?code=ZZZZ-ZZZZ`, headers });
  assert.deepEqual(none.json().workbooks, []);
  const bad = await app.inject({ url: `${url}?code=abc`, headers });
  assert.equal(bad.statusCode, 400);
});

test("invalid rows are refused by problem number and nothing is saved", async () => {
  const { app, rows, attempts } = memory();
  const made = (
    await app.inject({
      method: "POST",
      url,
      headers,
      payload: { date: today, minutes: 30, paper: "letter" },
    })
  ).json();
  const view = (
    await app.inject({ url: `${url}/${made.id}/results`, headers })
  ).json();
  const typed = view.rows.find((r: { entry: string }) => r.entry === "number");
  const markOnly = view.rows.find((r: { entry: string }) => r.entry === "mark");
  const cases: [unknown[], number | null][] = [
    [
      [
        { n: 1, mark: "right" },
        { n: typed.n, answer: "seven" },
      ],
      typed.n,
    ],
    [[{ n: 150, mark: "right" }], 150],
    [
      [
        { n: 1, mark: "right" },
        { n: 1, mark: "right" },
      ],
      1,
    ],
    ...(markOnly
      ? ([[[{ n: markOnly.n, answer: "3" }], markOnly.n]] as [
          unknown[],
          number,
        ][])
      : []),
  ];
  for (const [entries, problem] of cases) {
    const response = await app.inject({
      method: "POST",
      url: `${url}/${made.id}/results`,
      headers,
      payload: { entries },
    });
    assert.equal(response.statusCode, 400, JSON.stringify(entries));
    assert.equal(response.json().problem, problem);
    assert.match(response.json().error, new RegExp(`${problem}`));
  }
  assert.equal(attempts.length, 0);
  for (const payload of [{ entries: [] }, { entries: [{ n: 1 }] }, {}]) {
    const response = await app.inject({
      method: "POST",
      url: `${url}/${made.id}/results`,
      headers,
      payload,
    });
    assert.equal(response.statusCode, 400);
  }
  rows[0]!.spec.sections[0]!.items[0]!.templateVersion -= 1;
  const stale = await app.inject({ url: `${url}/${made.id}/results`, headers });
  assert.equal(stale.statusCode, 410);
});

test("mixed practice holds back the templates printed today, unless nothing else is left", () => {
  const simulated = simulateLearner(
    sampleLearners.find((l) => l.id === "third-grade")!,
    Date.now(),
  );
  const plan = (reserved?: Set<string>, pool = templates) =>
    planMixedPractice({
      templates: pool,
      skills,
      attempts: simulated.attempts,
      evidence: simulated.evidence,
      frontier: simulated.frontier,
      count: 5,
      seed: "paper",
      learnerKey: learnerId,
      reservedTemplateIds: reserved,
    }).map((c) => c.template.id);
  const free = plan();
  const reserved = new Set(free);
  const held = plan(reserved);
  assert.ok(held.length > 0);
  assert.ok(
    held.every((id) => !reserved.has(id)),
    "printed templates held back",
  );
  assert.deepEqual(plan(new Set()), free, "no reservation, same plan");
  const only = templates.filter((t) => t.id === free[0]);
  assert.deepEqual(
    plan(new Set([free[0]!]), only),
    plan(undefined, only),
    "a pool of only reserved templates is still served",
  );
  const record = {
    spec: {
      sections: [
        { items: [{ templateId: "a" }, { templateId: "b" }] },
        { items: [{ templateId: "a" }] },
      ],
    },
  } as unknown as WorkbookRecord;
  assert.deepEqual([...workbookTemplateIds([record])], ["a", "b"]);
});

test("a paper mark weighs half in the estimate and never confirms a band alone", () => {
  const nodes = new Map(skills.map((s) => [s.id, s]));
  const byId = new Map(templates.map((t) => [t.id, t]));
  const options = {
    start: 3,
    gradeOf: (id: string) => {
      const t = byId.get(id);
      return t && templateGrade(t, nodes);
    },
    strandOf: (id: string) => nodes.get(byId.get(id)!.skillId)!.strand,
    guessOf: guessChanceOf,
  };
  const hard = templates
    .filter((t) => templateGrade(t, nodes) >= 6 && guessChanceOf(t.id) === 0)
    .slice(0, 6);
  const at = Date.parse("2026-10-01T12:00:00Z");
  const observations = (weight?: number) =>
    hard.map((t, i) => ({
      templateId: t.id,
      correct: true,
      assisted: false,
      createdAt: new Date(at + i * 8 * 3600000).toISOString(),
      ...(weight === undefined ? {} : { evidenceWeight: weight }),
    }));
  const none = estimateFrontier({ ...options, observations: [], now: at });
  const unweighted = estimateFrontier({
    ...options,
    observations: observations(),
    now: at + 2 * 86400000,
  });
  const full = estimateFrontier({
    ...options,
    observations: observations(1),
    now: at + 2 * 86400000,
  });
  const half = estimateFrontier({
    ...options,
    observations: observations(0.5),
    now: at + 2 * 86400000,
  });
  assert.deepEqual(full, unweighted, "weight 1 is the default");
  assert.ok(half.overall.level > none.overall.level);
  assert.ok(half.overall.level < full.overall.level);
  assert.equal(half.overall.independent, 0);
  for (const [strand, band] of Object.entries(half.confirmation ?? {}))
    assert.ok(
      band.level <= (half.unconfirmedCeiling ?? 99),
      `${strand} confirmed by marks alone`,
    );
  // The TypeScript projection mirrors migration 0079.
  const evidence = projectSkillEvidence(
    observations(PAPER_MARK_WEIGHT).map((o, i) => ({
      ...o,
      id: String(i),
      skillId: byId.get(o.templateId)!.skillId,
    })),
  );
  assert.ok(evidence.every((e) => e.independentCorrect === 0));
  assert.ok(evidence.every((e) => e.recentIndependentCorrect === 0));
  void generateProblem;
});

test("results rows are named by the problem type's authored title, never a de-slugged id", async () => {
  const { resultLabel, shortResultLabels } =
    await import("../src/workbook/result-labels.js");
  const { printable } = await import("../src/workbook/compose.js");
  const byId = new Map(templates.map((t) => [t.id, t]));
  for (const [id, short] of Object.entries(shortResultLabels)) {
    const template = byId.get(id);
    assert.ok(template, `${id} is a real problem type`);
    assert.ok(short.length < template.title.length, `${id} label is shorter`);
    assert.match(short, /^[A-Z]/, `${id} label is sentence case`);
  }
  for (const t of templates.filter(printable)) {
    const label = resultLabel(t.id);
    assert.equal(label, shortResultLabels[t.id] ?? t.title);
    assert.notEqual(label, t.id);
  }
  // The skill names this replaces read like ids.
  assert.equal(
    resultLabel("read-clock-five-minutes"),
    "Read a clock to five minutes",
  );
});
