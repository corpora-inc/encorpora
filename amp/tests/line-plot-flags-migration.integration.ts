import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Pool } from "pg";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight";

test(
  "line-plot and shape-composer report migrations preserve installed formats in either order",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const pool = new Pool({ connectionString: url, max: 1 });
    const client = await pool.connect();
    const migrations = await Promise.all(
      [
        ["line-plot-build", "0100-line-plot-build-problem-flags.sql"],
        ["shape-composer", "0105-shape-composer-problem-flags.sql"],
      ].map(async ([kind, file]) => ({
        kind,
        sql: await readFile(
          new URL(`../migrations/${file}`, import.meta.url),
          "utf8",
        ),
      })),
    );
    try {
      for (const order of [migrations, [...migrations].reverse()]) {
        await client.query("BEGIN");
        try {
          await client.query(`CREATE TEMP TABLE amp_problem_flags (
            response_kind text NOT NULL,
            response text NOT NULL,
            CONSTRAINT amp_problem_flags_response_kind_check
              CHECK (response_kind IN ('number', 'installed-format')),
            CONSTRAINT amp_problem_flags_response_check
              CHECK (char_length(response) <= 200)
          ) ON COMMIT DROP`);
          await client.query(
            "INSERT INTO amp_problem_flags VALUES ('installed-format', '1')",
          );
          for (const migration of order) {
            await client.query(migration.sql);
            await client.query(
              "INSERT INTO amp_problem_flags VALUES ($1, $2)",
              [
                migration.kind,
                migration.kind === "shape-composer"
                  ? "x".repeat(201)
                  : '{"counts":{"1":1}}',
              ],
            );
          }
          assert.deepEqual(
            (
              await client.query(
                "SELECT response_kind FROM amp_problem_flags ORDER BY response_kind",
              )
            ).rows.map((row) => row.response_kind),
            ["installed-format", "line-plot-build", "shape-composer"],
          );
          await assert.rejects(
            client.query(
              "INSERT INTO amp_problem_flags VALUES ('unknown-format', '1')",
            ),
            { code: "23514" },
          );
        } finally {
          await client.query("ROLLBACK");
        }
      }
    } finally {
      client.release();
      await pool.end();
    }
  },
);
