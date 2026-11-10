import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight";

const markingMigration = "0101-unit-square-marking-problem-flags.sql";

for (const upgrade of [false, true]) {
  test(
    `unit-square reports preserve every installed format on ${upgrade ? "upgrade" : "fresh install"}`,
    { skip: !process.env.AMP_TEST_DATABASE_URL },
    async (t) => {
      const url = process.env.AMP_TEST_DATABASE_URL!;
      assertTestDatabaseTarget(url);
      const schema = `amp_marking_migration_${randomUUID().replaceAll("-", "")}`;
      const admin = new Pool({ connectionString: url, max: 1 });
      const scoped = new URL(url);
      scoped.searchParams.set("options", `-c search_path=${schema}`);
      const db = new Pool({ connectionString: scoped.href, max: 1 });
      t.after(async () => {
        await db.end();
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        await admin.end();
      });
      await admin.query(`CREATE SCHEMA ${schema}`);
      const report = async (kind: string, response: string) => {
        const id = randomUUID();
        await db.query(
          `INSERT INTO amp_problem_flags
            (id,request_id,problem_id,template_id,template_version,seed,skill_id,
             prompt,response_kind,response,outcome,reasons,client_kind,
             viewport_width,viewport_height)
           VALUES($1,$1,'migration-fixture','migration-fixture',1,'fixture',
             'fixture','Fixture problem',$2,$3,'incorrect',ARRAY['other'],'web',390,844)`,
          [id, kind, response],
        );
        return id;
      };
      let existingId: string | undefined;
      if (upgrade) {
        // Main can ship later-numbered migrations before this branch lands.
        const directory = new URL("../migrations/", import.meta.url);
        await db.query(
          "CREATE TABLE amp_migrations(name text PRIMARY KEY, checksum text NOT NULL)",
        );
        for (const name of (await readdir(directory))
          .filter((name) => name.endsWith(".sql") && name !== markingMigration)
          .sort()) {
          const sql = await readFile(new URL(name, directory), "utf8");
          await db.query(sql);
          await db.query("INSERT INTO amp_migrations VALUES($1,$2)", [
            name,
            createHash("sha256").update(sql).digest("hex"),
          ]);
        }
        existingId = await report("shape-composer", "x".repeat(4000));
      }
      await migrate(scoped.href);
      await migrate(scoped.href);
      if (existingId)
        assert.deepEqual(
          (
            await db.query(
              "SELECT response_kind,response FROM amp_problem_flags WHERE id=$1",
              [existingId],
            )
          ).rows,
          [{ response_kind: "shape-composer", response: "x".repeat(4000) }],
        );
      for (const kind of [
        "number",
        "fraction",
        "choice",
        "multi-select",
        "point-plot",
        "multi-part-choice",
        "figure-choice",
        "structured-work",
        "line-plot-build",
        "unit-square-marking",
      ])
        await report(kind, "12");
      await report("shape-composer", "x".repeat(4000));
      for (const [kind, response] of [
        ["unknown-format", "12"],
        ["unit-square-marking", "x".repeat(201)],
        ["shape-composer", "x".repeat(4001)],
      ])
        await assert.rejects(report(kind!, response!), { code: "23514" });
    },
  );
}
