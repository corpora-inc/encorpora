import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { buildApp } from "../src/server/app.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { schoolPictures } from "../src/schools/contracts.js";
import { generateProblem } from "../src/math/engine.js";
import { workbookProblems } from "../src/workbook/compose.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { updateStudent, writeStudent } from "../src/schools/roster.js";
import {
  createApproval,
  removeApproval,
  openApproval,
  mailedApprovalUrl,
} from "../src/family/approvals.js";
import { bookSummaries } from "../src/books/catalog.js";

const database = { skip: !process.env.AMP_TEST_DATABASE_URL };

test(
  "concurrent family creation assigns distinct picture identities beyond the first sixteen",
  database,
  async (t) => {
    const f = await fixture(t);
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        f.post("/api/v1/learners", { birthYear: 2016 }),
      ),
    );
    for (const response of responses)
      assert.equal(response.statusCode, 201, response.body);
    assert.equal(
      new Set(responses.map((response) => response.json().name)).size,
      20,
    );
    assert.equal(
      responses.filter((response) => / 2$/.test(response.json().name)).length,
      4,
    );
    const first = responses[0].json();
    await assert.rejects(
      f.db.query(
        "UPDATE amp_people SET email='fixture@example.invalid' WHERE learner_id=$1",
        [first.id],
      ),
      /unnamed learner cannot have identifying roster fields/,
    );
  },
);

test(
  "a family with 1000 live learners refuses another until one is deleted; a school has no such limit",
  database,
  async (t) => {
    const f = await fixture(t);
    const nonce = randomUUID();
    await f.db.query(
      `INSERT INTO amp_learners(id,account_id,name,birth_year)
       SELECT 'fixture-'||$2||'-'||i,$1,'Rowan Fixture',2016 FROM generate_series(1,1000) i`,
      [f.account, nonce],
    );
    const refused = await f.post("/api/v1/learners", { birthYear: 2016 });
    assert.equal(refused.statusCode, 403, refused.body);
    assert.match(refused.json().error, /1,000 learners/);
    await f.db.query("UPDATE amp_learners SET deleted_at=now() WHERE id=$1", [
      `fixture-${nonce}-1`,
    ]);
    const made = await f.post("/api/v1/learners", { birthYear: 2016 });
    assert.equal(made.statusCode, 201, made.body);

    const schools = new SchoolRepository(f.db);
    const org = await schools.createOrg({
      name: "Fixture School",
      kind: "school",
      timezone: "America/New_York",
    });
    // A school org may hold more: 1001 live students, one statement each.
    const person = "md5($2||'-'||i)::uuid";
    await f.db.query(
      `INSERT INTO amp_learners(id,account_id,name,birth_year)
       SELECT 'student-'||$1||'-'||i,'school:'||md5($1||'-'||i)::uuid,'Fox',2016 FROM generate_series(1,1001) i`,
      [nonce],
    );
    await f.db.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,handle,learner_id,timezone)
       SELECT ${person},$1,'Fox','fixture-'||i,'student-'||$2||'-'||i,'America/New_York' FROM generate_series(1,1001) i`,
      [org.id, nonce],
    );
    await f.db.query(
      `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
       SELECT gen_random_uuid(),${person},$1,'student',current_date FROM generate_series(1,1001) i`,
      [org.id, nonce],
    );
    const added = await schools.provisionStudent(org.id, { birthYear: 2016 });
    assert.equal(
      (
        await f.db.query(
          "SELECT count(*)::int AS n FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id WHERE p.tenant_id=$1 AND l.deleted_at IS NULL",
          [org.id],
        )
      ).rows[0].n,
      1002,
    );
    assert.ok(added.learnerId);
  },
);

async function fixture(t: TestContext) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_free_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(scoped.href);
  const repository = new PostgresRepository(scoped.href);
  const db = repository.pool;
  const userId = randomUUID();
  const account = `amp|${userId}`;
  await db.query(
    `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
     VALUES($1,'Casey Fixture',$2,true,now(),now())`,
    [userId, `${userId}@free-allowance.example`],
  );
  const accounts = new Set([account]);
  const authenticate = async (request: {
    headers: { authorization?: string };
  }) => {
    const signedIn = request.headers.authorization?.replace(/^Bearer /, "");
    if (!signedIn || !accounts.has(signedIn))
      throw new ApiError(401, "Sign in to continue");
    return signedIn;
  };
  const app = buildApp({ repository, authenticate });
  const fixtureSecret = randomBytes(32).toString("hex");
  const approvalKeys = {
    secret: fixtureSecret,
    origin: "https://amp.example",
  };
  await registerFamilyRoutes(app, {
    pool: db,
    authenticate,
    approvals: approvalKeys,
  });
  await registerSchoolRoutes(app, {
    pool: db,
    authenticate,
    services: {
      secret: fixtureSecret,
      origin: "https://amp.example",
      learning: repository,
      renderer: { render: async () => Buffer.from("%PDF-1.7 fixture") },
    },
  });
  await app.ready();
  t.after(async () => {
    await app.close();
    await repository.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  const headers = { authorization: `Bearer ${account}` };
  const post = (url: string, payload: object = {}) =>
    app.inject({ method: "POST", url, payload, headers });
  const get = (url: string) => app.inject({ url, headers });
  const consent = () =>
    db.query(
      `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference)
       VALUES($1,'fixture-policy','verified','fixture-parent-verification')`,
      [account],
    );
  const grant = (learnerId: string) =>
    db.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
       VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '1 year')`,
      [`fixture:${learnerId}`, learnerId],
    );
  return {
    app,
    repository,
    db,
    account,
    accounts,
    approvalKeys,
    post,
    get,
    consent,
    grant,
  };
}

