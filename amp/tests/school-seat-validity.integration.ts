import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";

test(
  "set-based seat release matches grant validity across scopes, dates and duplicate references",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `seat_validity_${randomUUID().replaceAll("-", "")}`,
      admin = new Pool({ connectionString: url, max: 1 }),
      scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    try {
      await migrate(scoped.href);
      const repo = new SchoolRepository(db),
        agreement = {
          version: "fixture",
          signerName: "Fixture",
          signerTitle: "Administrator",
        };
      const district = await repo.createOrg(
        { kind: "district", name: "Fixture district", timezone: "UTC" },
        agreement,
      );
      const other = await repo.createOrg(
        { kind: "district", name: "Other fixture district", timezone: "UTC" },
        agreement,
      );
      const east = await repo.createOrg({
        kind: "school",
        parentId: district.id,
        name: "East fixture school",
        timezone: "Pacific/Kiritimati",
      });
      const west = await repo.createOrg({
        kind: "school",
        parentId: district.id,
        name: "West fixture school",
        timezone: "Pacific/Honolulu",
      });
      const students: {
        name: string;
        org: string;
        personId: string;
        learnerId: string;
      }[] = [];
      for (const [name, org] of [
        ["east", east.id],
        ["west", west.id],
        ["expired", east.id],
        ["class-active", east.id],
        ["class-ended", east.id],
        ["class-archived", east.id],
        ["external", east.id],
        ["null", east.id],
        ["duplicate-invalid", east.id],
        ["duplicate-valid", other.id],
      ] as const) {
        students.push({
          name,
          org,
          ...(await repo.provisionStudent(org, { givenName: name })),
        });
      }
      const student = (name: string) => students.find((p) => p.name === name)!;
      // These zones are exactly one calendar day apart. The same date is active
      // at the eastern school and future-dated at the western school.
      await db.query(
        `UPDATE amp_org_roles SET begin_on=(now() AT TIME ZONE 'Pacific/Kiritimati')::date WHERE person_id=ANY($1::uuid[])`,
        [[student("east").personId, student("west").personId]],
      );
      await db.query(
        `UPDATE amp_org_roles SET end_on=(now() AT TIME ZONE 'Pacific/Kiritimati')::date WHERE person_id=$1`,
        [student("duplicate-invalid").personId],
      );
      const session = randomUUID(),
        activeClass = randomUUID(),
        archivedClass = randomUUID();
      await db.query(
        "INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on) VALUES($1,$2,'year','Fixture','2020-01-01','2100-01-01')",
        [session, east.id],
      );
      await db.query(
        `INSERT INTO amp_classes(id,org_id,session_id,name,grading_kind,join_code,archived_at)
      VALUES($1,$3,$4,'Active fixture','year','SEATAA',NULL),($2,$3,$4,'Archived fixture','year','SEATAB',now())`,
        [activeClass, archivedClass, east.id, session],
      );
      for (const name of ["class-active", "class-ended", "class-archived"])
        await db.query(
          `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on,end_on)
       VALUES($1,$2,$3,'student',(now() AT TIME ZONE 'Pacific/Kiritimati')::date,
         CASE WHEN $4 THEN (now() AT TIME ZONE 'Pacific/Kiritimati')::date END)`,
          [
            randomUUID(),
            name === "class-archived" ? archivedClass : activeClass,
            student(name).personId,
            name === "class-ended",
          ],
        );
      const general = randomUUID(),
        expired = randomUUID(),
        classes = randomUUID(),
        otherLicense = randomUUID();
      // Zero-capacity fixtures exercise release without allocating replacement seats.
      await db.query(
        `INSERT INTO amp_school_licenses(id,org_id,seats,starts_at,ends_at,class_ids) VALUES
      ($1,$5,0,now()-interval '1 day',now()+interval '1 day',NULL),
      ($2,$5,0,now()-interval '2 days',now()-interval '1 day',NULL),
      ($3,$5,0,now()-interval '1 day',now()+interval '1 day',$7),
      ($4,$6,0,now()-interval '1 day',now()+interval '1 day',NULL)`,
        [
          general,
          expired,
          classes,
          otherLicense,
          district.id,
          other.id,
          [activeClass, archivedClass],
        ],
      );
      const shared = `school-seat:${randomUUID()}`;
      const cases: {
        name: string;
        seat: string;
        grant: string | null;
        expected: boolean | null;
      }[] = [];
      for (const p of students) {
        const grant =
          p.name === "null"
            ? null
            : p.name.startsWith("duplicate-")
              ? shared
              : p.name === "external"
                ? `fixture-external:${randomUUID()}`
                : `school-seat:${randomUUID()}`;
        const license =
          p.name === "expired" || p.name === "external" || p.name === "null"
            ? expired
            : p.name.startsWith("class-")
              ? classes
              : p.name === "duplicate-valid"
                ? otherLicense
                : general;
        if (grant)
          await db.query(
            `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
        VALUES($1,$2,'pilot',$3,'active',now()-interval '1 day',now()+interval '1 day') ON CONFLICT(id) DO NOTHING`,
            [
              grant,
              p.name.startsWith("duplicate-")
                ? student("duplicate-valid").learnerId
                : p.learnerId,
              randomUUID(),
            ],
          );
        const seat = randomUUID();
        await db.query(
          "INSERT INTO amp_seats(id,license_id,person_id,grant_id) VALUES($1,$2,$3,$4)",
          [seat, license, p.personId, grant],
        );
        cases.push({ name: p.name, seat, grant, expected: null });
      }
      for (const c of cases)
        c.expected = (
          await db.query("SELECT amp_school_grant_valid($1) AS valid", [
            c.grant,
          ])
        ).rows[0].valid;
      assert.equal(cases.find((c) => c.name === "east")!.expected, true);
      assert.equal(cases.find((c) => c.name === "west")!.expected, false);
      assert.equal(
        cases.find((c) => c.name === "class-active")!.expected,
        true,
      );
      for (const name of ["expired", "class-ended", "class-archived"])
        assert.equal(cases.find((c) => c.name === name)!.expected, false);
      assert.equal(
        cases.find((c) => c.name === "duplicate-invalid")!.expected,
        true,
        "grant validity can come from an eligible seat outside the candidate tenant",
      );
      assert.equal(cases.find((c) => c.name === "external")!.expected, true);
      assert.equal(cases.find((c) => c.name === "null")!.expected, null);
      await repo.reconcileSeats(district.id);
      for (const c of cases) {
        const row = (
          await db.query("SELECT released_at FROM amp_seats WHERE id=$1", [
            c.seat,
          ])
        ).rows[0];
        assert.equal(row.released_at !== null, c.expected === false, c.name);
        if (c.grant)
          assert.equal(
            (
              await db.query("SELECT status FROM amp_grants WHERE id=$1", [
                c.grant,
              ])
            ).rows[0].status,
            c.expected === false ? "revoked" : "active",
            c.name,
          );
      }
      // Once the last eligible reference ends, both tenant reconciliations may
      // release their own duplicate seat and the shared grant is revoked.
      await db.query(
        "UPDATE amp_school_licenses SET ends_at=now() WHERE id=$1",
        [otherLicense],
      );
      await repo.reconcileSeats(district.id);
      await repo.reconcileSeats(other.id);
      assert.equal(
        (await db.query("SELECT status FROM amp_grants WHERE id=$1", [shared]))
          .rows[0].status,
        "revoked",
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_seats WHERE grant_id=$1 AND released_at IS NULL",
            [shared],
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
