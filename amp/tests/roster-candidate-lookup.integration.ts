import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { applyRoster, planRoster } from "../src/schools/reconcile.js";
import { nameKey, type RosterRow } from "../src/schools/sources/rows.js";
import { namedStudentId } from "../src/schools/sources/csv.js";

test(
  "roster candidate lookup preserves identity decisions and durable retries",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_candidates_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    await migrate(scoped.href);
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const repo = new SchoolRepository(db);
    const keys = {
      secret: "fixture-secret-fixture-secret-fixture-secret",
      origin: "https://amp.example.test",
    };
    const school = async () =>
      (
        await repo.createOrg(
          { kind: "school", name: "Fixture School", timezone: "UTC" },
          {
            version: AGREEMENT_VERSION,
            signerName: "Fixture Principal",
            signerTitle: "Principal",
          },
        )
      ).id;
    const row = (
      line: number,
      givenName: string,
      extra: Partial<RosterRow> = {},
    ): RosterRow => {
      const value: RosterRow = {
        line,
        role: "student",
        sourcedId: "",
        givenName,
        familyName: "Example",
        classes: [],
        ...extra,
      };
      value.sourcedId =
        value.role === "student"
          ? (value.identifier ??
            namedStudentId(
              value.givenName,
              value.familyName,
              value.classes[0]?.name,
            ))
          : (value.email ??
            `name:${nameKey(`${value.givenName} ${value.familyName ?? ""}`)}`);
      return value;
    };
    const apply = (
      orgId: string,
      rows: RosterRow[],
      resolutions?: Record<string, "same" | "new">,
    ) =>
      applyRoster(
        repo,
        keys,
        orgId,
        { source: "csv", rows, resolutions },
        null,
      );
    const sourceKey = (orgId: string, id: string) =>
      id.startsWith("name:") ? `${orgId}/${id}` : id;
    const ref = async (orgId: string, sourcedId: string) =>
      (
        await db.query(
          "SELECT local_id FROM amp_external_refs WHERE tenant_id=$1 AND source='csv' AND kind='person' AND sourced_id=$2",
          [orgId, sourceKey(orgId, sourcedId)],
        )
      ).rows[0]?.local_id;

    await t.test(
      "normalized names, stable IDs, ambiguity, staff, and class scope keep their meaning",
      async () => {
        const orgId = await school();
        const ana = await repo.provisionStudent(orgId, {
          givenName: "Ána",
          familyName: "de la Crúz",
        });
        // An old empty identifier behaves like a missing one, including when the
        // incoming file supplies a new identifier for that reviewed student.
        await db.query("UPDATE amp_people SET identifier='' WHERE id=$1", [
          ana.personId,
        ]);
        const named = row(1, "ANA", {
          familyName: "de  la cruz",
          identifier: "new-sis-id",
        });
        assert.equal(
          (await planRoster(repo, orgId, { source: "csv", rows: [named] }))[0]
            ?.reason,
          "possible_match",
        );
        assert.equal((await apply(orgId, [named])).results[0]?.status, "held");
        assert.equal(
          (await apply(orgId, [named], { "1": "same" })).results[0]?.status,
          "updated",
        );
        assert.equal(await ref(orgId, named.sourcedId), ana.personId);
        await assert.rejects(
          apply(orgId, [{ ...named, sourcedId: "another-csv-class-key" }]),
          /csv_identity_invalid/,
        );
        const movedKey = {
          ...named,
          classes: [{ sourcedId: "name:next class", name: "Next Class" }],
        };
        assert.equal(
          (await apply(orgId, [movedKey])).results[0]?.status,
          "updated",
        );
        assert.equal(await ref(orgId, movedKey.sourcedId), ana.personId);

        await repo.provisionStudent(orgId, {
          givenName: "First",
          identifier: "duplicate",
        });
        await repo.provisionStudent(orgId, {
          givenName: "Second",
          identifier: "duplicate",
        });
        const ambiguous = row(2, "First", {
          identifier: "duplicate",
          familyName: undefined,
        });
        assert.equal(
          (
            await planRoster(repo, orgId, { source: "csv", rows: [ambiguous] })
          )[0]?.reason,
          "ambiguous_match",
        );
        assert.equal(
          (await apply(orgId, [ambiguous], { "2": "same" })).results[0]?.status,
          "held",
        );

        const staff = await repo.addStaff({
          orgId,
          role: "teacher",
          givenName: "Staff",
          email: "staff@example.test",
        });
        const teacher = row(3, "Staff", {
          role: "teacher",
          email: "staff@example.test",
          familyName: undefined,
        });
        assert.equal(
          (await apply(orgId, [teacher])).results[0]?.status,
          "updated",
        );
        assert.equal(await ref(orgId, teacher.sourcedId), staff.personId);

        const allowed = await repo.createClass(orgId, { name: "Allowed" });
        const outside = await repo.createClass(orgId, { name: "Outside" });
        await repo.provisionStudent(orgId, {
          givenName: "Outside",
          identifier: "outside-id",
          classId: outside.id,
        });
        const outsideRow = row(4, "Outside", {
          identifier: "outside-id",
          familyName: undefined,
        });
        const plan = await planRoster(
          repo,
          orgId,
          { source: "csv", rows: [outsideRow] },
          { classId: allowed.id },
        );
        assert.equal(plan[0]?.reason, "outside_class");
        assert.equal(
          (
            await applyRoster(
              repo,
              keys,
              orgId,
              {
                source: "csv",
                rows: [outsideRow],
                resolutions: { "4": "new" },
              },
              null,
              { classId: allowed.id },
            )
          ).results[0]?.status,
          "held",
        );
      },
    );

    await t.test(
      "concurrent source claims, orphaned references, and row failures are retriable",
      async () => {
        const orgId = await school();
        const concurrent = row(10, "Concurrent", { identifier: "concurrent" });
        const both = await Promise.all([
          apply(orgId, [concurrent]),
          apply(orgId, [concurrent]),
        ]);
        assert.deepEqual(
          both.flatMap((result) => result.results.map((r) => r.status)).sort(),
          ["created", "unchanged"],
        );
        const original = await ref(orgId, concurrent.sourcedId);
        assert.equal(
          (await apply(orgId, [{ ...concurrent, givenName: "Different" }]))
            .results[0]?.status,
          "held",
        );
        assert.equal(await ref(orgId, concurrent.sourcedId), original);

        const orphan = row(11, "Orphan");
        await db.query(
          "INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id) VALUES($1,'csv','person',$2,$3)",
          [orgId, sourceKey(orgId, orphan.sourcedId), randomUUID()],
        );
        assert.equal(
          (await apply(orgId, [orphan])).results[0]?.status,
          "created",
        );

        await db.query(`CREATE FUNCTION reject_fixture_student() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.given_name='Reject fixture' THEN RAISE EXCEPTION 'synthetic row failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_fixture_student BEFORE INSERT ON amp_people FOR EACH ROW EXECUTE FUNCTION reject_fixture_student()`);
        const retry = [
          row(12, "Before failure"),
          row(13, "Reject fixture"),
          row(14, "After failure"),
        ];
        assert.deepEqual(
          (await apply(orgId, retry)).results.map((r) => r.status),
          ["created", "failed", "created"],
        );
        const before = await ref(orgId, retry[0]!.sourcedId),
          after = await ref(orgId, retry[2]!.sourcedId);
        assert.equal(await ref(orgId, retry[1]!.sourcedId), undefined);
        await db.query("DROP TRIGGER reject_fixture_student ON amp_people");
        assert.deepEqual(
          (await apply(orgId, retry)).results.map((r) => r.status),
          ["unchanged", "created", "unchanged"],
        );
        assert.equal(await ref(orgId, retry[0]!.sourcedId), before);
        assert.equal(await ref(orgId, retry[2]!.sourcedId), after);
      },
    );

    await t.test(
      "candidate hydration stays bounded and unchanged imports avoid repeated writes and source reads",
      async () => {
        const orgId = await school();
        const rows = Array.from({ length: 100 }, (_, i) =>
          row(100 + i, `Student ${i}`),
        );
        let queries = 0,
          writes = 0,
          hydrated = 0;
        const original = repo.transaction.bind(repo);
        repo.transaction = async (run) =>
          original(async (client) => {
            const query = client.query;
            client.query = function (
              this: typeof client,
              ...args: Parameters<typeof query>
            ) {
              queries++;
              const first = args[0] as string | { text: string };
              const sql = typeof first === "string" ? first : first.text;
              if (/INSERT INTO amp_external_refs/.test(sql)) writes++;
              const result = query.apply(this, args);
              if (sql.includes("source_metadata"))
                return (
                  result as unknown as Promise<{ rowCount: number | null }>
                ).then((found) => {
                  hydrated += found.rowCount ?? 0;
                  return found;
                });
              return result;
            } as typeof query;
            try {
              return await run(client);
            } finally {
              client.query = query;
            }
          });
        try {
          assert.ok(
            (await apply(orgId, rows)).results.every(
              (r) => r.status === "created",
            ),
          );
          assert.ok(
            hydrated <= rows.length,
            `new rows hydrated ${hydrated} complete candidate records`,
          );
          queries = writes = hydrated = 0;
          assert.ok(
            (await apply(orgId, rows)).results.every(
              (r) => r.status === "unchanged",
            ),
          );
          assert.equal(
            writes,
            0,
            "bound unchanged rows never attempt to claim their references again",
          );
          assert.ok(
            queries < rows.length * 3 + 30,
            `unchanged rows used ${queries} queries inside their transactions`,
          );
        } finally {
          repo.transaction = original;
        }
      },
    );
  },
);
