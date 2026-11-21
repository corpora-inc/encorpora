import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { savePilotInterest } from "../src/research/pilot-routes";

test(
  "the pilot list keeps one entry per email, updates it, and counts the list",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `research_pilot_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href });
    const signup = {
      role: "parent" as const,
      name: "Fixture Parent",
      email: "Parent@Fixture.example",
      learners: 2,
      bands: ["3-5" as const],
      setting: "home" as const,
      place: "AZ",
      tests: ["map" as const],
      source: "A co-op",
      news: false,
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      assert.deepEqual(await savePilotInterest(pool, signup), {
        returning: false,
        total: 1,
      });
      assert.deepEqual(
        await savePilotInterest(pool, {
          ...signup,
          email: "other@fixture.example",
        }),
        { returning: false, total: 2 },
      );
      // The same address in other letters updates the one entry; a blank
      // name or source keeps the one already given.
      const { name: _name, source: _source, ...again } = signup;
      assert.deepEqual(
        await savePilotInterest(pool, {
          ...again,
          email: "parent@fixture.example",
          learners: 3,
          news: true,
        }),
        { returning: true, total: 2 },
      );
      const { rows } = await pool.query(
        "SELECT email,name,learners,source,news FROM amp_research_pilot_interest WHERE lower(email)='parent@fixture.example'",
      );
      assert.deepEqual(rows, [
        {
          email: "parent@fixture.example",
          name: "Fixture Parent",
          learners: 3,
          source: "A co-op",
          news: true,
        },
      ]);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
