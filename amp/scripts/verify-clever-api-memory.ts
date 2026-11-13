/** Synthetic, local-only API preview memory measurement. The database generates
 * the district so the API process never constructs a full source snapshot. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "./migrate.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { storedAdoptionSnapshot } from "../src/schools/clever/store.js";
const url = new URL(process.env.AMP_TEST_DATABASE_URL ?? "");
assert.ok(
  ["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.pathname.startsWith("/amp_scratch_"),
);
const schema = `api_memory_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url.href });
await admin.query(`CREATE SCHEMA ${schema}`);
url.searchParams.set("options", `-c search_path=${schema}`);
await migrate(url.href);
const db = new Pool({ connectionString: url.href, max: 2 });
try {
  const repo = new SchoolRepository(db);
  const org = await repo.createOrg(
    { kind: "district", name: "Synthetic district", timezone: "UTC" },
    { version: "fixture", signerName: "Fixture", signerTitle: "Admin" },
  );
  const district = "1".repeat(24),
    school = "2" + "0".repeat(22) + "1";
  const c = await registerCleverConnection(db, {
    environment: "sandbox",
    districtId: district,
    tenantId: org.id,
  });
  const run = randomUUID();
  await db.query(
    "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status) VALUES($1,$2,'full','succeeded')",
    [run, c.id],
  );
  await db.query(
    `INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,record,last_seen_run_id) VALUES($1,'district',$2,jsonb_build_object('id',$2::text,'name','Fixture'),$3)`,
    [c.id, district, run],
  );
  await db.query(
    `INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,record,last_seen_run_id)
 SELECT $1,'school','2'||lpad(to_hex(n),23,'0'),jsonb_build_object('id','2'||lpad(to_hex(n),23,'0'),'district',$2::text,'name','Fixture school'),$3 FROM generate_series(1,100) n`,
    [c.id, district, run],
  );
  await db.query(
    `INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,record,last_seen_run_id)
 SELECT $1,'user','3'||lpad(to_hex(n),23,'0'),jsonb_build_object('id','3'||lpad(to_hex(n),23,'0'),'district',$2::text,'name',jsonb_build_object('first','Fixture student'),'roles',jsonb_build_object('student',jsonb_build_object('school','2'||lpad(to_hex(1+(n-1)/500),23,'0')))),$3 FROM generate_series(1,50000) n`,
    [c.id, district, run],
  );
  const before = process.memoryUsage().rss;
  for (let i = 0; i < 20; i++) {
    const schools = await storedAdoptionSnapshot(db, c.id);
    assert.equal(schools.schools.length, 100);
    assert.equal(schools.users.length, 0);
    const selected = await storedAdoptionSnapshot(db, c.id, school);
    assert.equal(selected.users.length, 500);
    assert.equal(selected.schools.length, 1);
  }
  console.log(
    JSON.stringify({
      districtStudents: 50000,
      selectedSchoolStudents: 500,
      iterations: 20,
      beforeRssMiB: before / 2 ** 20,
      afterRssMiB: process.memoryUsage().rss / 2 ** 20,
      peakRssMiB: process.resourceUsage().maxRSS / 1024,
    }),
  );
} finally {
  await db.end();
  await admin.end();
}
