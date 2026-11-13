// OneRoster preview and apply must agree when matching open manual memberships.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { applyRoster, planRoster } from "../src/schools/reconcile.js";
import { oneRosterRows } from "../src/schools/sources/oneroster.js";
import {
  csvRows,
  guessMapping,
  readTable,
} from "../src/schools/sources/csv.js";
const csv = (text: string) => {
  const table = readTable(text);
  return csvRows(table, guessMapping(table)).rows;
};
const keys = {
  secret: "fixture-secret-fixture-secret",
  origin: "https://amp.example.test",
};

test(
  "M5: CSV-to-OneRoster preview agrees with apply and retry",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `repro_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    const repo = new SchoolRepository(db);
    t.after(async () => {
      await db.end();
      await admin.end();
    });
    const district = await repo.createOrg(
      { kind: "district", name: "D", timezone: "UTC" },
      { version: "fixture", signerName: "A", signerTitle: "S" },
    );
    const a = await repo.createOrg({
      kind: "school",
      name: "A",
      timezone: "UTC",
      parentId: district.id,
    });
    // Term started in August; the school first rostered with a CSV in November.
    const first = await applyRoster(
      repo,
      keys,
      a.id,
      {
        source: "csv",
        rows: csv("Name,Student ID,Grade,Class\nAna Ruiz,S-1,4,Math\n"),
      },
      null,
    );
    const files = {
      orgs: "sourcedId,name,type,parentSourcedId\na,School A,school,d\nd,District,district,\n",
      users:
        "sourcedId,enabledUser,givenName,familyName,identifier,primaryOrgSourcedId,grades\nu,true,Ana,Ruiz,S-1,a,4\n",
      roles:
        "sourcedId,userSourcedId,orgSourcedId,role,roleType,beginDate,endDate\nru,u,a,student,primary,2026-08-01,\n",
      academicSessions:
        "sourcedId,title,type,startDate,endDate,parentSourcedId\ny,2026-27,schoolYear,2026-08-01,2027-07-31,\n",
      courses: "sourcedId,title,grades,schoolYearSourcedId\nc,Math,4,y\n",
      classes:
        "sourcedId,title,courseSourcedId,schoolSourcedId,termSourcedIds\nk1,Math,c,a,y\n",
      enrollments:
        "sourcedId,userSourcedId,classSourcedId,schoolSourcedId,role,beginDate,endDate\neu,u,k1,a,student,2026-08-01,\n",
    };
    const rows = oneRosterRows(files, { schoolSourcedId: "a" }).rows;
    const plan = await planRoster(repo, a.id, { source: "oneroster", rows });
    const out = await applyRoster(
      repo,
      keys,
      a.id,
      {
        source: "oneroster",
        rows,
        resolutions: { [String(rows[0]!.line)]: "same" },
      },
      null,
    );
    const again = await applyRoster(
      repo,
      keys,
      a.id,
      {
        source: "oneroster",
        rows,
        resolutions: { [String(rows[0]!.line)]: "same" },
      },
      null,
    );
    assert.equal(plan[0]!.status, "changed");
    assert.equal(out.results[0]!.status, "updated");
    assert.equal(again.results[0]!.status, "unchanged");
    assert.equal(
      (await planRoster(repo, a.id, { source: "oneroster", rows }))[0]!.status,
      "unchanged",
    );
  },
);
