/** Opt-in synthetic district verification against a dedicated test database.
 *
 * AMP_TEST_DATABASE_URL=postgresql://localhost/amp_fixture \
 *   node --import tsx scripts/verify-clever-scale.ts --run
 *
 * Optional: --schools=100 --students-per-school=100 --classes-per-school=4
 * --page-size=250. AMP_CLEVER_SCALE_MODULE_ROOT can point at another checkout's
 * amp directory. All source records and HTTP responses are generated locally;
 * this script never contacts Clever. Only its randomly named schema is dropped.
 * JSON measurements go to stdout, progress to stderr. Timing is diagnostic,
 * not a performance threshold or a production-capacity claim.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool, type PoolClient } from "pg";
import type { Snapshot, User } from "../src/schools/clever/model.js";
import type { CleverEvent } from "../src/schools/clever/client.js";
import type { SchoolTarget } from "../src/schools/authz.js";

if (!process.argv.includes("--run"))
  throw new Error(
    "Pass --run with AMP_TEST_DATABASE_URL to run the isolated scale fixture.",
  );
const databaseUrl = process.env.AMP_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("AMP_TEST_DATABASE_URL is required");
const moduleRoot = resolve(
  process.env.AMP_CLEVER_SCALE_MODULE_ROOT ??
    fileURLToPath(new URL("..", import.meta.url)),
);
const from = (path: string) =>
  import(pathToFileURL(resolve(moduleRoot, path)).href);
const { assertTestDatabaseTarget } = (await from(
  "scripts/test-database-preflight.ts",
)) as typeof import("./test-database-preflight.js");
assertTestDatabaseTarget(databaseUrl);
const { migrate } = (await from(
  "scripts/migrate.ts",
)) as typeof import("./migrate.js");
const { SchoolRepository } = (await from(
  "src/schools/repository.ts",
)) as typeof import("../src/schools/repository.js");
const { registerCleverConnection } = (await from(
  "src/schools/clever/connection.ts",
)) as typeof import("../src/schools/clever/connection.js");
const { syncCleverConnection } = (await from(
  "src/schools/clever/sync.ts",
)) as typeof import("../src/schools/clever/sync.js");
const { CleverClient } = (await from(
  "src/schools/clever/client.ts",
)) as typeof import("../src/schools/clever/client.js");
const { resolveCleverPerson } = (await from(
  "src/schools/clever/identity.ts",
)) as typeof import("../src/schools/clever/identity.js");
const { can, loadActor, rosterScope } = (await from(
  "src/schools/authz.ts",
)) as typeof import("../src/schools/authz.js");

const codeFiles = [
  "src/schools/clever/client.ts",
  "src/schools/clever/model.ts",
  "src/schools/clever/sync.ts",
  "src/schools/clever/store.ts",
  "src/schools/authz.ts",
  "src/schools/repository.ts",
];
const codeHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      codeFiles.map(async (file) => [
        file,
        createHash("sha256")
          .update(await readFile(resolve(moduleRoot, file)))
          .digest("hex"),
      ]),
    ),
  );
const sourceHashes = await codeHashes();

function integerOption(name: string, fallback: number, min = 1, max = 100_000) {
  const option = process.argv.find((value) => value.startsWith(`--${name}=`));
  const value = option ? Number(option.slice(name.length + 3)) : fallback;
  assert.ok(
    Number.isSafeInteger(value) && value >= min && value <= max,
    `Invalid --${name}`,
  );
  return value;
}
const schoolCount = integerOption("schools", 100, 2, 1_000);
const studentsPerSchool = integerOption("students-per-school", 100, 2, 10_000);
const classesPerSchool = integerOption(
  "classes-per-school",
  4,
  2,
  studentsPerSchool,
);
const pageSize = integerOption("page-size", 250, 1, 1_000);
const studentCount = schoolCount * studentsPerSchool;
assert.ok(studentCount <= 100_000, "Fixture is bounded to 100,000 learners");
const teacherCount = schoolCount * classesPerSchool;
const sourceId = (kind: number, index: number) =>
  `${kind.toString(16)}${index.toString(16).padStart(23, "0")}`;
const districtId = sourceId(1, 1),
  termId = sourceId(6, 1),
  courseId = sourceId(7, 1);
const studentId = (index: number) => sourceId(3, index + 1);
const teacherId = (index: number) => sourceId(4, index + 1);
const sectionId = (index: number) => sourceId(5, index + 1);
const schoolId = (index: number) => sourceId(2, index + 1);
const staffId = sourceId(8, 1),
  adminId = sourceId(8, 2),
  portalStaffId = sourceId(8, 3);
const now = new Date();
const schoolYear = now.getUTCFullYear() - (now.getUTCMonth() < 7 ? 1 : 0);
const snapshot: Snapshot = {
  district: {
    id: districtId,
    name: "Synthetic Scale District",
    connection_type: "complete",
  },
  schools: Array.from({ length: schoolCount }, (_, i) => ({
    id: schoolId(i),
    district: districtId,
    name: `Synthetic School ${i + 1}`,
  })),
  users: [],
  sections: [],
  courses: [
    {
      id: courseId,
      district: districtId,
      name: "Synthetic Mathematics",
      number: "M4",
    },
  ],
  terms: [
    {
      id: termId,
      district: districtId,
      name: "Synthetic school year",
      start_date: `${schoolYear}-08-01`,
      end_date: `${schoolYear + 1}-07-31`,
    },
  ],
};
for (let s = 0; s < schoolCount; s++) {
  for (let i = 0; i < studentsPerSchool; i++) {
    const index = s * studentsPerSchool + i;
    snapshot.users.push({
      id: studentId(index),
      district: districtId,
      name: { first: `Synthetic Student ${index + 1}` },
      roles: {
        student: { school: schoolId(s), schools: [schoolId(s)], grade: "4" },
      },
    });
  }
  for (let c = 0; c < classesPerSchool; c++) {
    const index = s * classesPerSchool + c;
    snapshot.users.push({
      id: teacherId(index),
      district: districtId,
      name: { first: `Synthetic Teacher ${index + 1}` },
      roles: { teacher: { school: schoolId(s), schools: [schoolId(s)] } },
    });
    snapshot.sections.push({
      id: sectionId(index),
      district: districtId,
      school: schoolId(s),
      name: `Synthetic Class ${index + 1}`,
      teacher: teacherId(index),
      teachers: [teacherId(index)],
      students: Array.from({ length: studentsPerSchool }, (_, i) => i)
        .filter((i) => i % classesPerSchool === c)
        .map((i) => studentId(s * studentsPerSchool + i)),
      course: courseId,
      term_id: termId,
    });
  }
}
const viewerStaff = {
  school: schoolId(0),
  schools: [schoolId(0)],
  roles: ["SchoolTechLead"],
};
const portalStaff = {
  school: schoolId(0),
  schools: [schoolId(0)],
  roles: ["PortalOnly"],
};
snapshot.users.push(
  {
    id: staffId,
    district: districtId,
    name: { first: "Synthetic School Viewer" },
    roles: { staff: viewerStaff },
  },
  {
    id: portalStaffId,
    district: districtId,
    name: { first: "Synthetic Portal Staff" },
    roles: { staff: portalStaff },
  },
  {
    id: adminId,
    district: districtId,
    name: { first: "Synthetic District Administrator" },
    roles: { district_admin: { title: "Administrator" } },
  },
);
const seedEvent: CleverEvent = {
  id: sourceId(9, 1),
  type: "districts.updated",
  created: new Date().toISOString(),
  data: { object: snapshot.district },
};
let events: CleverEvent[] = [];
let httpRequests = 0;
const requestPaths = new Map<string, number>();
const transport: typeof fetch = async (input) => {
  const url = new URL(String(input));
  httpRequests++;
  requestPaths.set(url.pathname, (requestPaths.get(url.pathname) ?? 0) + 1);
  if (url.origin === "https://clever.com" && url.pathname === "/oauth/tokens")
    return Response.json({
      data: [
        {
          access_token: "synthetic-local-only",
          owner: { id: districtId, type: "district" },
        },
      ],
    });
  assert.equal(url.origin, "https://api.clever.com");
  if (url.pathname === `/v3.1/districts/${districtId}`)
    return Response.json({ data: snapshot.district });
  const collection = url.pathname.slice("/v3.1/".length);
  let rows: unknown[];
  if (collection === "events")
    rows = url.searchParams.has("ending_before")
      ? [events.at(-1) ?? seedEvent]
      : events.filter(
          (event) => event.id > (url.searchParams.get("starting_after") ?? ""),
        );
  else {
    assert.ok(
      ["schools", "users", "sections", "courses", "terms"].includes(collection),
    );
    rows =
      snapshot[
        collection as "schools" | "users" | "sections" | "courses" | "terms"
      ];
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const next = new URL(url);
  next.searchParams.set("offset", String(offset + pageSize));
  return Response.json({
    data: rows.slice(offset, offset + pageSize).map((data) => ({ data })),
    links:
      offset + pageSize < rows.length
        ? [{ rel: "next", uri: `${next.pathname}${next.search}` }]
        : [],
  });
};
const clever = new CleverClient({
  clientId: "synthetic-client",
  clientSecret: "synthetic-secret",
  fetch: transport,
});
type QueryMetric = { count: number; totalMs: number; maxMs: number };
const measurements: unknown[] = [];
// Bounded batches may add fixed checks; per-person round trips must not return.
const rosterQueryBudget =
  100 + 64 * Math.ceil((studentCount + teacherCount + 3) / 1000);
const queryBudgets: Record<string, number> = {
  first_full: rosterQueryBudget,
  repeat_full: rosterQueryBudget,
  transfer_events: rosterQueryBudget + 8,
  empty_events: 25,
  issue_district_license: 20 + 4 * Math.ceil(studentCount / 1000),
  repeat_seat_reconciliation: 20,
  sample_paid_access: Math.min(schoolCount, 100) + 4,
};
const mib = (bytes: number) => Math.round((bytes / 1_048_576) * 100) / 100;
const rounded = (value: number) => Math.round(value * 100) / 100;
async function measuredDatabase<T>(
  db: Pool,
  label: string,
  run: (client: PoolClient) => Promise<T>,
  describe: (result: T) => Record<string, unknown> = () => ({}),
) {
  const client = await db.connect();
  const original = client.query.bind(client);
  const queries = new Map<string, QueryMetric>();
  const databaseErrors: { code: string; message: string; sql: string }[] = [];
  let queryCount = 0,
    queryMs = 0;
  client.query = (async (...args: unknown[]) => {
    const sql =
      typeof args[0] === "string"
        ? args[0]
        : (args[0] as { text: string }).text;
    const key = sql.trim().replace(/\s+/g, " ");
    const started = performance.now();
    try {
      return await Reflect.apply(original, client, args);
    } catch (error) {
      databaseErrors.push({
        code:
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "database_error",
        message:
          error instanceof Error ? error.message : "Database call failed",
        sql: key,
      });
      throw error;
    } finally {
      const elapsed = performance.now() - started;
      queryCount++;
      queryMs += elapsed;
      const metric = queries.get(key) ?? { count: 0, totalMs: 0, maxMs: 0 };
      metric.count++;
      metric.totalMs += elapsed;
      metric.maxMs = Math.max(metric.maxMs, elapsed);
      queries.set(key, metric);
    }
  }) as PoolClient["query"];
  const before = process.memoryUsage(),
    cpuBefore = process.cpuUsage(),
    requestsBefore = httpRequests;
  let peakRss = before.rss,
    peakHeap = before.heapUsed,
    peakHeapTotal = before.heapTotal;
  const sample = () => {
    const memory = process.memoryUsage();
    peakRss = Math.max(peakRss, memory.rss);
    peakHeap = Math.max(peakHeap, memory.heapUsed);
    peakHeapTotal = Math.max(peakHeapTotal, memory.heapTotal);
  };
  const sampler = setInterval(sample, 100);
  const started = performance.now();
  const heartbeat = setInterval(
    () =>
      console.error(
        JSON.stringify({
          phase: label,
          elapsedSeconds: rounded((performance.now() - started) / 1000),
          queries: queryCount,
          rssMiB: mib(process.memoryUsage().rss),
        }),
      ),
    15_000,
  );
  console.error(JSON.stringify({ phase: label, status: "started" }));
  try {
    const result = await run(client);
    assert.ok(
      queryCount > 0,
      "Scale instrumentation did not observe database calls",
    );
    const queryBudget = queryBudgets[label];
    if (queryBudget !== undefined)
      assert.ok(
        queryCount <= queryBudget,
        `${label}: ${queryCount} SQL calls exceeds batch budget ${queryBudget}`,
      );
    sample();
    const cpu = process.cpuUsage(cpuBefore);
    const measurement = {
      phase: label,
      ...describe(result),
      seconds: rounded((performance.now() - started) / 1000),
      httpRequests: httpRequests - requestsBefore,
      queryCount,
      queryBudget,
      milliseconds: rounded(performance.now() - started),
      querySeconds: rounded(queryMs / 1000),
      cpuSeconds: rounded((cpu.user + cpu.system) / 1_000_000),
      baselineRssMiB: mib(before.rss),
      peakRssMiB: mib(peakRss),
      baselineHeapUsedMiB: mib(before.heapUsed),
      baselineHeapTotalMiB: mib(before.heapTotal),
      peakHeapUsedMiB: mib(peakHeap),
      peakHeapTotalMiB: mib(peakHeapTotal),
      slowestQueries: [...queries]
        .sort((a, b) => b[1].totalMs - a[1].totalMs)
        .slice(0, 8)
        .map(([sql, m]) => ({
          sql,
          count: m.count,
          totalSeconds: rounded(m.totalMs / 1000),
          maxMs: rounded(m.maxMs),
        })),
    };
    measurements.push(measurement);
    console.error(
      JSON.stringify({
        phase: label,
        status: "passed",
        seconds: measurement.seconds,
        queries: queryCount,
      }),
    );
    return result;
  } catch (error) {
    sample();
    const failed = {
      phase: label,
      status: "failed",
      databaseErrors,
      milliseconds: rounded(performance.now() - started),
      queryCount,
      querySeconds: rounded(queryMs / 1000),
      peakRssMiB: mib(peakRss),
      peakHeapUsedMiB: mib(peakHeap),
      peakHeapTotalMiB: mib(peakHeapTotal),
      errorCode:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "verification_failed",
    };
    measurements.push(failed);
    console.error(JSON.stringify(failed));
    throw error;
  } finally {
    clearInterval(sampler);
    clearInterval(heartbeat);
    client.query = original;
    client.release();
  }
}

const measuredSync = (
  db: Pool,
  connectionId: string,
  label: string,
  mode: "full" | "events",
) =>
  measuredDatabase(
    db,
    label,
    (client) => {
      const options = { mode, db: client };
      return syncCleverConnection(db, connectionId, clever, options);
    },
    (result) => ({ mode: result.mode, counts: result.counts }),
  );

/** Give the real repository its normal transaction lifecycle while the outer
 * measurement owns/reports the client. No production pool is modified. */