test(
  "parent approval names an existing tutor student without replacing their learning or allowance",
  database,
  async (t) => {
    const f = await fixture(t);
    await f.post("/api/v1/learners", { birthYear: 2016 });
    const home = (await f.get("/api/v1/me")).json().familyClass;
    const schools = new SchoolRepository(f.db);
    const student = await schools.provisionStudent(home.orgId, {
      birthYear: 2015,
      classId: home.classId,
    });
    const problem = generateProblem(
      "add-within-20",
      `approval-free:${student.learnerId}`,
    );
    await f.repository.transaction(
      student.accountId,
      student.learnerId,
      async (tx) => {
        await tx.saveProblems([problem]);
        await tx.saveSkip({
          ...problem,
          skipped: true,
          skippedAt: new Date().toISOString(),
        });
      },
    );
    const parentId = randomUUID(),
      parent = `amp|${parentId}`,
      email = `${parentId}@parent.example`;
    f.accounts.add(parent);
    await f.db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
    VALUES($1,'Taylor Fixture',$2,true,now(),now())`,
      [parentId, email],
    );
    assert.equal(
      (
        await f.post("/api/v1/family/approvals", {
          childName: "A child's identifying name",
          parentEmail: "parent@example.invalid",
        })
      ).statusCode,
      400,
      "a teacher invitation cannot collect a child's name before their parent approves",
    );
    const cancelled = await createApproval(f.db, f.approvalKeys, f.account, {
      personId: student.personId,
      parentEmail: "wrong-parent@example.invalid",
    });
    await removeApproval(f.db, f.account, cancelled.id);
    assert.equal(
      (
        await f.db.query("SELECT learner_id FROM amp_people WHERE id=$1", [
          student.personId,
        ])
      ).rows[0].learner_id,
      student.learnerId,
      "cancelling a pending invitation must keep the original student",
    );
    assert.equal(
      (
        await f.db.query(
          "SELECT count(*)::int AS n FROM amp_enrollments WHERE person_id=$1 AND end_on IS NULL",
          [student.personId],
        )
      ).rows[0].n,
      1,
    );
    await f.repository.transaction(
      student.accountId,
      student.learnerId,
      async () => {},
    );
    const sent = await createApproval(f.db, f.approvalKeys, f.account, {
      personId: student.personId,
      parentEmail: email,
    });
    const [token, proof] = new URL(
      mailedApprovalUrl(f.approvalKeys, sent.id),
    ).hash
      .slice(1)
      .split(".");
    await openApproval(f.db, f.approvalKeys, parent, { token, proof });
    const approve = () =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/family/approvals/${sent.id}/approve`,
        headers: { authorization: `Bearer ${parent}` },
        payload: { name: "Rowan Fixture" },
      });
    assert.equal(
      (await approve()).statusCode,
      409,
      "opening the link does not establish naming consent",
    );
    await f.db.query(
      `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference)
    VALUES($1,'fixture-policy','verified','fixture-parent-verification')`,
      [parent],
    );
    const approved = await approve();
    assert.equal(approved.statusCode, 200, approved.body);
    assert.equal(approved.json().learnerId, student.learnerId);
    assert.equal((await approve()).json().learnerId, student.learnerId);
    const row = (
      await f.db.query(
        "SELECT account_id,name,name_pending,free_online_used FROM amp_learners WHERE id=$1",
        [student.learnerId],
      )
    ).rows[0];
    assert.deepEqual(row, {
      account_id: parent,
      name: "Rowan Fixture",
      name_pending: false,
      free_online_used: 1,
    });
    assert.equal(
      (
        await f.db.query("SELECT learner_id FROM amp_people WHERE id=$1", [
          student.personId,
        ])
      ).rows[0].learner_id,
      student.learnerId,
    );
    assert.equal(
      (
        await f.db.query(
          "SELECT count(*)::int AS n FROM amp_instances WHERE learner_id=$1",
          [student.learnerId],
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      f.repository.transaction(
        student.accountId,
        student.learnerId,
        async () => {},
      ),
    );
    const stillLearning = await f.app.inject({
      method: "POST",
      url: `/api/v1/learners/${student.learnerId}/batches`,
      headers: { authorization: `Bearer ${parent}` },
      payload: { count: 1 },
    });
    assert.equal(stillLearning.statusCode, 200, stillLearning.body);
  },
);

