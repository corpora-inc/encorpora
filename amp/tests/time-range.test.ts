import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { periodRange } from "../src/schools/teacher-reads.js";
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
