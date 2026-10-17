import "../scripts/test-database-preflight.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { PostgresRepository, type Outcome } from "../src/server/repository.js";
import { FamilyRepository } from "../src/family/repository.js";
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
const sql = (file: string) =>
  readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
const origin = Date.parse("2026-01-01T00:00:00Z");
function outcome(
  index: number,
  skillId = "multiplication-facts",
  correct = true,
  assisted = false,
  at = origin + index * 86400000,
): Outcome {
  return {
    id: `a${String(index).padStart(8, "0")}`,
    problemId: `p${index}`,
    requestId: `r${index}`,
    skillId,
    templateId:
      skillId === "multiplication-facts" ? "multiply-facts" : "statistics-mean",
    correct,
    assisted,
    createdAt: new Date(at).toISOString(),
    answer: "private answer",
    response: "child response",
    explanation: ["private explanation"],
  };
}
async function fixture(
  run: (pool: Pool, learning: PostgresRepository) => Promise<void>,
) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_evidence_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const pool = new Pool({
    connectionString: url,
    max: 8,
    options: `-c search_path=${schema}`,
  });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const learning = new PostgresRepository(scoped.href);
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    for (const file of [
      "0001.sql",
      "0002-commerce.sql",
      "0003-parent-consent.sql",
      "0004-parent-lifecycle.sql",
      "0006-commerce-orders.sql",
    ])
      await pool.query(await sql(file));
    await pool.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('evidence-parent','test','verified','private'),('evidence-other','test','verified','private')",
    );
    await pool.query(
      "INSERT INTO amp_learners(id,account_id,name) VALUES('child','evidence-parent','Child fixture'),('other','evidence-other','Foreign fixture')",
    );
    await run(pool, learning);
  } finally {
    await learning.close();
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
async function insert(
  db: Pool | PoolClient,
  observation: Outcome,
  learner = "child",
) {
  await db.query(
    "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [
      observation.problemId,
      learner,
      JSON.stringify({ public: { id: observation.problemId } }),
    ],
  );
  await db.query(
    "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at) VALUES($1,$2,$3,$4,$5,$6)",
    [
      observation.id,
      learner,
      observation.problemId,
      observation.requestId,
      JSON.stringify(observation),
      observation.createdAt,
    ],
  );
}
async function states(pool: Pool, learner = "child") {
  return (
    await pool.query(
      "SELECT state FROM amp_skill_evidence WHERE learner_id=$1 ORDER BY skill_id",
      [learner],
    )
  ).rows.map((r) => r.state);
}
async function factsDigest(pool: Pool) {
  const rows = (
    await pool.query(
      "SELECT id,learner_id,problem_id,request_id,outcome,created_at FROM amp_attempts ORDER BY id",
    )
  ).rows;
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
test(
  "skill evidence migration preserves facts, exactly replays retained history and matches online updates",
  enabled,
  async () =>
    fixture(async (pool, learning) => {
      const history: Outcome[] = [];
      for (let i = 0; i < 6; i++) history.push(outcome(i));
      for (let i = 6; i < 230; i++)
        history.push(
          outcome(i, "statistics-mean", true, false, origin + 6 * 86400000 + i),
        );
      for (const o of history) await insert(pool, o);
      await insert(pool, outcome(9000, "foreign-skill"), "other");
      const digest = await factsDigest(pool);
      await pool.query(await sql("0008-skill-evidence.sql"));
      await pool.query(await sql("0010-starting-point.sql"));
      assert.equal(await factsDigest(pool), digest);
      const expected = async () =>
        projectSkillEvidence(
          (
            await pool.query(
              "SELECT outcome,evidence_sequence::text AS sequence FROM amp_attempts WHERE learner_id='child' ORDER BY evidence_sequence",
            )
          ).rows.map((row) => ({
            ...row.outcome,
            ingestionSequence: row.sequence,
          })),
        ).sort((a, b) => a.skillId.localeCompare(b.skillId));
      assert.deepEqual(await states(pool), await expected());
      assert.equal((await states(pool))[0].creditedRetrievals, 6);
      assert.equal((await states(pool))[0].reviewDueAt, origin + 35 * 86400000);
      for (let i = 230; i < 530; i++) {
        const o = outcome(
          i,
          "multiplication-facts",
          true,
          false,
          origin + 6 * 86400000 + i,
        );
        await insert(pool, o);
        history.push(o);
      }
      assert.deepEqual(await states(pool), await expected());
      const assisted = outcome(
        600,
        "multiplication-facts",
        true,
        true,
        origin + 7 * 86400000,
      );
      await insert(pool, assisted);
      history.push(assisted);
      assert.deepEqual(await states(pool), await expected());
      assert.equal((await states(pool))[0].reviewDueAt, origin + 7 * 86400000);
      const before = await states(pool);
      await assert.rejects(insert(pool, assisted), { code: "23505" });
      assert.deepEqual(await states(pool), before);
      await learning.transaction("evidence-parent", "child", async (tx) => {
        assert.equal((await tx.recentAttempts()).length, 12);
        assert.equal((await tx.skillEvidence()).length, 2);
        const progress = await tx.progress([
          "multiplication-facts",
          "unobserved",
        ]);
        assert.equal(progress[0]!.attempts, 307);
        assert.equal(progress[1]!.status, "new");
        assert.equal(progress[1]!.attempts, 0);
      });
      await assert.rejects(
        learning.transaction("evidence-other", "child", (tx) =>
          tx.skillEvidence(),
        ),
        /Learner not found/,
      );
    }),
);
test(
  "atomic insertion, concurrent ingestion, explicit ordering, export ownership and tombstone purge",
  enabled,
  async () =>
    fixture(async (pool, learning) => {
      await pool.query(await sql("0008-skill-evidence.sql"));
      await pool.query(await sql("0010-starting-point.sql"));
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await insert(client, outcome(1));
        await client.query("ROLLBACK");
        assert.deepEqual(await states(pool), []);
      } finally {
        client.release();
      }
      // Different request IDs cannot lose one another's projection increment.
      await Promise.all(
        Array.from({ length: 24 }, (_, i) =>
          insert(
            pool,
            outcome(
              i + 100,
              "multiplication-facts",
              i % 3 !== 0,
              i % 5 === 0,
              origin,
            ),
          ),
        ),
      );
      const actualOrder = (
        await pool.query(
          "SELECT outcome,evidence_sequence::text AS sequence FROM amp_attempts WHERE learner_id='child' ORDER BY evidence_sequence",
        )
      ).rows.map(
        (r) => ({ ...r.outcome, ingestionSequence: r.sequence }) as Outcome,
      );
      assert.equal(actualOrder.length, 24);
      assert.deepEqual(await states(pool), projectSkillEvidence(actualOrder));
      assert.equal((await states(pool))[0].attempts, 24);
      await insert(pool, outcome(900, "foreign-skill"), "other");
      const family = new FamilyRepository(pool);
      const lines = [];
      for await (const line of family.export("evidence-parent"))
        lines.push(JSON.parse(line));
      const derived = lines.filter(
        (line) => line.type === "derived-skill-evidence",
      );
      assert.equal(derived.length, 1);
      assert.ok(!JSON.stringify(derived).includes("private answer"));
      assert.ok(!JSON.stringify(lines).includes("foreign-skill"));
      await pool.query(
        "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES('retained','child','stripe','fixture','active',now(),now()+interval '1 year')",
      );
      await family.deleteLearning("evidence-parent", "child");
      assert.deepEqual(await states(pool), []);
      assert.equal(
        (await pool.query("SELECT name FROM amp_learners WHERE id='child'"))
          .rows[0].name,
        "Deleted learner",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_attempts WHERE learner_id='child'",
          )
        ).rows[0].n,
        0,
      );
      assert.equal((await states(pool, "other")).length, 1);
      await assert.rejects(
        learning.transaction("evidence-parent", "child", (tx) =>
          tx.skillEvidence(),
        ),
        /Learner not found/,
      );
    }),
);