function measuredRepository(db: Pool, client: PoolClient) {
  const borrowed = new Proxy(client, {
    get(target, key) {
      if (key === "release") return () => {};
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const pool = new Proxy(db, {
    get(target, key) {
      if (key === "connect") return async () => borrowed;
      if (key === "query") return client.query.bind(client);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const repository = new SchoolRepository(pool);
  assert.equal(
    typeof Reflect.get(repository, "reconcileSeats"),
    "function",
    "Implementation must support school seat reconciliation",
  );
  return repository as InstanceType<typeof SchoolRepository> & {
    reconcileSeats(tenantId: string): Promise<{ assigned: number }>;
  };
}
function summarizePlan(node: Record<string, unknown>): unknown {
  return {
    node: node["Node Type"],
    index: node["Index Name"],
    relation: node["Relation Name"],
    rows: node["Actual Rows"],
    loops: node["Actual Loops"],
    sharedHitBlocks: node["Shared Hit Blocks"],
    sharedReadBlocks: node["Shared Read Blocks"],
    ...(Array.isArray(node.Plans)
      ? { children: node.Plans.map(summarizePlan) }
      : {}),
  };
}

const schema = `clever_scale_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: databaseUrl, max: 1 });
const scoped = new URL(databaseUrl);
scoped.searchParams.set("options", `-c search_path=${schema}`);
let db: Pool | undefined;
let databaseEnvironment: Record<string, unknown> | undefined;
await admin.query(`CREATE SCHEMA ${schema}`);
try {
  await migrate(scoped.href);
  db = new Pool({ connectionString: scoped.href, max: 3 });
  const migrationSnapshot = (
    await db.query(`SELECT count(*)::int AS count,
    max(name) AS latest,md5(string_agg(name||':'||checksum,',' ORDER BY name)) AS checksum
    FROM amp_migrations`)
  ).rows[0];
  const databaseRuntime = (
    await db.query(`SELECT current_setting('server_version') AS version,
    current_setting('max_connections')::int AS max_connections,
    current_setting('max_locks_per_transaction')::int AS max_locks_per_transaction`)
  ).rows[0];
  databaseEnvironment = databaseRuntime;
  const repo = new SchoolRepository(db);
  const org = await repo.createOrg(
    { kind: "district", name: "Synthetic Scale District", timezone: "UTC" },
    {
      version: "synthetic-scale",
      signerName: "Synthetic Administrator",
      signerTitle: "Fixture",
    },
  );
  const connection = await registerCleverConnection(db, {
    environment: "sandbox",
    districtId,
    tenantId: org.id,
    eventsEnabled: true,
  });
  const counts = async () =>
    (
      await db!.query(`SELECT
    (SELECT count(*)::int FROM amp_orgs) AS orgs,
    (SELECT count(*)::int FROM amp_people) AS people,
    (SELECT count(*)::int FROM amp_learners) AS learners,
    (SELECT count(*)::int FROM amp_classes) AS classes,
    (SELECT count(*)::int FROM amp_org_roles) AS roles,
    (SELECT count(*)::int FROM amp_org_roles WHERE end_on IS NULL) AS active_roles,
    (SELECT count(*)::int FROM amp_enrollments) AS enrollments,
    (SELECT count(*)::int FROM amp_enrollments WHERE end_on IS NULL) AS active_enrollments,
    (SELECT count(*)::int FROM amp_clever_bindings) AS bindings,
    (SELECT count(*)::int FROM amp_clever_memberships) AS source_memberships`)
    ).rows[0];
  const identityDigest = async () =>
    (
      await db!.query(
        "SELECT md5(string_agg(id::text||':'||COALESCE(learner_id::text,''),',' ORDER BY id)) AS digest FROM amp_people",
      )
    ).rows[0].digest as string;
  const membershipDigest = async () =>
    (
      await db!.query(
        "SELECT md5(string_agg(id::text,',' ORDER BY id)) AS digest FROM (SELECT id FROM amp_org_roles UNION ALL SELECT id FROM amp_enrollments) x",
      )
    ).rows[0].digest as string;
  const sourcePerson = (id: string) =>
    resolveCleverPerson(db!, {
      environment: "sandbox",
      districtId,
      userId: id,
    });
  const binding = async (kind: string, id: string) =>
    (
      await db!.query(
        "SELECT local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind=$2 AND clever_id=$3",
        [connection.id, kind, id],
      )
    ).rows[0].local_id as string;
  const first = await measuredSync(db, connection.id, "first_full", "full");
  assert.deepEqual(first.counts, {
    schools: schoolCount,
    users: studentCount + teacherCount + 3,
    sections: teacherCount,
    courses: 1,
    terms: 1,
  });
  const firstCounts = await counts();
  assert.equal(firstCounts.orgs, schoolCount + 1);
  assert.equal(firstCounts.people, studentCount + teacherCount + 3);
  assert.equal(firstCounts.learners, studentCount);
  assert.equal(firstCounts.classes, teacherCount);
  assert.equal(firstCounts.active_roles, studentCount + teacherCount + 2);
  assert.equal(firstCounts.active_enrollments, studentCount + teacherCount);
  assert.equal(
    firstCounts.source_memberships,
    firstCounts.active_roles + firstCounts.active_enrollments,
  );
  const distribution = (
    await db.query(
      `SELECT o.id,
    (SELECT count(*)::int FROM amp_classes c WHERE c.org_id=o.id) AS classes,
    (SELECT count(*)::int FROM amp_org_roles r WHERE r.org_id=o.id AND r.role='student' AND r.end_on IS NULL) AS students,
    (SELECT count(*)::int FROM amp_org_roles r WHERE r.org_id=o.id AND r.role='teacher' AND r.end_on IS NULL) AS teachers
    FROM amp_orgs o WHERE o.parent_id=$1`,
      [org.id],
    )
  ).rows;
  assert.equal(distribution.length, schoolCount);
  assert.ok(
    distribution.every(
      (row) =>
        row.classes === classesPerSchool &&
        row.students === studentsPerSchool &&
        row.teachers === classesPerSchool,
    ),
  );
  const identities = await identityDigest(),
    memberships = await membershipDigest();
  const movedBefore = await sourcePerson(studentId(0));
  assert.ok(movedBefore?.learnerId);
  await db.query(
    "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,'{}')",
    ["synthetic-scale-evidence", movedBefore.learnerId],
  );
  await db.query(
    "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES($1,$2,$3,$4,$5)",
    [
      "synthetic-scale-attempt",
      movedBefore.learnerId,
      "synthetic-scale-evidence",
      "synthetic-scale-request",
      JSON.stringify({
        createdAt: new Date().toISOString(),
        skillId: "synthetic-scale-skill",
        correct: true,
      }),
    ],
  );
  await measuredSync(db, connection.id, "repeat_full", "full");
  assert.deepEqual(await counts(), firstCounts);
  assert.equal(await identityDigest(), identities);
  assert.equal(await membershipDigest(), memberships);

  const firstSchool = await binding("school", schoolId(0)),
    lastSchool = await binding("school", schoolId(schoolCount - 1));
  const firstClass = await binding("section", sectionId(0)),
    sameSchoolOtherClass = await binding("section", sectionId(1)),
    lastClass = await binding("section", sectionId(teacherCount - 1));
  const orgTarget = (id: string): Extract<SchoolTarget, { kind: "org" }> => ({
    kind: "org",
    orgId: id,
    path: [org.id, id],
  });
  const classTarget = (id: string, school: string): SchoolTarget => ({
    kind: "class",
    classId: id,
    orgId: school,
    path: [org.id, school],
  });
  const studentTarget = (school: string, classId: string): SchoolTarget => ({
    kind: "student",
    personId: movedBefore.personId,
    orgId: school,
    path: [org.id, school],
    classIds: [classId],
  });
  for (const [source, account] of [
    [teacherId(0), "amp|scale-teacher"],
    [teacherId(teacherCount - 1), "amp|scale-last-teacher"],
    [staffId, "amp|scale-viewer"],
    [portalStaffId, "amp|scale-portal"],
    [adminId, "amp|scale-admin"],
  ]) {
    const person = await sourcePerson(source!);
    assert.ok(person);
    await db.query("UPDATE amp_people SET account_id=$2 WHERE id=$1", [
      person.personId,
      account,
    ]);
  }
  const accessStarted = performance.now();
  const teacher = await loadActor(db, "amp|scale-teacher"),
    viewer = await loadActor(db, "amp|scale-viewer"),
    portalStaffActor = await loadActor(db, "amp|scale-portal"),
    districtAdmin = await loadActor(db, "amp|scale-admin");
  assert.equal(
    can(teacher, "classes.read", classTarget(firstClass, firstSchool)),
    true,
  );
  assert.equal(
    can(
      teacher,
      "classes.read",
      classTarget(sameSchoolOtherClass, firstSchool),
    ),
    false,
  );
  assert.equal(can(teacher, "org.read", orgTarget(lastSchool)), false);
  assert.equal(
    can(teacher, "students.read", studentTarget(firstSchool, firstClass)),
    true,
  );
  assert.deepEqual(rosterScope(teacher, orgTarget(firstSchool)), {
    classIds: [firstClass],
  });
  assert.equal(can(viewer, "students.read", orgTarget(firstSchool)), true);
  assert.equal(
    can(portalStaffActor, "org.read", orgTarget(firstSchool)),
    false,
  );
  assert.equal(
    can(portalStaffActor, "students.read", orgTarget(firstSchool)),
    false,
  );
  assert.deepEqual(portalStaffActor.roles, []);
  assert.deepEqual(portalStaffActor.classes, []);
  assert.equal(can(viewer, "students.read", orgTarget(lastSchool)), false);
  assert.equal(
    can(viewer, "grades.write", classTarget(firstClass, firstSchool)),
    false,
  );
  assert.deepEqual(rosterScope(viewer, orgTarget(firstSchool)), {
    classIds: null,
  });
  assert.equal(can(districtAdmin, "staff.manage", orgTarget(lastSchool)), true);
  const unrelated = randomUUID();
  assert.equal(
    can(districtAdmin, "org.read", {
      kind: "org",
      orgId: unrelated,
      path: [unrelated],
    }),
    false,
  );
  assert.equal(
    can(
      await loadActor(db, `school:${movedBefore.personId}`),
      "org.read",
      orgTarget(firstSchool),
    ),
    false,
  );
  const accessMs = rounded(performance.now() - accessStarted);

  const movedUser = snapshot.users.find((user) => user.id === studentId(0))!;
  (movedUser.roles.student as NonNullable<User["roles"]["student"]>).school =
    schoolId(schoolCount - 1);
  movedUser.roles.student!.schools = [schoolId(schoolCount - 1)];
  snapshot.sections[0]!.students = snapshot.sections[0]!.students.filter(
    (id) => id !== studentId(0),
  );
  snapshot.sections.at(-1)!.students.push(studentId(0));
  events = [movedUser, snapshot.sections[0]!, snapshot.sections.at(-1)!].map(
    (object, i) => ({
      id: sourceId(9, i + 2),
      type: i === 0 ? "users.updated" : "sections.updated",
      created: new Date().toISOString(),
      data: { object },
    }),
  );
  const transfer = await measuredSync(
    db,
    connection.id,
    "transfer_events",
    "events",
  );
  assert.equal(transfer.mode, "events");
  assert.equal(transfer.cursor, events.at(-1)!.id);
  const movedAfter = await sourcePerson(studentId(0));
  assert.equal(movedAfter?.personId, movedBefore.personId);
  assert.equal(movedAfter?.learnerId, movedBefore.learnerId);
  assert.equal(await identityDigest(), identities);
  assert.deepEqual(
    (
      await db.query(
        "SELECT class_id FROM amp_enrollments WHERE person_id=$1 AND role='student' AND end_on IS NULL",
        [movedBefore.personId],
      )
    ).rows,
    [{ class_id: lastClass }],
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT org_id FROM amp_org_roles WHERE person_id=$1 AND role='student' AND end_on IS NULL",
        [movedBefore.personId],
      )
    ).rows,
    [{ org_id: lastSchool }],
  );
  assert.equal(
    (
      await db.query(
        "SELECT 1 FROM amp_attempts WHERE learner_id=$1 AND id='synthetic-scale-attempt'",
        [movedBefore.learnerId],
      )
    ).rowCount,
    1,
  );
  assert.equal(
    can(
      await loadActor(db, "amp|scale-teacher"),
      "students.read",
      studentTarget(lastSchool, lastClass),
    ),
    false,
  );
  assert.equal(
    can(
      await loadActor(db, "amp|scale-last-teacher"),
      "students.read",
      studentTarget(lastSchool, lastClass),
    ),
    true,
  );
  const finalCounts = await counts();
  assert.equal(finalCounts.active_enrollments, firstCounts.active_enrollments);
  assert.equal(finalCounts.active_roles, firstCounts.active_roles);
  const transferredMemberships = await membershipDigest();
  const empty = await measuredSync(db, connection.id, "empty_events", "events");
  assert.equal(empty.mode, "events");
  assert.equal(empty.cursor, transfer.cursor);
  assert.deepEqual(empty.counts, transfer.counts);
  assert.deepEqual(await counts(), finalCounts);
  assert.equal(await identityDigest(), identities);
  assert.equal(await membershipDigest(), transferredMemberships);
  assert.equal(
    (
      await db.query(
        "SELECT 1 FROM amp_clever_sync_runs WHERE status='succeeded'",
      )
    ).rowCount,
    4,
  );
  const license = await measuredDatabase(
    db,
    "issue_district_license",
    (client) =>
      measuredRepository(db!, client).issueLicense({
        orgId: org.id,
        seats: studentCount,
        endsAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        reference: "synthetic-scale",
      }),
    (result) => ({ assigned: result.assigned, seats: result.seats }),
  );
  assert.equal(license.assigned, studentCount);
  const seatState = async () =>
    (
      await db!.query(`SELECT
    (SELECT count(*)::int FROM amp_seats WHERE released_at IS NULL) AS seats,
    (SELECT count(DISTINCT person_id)::int FROM amp_seats WHERE released_at IS NULL) AS people,
    (SELECT count(*)::int FROM amp_grants WHERE status='active') AS grants,
    (SELECT md5(string_agg(id::text||':'||grant_id,',' ORDER BY id)) FROM amp_seats) AS digest`)
    ).rows[0];
  const paidBefore = await seatState();
  assert.equal(paidBefore.seats, studentCount);
  assert.equal(paidBefore.people, studentCount);
  assert.equal(paidBefore.grants, studentCount);
  const reconciled = await measuredDatabase(
    db,
    "repeat_seat_reconciliation",
    (client) => measuredRepository(db!, client).reconcileSeats(org.id),
    (result) => ({ assigned: result.assigned }),
  );
  assert.equal(reconciled.assigned, 0);
  assert.deepEqual(await seatState(), paidBefore);
  assert.equal(await identityDigest(), identities);
  assert.equal(await membershipDigest(), transferredMemberships);
  const paidLookup =
    "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND starts_at<=now() AND ends_at>now() AND amp_school_grant_valid(id) LIMIT 1";
  const paidSamples = (
    await db.query(`SELECT DISTINCT ON(r.org_id) p.learner_id,s.grant_id FROM amp_people p
    JOIN amp_seats s ON s.person_id=p.id JOIN amp_org_roles r ON r.person_id=p.id
    WHERE s.released_at IS NULL AND r.role='student' AND r.end_on IS NULL ORDER BY r.org_id,p.id LIMIT 100`)
  ).rows;
  const accessLatencies: number[] = [];
  await measuredDatabase(
    db,
    "sample_paid_access",
    async (client) => {
      for (const sample of paidSamples) {
        const started = performance.now();
        assert.equal(
          (await client.query(paidLookup, [sample.learner_id])).rowCount,
          1,
        );
        accessLatencies.push(performance.now() - started);
      }
      assert.equal(
        (await client.query(paidLookup, [randomUUID()])).rowCount,
        0,
      );
    },
    () => ({ samples: paidSamples.length }),
  );
  accessLatencies.sort((a, b) => a - b);
  const sampleAccess = {
    samples: paidSamples.length,
    medianMs: rounded(accessLatencies[Math.floor(accessLatencies.length / 2)]!),
    p95Ms: rounded(
      accessLatencies[
        Math.min(
          accessLatencies.length - 1,
          Math.floor(accessLatencies.length * 0.95),
        )
      ]!,
    ),
    maxMs: rounded(accessLatencies.at(-1)!),
  };
  await db.query("ANALYZE amp_seats");
  await db.query("ANALYZE amp_grants");
  const explainLookup = async (sql: string, value: string) => {
    const explanation = (
      await db!.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`, [value])
    ).rows[0]["QUERY PLAN"][0];
    return {
      planningMs: explanation["Planning Time"],
      executionMs: explanation["Execution Time"],
      plan: summarizePlan(explanation.Plan),
    };
  };
  const lookupPlans = {
    seatByGrant: await explainLookup(
      "SELECT id FROM amp_seats WHERE grant_id=$1",
      paidSamples[0]!.grant_id,
    ),
    paidGrant: await explainLookup(paidLookup, paidSamples[0]!.learner_id),
  };
  if (studentCount >= 1000)
    assert.ok(
      JSON.stringify(lookupPlans.seatByGrant).includes("amp_seats_grant_idx"),
      "Seat authorization should use its grant index at district scale",
    );
  assert.deepEqual(
    await codeHashes(),
    sourceHashes,
    "Implementation changed during verification",
  );
  console.log(
    JSON.stringify(
      {
        status: "passed",
        fixture: {
          schools: schoolCount,
          students: studentCount,
          teachers: teacherCount,
          classes: teacherCount,
          schoolViewers: 1,
          portalOnlyStaff: 1,
          districtAdmins: 1,
          pageSize,
        },
        measurements,
        queryBudgets,
        firstCounts,
        finalCounts,
        accessChecksMs: accessMs,
        paidAccess: {
          ...sampleAccess,
          seats: paidBefore.seats,
          grants: paidBefore.grants,
          lookupPlans,
        },
        assertions: [
          "first import counts and every school's distribution",
          "repeat stable person/learner/membership IDs",
          "teacher class scope",
          "SchoolTechLead viewer scope and PortalOnly denial",
          "district admin tenant scope",
          "student denied staff access",
          "Events transfer retains learner and attempt",
          "former teacher loses transferred student access",
          "empty Events poll preserves cursor, counts and identity/membership IDs",
          "district license seats every learner once and reconciliation is idempotent",
          "sampled paid access and indexed seat lookup",
        ],
        httpRequests,
        requestPaths: Object.fromEntries(requestPaths),
        sourceHashes,
        migrationSnapshot,
        runtime: {
          node: process.versions.node,
          postgres: databaseRuntime,
          platform: process.platform,
          architecture: process.arch,
        },
        memorySamplingMs: 100,
        limitations: [
          "synthetic HTTP transport, no external network latency",
          "single connection on local PostgreSQL",
          "memory samples cover Node only, excluding PostgreSQL",
          "query instrumentation adds small per-call overhead",
          "excludes browser and pilot post-sync worker; paid license/reconciliation are measured separately",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.log(
    JSON.stringify(
      {
        status: "failed",
        databaseEnvironment,
        fixture: {
          schools: schoolCount,
          students: studentCount,
          teachers: teacherCount,
        },
        measurements,
        sourceHashes,
        queryBudgets,
        errorCode:
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "verification_failed",
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await db?.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
