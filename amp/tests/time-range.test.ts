import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import {
  MAX_TIME_DAYS,
  periodRange,
  readTime,
  readStudentTime,
} from "../src/schools/teacher-reads.js";
import { timeQuerySchema } from "../src/schools/teacher-contracts.js";
import type { ClassContext } from "../src/schools/term-grades.js";

test("Time uses local Monday boundaries, four weeks, and exact inclusive starts", async () => {
  const pool = {
    query: () => {
      throw new Error("No calendar query expected");
    },
  } as unknown as Pool;
  // Sunday after the autumn clock change; UTC may already be Monday.
  const context = {
    today: "2026-11-01",
    timezone: "America/New_York",
    sessionId: "",
  } as ClassContext;
  assert.deepEqual(await periodRange(pool, context, "week"), {
    from: "2026-10-26",
    to: "2026-11-01",
  });
  assert.deepEqual(await periodRange(pool, context, "month"), {
    from: "2026-10-05",
    to: "2026-11-01",
  });
  assert.deepEqual(await periodRange(pool, context, "term"), {
    from: "2026-10-05",
    to: "2026-11-01",
  });
  const query = timeQuerySchema.parse({ period: "weeks", from: "2026-10-28" });
  assert.equal(query.period, "month");
  assert.deepEqual(await periodRange(pool, context, query.period, query.from), {
    from: "2026-10-28",
    to: "2026-11-01",
  });
  await assert.rejects(periodRange(pool, context, "week", "2026-11-02"), {
    code: "invalid_time_range",
  });
  assert.equal(
    timeQuerySchema.safeParse({ from: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    timeQuerySchema.safeParse({ from: "0000-01-01" }).success,
    false,
  );
});

test("Time term boundaries and exact starts share the class calendar", async () => {
  const context = {
    today: "2026-11-14",
    sessionId: "year",
    gradingKind: "term",
  } as ClassContext;
  const pool = {
    query: async (sql: string) => ({
      rows: sql.includes("WITH RECURSIVE")
        ? [
            {
              id: "fall",
              name: "Fall",
              kind: "term",
              startsOn: "2026-09-01",
              endsOn: "2026-10-31",
            },
            {
              id: "winter",
              name: "Winter",
              kind: "term",
              startsOn: "2026-12-01",
              endsOn: "2027-02-28",
            },
          ]
        : [],
    }),
  } as unknown as Pool;
  assert.deepEqual(await periodRange(pool, context, "term"), {
    from: "2026-09-01",
    to: "2026-10-31",
  });
  assert.deepEqual(await periodRange(pool, context, "term", "2026-10-10"), {
    from: "2026-10-10",
    to: "2026-10-31",
  });
  await assert.rejects(periodRange(pool, context, "term", "2026-11-01"), {
    code: "invalid_time_range",
  });
});

test("Time rejects more than 400 inclusive days before roster or evidence reads", async () => {
  const pool = {
    query: () => {
      throw new Error("No roster or evidence query allowed");
    },
  } as unknown as Pool;
  const context = { today: "2026-11-14", sessionId: "" } as ClassContext;
  const start = (days: number) =>
    new Date(Date.parse(`${context.today}T00:00:00Z`) - (days - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  assert.equal(MAX_TIME_DAYS, 400);
  assert.deepEqual(await periodRange(pool, context, "week", start(400)), {
    from: start(400),
    to: context.today,
  });
  for (const from of [start(401), "0001-01-01"]) {
    for (const read of [
      () => periodRange(pool, context, "week", from),
      () => readTime(pool, context, "week", from),
      () => readStudentTime(pool, context, "week", "absent-student", from),
    ])
      await assert.rejects(read, {
        statusCode: 400,
        code: "time_range_too_long",
      });
  }
});

test("Time bounds default terms and validates only the final overridden range", async () => {
  const context = {
    today: "2026-11-14",
    sessionId: "year",
    gradingKind: "term",
  } as ClassContext;
  const pool = {
    query: async () => ({
      rows: [
        {
          id: "long",
          name: "Long term",
          kind: "term",
          startsOn: "2024-01-01",
          endsOn: "2026-11-13",
        },
      ],
    }),
  } as unknown as Pool;
  await assert.rejects(periodRange(pool, context, "term"), {
    statusCode: 400,
    code: "time_range_too_long",
  });
  assert.deepEqual(await periodRange(pool, context, "term", "2026-11-01"), {
    from: "2026-11-01",
    to: "2026-11-13",
  });
});
