import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app.js";
import {
  ApiError,
  type LearnerTransaction,
  type Repository,
} from "../src/server/repository.js";
import type { WorkbookRecord } from "../src/workbook/contracts.js";
import { composableDate } from "../src/workbook/routes.js";
import { sampleLearners, simulateLearner } from "../src/workbook/synthetic.js";

const learnerId = "7b8a3c1e-2f4d-4e6a-9b1c-0d2e3f4a5b6c";
const other = "11111111-2222-4333-8444-555555555555";
const today = new Date().toISOString().slice(0, 10);
const kindergartner = sampleLearners.find((l) => l.id === "new-kindergartner")!;
const third = sampleLearners.find((l) => l.id === "third-grade")!;

/** One learner's workbooks in memory; evidence from a synthetic learner. */
function memoryRepository(
  options: { access?: boolean; learner?: typeof third } = {},
) {
  const rows: (WorkbookRecord & { learnerId: string })[] = [];
  const simulated = simulateLearner(options.learner ?? third, Date.now());
  const repository = {
    hasConsent: async () => true,
    list: async (account: string) =>
      account === "parent"
        ? [{ id: learnerId, name: "Sample learner", birthYear: 2017 }]
        : [],
    transaction: async <T>(
      account: string,
      id: string,
      run: (tx: LearnerTransaction) => Promise<T>,
    ) => {
      if (account !== "parent" || id !== learnerId)
        throw new ApiError(404, "Learner not found");
      const mine = () => rows.filter((r) => r.learnerId === id);
      const tx = {
        hasAccess: async () => options.access ?? true,
        frontier: async () => simulated.frontier,
        skillEvidence: async () => simulated.evidence,
        recentAttempts: async () => simulated.attempts.slice(-12),
        workbooks: async (date?: string) =>
          mine()
            .filter((r) => !date || r.date === date)
            .sort(
              (a, b) =>
                b.date.localeCompare(a.date) ||
                b.number - a.number ||
                a.minutes - b.minutes,
            )
            .map((r) => ({ ...r })),
        workbook: async (workbookId: string) => {
          const found = mine().find((r) => r.id === workbookId);
          return found && { ...found };
        },
        saveWorkbook: async (record: WorkbookRecord) => {
          const found = mine().find(
            (r) =>
              r.date === record.date &&
              r.number === record.number &&
              r.minutes === record.minutes,
          );
          if (found) return { ...found };
          rows.push({ ...record, learnerId: id });
          return { ...record };
        },
        setWorkbookPaper: async (
          workbookId: string,
          paper: WorkbookRecord["paper"],
        ) => {
          mine().find((r) => r.id === workbookId)!.paper = paper;
        },
      } as unknown as LearnerTransaction;
      return run(tx);
    },
  } as unknown as Repository;
  return { repository, rows };
}
function app(
  repository: Repository,
  development = true,
  authenticate = async (request: { headers: Record<string, unknown> }) =>
    String(request.headers.authorization ?? "").replace(/^Bearer /, ""),
) {
  return buildApp({
    repository,
    development,
    authenticate: authenticate as never,
  });
}
const headers = { authorization: "Bearer parent" };
const url = `/api/v1/learners/${learnerId}/workbooks`;

test("the same date, number and length return the stored workbook; no number makes another", async () => {
  const { repository, rows } = memoryRepository();
  const server = app(repository);
  const body = { date: today, minutes: 45, paper: "letter" };
  const first = await server.inject({
    method: "POST",
    url,
    headers,
    payload: { ...body, number: 1 },
  });
  assert.equal(first.statusCode, 201, first.body);
  const made = first.json();
  assert.equal(made.number, 1);
  assert.match(made.code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.ok(made.problems >= 8, `${made.problems} problems`);
  assert.ok(Math.abs(made.estimatedMinutes - 45) <= 10);
  assert.ok(made.sections.some((s: { kind: string }) => s.kind === "practice"));

  const again = await server.inject({
    method: "POST",
    url,
    headers,
    payload: { ...body, number: 1 },
  });
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().id, made.id);
  assert.equal(again.json().code, made.code);
  assert.equal(rows.length, 1);

  const another = await server.inject({
    method: "POST",
    url,
    headers,
    payload: body,
  });
  assert.equal(another.statusCode, 201);
  assert.equal(another.json().number, 2);
  assert.notEqual(another.json().code, made.code);

  // A different length of the same number is its own workbook.
  const short = await server.inject({
    method: "POST",
    url,
    headers,
    payload: { ...body, minutes: 30, number: 1 },
  });
  assert.equal(short.statusCode, 201);
  assert.equal(short.json().number, 1);
  assert.ok(short.json().estimatedMinutes < made.estimatedMinutes);

  // Paper size is a print preference: changing it keeps the problems.
  const a4 = await server.inject({
    method: "POST",
    url,
    headers,
    payload: { ...body, number: 1, paper: "a4" },
  });
  assert.equal(a4.json().id, made.id);
  assert.equal(a4.json().paper, "a4");
  assert.equal(a4.json().code, made.code);

  const history = await server.inject({ url, headers });
  assert.equal(history.statusCode, 200);
  assert.deepEqual(
    history
      .json()
      .workbooks.map((w: { number: number; minutes: number }) => [
        w.number,
        w.minutes,
      ]),
    [
      [2, 45],
      [1, 30],
      [1, 45],
    ],
  );
  const filtered = await server.inject({
    url: `${url}?date=2020-01-01`,
    headers,
  });
  assert.deepEqual(filtered.json().workbooks, []);
});

