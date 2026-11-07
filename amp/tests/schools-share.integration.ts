import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { SCOPE_CSV_HEADERS } from "../src/schools/scope-and-sequence.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import type { WorkbookRenderer } from "../src/workbook/pdf.js";
import { PDFDocument } from "pdf-lib";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};
const SECRET = "synthetic-share-fixture-secret-0123456789";
const ORIGIN = "https://amp.test";

test(
  "AMP for Schools: family links, and the public curriculum files",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_school_share_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    let renders = 0;
    const renderer: WorkbookRenderer = {
      async render() {
        renders += 1;
        const pdf = await PDFDocument.create();
        pdf.addPage();
        return Buffer.from(await pdf.save());
      },
    };
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: { secret: SECRET, origin: ORIGIN, learning, renderer },
    });
    await app.ready();

    const staff = (
      method: "GET" | "POST",
      account: string,
      path: string,
      payload?: object,
    ) =>
      app.inject({
        method,
        url: `/api/v1/school/${path}`,
        headers: { authorization: `Bearer ${account}` },
        ...(method === "POST" ? { payload: payload ?? {} } : {}),
      });
    const view = (token: string) =>
      app.inject({
        method: "POST",
        url: "/api/v1/school/share/view",
        payload: { token },
      });
    const tokenOf = (shareUrl: string) => shareUrl.split("#")[1]!;
    const makeLink = async (account: string, personId: string) => {
      const response = await staff(
        "POST",
        account,
        `students/${personId}/share`,
      );
      assert.equal(response.statusCode, 200, response.body);
      return response.json().link as { url: string; expiresAt: string };
    };
    const events = async (action: string, personId: string) =>
      (
        await db.query(
          "SELECT count(*)::int AS n FROM amp_school_events WHERE action=$1 AND target_id=$2",
          [action, personId],
        )
      ).rows[0].n as number;
    async function school(name: string) {
      const org = await schools.createOrg(
        { kind: "school", name, timezone: "America/New_York" },
        agreement,
      );
      await schools.issueLicense({
        orgId: org.id,
        seats: 60,
        endsAt: YEAR_AHEAD,
      });
      const period = await schools.createClass(org.id, { name: "Period 1" });
      const teacher = `amp|teacher-${randomUUID()}`;
      await schools.addStaff({
        orgId: org.id,
        role: "teacher",
        givenName: "Fixture",
        accountId: teacher,
        classId: period.id,
      });
      return { orgId: org.id, period, teacher };
    }
    const home = await school("Alder Street School");
    const away = await school("Birch Road School");
    const enroll = (
      place: { orgId: string; period: { id: string } },
      givenName: string,
      familyName: string,
    ) =>
      schools.provisionStudent(place.orgId, {
        givenName,
        familyName,
        classId: place.period.id,
        gradeLevel: 5,
      });

    try {
      await t.test("a link shows one student, and nobody else", async () => {
        const amara = await enroll(home, "Amara", "Osei");
        const caleb = await enroll(home, "Caleb", "Ortiz");
        await db.query(
          `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
           VALUES($1,(now() AT TIME ZONE 'America/New_York')::date,$2,'fixture')`,
          [
            amara.learnerId,
            JSON.stringify({
              overall: { level: 5.2, sd: 0.3, answered: 30, independent: 12 },
              strands: {
                fractions: {
                  level: 5.5,
                  sd: 0.4,
                  answered: 12,
                  independent: 6,
                },
              },
            }),
          ],
        );
        const link = await makeLink(home.teacher, amara.personId);
        assert.match(link.url, /^https:\/\/amp\.test\/p#[A-Za-z0-9_-]{43}$/);
        const seen = await view(tokenOf(link.url));
        assert.equal(seen.statusCode, 200, seen.body);
        assert.equal(seen.headers["cache-control"], "no-store");
        const body = seen.json();
        assert.equal(body.student.name, "Amara Osei");
        assert.equal(body.schoolName, "Alder Street School");
        assert.deepEqual(body.classes, ["Period 1"]);
        assert.equal(body.strands[0].id, "fractions");
        assert.ok(body.level.overall.level > 5);
        // Levels show whatever the student's own setting; hidden is the default.
        assert.ok(!seen.body.includes("Caleb"));
        assert.ok(!seen.body.includes(caleb.personId));
        assert.ok(!seen.body.includes(amara.personId));
        // The same link copies again, and stays one link.
        assert.equal(
          (
            await staff("GET", home.teacher, `students/${amara.personId}/share`)
          ).json().link.url,
          link.url,
        );
        assert.equal(
          (await makeLink(home.teacher, amara.personId)).url,
          link.url,
        );
        assert.equal(await events("student.share-created", amara.personId), 1);
      });

      await t.test(
        "final grades show only once a teacher enters one",
        async () => {
          const noor = await enroll(home, "Noor", "Haddad");
          const link = await makeLink(home.teacher, noor.personId);
          assert.deepEqual((await view(tokenOf(link.url))).json().grades, []);
          const terms = await db.query(
            "SELECT session_id FROM amp_classes WHERE id=$1",
            [home.period.id],
          );
          const entered = await staff(
            "POST",
            home.teacher,
            `classes/${home.period.id}/students/${noor.personId}/final`,
            { term: terms.rows[0].session_id, value: "B+" },
          );
          assert.equal(entered.statusCode, 200, entered.body);
          const body = (await view(tokenOf(link.url))).json();
          assert.equal(body.grades.length, 1);
          assert.equal(body.grades[0].final, "B+");
          assert.ok(!JSON.stringify(body).includes("suggest"));
        },
      );

      await t.test("revoke ends it at once, and is logged", async () => {
        const diego = await enroll(home, "Diego", "Salas");
        const link = await makeLink(home.teacher, diego.personId);
        assert.equal((await view(tokenOf(link.url))).statusCode, 200);
        const revoked = await staff(
          "POST",
          home.teacher,
          `students/${diego.personId}/share/revoke`,
        );
        assert.equal(revoked.statusCode, 200, revoked.body);
        assert.equal(revoked.json().link, null);
        assert.equal((await view(tokenOf(link.url))).statusCode, 410);
        assert.equal(await events("student.share-revoked", diego.personId), 1);
        // A new link is a different one, and the old one stays dead.
        const again = await makeLink(home.teacher, diego.personId);
        assert.notEqual(again.url, link.url);
        assert.equal((await view(tokenOf(link.url))).statusCode, 410);
        assert.equal((await view(tokenOf(again.url))).statusCode, 200);
      });

      await t.test("an expired link ends", async () => {
        const eli = await enroll(home, "Eli", "Novak");
        const link = await makeLink(home.teacher, eli.personId);
        await db.query(
          `UPDATE amp_person_credentials SET expires_at=now()-interval '1 minute'
           WHERE person_id=$1 AND kind='share'`,
          [eli.personId],
        );
        assert.equal((await view(tokenOf(link.url))).statusCode, 410);
        assert.equal(
          (
            await staff("GET", home.teacher, `students/${eli.personId}/share`)
          ).json().link,
          null,
        );
      });

      await t.test("an ended enrollment ends it", async () => {
        const hana = await enroll(home, "Hana", "Sato");
        const link = await makeLink(home.teacher, hana.personId);
        await db.query(
          `UPDATE amp_enrollments SET end_on=(now() AT TIME ZONE 'America/New_York')::date
           WHERE person_id=$1`,
          [hana.personId],
        );
        assert.equal((await view(tokenOf(link.url))).statusCode, 410);
      });

      await t.test("a deleted student's link ends", async () => {
        const imani = await enroll(home, "Imani", "Clarke");
        const link = await makeLink(home.teacher, imani.personId);
        await db.query("DELETE FROM amp_learners WHERE id=$1", [
          imani.learnerId,
        ]);
        const seen = await view(tokenOf(link.url));
        assert.equal(seen.statusCode, 410);
        assert.ok(!seen.body.includes("Imani"));
      });

      await t.test("a token that was never real, or malformed", async () => {
        assert.equal((await view("A".repeat(43))).statusCode, 410);
        assert.equal((await view("short")).statusCode, 410);
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/v1/school/share/view",
              payload: { token: "A".repeat(300) },
            })
          ).statusCode,
          400,
        );
      });

      await t.test(
        "another school's staff can't mint or read one",
        async () => {
          const jonah = await enroll(home, "Jonah", "Reyes");
          for (const [method, path] of [
            ["GET", `students/${jonah.personId}/share`],
            ["POST", `students/${jonah.personId}/share`],
            ["POST", `students/${jonah.personId}/share/revoke`],
            ["POST", `classes/${home.period.id}/parent-links`],
          ] as const)
            assert.equal(
              (await staff(method, away.teacher, path)).statusCode,
              404,
              path,
            );
        },
      );

      await t.test("a student's token can't mint one", async () => {
        const kai = await enroll(home, "Kai", "Nakamura");
        const { token } = await schools.issueStudentSession({
          personId: kai.personId,
          mode: "shared",
        });
        for (const url of [
          `/api/v1/school/students/${kai.personId}/share`,
          `/api/v1/school/classes/${home.period.id}/parent-links`,
        ]) {
          const response = await app.inject({
            method: "POST",
            url,
            headers: { authorization: `Bearer ${token}` },
            payload: {},
          });
          assert.equal(response.statusCode, 401, url);
        }
      });

      await t.test("an aide reads but doesn't hold the link", async () => {
        const lena = await enroll(home, "Lena", "Fischer");
        const aide = `amp|aide-${randomUUID()}`;
        await schools.addStaff({
          orgId: home.orgId,
          role: "aide",
          givenName: "Fixture",
          accountId: aide,
          classId: home.period.id,
        });
        await makeLink(home.teacher, lena.personId);
        const state = await staff(
          "GET",
          aide,
          `students/${lena.personId}/share`,
        );
        assert.equal(state.statusCode, 200, state.body);
        assert.equal(state.json().canManage, false);
        assert.equal(state.json().link, null);
        assert.equal(
          (await staff("POST", aide, `students/${lena.personId}/share`))
            .statusCode,
          404,
        );
      });

      await t.test("a student in no class gets no link to send", async () => {
        const marcus = await enroll(home, "Marcus", "Bell");
        const adminAccount = `amp|admin-${randomUUID()}`;
        await schools.addStaff({
          orgId: home.orgId,
          role: "admin",
          givenName: "Grace",
          familyName: "Okafor",
          accountId: adminAccount,
        });
        await db.query(
          `UPDATE amp_enrollments SET end_on=(now() AT TIME ZONE 'America/New_York')::date
           WHERE person_id=$1`,
          [marcus.personId],
        );
        const state = await staff(
          "GET",
          adminAccount,
          `students/${marcus.personId}/share`,
        );
        assert.equal(state.json().available, false);
        assert.equal(
          (
            await staff(
              "POST",
              adminAccount,
              `students/${marcus.personId}/share`,
            )
          ).statusCode,
          409,
        );
      });

      await t.test(
        "parent links: a fresh link for everyone, logged",
        async () => {
          const place = await school("Cedar Lane School");
          const mei = await enroll(place, "Mei", "Tran");
          const owen = await enroll(place, "=Owen", "Hartley");
          const before = await makeLink(place.teacher, mei.personId);
          const made = await staff(
            "POST",
            place.teacher,
            `classes/${place.period.id}/parent-links`,
          );
          assert.equal(made.statusCode, 200, made.body);
          assert.match(String(made.headers["content-type"]), /text\/csv/);
          assert.match(
            String(made.headers["content-disposition"]),
            /attachment; filename="family-links-period-1\.csv"/,
          );
          const rows = made.body.replace(/^﻿/, "").trim().split("\r\n");
          assert.equal(rows[0], "Student,Link");
          assert.equal(rows.length, 3);
          // A spreadsheet won't run a name as a formula.
          assert.ok(rows.some((row) => row.startsWith("'=Owen Hartley,")));
          const mine = rows.find((row) => row.startsWith("Mei Tran,"))!;
          const fresh = mine.split(",")[1]!;
          assert.notEqual(fresh, before.url);
          assert.equal((await view(tokenOf(before.url))).statusCode, 410);
          assert.equal((await view(tokenOf(fresh))).statusCode, 200);
          assert.equal(await events("student.share-rotated", mei.personId), 1);
          assert.equal(await events("student.share-created", owen.personId), 1);
        },
      );

      await t.test(
        "the curriculum files cache, name themselves and match",
        async () => {
          const json = await app.inject({
            method: "GET",
            url: "/api/v1/schools/scope-and-sequence",
          });
          assert.equal(json.statusCode, 200);
          assert.match(String(json.headers["cache-control"]), /max-age=86400/);
          const scope = json.json();
          assert.ok(scope.objectives > 300);
          assert.ok(scope.problemTypes > 1000);
          assert.ok(scope.lessons > scope.problemTypes);
          assert.equal(scope.levels.length, 13);
          assert.equal(scope.levels[0].label, "Kindergarten");
          assert.equal(scope.levels.at(-1).label, "Precalculus");
          const rows = scope.levels.flatMap(
            (level: { rows: unknown[] }) => level.rows,
          );
          assert.equal(rows.length, scope.objectives);
          assert.ok(!JSON.stringify(rows).includes("SAT."));

          const csv = await app.inject({
            method: "GET",
            url: "/api/v1/schools/scope-and-sequence.csv",
          });
          assert.equal(csv.statusCode, 200);
          assert.match(String(csv.headers["cache-control"]), /max-age=86400/);
          const lines = csv.body.replace(/^﻿/, "").trim().split("\r\n");
          assert.equal(lines[0], SCOPE_CSV_HEADERS.join(","));
          assert.equal(lines.length, scope.objectives + 1);
          assert.ok(csv.body.includes("SAT Advanced Math"));
          assert.ok(!csv.body.includes("SAT."));
          const repeat = await app.inject({
            method: "GET",
            url: "/api/v1/schools/scope-and-sequence.csv",
            headers: { "if-none-match": String(csv.headers.etag) },
          });
          assert.equal(repeat.statusCode, 304);

          const first = await app.inject({
            method: "GET",
            url: "/api/v1/schools/scope-and-sequence.pdf",
          });
          assert.equal(first.statusCode, 200);
          assert.match(
            String(first.headers["content-type"]),
            /application\/pdf/,
          );
          const second = await app.inject({
            method: "GET",
            url: "/api/v1/schools/scope-and-sequence.pdf",
            headers: { "if-none-match": String(first.headers.etag) },
          });
          assert.equal(second.statusCode, 304);
          assert.equal(renders, 1);
          const summary = (
            await app.inject({
              method: "GET",
              url: "/api/v1/schools/curriculum",
            })
          ).json();
          assert.equal(summary.objectives, scope.objectives);
          assert.equal(summary.levels[0].rows, undefined);
        },
      );

      await t.test(
        "device mode: a screen's choice reaches sign-in",
        async () => {
          const place = await school("Dogwood School");
          const second = await schools.createClass(place.orgId, {
            name: "Period 2",
          });
          await schools.addStaff({
            orgId: place.orgId,
            role: "teacher",
            givenName: "Fixture",
            accountId: place.teacher,
            classId: second.id,
          });
          const sam = await enroll(place, "Sam", "Whitlock");
          const code = (
            await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [
              place.period.id,
            ])
          ).rows[0].join_code;
          const signIn = (pictures: string[]) =>
            app.inject({
              method: "POST",
              url: "/api/v1/school/join/picture",
              payload: { code, personId: sam.personId, pictures, set: true },
            });
          const setMode = async (classId: string, deviceMode: string) => {
            const response = await staff(
              "POST",
              place.teacher,
              `classes/${classId}/experience`,
              { values: { deviceMode } },
            );
            assert.equal(response.statusCode, 200, response.body);
            return response.json();
          };
          const MINE = ["fox", "boat", "kite"];
          assert.equal((await signIn(MINE)).json().mode, "shared");
          const set = await setMode(place.period.id, "personal");
          assert.equal(set.settings.deviceMode.value, "personal");
          assert.equal(set.settings.deviceMode.setBy.id, place.period.id);
          assert.equal((await signIn(MINE)).json().mode, "personal");
          // In two classes, one asking for shared devices holds either way in.
          await db.query(
            `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
           VALUES($1,$2,$3,'student',(now() AT TIME ZONE 'America/New_York')::date)`,
            [randomUUID(), second.id, sam.personId],
          );
          assert.equal((await signIn(MINE)).json().mode, "shared");
          await setMode(second.id, "personal");
          assert.equal((await signIn(MINE)).json().mode, "personal");
          // A lock above holds, with who set it.
          const adminAccount = `amp|admin-${randomUUID()}`;
          await schools.addStaff({
            orgId: place.orgId,
            role: "admin",
            givenName: "Dana",
            accountId: adminAccount,
          });
          const locked = await staff(
            "POST",
            adminAccount,
            `orgs/${place.orgId}/experience`,
            { values: { deviceMode: "shared" }, locks: { deviceMode: true } },
          );
          assert.equal(locked.statusCode, 200, locked.body);
          assert.equal(
            (
              await staff(
                "POST",
                place.teacher,
                `classes/${place.period.id}/experience`,
                { values: { deviceMode: "personal" } },
              )
            ).statusCode,
            409,
          );
          const read = (
            await staff(
              "GET",
              place.teacher,
              `classes/${place.period.id}/experience`,
            )
          ).json();
          assert.equal(read.settings.deviceMode.value, "shared");
          assert.equal(read.settings.deviceMode.lockedBy.id, place.orgId);
          assert.equal((await signIn(MINE)).json().mode, "shared");
        },
      );
    } finally {
      await app.close();
      await learning.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