/** Another family's parent, with a confirmed address and verified consent. */
async function otherParent(f: Awaited<ReturnType<typeof fixture>>) {
  const id = randomUUID();
  const account = `amp|${id}`;
  const email = `${id}@parent.example`;
  f.accounts.add(account);
  await f.db.query(
    `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
     VALUES($1,'Taylor Fixture',$2,true,now(),now())`,
    [id, email],
  );
  await f.db.query(
    `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference)
     VALUES($1,'fixture-policy','verified','fixture-parent-verification')`,
    [account],
  );
  const approve = async (approvalId: string, name: string) => {
    const [token, proof] = new URL(
      mailedApprovalUrl(f.approvalKeys, approvalId),
    ).hash
      .slice(1)
      .split(".");
    await openApproval(f.db, f.approvalKeys, account, { token, proof });
    const approved = await f.app.inject({
      method: "POST",
      url: `/api/v1/family/approvals/${approvalId}/approve`,
      headers: { authorization: `Bearer ${account}` },
      payload: { name },
    });
    assert.equal(approved.statusCode, 200, approved.body);
    return approved.json().learnerId as string;
  };
  return { account, email, approve };
}

test(
  "a tutor's two invitations to one parent are two links, and approving both adds both children",
  database,
  async (t) => {
    const f = await fixture(t);
    // The tutor's own child makes their family class.
    await f.post("/api/v1/learners", { birthYear: 2016 });
    const parent = await otherParent(f);
    const first = await createApproval(f.db, f.approvalKeys, f.account, {
      parentEmail: parent.email,
    });
    const second = await createApproval(f.db, f.approvalKeys, f.account, {
      parentEmail: parent.email,
    });
    assert.notEqual(
      second.id,
      first.id,
      "a second child of the same parent gets their own link",
    );
    const ana = await parent.approve(first.id, "Ana Fixture");
    const bea = await parent.approve(second.id, "Bea Fixture");
    assert.notEqual(ana, bea);
    assert.deepEqual(
      (
        await f.db.query(
          "SELECT name FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL ORDER BY name",
          [parent.account],
        )
      ).rows.map((row) => row.name),
      ["Ana Fixture", "Bea Fixture"],
    );
    const rows = (await f.get("/api/v1/family/approvals")).json().approvals as {
      status: string;
    }[];
    assert.equal(rows.length, 2);
  },
);

test(
  "an adult starts without a purchase and derived paid access preserves their own free balance",
  database,
  async (t) => {
    const f = await fixture(t);
    const started = await f.post("/api/v1/me/practice", {
      start: "algebra-1",
      timezone: "America/New_York",
    });
    assert.equal(started.statusCode, 201, started.body);
    const learnerId = started.json().learnerId;
    const base = `/api/v1/learners/${learnerId}`;
    const again = await f.post("/api/v1/me/practice", {
      start: "algebra-1",
      timezone: "America/New_York",
    });
    assert.equal(again.json().learnerId, learnerId);
    assert.equal(
      (await f.get("/api/v1/me")).json().adultPractice.learner.active,
      true,
    );
    assert.equal(
      (await f.get("/api/v1/me/practice")).json().learner.active,
      true,
    );
    const usage = async () =>
      (
        await f.db.query(
          "SELECT free_online_used FROM amp_learners WHERE id=$1",
          [learnerId],
        )
      ).rows[0].free_online_used;
    const problems = Array.from({ length: 3 }, (_, index) =>
      generateProblem("add-within-20", `adult-free:${learnerId}:${index}`),
    );
    await f.repository.transaction(f.account, learnerId, (tx) =>
      tx.saveProblems(problems),
    );
    const answer = (index: number) =>
      f.post(`${base}/attempts`, {
        problemId: problems[index].public.id,
        requestId: randomUUID(),
        response: problems[index].answer,
      });
    assert.equal((await answer(0)).statusCode, 200);
    assert.equal(await usage(), 1);
    const child = (
      await f.post("/api/v1/learners", { birthYear: 2016 })
    ).json();
    await f.grant(child.id);
    assert.ok(
      (await f.get("/api/v1/me/practice")).json().learner.endsAt,
      "the adult record refreshes newly acquired access",
    );
    assert.equal(
      (await answer(1)).statusCode,
      200,
      "the child's grant refreshes adult access at the learning gate",
    );
    assert.equal(await usage(), 1);
    await f.db.query(
      "UPDATE amp_grants SET status='revoked' WHERE learner_id=$1",
      [child.id],
    );
    assert.equal(
      (await f.get("/api/v1/me/practice")).json().learner.endsAt,
      null,
      "the adult record does not display revoked access",
    );
    assert.equal(
      (await answer(2)).statusCode,
      200,
      "without refreshing /me, revoked child access falls back to the adult allowance",
    );
    assert.equal(await usage(), 2);
    await f.db.query(
      "UPDATE amp_learners SET free_online_used=100 WHERE id=$1",
      [learnerId],
    );
    assert.equal(
      (await f.post(`${base}/batches`, { count: 1 })).statusCode,
      402,
    );
    assert.equal(
      (await f.get("/api/v1/me/practice")).json().learner.active,
      false,
    );
  },
);

