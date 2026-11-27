import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { Pool, type PoolClient } from "pg";
import {
  Decrypter,
  generateIdentity,
  identityToRecipient,
} from "age-encryption";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { skills } from "../src/curriculum/catalog.js";
import { EXTRACT_FILES, headerOf } from "../src/research/codebook.js";
import { runResearchExport } from "../src/research/export-cli.js";
import type { ExtractManifest } from "../src/research/export.js";
import {
  enrollParticipant,
  withdrawParticipant,
} from "../src/research/participants.js";
import { studyId, studyIdKeyFrom } from "../src/research/study-id.js";

/* The research export over a seeded database. Every name, address and
   answer here is made up, and each is chosen so its appearance anywhere in
   an extract would be caught. */
test(
  "research export: enrolled participants only, study IDs only, encrypted",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `amp_research_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await migrate(scoped.href);
    const pool = new Pool({ connectionString: scoped.href, max: 4 });
    t.after(async () => {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const key = studyIdKeyFrom({
      AMP_RESEARCH_ID_KEY: "fixture-key-".repeat(4),
    });
    const identity = await generateIdentity();
    const recipients = [await identityToRecipient(identity)];
    const DAY = 86_400_000;
    const now = Date.now();
    const enrolledAt = new Date(now - 20 * DAY);

    // Personal values seeded into the database, none of which may appear.
    const pii = {
      familyA: `amp|${randomUUID()}`,
      familyB: `amp|${randomUUID()}`,
      names: [
        "Zebulon Fixturechild",
        "Ophelia Fixturechild",
        "Withdrawn Fixturechild",
        "Unenrolled Fixturechild",
      ],
      email: "zebulon.parent@fixture.example",
      response: "my answer is forty two said Zebulon",
      workbookCode: "QZ7K-X9W3",
      birthYear: 2017,
    };
    const [kid1, kid2, withdrawn, unenrolled, otherStudy] = Array.from(
      { length: 5 },
      () => randomUUID(),
    );
    const learner = (id: string, account: string, name: string) =>
      pool.query(
        "INSERT INTO amp_learners(id,account_id,name,birth_year,created_at) VALUES($1,$2,$3,$4,$5)",
        [id, account, name, pii.birthYear, new Date(now - 60 * DAY)],
      );
    await learner(kid1!, pii.familyA, pii.names[0]!);
    await learner(kid2!, pii.familyA, pii.names[1]!);
    await learner(withdrawn!, pii.familyB, pii.names[2]!);
    await learner(unenrolled!, pii.familyB, pii.names[3]!);
    await learner(otherStudy!, pii.familyB, "Other Study Fixturechild");
    await pool.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,'Fixture Parent',$2,true,now(),now())`,
      [pii.familyA.slice(4), pii.email],
    );

    const skill = skills[0]!.id;
    let served = 0;
    /** One problem served at `at`; answered unless told otherwise. */
    const problem = async (
      learnerId: string,
      at: Date,
      answer: "right" | "wrong" | "skipped" | "unanswered" | "paper" = "right",
    ) => {
      const id = randomUUID();
      served++;
      await pool.query(
        "INSERT INTO amp_instances(id,learner_id,content,created_at) VALUES($1,$2,$3,$4)",
        [
          id,
          learnerId,
          {
            public: { id, skillId: skill, templateId: "fixture-template" },
            answer: "42",
            explanation: ["Because."],
            selection: {
              reason: "review",
              strand: "number",
              practicePolicy: "fixture-policy",
            },
            ...(answer === "skipped"
              ? { skipped: true, skippedAt: at.toISOString() }
              : {}),
          },
          at,
        ],
      );
      if (answer === "skipped" || answer === "unanswered") return;
      const answeredAt = new Date(at.getTime() + 12_300);
      await pool.query(
        "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          learnerId,
          id,
          randomUUID(),
          {
            id: randomUUID(),
            problemId: id,
            requestId: randomUUID(),
            skillId: skill,
            templateId: "fixture-template",
            correct: answer !== "wrong",
            assisted: answer === "wrong",
            response: pii.response,
            explanation: ["Because."],
            answer: "42",
            createdAt: answeredAt.toISOString(),
            ...(answer === "wrong"
              ? { help: ["hint"], parts: [true, false] }
              : {}),
            ...(answer === "paper"
              ? { evidenceSource: "paper", evidenceWeight: 0.5 }
              : {}),
          },
          answeredAt,
        ],
      );
    };

    // Enrolment, and the participants' records around it. Enrolment is
    // always "now", so the fixture moves it back to give it a history.
    assert.equal(
      await enrollParticipant(pool, {
        study: "rr3",
        learnerId: kid1!,
        consentRef: "fixture-consent-1",
      }),
      true,
    );
    for (const [study, id] of [
      ["rr3", kid2!],
      ["rr3", withdrawn!],
      ["rr9", otherStudy!],
    ] as const)
      assert.equal(
        await enrollParticipant(pool, { study, learnerId: id }),
        true,
      );
    await pool.query("UPDATE amp_research_participants SET enrolled_at=$1", [
      enrolledAt,
    ]);
    assert.equal(
      await withdrawParticipant(pool, { study: "rr3", learnerId: withdrawn! }),
      true,
    );
    // The enrolment day itself, a minute before enrolment: not exported, in
    // answers or in the weekly answers.
    await problem(kid1!, new Date(enrolledAt.getTime() - 60_000));
    // Before enrolment: never exported.
    await problem(kid1!, new Date(enrolledAt.getTime() - 2 * DAY));
    // Week 1: 40 answers, one wrong with a hint, one paper, one skip, one open.
    for (let i = 0; i < 40; i++)
      await problem(
        kid1!,
        new Date(enrolledAt.getTime() + 3_600_000 + i * 60_000),
      );
    await problem(kid1!, new Date(enrolledAt.getTime() + 2 * DAY), "wrong");
    await problem(
      kid1!,
      new Date(enrolledAt.getTime() + 2 * DAY + 60_000),
      "paper",
    );
    await problem(
      kid1!,
      new Date(enrolledAt.getTime() + 2 * DAY + 120_000),
      "skipped",
    );
    // Week 2.
    await problem(
      kid1!,
      new Date(enrolledAt.getTime() + 8 * DAY),
      "unanswered",
    );
    await problem(kid2!, new Date(enrolledAt.getTime() + 9 * DAY));
    // Withdrawn and unenrolled learners practise too.
    for (const id of [withdrawn!, unenrolled!, otherStudy!])
      for (let i = 0; i < 5; i++)
        await problem(id, new Date(enrolledAt.getTime() + DAY + i * 60_000));
    const day = (offset: number) =>
      new Date(enrolledAt.getTime() + offset * DAY).toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO amp_workbooks(id,learner_id,workbook_date,number,minutes,paper,spec,code,created_at)
       VALUES($1,$2,$3,1,30,'letter',$4,$5,$6)`,
      [
        randomUUID(),
        kid1,
        day(3),
        {
          version: 2,
          date: day(3),
          number: 1,
          minutes: 30,
          level: 3,
          sections: [
            { kind: "lesson", items: [{}, {}] },
            { kind: "practice", items: [{}, {}, {}] },
          ],
          choices: { areas: [], lean: "level", lesson: true },
        },
        pii.workbookCode,
        new Date(enrolledAt.getTime() + 3 * DAY),
      ],
    );
    for (const id of [kid1!, withdrawn!])
      await pool.query(
        `INSERT INTO amp_adult_checkins(learner_id,"at",role,kind) VALUES($1,$2,'parent','view'),($1,$3,'teacher','score')`,
        [
          id,
          new Date(enrolledAt.getTime() + 4 * DAY),
          new Date(enrolledAt.getTime() - DAY),
        ],
      );
    await pool.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,active_ms) VALUES
       ($1,$2,'practice',600000),($1,$2,'hint',30500),($1,$3,'practice',120000)`,
      [kid1, day(3), day(10)],
    );
    // The enrolment day's time is partly before enrolment: left out.
    await pool.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,active_ms)
       SELECT learner_id,(enrolled_at AT TIME ZONE amp_learner_zone(learner_id))::date,'other',900000
         FROM amp_research_participants WHERE study='rr3' AND learner_id=$1`,
      [kid1],
    );
    await pool.query(
      `INSERT INTO amp_help_days(learner_id,day,kind,opened) VALUES($1,$2,'hint',3),($1,$2,'video_play',1)`,
      [kid1, day(3)],
    );
    await pool.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')`,
      [
        kid1,
        day(0),
        {
          expected: 3,
          overall: { level: 3.25, sd: 0.4, answered: 40 },
          strands: {},
        },
      ],
    );

    /** One export, through the real command path, into memory. */
    const extract = async (
      options: {
        key?: typeof key;
        batchSize?: number;
        spy?: (rows: number, sql: string) => void;
      } = {},
    ) => {
      const chunks: Buffer[] = [];
      const spied = {
        connect: async () => {
          const client = await pool.connect();
          if (!options.spy) return client;
          // Spied for this export only: the pooled client gets its own
          // query and release back when it is returned.
          const own = client as unknown as {
            query: unknown;
            release: (error?: Error) => void;
          };
          const { query: original, release } = own;
          const query = client.query.bind(client) as (
            ...args: unknown[]
          ) => Promise<{ rows: unknown[] }>;
          own.query = async (...args: unknown[]) => {
            const result = await query(...args);
            options.spy!(result.rows.length, String(args[0]));
            return result;
          };
          own.release = (error?: Error) => {
            own.query = original;
            own.release = release;
            release.call(client, error);
          };
          return client as PoolClient;
        },
      };
      const result = await runResearchExport({
        pool: spied,
        study: "rr3",
        key: options.key ?? key,
        recipients,
        batchSize: options.batchSize,
        sink: async (ciphertext) => {
          for await (const chunk of ciphertext) chunks.push(chunk as Buffer);
        },
      });
      const ciphertext = Buffer.concat(chunks);
      assert.equal(ciphertext.length, result.bytes);
      const decrypter = new Decrypter();
      decrypter.addIdentity(identity);
      const zip = await decrypter.decrypt(ciphertext);
      const files = unzipSync(zip);
      const text = Object.fromEntries(
        Object.entries(files).map(([name, data]) => [name, strFromU8(data)]),
      );
      return { result, files, text, zip: Buffer.from(zip) };
    };
    const rows = (csv: string) => {
      const [header, ...lines] = csv.trimEnd().split("\r\n");
      const columns = header!.split(",");
      return lines.map((line) =>
        Object.fromEntries(
          line.split(",").map((value, i) => [columns[i]!, value]),
        ),
      );
    };

    const first = await extract();
    const manifest = JSON.parse(
      first.text["manifest.json"]!,
    ) as ExtractManifest;

    await t.test(
      "every file, its codebook and a matching SHA-256 manifest",
      async () => {
        const { createHash } = await import("node:crypto");
        assert.deepEqual(
          Object.keys(first.files).sort(),
          [
            ...EXTRACT_FILES.map((file) => file.name),
            "codebook.json",
            "codebook.md",
            "manifest.json",
          ].sort(),
        );
        assert.deepEqual(manifest, first.result.manifest);
        assert.equal(manifest.study, "rr3");
        assert.equal(manifest.participants, 2);
        for (const file of manifest.files) {
          const data = first.files[file.name]!;
          assert.equal(
            createHash("sha256").update(data).digest("hex"),
            file.sha256,
            file.name,
          );
          assert.equal(data.length, file.bytes, file.name);
        }
        for (const spec of EXTRACT_FILES)
          assert.equal(
            first.text[spec.name]!.split("\r\n")[0],
            headerOf(spec.name).join(","),
            spec.name,
          );
      },
    );

    await t.test(
      "only enrolled participants who have not withdrawn, from enrolment on",
      () => {
        const kidId = studyId(key, "rr3", "learner", kid1!);
        const siblingId = studyId(key, "rr3", "learner", kid2!);
        const participants = rows(first.text["participants.csv"]!);
        assert.deepEqual(
          participants.map((row) => row.study_learner_id).sort(),
          [kidId, siblingId].sort(),
        );
        // Siblings share a household ID.
        assert.equal(
          new Set(participants.map((row) => row.study_family_id)).size,
          1,
        );
        assert.deepEqual(
          new Set(participants.map((row) => row.current_week)),
          new Set(["3"]),
        );
        const absent = [withdrawn!, unenrolled!, otherStudy!].flatMap((id) => [
          studyId(key, "rr3", "learner", id),
          studyId(key, "rr9", "learner", id),
        ]);
        for (const [name, body] of Object.entries(first.text))
          for (const id of absent)
            assert.ok(!body.includes(id), `${name} holds a non-participant`);

        const answers = rows(first.text["answers.csv"]!);
        const mine = answers.filter((row) => row.study_learner_id === kidId);
        // 40 + wrong + paper + skip + open, not the one before enrolment.
        assert.equal(mine.length, 44);
        assert.equal(answers.length, 45);
        assert.deepEqual(
          mine.map((row) => Number(row.sequence)),
          Array.from({ length: 44 }, (_, i) => i + 1),
        );
        assert.deepEqual([...new Set(mine.map((row) => row.week))], ["1", "2"]);
        const wrong = mine[40]!;
        assert.equal(wrong.correct, "false");
        assert.equal(wrong.assisted, "true");
        assert.equal(wrong.help_hint, "true");
        assert.equal(wrong.independent, "false");
        assert.equal(wrong.parts_correct, "1");
        assert.equal(wrong.parts_total, "2");
        assert.equal(wrong.seconds_to_answer, "12.3");
        assert.equal(wrong.learner_level, "3.25");
        assert.equal(mine[0]!.independent, "true");
        assert.equal(
          mine[0]!.learner_level,
          "",
          "no level stored before day 1",
        );
        const paper = mine[41]!;
        assert.equal(paper.evidence_source, "paper");
        assert.equal(paper.evidence_weight, "0.5");
        assert.equal(paper.seconds_to_answer, "");
        assert.equal(mine[42]!.outcome, "skipped");
        assert.equal(mine[43]!.outcome, "unanswered");
        assert.equal(mine[43]!.correct, "");

        const checkins = rows(first.text["adult_checkins.csv"]!);
        assert.deepEqual(checkins, [
          { study_learner_id: kidId, week: "1", role: "parent", kind: "view" },
        ]);
        const workbooks = rows(first.text["workbooks.csv"]!);
        assert.equal(workbooks.length, 1);
        assert.equal(workbooks[0]!.problems, "5");
        assert.equal(workbooks[0]!.sections, "2");

        const weeks = rows(first.text["weekly_activity.csv"]!).filter(
          (row) => row.study_learner_id === kidId,
        );
        assert.deepEqual(
          weeks.map((row) => row.week),
          ["1", "2", "3"],
        );
        assert.equal(weeks[0]!.active_seconds, "630");
        assert.equal(weeks[0]!.practice_seconds, "600");
        assert.equal(weeks[0]!.hint_seconds, "30");
        assert.equal(weeks[0]!.hints_opened, "3");
        assert.equal(weeks[0]!.video_plays, "1");
        assert.equal(weeks[1]!.active_seconds, "120");
        assert.equal(weeks[2]!.active_seconds, "0");
        // Answers come from the rollup the attempt trigger keeps.
        assert.equal(Number(weeks[0]!.answers) + Number(weeks[1]!.answers), 42);
      },
    );

    await t.test(
      "no direct identifier, date or typed text anywhere in the extract",
      () => {
        const seeded = [
          ...pii.names,
          pii.familyA,
          pii.familyB,
          pii.familyA.slice(4),
          pii.email,
          pii.response,
          "forty two",
          pii.workbookCode,
          "fixture-consent-1",
          kid1!,
          kid2!,
          withdrawn!,
          unenrolled!,
        ];
        for (const [name, body] of Object.entries(first.text)) {
          for (const value of seeded)
            assert.ok(!body.includes(value), `${name} holds ${value}`);
          assert.doesNotMatch(
            body,
            new RegExp(`\\b${pii.birthYear}\\b`),
            `${name} holds a birth year`,
          );
          assert.doesNotMatch(
            body,
            /\b20\d\d-\d\d-\d\d/,
            `${name} holds a calendar date`,
          );
        }
        assert.ok(!("generatedAt" in manifest));
        // Every ZIP entry carries the same fixed time, never the export's:
        // the DOS date of each local file header is 2000-01-01.
        let entries = 0;
        for (
          let at = first.zip.indexOf("PK\x03\x04");
          at >= 0;
          at = first.zip.indexOf("PK\x03\x04", at + 4)
        ) {
          entries++;
          const date = first.zip.readUInt16LE(at + 12);
          assert.deepEqual(
            [(date >> 9) + 1980, (date >> 5) & 15, date & 31],
            [2000, 1, 1],
          );
        }
        assert.equal(entries, Object.keys(first.files).length);
      },
    );

    await t.test(
      "study IDs are stable across runs and change with the key",
      async () => {
        const again = await extract();
        assert.equal(
          again.text["participants.csv"],
          first.text["participants.csv"],
        );
        assert.equal(again.text["answers.csv"], first.text["answers.csv"]);
        const rekeyed = await extract({
          key: studyIdKeyFrom({
            AMP_RESEARCH_ID_KEY: "another-fixture-key-".repeat(2),
          }),
        });
        const before = new Set(
          rows(first.text["participants.csv"]!).map(
            (row) => row.study_learner_id,
          ),
        );
        for (const row of rows(rekeyed.text["participants.csv"]!))
          assert.ok(!before.has(row.study_learner_id!));
        assert.equal(rows(rekeyed.text["answers.csv"]!).length, 45);
      },
    );

    await t.test(
      "memory is bounded: every read is one cursor batch",
      async () => {
        const batch = 7;
        let largest = 0;
        let fetches = 0;
        const spied = await extract({
          batchSize: batch,
          spy: (count, sql) => {
            if (sql.startsWith("FETCH")) {
              fetches++;
              largest = Math.max(largest, count);
            } else
              assert.equal(
                count,
                0,
                `only cursors return rows: ${sql.slice(0, 40)}`,
              );
          },
        });
        assert.equal(largest, batch);
        // 45 answers alone take seven fetches of seven.
        assert.ok(fetches >= Math.ceil(45 / batch) + 5, `${fetches} fetches`);
        assert.equal(spied.text["answers.csv"], first.text["answers.csv"]);
      },
    );

    await t.test(
      "a withdrawal takes the participant out of the next extract",
      async () => {
        assert.equal(
          await withdrawParticipant(pool, { study: "rr3", learnerId: kid2! }),
          true,
        );
        const after = await extract();
        assert.equal(after.result.manifest.participants, 1);
        assert.ok(
          !after.text["answers.csv"]!.includes(
            studyId(key, "rr3", "learner", kid2!),
          ),
        );
      },
    );

    await t.test(
      "enrolment: idempotent, re-enrolment starts again, unknown learners refused",
      async () => {
        const at = (id: string) =>
          pool.query(
            "SELECT enrolled_at,withdrawn_at,consent_ref FROM amp_research_participants WHERE study='rr3' AND learner_id=$1",
            [id],
          );
        assert.equal(
          await enrollParticipant(pool, { study: "rr3", learnerId: kid1! }),
          true,
        );
        const kept = (await at(kid1!)).rows[0];
        assert.equal(kept.enrolled_at.getTime(), enrolledAt.getTime());
        assert.equal(kept.consent_ref, "fixture-consent-1");
        assert.equal(
          await enrollParticipant(pool, {
            study: "rr3",
            learnerId: kid2!,
            consentRef: "fixture-consent-2",
          }),
          true,
        );
        const again = (await at(kid2!)).rows[0];
        assert.equal(again.withdrawn_at, null);
        // A new enrolment starts now: never back in the withdrawn period.
        assert.ok(again.enrolled_at.getTime() > Date.now() - 60_000);
        assert.equal(again.consent_ref, "fixture-consent-2");
        assert.equal(
          await enrollParticipant(pool, {
            study: "rr3",
            learnerId: randomUUID(),
          }),
          false,
        );
        assert.equal(
          await withdrawParticipant(pool, {
            study: "rr3",
            learnerId: unenrolled!,
          }),
          false,
        );
        await assert.rejects(
          enrollParticipant(pool, { study: "RR 3", learnerId: kid1! }),
          /study code/,
        );
        // A deleted learner leaves every extract.
        await pool.query(
          "UPDATE amp_learners SET deleted_at=now() WHERE id=$1",
          [kid2],
        );
        assert.equal((await extract()).result.manifest.participants, 1);
      },
    );
    assert.ok(served > 0);
  },
);