test("composition is deterministic per learner, date and number", async () => {
  const codes = [];
  for (let i = 0; i < 2; i++) {
    const server = app(memoryRepository().repository);
    const made = await server.inject({
      method: "POST",
      url,
      headers,
      payload: { date: today, minutes: 60, paper: "letter", number: 3 },
    });
    codes.push(made.json().code);
  }
  assert.equal(codes[0], codes[1]);
});

test("a learner with no answers gets a workbook from the starting estimate", async () => {
  const server = app(memoryRepository({ learner: kindergartner }).repository);
  const made = await server.inject({
    method: "POST",
    url,
    headers,
    payload: { date: today, minutes: 30, paper: "letter" },
  });
  assert.equal(made.statusCode, 201, made.body);
  assert.ok(made.json().problems > 0);
});

test("new workbooks are for today; stored ones of any date stay available", async () => {
  const { repository, rows } = memoryRepository();
  const server = app(repository);
  const old = await server.inject({
    method: "POST",
    url,
    headers,
    payload: { date: "2026-01-05", minutes: 45, paper: "letter" },
  });
  assert.equal(old.statusCode, 400);
  assert.match(old.json().error, /today/);
  assert.equal(rows.length, 0);
  assert.equal(composableDate(today, Date.now()), true);
  const day = 86_400_000;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  assert.equal(composableDate(iso(Date.now() + day), Date.now()), true);
  assert.equal(composableDate(iso(Date.now() - day), Date.now()), true);
  assert.equal(composableDate(iso(Date.now() - 2 * day), Date.now()), false);
  for (const payload of [
    { date: today, minutes: 40, paper: "letter" },
    { date: today, minutes: 45, paper: "legal" },
    { date: "2026-02-30", minutes: 45, paper: "letter" },
    { date: "0000-01-01", minutes: 45, paper: "letter" },
    { date: today, minutes: 45, paper: "letter", number: 0 },
    { date: today, minutes: 45, paper: "letter", extra: true },
  ]) {
    const response = await server.inject({
      method: "POST",
      url,
      headers,
      payload,
    });
    assert.equal(response.statusCode, 400, JSON.stringify(payload));
  }
});

test("workbooks require the learner's parent, a license and a full account", async () => {
  const unlicensed = app(memoryRepository({ access: false }).repository, false);
  const denied = await unlicensed.inject({
    method: "POST",
    url,
    headers,
    payload: { date: today, minutes: 45, paper: "letter" },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal((await unlicensed.inject({ url, headers })).statusCode, 403);

  const server = app(memoryRepository().repository);
  const stranger = await server.inject({
    url,
    headers: { authorization: "Bearer someone-else" },
  });
  assert.equal(stranger.statusCode, 404);
  const wrongLearner = await server.inject({
    url: `/api/v1/learners/${other}/workbooks`,
    headers,
  });
  assert.equal(wrongLearner.statusCode, 404);
  const trial = await server.inject({
    url,
    headers: { authorization: "Bearer trial:abc" },
  });
  assert.equal(trial.statusCode, 403);
});

test("the printable document reprints the stored workbook", async () => {
  const server = app(memoryRepository().repository);
  const made = (
    await server.inject({
      method: "POST",
      url,
      headers,
      payload: { date: today, minutes: 30, paper: "a4" },
    })
  ).json();
  const document = await server.inject({
    url: `${url}/${made.id}/document`,
    headers,
  });
  assert.equal(document.statusCode, 200);
  assert.match(document.headers["content-type"] as string, /text\/html/);
  assert.match(
    document.headers["content-disposition"] as string,
    new RegExp(`amp-workbook-${today}-1\\.html`),
  );
  assert.ok(document.body.includes(made.code));
  assert.ok(document.body.includes("size:A4"));
  const letter = await server.inject({
    url: `${url}/${made.id}/document?paper=letter`,
    headers,
  });
  assert.ok(letter.body.includes("size:letter"));
  const missing = await server.inject({
    url: `${url}/${other}/document`,
    headers,
  });
  assert.equal(missing.statusCode, 404);
});

test("a workbook whose templates changed version is not reprinted as if unchanged", async () => {
  const { repository, rows } = memoryRepository();
  const server = app(repository);
  const made = (
    await server.inject({
      method: "POST",
      url,
      headers,
      payload: { date: today, minutes: 30, paper: "letter" },
    })
  ).json();
  rows[0]!.spec.sections[0]!.items[0]!.templateVersion -= 1;
  const document = await server.inject({
    url: `${url}/${made.id}/document`,
    headers,
  });
  assert.equal(document.statusCode, 410);
  assert.match(document.json().error, /Make today's workbook/);
  const history = await server.inject({
    url: `${url}?date=0000-01-01`,
    headers,
  });
  assert.equal(history.statusCode, 400);
});