test(
  "a class starts unnamed, names require its agreement, and ending it stops learning",
  database,
  async (t) => {
    const f = await fixture(t);
    const schools = new SchoolRepository(f.db);
    const org = await schools.createOrg({
      name: "Fixture School",
      kind: "school",
      timezone: "America/New_York",
    });
    const home = await schools.createClass(org.id, { name: "Fixture Class" });
    const student = await schools.provisionStudent(org.id, {
      birthYear: 2016,
      classId: home.id,
    });
    const learnerId = student.learnerId;
    const owner = `school:${student.personId}`;
    const read = async () =>
      (
        await f.db.query(
          "SELECT name,name_pending,free_online_used FROM amp_learners WHERE id=$1",
          [learnerId],
        )
      ).rows[0];
    assert.equal((await read()).name_pending, true);
    await updateStudent(
      schools,
      org.id,
      student.personId,
      { gradeLevel: 9 },
      null,
    );
    assert.equal(
      (
        await f.db.query("SELECT birth_year FROM amp_learners WHERE id=$1", [
          learnerId,
        ])
      ).rows[0].birth_year,
      2016,
      "a roster grade does not replace an unnamed learner's supplied birth year",
    );
    await assert.rejects(
      schools.provisionStudent(org.id, {
        givenName: "Rowan Fixture",
        classId: home.id,
      }),
      /agreement_required/,
    );
    await assert.rejects(
      updateStudent(
        schools,
        org.id,
        student.personId,
        { displayName: "Rowan Fixture" },
        null,
      ),
      /consent_required/,
    );
    await f.repository.transaction(owner, learnerId, async (tx) => {
      const problem = generateProblem(
        "add-within-20",
        `class-free:${learnerId}`,
      );
      await tx.saveProblems([problem]);
      await tx.saveSkip({
        ...problem,
        skipped: true,
        skippedAt: new Date().toISOString(),
      });
    });
    assert.equal((await read()).free_online_used, 1);
    await schools.recordDataAgreement(org.id, {
      version: "fixture-policy",
      signerName: "Casey Fixture",
      signerTitle: "Teacher",
    });
    await schools.transaction((client) =>
      writeStudent(client, student.personId, {
        givenName: "Rowan",
        familyName: "Fixture",
      }),
    );
    const rosterName = async () =>
      (
        await f.db.query(
          "SELECT given_name,family_name FROM amp_people WHERE id=$1",
          [student.personId],
        )
      ).rows[0];
    assert.deepEqual(await rosterName(), {
      given_name: "Rowan",
      family_name: "Fixture",
    });
    await updateStudent(
      schools,
      org.id,
      student.personId,
      { gradeLevel: 4 },
      null,
    );
    assert.deepEqual(await rosterName(), {
      given_name: "Rowan",
      family_name: "Fixture",
    });
    assert.deepEqual(await read(), {
      name: "Rowan Fixture",
      name_pending: false,
      free_online_used: 1,
    });
    const second = await schools.provisionStudent(org.id, {
      birthYear: 2017,
      classId: home.id,
    });
    await f.db.query(
      "UPDATE amp_data_agreements SET ended_at=now() WHERE org_id=$1",
      [org.id],
    );
    for (const row of [student, second]) {
      await assert.rejects(
        f.repository.transaction(
          `school:${row.personId}`,
          row.learnerId,
          async () => {},
        ),
        /consent is required/,
      );
    }
  },
);

