import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { skills } from "../src/curriculum/catalog.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { printableSkills } from "../src/workbook/routes.js";

test(
  "a workbook held to skills: only their problems, named on its first page, listed with the learner's others; an unprintable skill is refused",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_workbook_skills_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => "skills-parent",
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const learner = await repository.create(
        "skills-parent",
        "Sample child",
        2016,
      );
      const base = `/api/v1/learners/${learner.id}/workbooks`;
      const date = new Date().toISOString().slice(0, 10);
      const held = (skillIds: string[], lesson = true) => ({
        areas: [],
        lean: "level",
        lesson,
        skills: skillIds,
      });
      const post = (
        action: "preview" | "issue",
        choices: object | undefined,
        requestId: string = randomUUID(),
        minutes = 30,
      ) =>
        app.inject({
          method: "POST",
          url: `${base}/${action}`,
          payload: {
            date,
            paper: "letter",
            minutes,
            requestId,
            ...(choices ? { choices } : {}),
          },
        });
      const history = async () =>
        (await app.inject({ url: base })).json().workbooks as {
          id: string;
          skills?: { id: string; title: string }[];
        }[];
      const rows = async (id: string) =>
        (await app.inject({ url: `${base}/${id}/results` })).json().rows as {
          skillId: string;
        }[];
      const firstPage = async (id: string) =>
        (await app.inject({ url: `${base}/${id}/document` })).body;

      // The curriculum says which skills a workbook can be held to.
      const map = (await app.inject({ url: "/api/v1/catalog/map" })).json()
        .skills as { id: string; printable: boolean }[];
      assert.equal(map.length, skills.length);
      for (const skill of map)
        assert.equal(skill.printable, printableSkills.has(skill.id), skill.id);
      const unprintable = map.find((skill) => !skill.printable)!.id;

      // A preview composes it and stores nothing.
      const skill = "angle-measure";
      const request = randomUUID();
      const preview = await post("preview", held([skill]), request);
      assert.equal(preview.statusCode, 200, preview.body);
      assert.deepEqual(preview.json().skills, [
        { id: skill, title: "Measuring angles" },
      ]);
      assert.deepEqual(preview.json().choices, held([skill]));
      assert.deepEqual(
        preview.json().sections.map((s: { kind: string }) => s.kind),
        ["lesson", "practice"],
      );
      assert.ok(preview.json().problems >= 6, preview.body);
      assert.ok(preview.json().estimatedMinutes <= 30);
      assert.equal((await history()).length, 0);

      // Issued, it is the previewed workbook: every problem that skill's,
      // the skill named on its first page.
      const issued = await post("issue", held([skill]), request);
      assert.equal(issued.statusCode, 201, issued.body);
      assert.equal(issued.json().code, preview.json().code);
      const one = issued.json().id as string;
      const problems = await rows(one);
      assert.equal(problems.length, issued.json().problems);
      for (const row of problems) assert.equal(row.skillId, skill);
      assert.match(
        await firstPage(one),
        /<p class="wb-mast-skills"[^>]*>Measuring angles<\/p>/,
      );
      // Asked again, the same workbook, not another.
      const again = await post("issue", held([skill]), request);
      assert.equal(again.statusCode, 200, again.body);
      assert.equal(again.json().id, one);

      // A few skills together: theirs alone, each named.
      const few = ["whole-division", "fraction-equivalence"];
      const pair = await post("issue", held(few, false), randomUUID(), 45);
      assert.equal(pair.statusCode, 201, pair.body);
      assert.deepEqual(
        pair
          .json()
          .skills.map((entry: { id: string }) => entry.id)
          .sort(),
        [...few].sort(),
      );
      const both = new Set((await rows(pair.json().id)).map((r) => r.skillId));
      assert.deepEqual([...both].sort(), [...few].sort());
      assert.deepEqual(
        pair.json().sections.map((s: { kind: string }) => s.kind),
        ["practice"],
      );

      // An ordinary workbook is as it was: no scope, nothing named.
      const mixed = await post("issue", undefined, randomUUID(), 45);
      assert.equal(mixed.statusCode, 201, mixed.body);
      assert.equal(mixed.json().skills, undefined);
      assert.equal(mixed.json().choices.skills, undefined);
      assert.ok(
        !(await firstPage(mixed.json().id)).includes('class="wb-mast-skills"'),
      );
      assert.ok(
        new Set((await rows(mixed.json().id)).map((r) => r.skillId)).size > 3,
      );

      // All three are the learner's workbooks, the held ones saying so.
      const listed = await history();
      assert.equal(listed.length, 3);
      assert.deepEqual(listed.find((workbook) => workbook.id === one)?.skills, [
        { id: skill, title: "Measuring angles" },
      ]);
      assert.equal(
        listed.find((workbook) => workbook.id === mixed.json().id)?.skills,
        undefined,
      );

      // A skill that isn't in the curriculum, or has no problem type that
      // prints, is refused in words, never swapped for mixed work.
      for (const [asked, message] of [
        [["no-such-skill"], /These skills have no printable problems yet/],
        [[unprintable], /These skills have no printable problems yet/],
        [[skill, unprintable], /One of these skills has no printable problems/],
      ] as const) {
        for (const action of ["preview", "issue"] as const) {
          const refused = await post(action, held([...asked]));
          assert.equal(refused.statusCode, 400, refused.body);
          assert.match(refused.json().error, message);
        }
      }
      // Too many, or none, is no request at all.
      for (const asked of [[], [...printableSkills].slice(0, 13)])
        assert.equal((await post("preview", held(asked))).statusCode, 400);
      assert.equal((await history()).length, 3);
    } finally {
      await app.close();
      await repository.pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