test(
  "unnamed teens cannot send free text, student sessions stay isolated, and withdrawal stops collection",
  database,
  async (t) => {
    const f = await fixture(t);
    const learner = (
      await f.post("/api/v1/learners", { birthYear: 2010 })
    ).json();
    const sibling = (
      await f.post("/api/v1/learners", { birthYear: 2016 })
    ).json();
    const base = `/api/v1/learners/${learner.id}`;
    const problem = generateProblem(
      "add-within-20",
      `unnamed-flag:${learner.id}`,
    );
    await f.repository.transaction(f.account, learner.id, (tx) =>
      tx.saveProblems([problem]),
    );
    assert.equal(
      (await f.post(`${base}/skips`, { problemId: problem.public.id }))
        .statusCode,
      200,
    );
    const report = {
      problemId: problem.public.id,
      requestId: randomUUID(),
      reasons: ["other"],
      skipped: true,
      client: { kind: "web", viewport: { width: 390, height: 844 } },
    };
    const refused = await f.post(`${base}/problem-flags`, {
      ...report,
      note: "A fixture note",
    });
    assert.equal(refused.statusCode, 400, refused.body);
    assert.equal(
      (await f.post(`${base}/problem-flags`, report)).statusCode,
      201,
    );
    const session = await f.post(
      `/api/v1/family/learners/${learner.id}/practice-here`,
    );
    assert.equal(session.statusCode, 201);
    const headers = { authorization: `Bearer ${session.json().token}` };
    const children = await f.app.inject({ url: "/api/v1/learners", headers });
    assert.deepEqual(
      children.json().learners.map((row: { id: string }) => row.id),
      [learner.id],
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: `/api/v1/learners/${sibling.id}/batches`,
          headers,
          payload: { count: 1 },
        })
      ).statusCode,
      404,
    );
    await f.consent();
    await f.db.query(
      "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id=$1",
      [f.account],
    );
    assert.equal(
      (await f.post(`${base}/batches`, { count: 1 })).statusCode,
      403,
    );
    assert.equal(
      (
        await f.post(`${base}/workbooks`, {
          date: "2026-11-09",
          number: 1,
          paper: "letter",
          minutes: 30,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (await f.post("/api/v1/learners", { birthYear: 2016 })).statusCode,
      403,
    );
  },
);

test(
  "the free allowance opens supporting books without consuming a personalized workbook",
  database,
  async (t) => {
    const f = await fixture(t);
    const learner = (
      await f.post("/api/v1/learners", { birthYear: 2016 })
    ).json();
    const book = bookSummaries[0];
    const open = () =>
      f.post(`/api/v1/learners/${learner.id}/books/${book.id}/open`, {
        readerCapabilities: book.requiredReaderCapabilities,
      });
    const opened = await open();
    assert.equal(opened.statusCode, 200, opened.body);
    const usage = (
      await f.db.query(
        "SELECT free_online_used,free_workbooks_used FROM amp_learners WHERE id=$1",
        [learner.id],
      )
    ).rows[0];
    assert.deepEqual(usage, { free_online_used: 0, free_workbooks_used: 0 });
    await f.db.query(
      "UPDATE amp_learners SET free_online_used=100 WHERE id=$1",
      [learner.id],
    );
    assert.equal((await open()).statusCode, 402);
    await f.grant(learner.id);
    assert.equal((await open()).statusCode, 200);
  },
);

test(
  "an unnamed family learner has a picture identity and cannot be named by a grant alone",
  database,
  async (t) => {
    const f = await fixture(t);
    const made = await f.post("/api/v1/learners", { birthYear: 2016 });
    assert.equal(made.statusCode, 201, made.body);
    const learner = made.json();
    assert.equal(learner.namePending, true);
    assert.ok(schoolPictures.includes(learner.pictureIdentity));
    assert.equal(learner.birthYear, 2016);
    assert.ok(learner.name.length > 0, "a visible picture label is provided");
    const listed = await f.get("/api/v1/learners");
    assert.equal(listed.statusCode, 200, listed.body);
    assert.deepEqual(
      listed.json().learners.map((row: { id: string }) => row.id),
      [learner.id],
    );
    const me = await f.get("/api/v1/me");
    assert.equal(me.statusCode, 200, me.body);
    assert.equal(me.json().family.learners[0].canPractice, true);
    assert.equal(me.json().learners[0].entitlement.active, true);
    assert.equal(me.json().learners[0].entitlement.plan, null);
    assert.equal(me.json().learners[0].entitlement.endsAt, null);
    assert.deepEqual(me.json().family.learners[0].access, []);
    assert.equal(me.json().consent.status, "none");
    assert.equal(me.json().family.consent.status, "not-recorded");
    assert.deepEqual(me.json().family.learners[0].freeAllowance.problems, {
      total: 100,
      used: 0,
      remaining: 100,
    });
    const practiceHere = await f.post(
      `/api/v1/family/learners/${learner.id}/practice-here`,
    );
    assert.equal(
      practiceHere.statusCode,
      201,
      "a learner-bound student session is created",
    );
    const studentMe = await f.app.inject({
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${practiceHere.json().token}` },
    });
    assert.equal(studentMe.statusCode, 200);
    assert.equal(studentMe.json().family.learners[0].canPractice, true);
    assert.equal(studentMe.json().learners[0].entitlement.licensed, false);
    assert.equal(
      studentMe.json().family.learners[0].freeAllowance.problems.remaining,
      100,
    );
    assert.equal(
      (await f.db.query("SELECT count(*)::int AS n FROM amp_trials")).rows[0].n,
      0,
      "the learner is a real family learner, with no trial record",
    );
    const rename = () =>
      f.post(`/api/v1/family/learners/${learner.id}/rename`, {
        name: "Rowan Fixture",
      });
    assert.equal((await rename()).statusCode, 403);
    await f.grant(learner.id);
    assert.equal(
      (await rename()).statusCode,
      403,
      "access alone does not establish parental consent",
    );
    await f.consent();
    const named = await rename();
    assert.equal(named.statusCode, 200, named.body);
    const after = (await f.get("/api/v1/learners")).json().learners;
    assert.equal(after.length, 1);
    assert.equal(after[0].id, learner.id);
    assert.equal(after[0].name, "Rowan Fixture");
    assert.equal(after[0].namePending, false);
  },
);

test(
  "100 unlicensed online answers and skips are counted once, then a grant opens the same learner",
  database,
  async (t) => {
    const f = await fixture(t);
    await f.consent();
    const learner = await f.repository.create(f.account, "Rowan Fixture", 2016);
    const base = `/api/v1/learners/${learner.id}`;
    const batch = await f.post(`${base}/batches`, { count: 1 });
    assert.equal(batch.statusCode, 200, batch.body);
    const problems = Array.from({ length: 103 }, (_, index) => {
      const problem = generateProblem("add-within-20", `free:${index}`);
      problem.public.id = `${problem.public.id}:${learner.id}`;
      return problem;
    });
    await f.repository.transaction(f.account, learner.id, (tx) =>
      tx.saveProblems(problems),
    );
    const requestIds = problems.map(() => randomUUID());
    const answer = (index: number, extra: object = {}) =>
      f.post(`${base}/attempts`, {
        problemId: problems[index].public.id,
        requestId: requestIds[index],
        response: problems[index].answer,
        ...extra,
      });
    const skip = (index: number) =>
      f.post(`${base}/skips`, { problemId: problems[index].public.id });
    for (let index = 0; index < 99; index++) {
      const response =
        index % 2 === 0 ? await answer(index) : await skip(index);
      assert.equal(
        response.statusCode,
        200,
        `problem ${index}: ${response.body}`,
      );
    }
    const lastBatch = await f.post(`${base}/batches`, { count: 5 });
    assert.equal(lastBatch.statusCode, 200, lastBatch.body);
    assert.equal(lastBatch.json().problems.length, 1);
    const concurrent = await Promise.all([answer(99), skip(100)]);
    assert.deepEqual(
      concurrent.map((response) => response.statusCode).sort(),
      [200, 402],
      "concurrent requests cannot spend the last problem twice",
    );
    const winner = concurrent[0].statusCode === 200 ? answer(99) : skip(100);
    assert.equal(
      (await winner).statusCode,
      200,
      "the last request can be retried",
    );
    assert.equal(
      (await f.post(`${base}/batches`, { count: 1 })).statusCode,
      402,
    );
    assert.equal((await answer(101)).statusCode, 402);
    assert.equal((await skip(102)).statusCode, 402);
    assert.equal(
      (await answer(101, { evidenceSource: "paper" })).statusCode,
      400,
      "an online client cannot claim paper evidence to bypass the allowance",
    );
    const history = async () =>
      (
        await f.db.query(
          `SELECT
             (SELECT count(*)::int FROM amp_attempts WHERE learner_id=$1) AS answers,
             (SELECT count(*)::int FROM amp_instances
              WHERE learner_id=$1 AND content->>'skipped'='true') AS skips`,
          [learner.id],
        )
      ).rows[0];
    const before = await history();
    assert.equal(before.answers + before.skips, 100);
    await f.grant(learner.id);
    const paidBatch = await f.post(`${base}/batches`, { count: 1 });
    assert.equal(paidBatch.statusCode, 200, paidBatch.body);
    const paidAnswer = await answer(101);
    assert.equal(paidAnswer.statusCode, 200, paidAnswer.body);
    assert.deepEqual(await history(), {
      answers: before.answers + 1,
      skips: before.skips,
    });
    await f.db.query(
      "UPDATE amp_grants SET status='revoked' WHERE learner_id=$1",
      [learner.id],
    );
    assert.equal(
      (await skip(102)).statusCode,
      402,
      "payment does not reset usage",
    );
  },
);

test(
  "all five workbooks are immediately available, include result recording and remain readable after online exhaustion",
  database,
  async (t) => {
    const f = await fixture(t);
    const created = await f.post("/api/v1/learners", { birthYear: 2016 });
    assert.equal(created.statusCode, 201, created.body);
    const learner = created.json();
    const base = `/api/v1/learners/${learner.id}`;
    const date = new Date().toISOString().slice(0, 10);
    const make = (number: number, paper = "letter") =>
      f.post(`${base}/workbooks`, { date, number, paper, minutes: 30 });
    const usage = async () =>
      (
        await f.db.query(
          "SELECT free_online_used,free_workbooks_used FROM amp_learners WHERE id=$1",
          [learner.id],
        )
      ).rows[0];
    const first = await make(1);
    assert.equal(first.statusCode, 201, first.body);
    const firstBook = first.json();
    const repeated = await make(1, "a4");
    assert.equal(repeated.statusCode, 200, repeated.body);
    assert.equal(repeated.json().id, firstBook.id);
    assert.deepEqual(await usage(), {
      free_online_used: 0,
      free_workbooks_used: 1,
    });
    const record = async (workbookId: string) => {
      const view = await f.get(`${base}/workbooks/${workbookId}/results`);
      assert.equal(view.statusCode, 200, view.body);
      const row = view.json().rows[0];
      const stored = (
        await f.db.query("SELECT spec FROM amp_workbooks WHERE id=$1", [
          workbookId,
        ])
      ).rows[0];
      const problem = workbookProblems(stored.spec)[row.n - 1];
      const entry =
        row.entry === "number"
          ? { n: row.n, answer: problem.answer }
          : { n: row.n, mark: "right" };
      const response = await f.post(`${base}/workbooks/${workbookId}/results`, {
        entries: [entry],
      });
      assert.equal(response.statusCode, 200, response.body);
      return response.json().recorded;
    };
    assert.equal(await record(firstBook.id), 1);
    assert.equal(await record(firstBook.id), 0);
    assert.deepEqual(await usage(), {
      free_online_used: 0,
      free_workbooks_used: 1,
    });
    const problems = Array.from({ length: 100 }, (_, index) => {
      const problem = generateProblem(
        "add-within-20",
        `workbook-free:${index}`,
      );
      problem.public.id = `${problem.public.id}:${learner.id}`;
      return problem;
    });
    await f.repository.transaction(f.account, learner.id, (tx) =>
      tx.saveProblems(problems),
    );
    for (const number of [2, 3, 4]) {
      const made = await make(number);
      assert.equal(made.statusCode, 201, made.body);
    }
    assert.equal(
      (await usage()).free_online_used,
      0,
      "all five workbooks require no online activity",
    );
    const fifth = await Promise.all([make(5), make(6)]);
    assert.deepEqual(fifth.map((r) => r.statusCode).sort(), [201, 402]);
    const lastBook = fifth.find((r) => r.statusCode === 201)!.json();
    for (let index = 0; index < 100; index++) {
      const skipped = await f.post(`${base}/skips`, {
        problemId: problems[index].public.id,
      });
      assert.equal(skipped.statusCode, 200, skipped.body);
    }
    assert.deepEqual(await usage(), {
      free_online_used: 100,
      free_workbooks_used: 5,
    });
    assert.equal((await make(7)).statusCode, 402);
    assert.equal((await make(lastBook.number)).statusCode, 200);
    assert.equal((await f.get(`${base}/workbooks`)).json().workbooks.length, 5);
    const download = await f.get(`${base}/workbooks/${lastBook.id}/document`);
    assert.equal(download.statusCode, 200, download.body.slice(0, 200));
    assert.equal(await record(lastBook.id), 1);
    assert.deepEqual(await usage(), {
      free_online_used: 100,
      free_workbooks_used: 5,
    });
    await f.grant(learner.id);
    const paid = await make(7);
    assert.equal(paid.statusCode, 201, paid.body);
    assert.deepEqual(await usage(), {
      free_online_used: 100,
      free_workbooks_used: 5,
    });
    await f.db.query(
      "UPDATE amp_grants SET status='revoked' WHERE learner_id=$1",
      [learner.id],
    );
    assert.equal((await make(8)).statusCode, 402);
    assert.equal(
      await record(paid.json().id),
      1,
      "issued paid workbooks also retain result entry",
    );
  },
);

test(
  "the teacher workbook view uses a family student's actual owner and separate workbook allowance",
  database,
  async (t) => {
    const f = await fixture(t);
    const created = await f.post("/api/v1/learners", { birthYear: 2016 });
    assert.equal(created.statusCode, 201, created.body);
    const learner = created.json();
    const { class_id: classId, person_id: personId } = (
      await f.db.query(
        `SELECT f.class_id,p.id AS person_id FROM amp_families f
       JOIN amp_people p ON p.learner_id=$2 WHERE f.account_id=$1`,
        [f.account, learner.id],
      )
    ).rows[0];
    const base = `/api/v1/school/classes/${classId}/students/${personId}/workbooks`;
    const stack = await f.get(`/api/v1/school/classes/${classId}/workbooks`);
    assert.equal(stack.statusCode, 200, stack.body);
    assert.equal(stack.json().students[0].seated, false);
    assert.equal(stack.json().students[0].canMakeWorkbook, true);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
    }).format(new Date());
    const made = await f.post(base, {
      date,
      minutes: 30,
      paper: "letter",
      number: 1,
    });
    assert.equal(made.statusCode, 201, made.body);
    const workbook = made.json();
    await f.db.query(
      "UPDATE amp_learners SET free_workbooks_used=5 WHERE id=$1",
      [learner.id],
    );
    const next = await f.post(base, {
      date,
      minutes: 30,
      paper: "letter",
      number: 2,
    });
    assert.equal(next.statusCode, 402, next.body);
    assert.equal(
      next.json().error,
      "free_workbooks_unavailable",
      "quota refusal is not an agreement error",
    );
    // Simulate the exhausted lifetime meter; this test isolates classroom
    // authorization, while the online test spends all 100 through the API.
    await f.db.query(
      "UPDATE amp_learners SET free_online_used=100,free_workbooks_used=5 WHERE id=$1",
      [learner.id],
    );
    const again = await f.post(base, {
      date,
      minutes: 30,
      paper: "a4",
      number: 1,
    });
    assert.equal(again.statusCode, 200, again.body);
    assert.equal(again.json().id, workbook.id);
    const pdf = await f.get(`${base}/${workbook.id}/pdf`);
    assert.equal(pdf.statusCode, 200, pdf.body);
    const marks = await f.post(`${base}/${workbook.id}/marks`, {
      entries: [{ n: 1, mark: "right" }],
    });
    assert.equal(marks.statusCode, 200, marks.body);
    const counters = (
      await f.db.query(
        "SELECT free_online_used,free_workbooks_used FROM amp_learners WHERE id=$1",
        [learner.id],
      )
    ).rows[0];
    assert.deepEqual(counters, {
      free_online_used: 100,
      free_workbooks_used: 5,
    });
  },
);

test(
  "paid answers, skips and new workbooks preserve a partially unused free allowance",
  database,
  async (t) => {
    const f = await fixture(t);
    await f.consent();
    const learner = await f.repository.create(f.account, "Rowan Fixture", 2016);
    const base = `/api/v1/learners/${learner.id}`;
    const problems = Array.from({ length: 5 }, (_, index) => {
      const problem = generateProblem("add-within-20", `paid-freeze:${index}`);
      problem.public.id = `${problem.public.id}:${learner.id}`;
      return problem;
    });
    await f.repository.transaction(f.account, learner.id, (tx) =>
      tx.saveProblems(problems),
    );
    const answer = (index: number) =>
      f.post(`${base}/attempts`, {
        problemId: problems[index].public.id,
        requestId: randomUUID(),
        response: problems[index].answer,
      });
    const skip = (index: number) =>
      f.post(`${base}/skips`, { problemId: problems[index].public.id });
    const make = (number: number) =>
      f.post(`${base}/workbooks`, {
        date: new Date().toISOString().slice(0, 10),
        minutes: 30,
        paper: "letter",
        number,
      });
    assert.equal((await answer(0)).statusCode, 200);
    assert.equal((await skip(1)).statusCode, 200);
    assert.equal((await make(1)).statusCode, 201);
    const allowance = () =>
      f.repository.transaction(f.account, learner.id, (tx) =>
        tx.freeAllowance(),
      );
    const before = await allowance();
    assert.equal(before.problems.used, 2);
    assert.equal(before.workbooks.made, 1);
    await f.grant(learner.id);
    assert.equal((await answer(2)).statusCode, 200);
    assert.equal((await skip(3)).statusCode, 200);
    assert.equal((await make(2)).statusCode, 201);
    assert.deepEqual(
      await allowance(),
      before,
      "all three paid operations freeze unused balances",
    );
    await f.db.query(
      "UPDATE amp_grants SET status='revoked' WHERE learner_id=$1",
      [learner.id],
    );
    assert.deepEqual(
      await allowance(),
      before,
      "revocation restores exactly the prior unused balance",
    );
    assert.equal((await answer(4)).statusCode, 200);
    const after = await allowance();
    assert.equal(after.problems.remaining, 97);
    assert.equal(after.workbooks.made, 1);
    assert.equal((await make(3)).statusCode, 201);
    assert.equal((await allowance()).workbooks.made, 2);
  },
);
