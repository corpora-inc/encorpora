import { randomInt, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  activeToday,
  generateStudentToken,
  hashStudentToken,
  schoolAccountId,
  studentSessionExpiry,
} from "./principal.js";
import {
  addStaffSchema,
  extendLicenseSchema,
  createClassSchema,
  createOrgSchema,
  createStudentSchema,
  dataAgreementSchema,
  issueLicenseSchema,
  issueStudentSessionSchema,
  setSeatsSchema,
  SchoolError,
  type ClassResource,
  type CreateClass,
  type CreateStudent,
  type DataAgreement,
  type EnrollmentRole,
  type IssueLicense,
  type OrgKind,
  type OrgResource,
  type Page,
  type SessionMode,
  type StaffRole,
  type StudentResource,
} from "./contracts.js";
import { recordEvent } from "./events.js";

type Org = { id: string; path: string[]; timezone: string };
const FROM_ORG = `SELECT id,path,timezone FROM amp_orgs WHERE id=$1`;
const IN_FORCE = (license: string) =>
  `${license}.status='active' AND ${license}.starts_at<=now() AND ${license}.ends_at>now()`;

const HANDLE_FIRST = [
  "Bright",
  "Calm",
  "Clever",
  "Keen",
  "Lively",
  "Quick",
  "Steady",
  "Swift",
];
const HANDLE_SECOND = [
  "Falcon",
  "Fox",
  "Heron",
  "Lynx",
  "Otter",
  "Owl",
  "Raven",
  "Wren",
];
/** A name for wider standings boards: says nothing about who this is. */
export const generateHandle = () =>
  `${HANDLE_FIRST[randomInt(HANDLE_FIRST.length)]}${HANDLE_SECOND[randomInt(HANDLE_SECOND.length)]}${randomInt(1000, 10000)}`;

const JOIN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generateJoinCode = () =>
  Array.from(
    { length: 6 },
    () => JOIN_ALPHABET[randomInt(JOIN_ALPHABET.length)],
  ).join("");

/** The prior for a student with no birth date on file: the year a child at this
 * grade is typically born, so `initialLevel` starts them at their grade. Uses
 * the same August school year as `completedGrade`. K is grade 0. */
export function birthYearForGrade(gradeLevel: number, now = new Date()) {
  const schoolYear = now.getUTCFullYear() - (now.getUTCMonth() < 7 ? 1 : 0);
  return schoolYear - gradeLevel - 6;
}
function learnerName(person: {
  givenName: string;
  familyName?: string;
  displayName?: string;
}) {
  return (
    person.displayName ??
    (person.familyName
      ? `${person.givenName} ${person.familyName}`
      : person.givenName)
  );
}

export class SchoolRepository {
  constructor(readonly pool: Pool) {}

  async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='30s'");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async org(client: PoolClient, orgId: string): Promise<Org> {
    const org = (await client.query(FROM_ORG, [orgId])).rows[0];
    if (!org) throw new SchoolError(404, "org_not_found");
    return org;
  }
  async today(client: PoolClient, timezone: string): Promise<string> {
    return (
      await client.query(
        "SELECT to_char(now() AT TIME ZONE $1,'YYYY-MM-DD') AS today",
        [timezone],
      )
    ).rows[0].today;
  }
  /** A class this org's staff can reach: at the org or below it. */
  async classIn(client: PoolClient, classId: string, orgPath: string[]) {
    const found = (
      await client.query(
        `SELECT c.id,c.org_id,o.path,o.timezone FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
         WHERE c.id=$1 AND c.archived_at IS NULL AND o.path @> $2::uuid[]`,
        [classId, orgPath.slice(-1)],
      )
    ).rows[0];
    if (!found) throw new SchoolError(404, "class_not_found");
    return found as {
      id: string;
      org_id: string;
      path: string[];
      timezone: string;
    };
  }

  /** `agreement`, when an operator already holds the signed one, is accepted in
   * the same transaction, so an org never half-exists. */
  async createOrg(raw: unknown, agreement?: unknown) {
    const input = createOrgSchema.parse(raw);
    const accepted =
      agreement === undefined ? null : dataAgreementSchema.parse(agreement);
    return this.transaction(async (client) => {
      const parent = input.parentId
        ? await this.org(client, input.parentId)
        : null;
      const id = randomUUID();
      const timezone = input.timezone ?? parent?.timezone;
      if (!timezone) throw new SchoolError(400, "timezone_required");
      await client.query(
        "INSERT INTO amp_orgs(id,kind,parent_id,path,name,timezone) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          input.kind,
          parent?.id ?? null,
          [...(parent?.path ?? []), id],
          input.name,
          timezone,
        ],
      );
      await recordEvent(client, {
        orgId: id,
        action: "org.created",
        targetKind: "org",
        targetId: id,
        detail: { after: { kind: input.kind, parentId: parent?.id ?? null } },
      });
      if (accepted) await this.acceptAgreement(client, id, accepted);
      return { id, kind: input.kind as OrgKind, parentId: parent?.id ?? null };
    });
  }

  /** The nearest org's most recent row up the path is the one that applies. */
  async recordDataAgreement(orgId: string, raw: unknown) {
    const input = dataAgreementSchema.parse(raw);
    return this.transaction(async (client) => {
      const org = await this.org(client, orgId);
      return { id: await this.acceptAgreement(client, org.id, input) };
    });
  }
  async acceptAgreement(
    client: PoolClient,
    orgId: string,
    input: DataAgreement,
    signerPersonId: string | null = null,
  ) {
    const id = randomUUID();
    await client.query(
      "INSERT INTO amp_data_agreements(id,org_id,version,signer_person_id,signer_name,signer_title) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        orgId,
        input.version,
        signerPersonId,
        input.signerName,
        input.signerTitle,
      ],
    );
    await recordEvent(client, {
      orgId,
      actorPersonId: signerPersonId,
      action: "agreement.accepted",
      targetKind: "agreement",
      targetId: id,
      detail: { after: { version: input.version } },
    });
    return id;
  }

  /** A person per tenant: a teacher at two schools in one district is one
   * person with two roles. A verified parent account with this address links
   * now; otherwise the person waits, unlinked, for an invite. */
  async addStaff(raw: unknown) {
    const input = addStaffSchema.parse(raw);
    return this.transaction(async (client) => {
      const org = await this.org(client, input.orgId);
      const tenantId = org.path[0]!;
      const accountId =
        input.accountId ??
        (input.email ? await this.verifiedAccount(client, input.email) : null);
      const existing = accountId
        ? (
            await client.query(
              "SELECT id FROM amp_people WHERE tenant_id=$1 AND account_id=$2 AND deleted_at IS NULL",
              [tenantId, accountId],
            )
          ).rows[0]
        : undefined;
      const personId: string = existing?.id ?? randomUUID();
      if (!existing)
        await client.query(
          `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,email,account_id,timezone)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            personId,
            tenantId,
            input.givenName,
            input.familyName ?? null,
            generateHandle(),
            input.email ?? null,
            accountId,
            org.timezone,
          ],
        );
      const today = await this.today(client, org.timezone);
      await client.query(
        `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (person_id,org_id,role) WHERE end_on IS NULL DO NOTHING`,
        [randomUUID(), personId, org.id, input.role, today],
      );
      if (input.classId) {
        if (input.role !== "teacher" && input.role !== "aide")
          throw new SchoolError(400, "class_staff_must_teach");
        const found = await this.classIn(client, input.classId, org.path);
        await this.enroll(client, found.id, personId, input.role, today);
      }
      await recordEvent(client, {
        orgId: org.id,
        action: "staff.added",
        targetKind: "person",
        targetId: personId,
        detail: {
          after: { role: input.role, classId: input.classId ?? null },
        },
      });
      return { personId, role: input.role as StaffRole, linked: !!accountId };
    });
  }
  private async verifiedAccount(client: PoolClient, email: string) {
    const table = await client.query(
      "SELECT to_regclass('amp_auth_users') AS relation",
    );
    if (!table.rows[0].relation) return null;
    const user = (
      await client.query(
        `SELECT id FROM amp_auth_users WHERE lower(email)=$1 AND "emailVerified"`,
        [email],
      )
    ).rows[0];
    return user ? `amp|${user.id}` : null;
  }
  async enroll(
    client: PoolClient,
    classId: string,
    personId: string,
    role: EnrollmentRole,
    today: string,
  ) {
    await client.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (class_id,person_id,role) WHERE end_on IS NULL DO NOTHING`,
      [randomUUID(), classId, personId, role, today],
    );
  }

  /** One transaction: learner, person, role, enrollment if a class is given,
   * seat if the license has room. Without room the student is rostered and
   * flagged as needing a seat. */
  async provisionStudent(
    orgId: string,
    raw: unknown,
    actorPersonId: string | null = null,
    now = new Date(),
  ) {
    const input = createStudentSchema.parse(raw);
    return this.transaction((client) =>
      this.provisionStudentIn(client, orgId, input, actorPersonId, now),
    );
  }
  /** `provisionStudent` inside a transaction the caller holds: the reconciler
   * records a student's external ID in the same one, so a retry can't add them
   * twice. */
  async provisionStudentIn(
    client: PoolClient,
    orgId: string,
    input: CreateStudent,
    actorPersonId: string | null = null,
    now = new Date(),
    personId: string = randomUUID(),
  ) {
    const named = await this.org(client, orgId);
    const home = input.classId
      ? await this.classIn(client, input.classId, named.path)
      : null;
    const org: Org = home
      ? { id: home.org_id, path: home.path, timezone: home.timezone }
      : named;
    const learnerId = randomUUID();
    await client.query(
      "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,$3,$4)",
      [
        learnerId,
        schoolAccountId(personId),
        learnerName(input),
        input.gradeLevel === undefined
          ? null
          : birthYearForGrade(input.gradeLevel, now),
      ],
    );
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,family_name,display_name,handle,email,identifier,grade_level,learner_id,timezone)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        personId,
        org.path[0],
        input.givenName,
        input.familyName ?? null,
        input.displayName ?? null,
        generateHandle(),
        input.email ?? null,
        input.identifier ?? null,
        input.gradeLevel ?? null,
        learnerId,
        org.timezone,
      ],
    );
    const today = await this.today(client, org.timezone);
    await client.query(
      "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'student',$4)",
      [randomUUID(), personId, org.id, today],
    );
    if (home) await this.enroll(client, home.id, personId, "student", today);
    const seated = await this.takeSeat(client, personId, learnerId, org.path);
    await recordEvent(client, {
      orgId: org.id,
      actorPersonId,
      action: "student.added",
      targetKind: "person",
      targetId: personId,
      detail: {
        after: {
          classId: input.classId ?? null,
          gradeLevel: input.gradeLevel ?? null,
          seated,
        },
      },
    });
    return {
      personId,
      learnerId,
      accountId: schoolAccountId(personId),
      orgId: org.id,
      seated,
    };
  }

  /** Locks each candidate license, nearest first (the same order everywhere,
   * so two provisions can't deadlock), and takes the first with room. */
  private async takeSeat(
    client: PoolClient,
    personId: string,
    learnerId: string,
    path: string[],
  ): Promise<boolean> {
    const licenses = (
      await client.query(
        `SELECT l.id,l.seats,l.ends_at FROM amp_school_licenses l
         WHERE l.org_id=ANY($1::uuid[]) AND ${IN_FORCE("l")}
         ORDER BY array_position($1::uuid[],l.org_id) DESC,l.ends_at DESC,l.id
         FOR UPDATE`,
        [path],
      )
    ).rows;
    for (const license of licenses)
      if ((await this.seatsUsed(client, license.id)) < license.seats) {
        await this.assignSeat(client, license, personId, learnerId);
        return true;
      }
    return false;
  }
  private async seatsUsed(client: PoolClient, licenseId: string) {
    return (
      await client.query(
        "SELECT count(*)::int AS used FROM amp_seats WHERE license_id=$1 AND released_at IS NULL",
        [licenseId],
      )
    ).rows[0].used as number;
  }
  /** Caller holds the license row lock. */
  private async assignSeat(
    client: PoolClient,
    license: { id: string; ends_at: Date },
    personId: string,
    learnerId: string,
  ) {
    const seatId = randomUUID();
    const grantId = `school-seat:${seatId}`;
    await client.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
       VALUES($1,$2,'pilot',$3,'active',now(),$4)`,
      [grantId, learnerId, seatId, license.ends_at],
    );
    await client.query(
      "INSERT INTO amp_seats(id,license_id,person_id,grant_id) VALUES($1,$2,$3,$4)",
      [seatId, license.id, personId, grantId],
    );
  }
  /** Gives open seats to rostered students waiting under this license's org,
   * longest-waiting first: those with no seat, or one on a license that has
   * ended, which this replaces. Caller holds the license row lock. */
  private async seatWaitingStudents(
    client: PoolClient,
    license: { id: string; org_id: string; seats: number; ends_at: Date },
  ): Promise<number> {
    const room = license.seats - (await this.seatsUsed(client, license.id));
    if (room <= 0) return 0;
    const waiting = (
      await client.query(
        `SELECT p.id,p.learner_id FROM amp_people p
         WHERE p.tenant_id=(SELECT path[1] FROM amp_orgs WHERE id=$1)
           AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
           AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
             WHERE r.person_id=p.id AND r.role='student' AND o.path @> ARRAY[$1]::uuid[] AND ${activeToday("r", "o")})
           AND NOT EXISTS(SELECT 1 FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
             WHERE s.person_id=p.id AND s.released_at IS NULL AND ${IN_FORCE("l")})
         ORDER BY p.created_at,p.id LIMIT $2`,
        [license.org_id, room],
      )
    ).rows;
    for (const person of waiting) {
      await client.query(
        "UPDATE amp_seats SET released_at=now() WHERE person_id=$1 AND released_at IS NULL",
        [person.id],
      );
      await this.assignSeat(client, license, person.id, person.learner_id);
    }
    return waiting.length;
  }

  async issueLicense(raw: unknown) {
    const input = issueLicenseSchema.parse(raw);
    return this.transaction((client) => this.issueLicenseIn(client, input));
  }
  async issueLicenseIn(client: PoolClient, input: IssueLicense) {
    const org = await this.org(client, input.orgId);
    const id = randomUUID();
    const license = (
      await client.query(
        `INSERT INTO amp_school_licenses(id,org_id,seats,starts_at,ends_at,reference)
           VALUES($1,$2,$3,COALESCE($4::timestamptz,now()),$5,$6)
           RETURNING id,org_id,seats,starts_at,ends_at,starts_at<=now() AND ends_at>now() AS in_force`,
        [
          id,
          org.id,
          input.seats,
          input.startsAt ?? null,
          input.endsAt,
          input.reference ?? null,
        ],
      )
    ).rows[0];
    const assigned = license.in_force
      ? await this.seatWaitingStudents(client, license)
      : 0;
    await recordEvent(client, {
      orgId: org.id,
      action: "license.issued",
      targetKind: "license",
      targetId: id,
      detail: {
        after: { seats: input.seats, endsAt: input.endsAt, assigned },
      },
    });
    return { licenseId: id, seats: input.seats, assigned };
  }

  /** Never below the seats in use: release specific students first. */
  async setSeats(raw: unknown) {
    const input = setSeatsSchema.parse(raw);
    return this.transaction(async (client) => {
      const license = (
        await client.query(
          `SELECT id,org_id,seats,ends_at,${IN_FORCE("amp_school_licenses")} AS in_force
           FROM amp_school_licenses WHERE id=$1 FOR UPDATE`,
          [input.licenseId],
        )
      ).rows[0];
      if (!license) throw new SchoolError(404, "license_not_found");
      if (input.seats < (await this.seatsUsed(client, license.id)))
        throw new SchoolError(409, "seats_in_use");
      await client.query(
        "UPDATE amp_school_licenses SET seats=$2 WHERE id=$1",
        [license.id, input.seats],
      );
      const assigned = license.in_force
        ? await this.seatWaitingStudents(client, {
            ...license,
            seats: input.seats,
          })
        : 0;
      await recordEvent(client, {
        orgId: license.org_id,
        action: "license.seats-changed",
        targetKind: "license",
        targetId: license.id,
        detail: {
          before: { seats: license.seats },
          after: { seats: input.seats, assigned },
        },
      });
      return { licenseId: license.id, seats: input.seats, assigned };
    });
  }

  /** A new end date for a license and every seat on it. */
  async extendLicense(raw: unknown) {
    const input = extendLicenseSchema.parse(raw);
    return this.transaction(async (client) => {
      const license = (
        await client.query(
          "SELECT id,org_id,ends_at,starts_at FROM amp_school_licenses WHERE id=$1 FOR UPDATE",
          [input.licenseId],
        )
      ).rows[0];
      if (!license) throw new SchoolError(404, "license_not_found");
      if (new Date(input.endsAt) <= license.starts_at)
        throw new SchoolError(409, "license_ends_before_start");
      await client.query(
        "UPDATE amp_school_licenses SET ends_at=$2,status='active' WHERE id=$1",
        [license.id, input.endsAt],
      );
      const moved = await client.query(
        `UPDATE amp_grants g SET ends_at=$2 FROM amp_seats s
         WHERE s.grant_id=g.id AND s.license_id=$1 AND s.released_at IS NULL`,
        [license.id, input.endsAt],
      );
      await recordEvent(client, {
        orgId: license.org_id,
        action: "license.extended",
        targetKind: "license",
        targetId: license.id,
        detail: {
          before: { endsAt: license.ends_at },
          after: { endsAt: input.endsAt, seats: moved.rowCount },
        },
      });
      return { licenseId: license.id, endsAt: input.endsAt };
    });
  }

  /** The grant is revoked, the seat is free for another student. */
  async releaseSeat(personId: string, actorPersonId: string | null = null) {
    return this.transaction(async (client) => {
      const seat = (
        await client.query(
          `SELECT s.id,s.grant_id,l.org_id,l.id AS license_id FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
           WHERE s.person_id=$1 AND s.released_at IS NULL FOR UPDATE OF s`,
          [personId],
        )
      ).rows[0];
      if (!seat) return { released: false };
      await client.query("UPDATE amp_seats SET released_at=now() WHERE id=$1", [
        seat.id,
      ]);
      if (seat.grant_id)
        await client.query(
          "UPDATE amp_grants SET status='revoked' WHERE id=$1",
          [seat.grant_id],
        );
      await recordEvent(client, {
        orgId: seat.org_id,
        actorPersonId,
        action: "seat.released",
        targetKind: "person",
        targetId: personId,
        detail: { before: { licenseId: seat.license_id } },
      });
      return { released: true };
    });
  }

  /** A sign-in for one device. Sign-in screens call this after checking a card,
   * code or SSO credential; the token is returned once and only its hash stored. */
  async issueStudentSession(raw: {
    personId: string;
    mode: SessionMode;
  }): Promise<{
    token: string;
    accountId: string;
    mode: SessionMode;
    expiresAt: string;
  }> {
    const input = issueStudentSessionSchema.parse(raw);
    return this.transaction(async (client) => {
      const student = (
        await client.query(
          `SELECT p.id FROM amp_people p WHERE p.id=$1 AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
           AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
             WHERE r.person_id=p.id AND r.role='student' AND ${activeToday("r", "o")})`,
          [input.personId],
        )
      ).rows[0];
      if (!student) throw new SchoolError(404, "student_not_found");
      const token = generateStudentToken();
      const expiresAt = studentSessionExpiry(input.mode);
      await client.query(
        "INSERT INTO amp_student_sessions(id,token_hash,person_id,mode,expires_at) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          hashStudentToken(token),
          student.id,
          input.mode,
          expiresAt,
        ],
      );
      return {
        token,
        accountId: schoolAccountId(student.id),
        mode: input.mode,
        expiresAt: expiresAt.toISOString(),
      };
    });
  }

  /** The year in use: this one, or the next if the chosen one hasn't started.
   * District calendars are inherited; a school without one gets a default year. */
  async yearSession(client: PoolClient, org: Org): Promise<string> {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-calendar:${org.id}`,
    ]);
    const today = await this.today(client, org.timezone);
    const existing = (
      await client.query(
        `SELECT id FROM amp_academic_sessions
         WHERE org_id=ANY($1::uuid[]) AND kind='year' AND ends_on>=$2
         ORDER BY array_position($1::uuid[],org_id) DESC,starts_on,id LIMIT 1`,
        [org.path, today],
      )
    ).rows[0];
    if (existing) return existing.id;
    const [year, month] = today.split("-").map(Number) as [number, number];
    const start = month >= 7 ? year : year - 1;
    const id = randomUUID();
    await client.query(
      "INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on) VALUES($1,$2,'year',$3,$4,$5)",
      [
        id,
        org.id,
        `${start}–${String(start + 1).slice(2)}`,
        `${start}-07-01`,
        `${start + 1}-06-30`,
      ],
    );
    return id;
  }

  async createClass(
    orgId: string,
    raw: unknown,
    actorPersonId: string | null = null,
    teacherPersonId?: string,
  ): Promise<ClassResource> {
    const input = createClassSchema.parse(raw);
    return this.transaction(async (client) => {
      const created = await this.createClassIn(
        client,
        orgId,
        input,
        actorPersonId,
      );
      if (teacherPersonId) {
        const org = await this.org(client, created.orgId);
        await this.enroll(
          client,
          created.id,
          teacherPersonId,
          "teacher",
          await this.today(client, org.timezone),
        );
      }
      return created;
    });
  }
  async createClassIn(
    client: PoolClient,
    orgId: string,
    input: CreateClass,
    actorPersonId: string | null = null,
  ): Promise<ClassResource> {
    const org = await this.org(client, orgId);
    let sessionId = input.sessionId;
    if (sessionId) {
      const owned = await client.query(
        "SELECT 1 FROM amp_academic_sessions WHERE id=$1 AND org_id=ANY($2::uuid[])",
        [sessionId, org.path],
      );
      if (!owned.rowCount) throw new SchoolError(404, "session_not_found");
    } else sessionId = await this.yearSession(client, org);
    const id = randomUUID();
    const gradingKind = input.gradingKind ?? "semester";
    const courseBands = input.courseBands ?? [];
    for (let attempt = 0; ; attempt++) {
      const joinCode = generateJoinCode();
      const inserted = await client.query(
        `INSERT INTO amp_classes(id,org_id,session_id,name,course_bands,grading_kind,join_code)
           VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (join_code) DO NOTHING RETURNING id`,
        [id, org.id, sessionId, input.name, courseBands, gradingKind, joinCode],
      );
      if (inserted.rowCount) {
        await recordEvent(client, {
          orgId: org.id,
          actorPersonId,
          action: "class.created",
          targetKind: "class",
          targetId: id,
          detail: { after: { sessionId, courseBands, gradingKind } },
        });
        return {
          id,
          orgId: org.id,
          sessionId,
          name: input.name,
          courseBands,
          gradingKind,
          joinCode,
          studentCount: 0,
        };
      }
      if (attempt >= 5) throw new Error("No unused class code was found");
    }
  }

  /** The orgs this account holds a role at, one entry per org. */
  async myOrgs(accountId: string): Promise<OrgResource[]> {
    return (
      await this.pool.query(
        `SELECT o.id,o.kind,o.name,o.parent_id AS "parentId",o.timezone,o.solo,o.setup_pending AS "setupPending",
           array_agg(DISTINCT r.role ORDER BY r.role) AS roles
         FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id AND r.role<>'student'
         JOIN amp_orgs o ON o.id=r.org_id
         WHERE p.account_id=$1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")}
         GROUP BY o.id ORDER BY o.name,o.id`,
        [accountId],
      )
    ).rows;
  }
  async orgFor(accountId: string, orgId: string): Promise<OrgResource | null> {
    const row = (
      await this.pool.query(
        `SELECT o.id,o.kind,o.name,o.parent_id AS "parentId",o.timezone,o.solo,o.setup_pending AS "setupPending",
           COALESCE(array_agg(DISTINCT r.role) FILTER (WHERE r.id IS NOT NULL),'{}') AS roles
         FROM amp_orgs o
         LEFT JOIN amp_people p ON p.account_id=$1 AND p.deleted_at IS NULL
         LEFT JOIN amp_org_roles r ON r.person_id=p.id AND r.org_id=o.id AND r.role<>'student' AND ${activeToday("r", "o")}
         WHERE o.id=$2 GROUP BY o.id`,
        [accountId, orgId],
      )
    ).rows[0];
    return row ?? null;
  }
  /** Classes at this org and below; `classIds` narrows to a teacher's own. */
  async classes(
    orgId: string,
    { classIds }: { classIds: string[] | null },
    page: Page,
  ): Promise<ClassResource[]> {
    return (
      await this.pool.query(
        `SELECT c.id,c.org_id AS "orgId",c.session_id AS "sessionId",c.name,c.course_bands AS "courseBands",
           c.grading_kind AS "gradingKind",c.join_code AS "joinCode",
           (SELECT count(*)::int FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
             WHERE e.class_id=c.id AND e.role='student' AND p.deleted_at IS NULL AND ${activeToday("e", "o")}) AS "studentCount"
         FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
         WHERE o.path @> ARRAY[$1]::uuid[] AND c.archived_at IS NULL
           AND ($2::uuid[] IS NULL OR c.id=ANY($2::uuid[]))
         ORDER BY c.name,c.id LIMIT $3 OFFSET $4`,
        [orgId, classIds, page.limit, page.offset],
      )
    ).rows;
  }
  /** Active students at this org and below; `classIds` narrows to a teacher's
   * own classes, and only those classes are listed on each student. */
  async students(
    orgId: string,
    { classIds }: { classIds: string[] | null },
    page: Page,
  ): Promise<(StudentResource & { total: number })[]> {
    const needle = page.q
      ? `%${page.q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`
      : null;
    return (
      await this.pool.query(
        `SELECT p.id,p.given_name AS "givenName",p.family_name AS "familyName",p.display_name AS "displayName",
           p.handle,p.identifier,p.grade_level AS "gradeLevel",count(*) OVER()::int AS total,
           ARRAY(SELECT e.class_id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs eo ON eo.id=c.org_id
             WHERE e.person_id=p.id AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "eo")}
               AND ($2::uuid[] IS NULL OR e.class_id=ANY($2::uuid[]))
             ORDER BY e.class_id) AS "classIds",
           EXISTS(SELECT 1 FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
             WHERE s.person_id=p.id AND s.released_at IS NULL AND ${IN_FORCE("l")}) AS seated
         FROM amp_people p
         WHERE p.tenant_id=(SELECT path[1] FROM amp_orgs WHERE id=$1) AND p.deleted_at IS NULL
           AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
             WHERE r.person_id=p.id AND r.role='student' AND o.path @> ARRAY[$1]::uuid[] AND ${activeToday("r", "o")})
           AND ($2::uuid[] IS NULL OR EXISTS(SELECT 1 FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs eo ON eo.id=c.org_id
             WHERE e.person_id=p.id AND e.role='student' AND e.class_id=ANY($2::uuid[]) AND c.archived_at IS NULL AND ${activeToday("e", "eo")}))
           AND ($5::text IS NULL OR lower(concat_ws(' ',p.display_name,p.given_name,p.family_name,p.identifier)) LIKE $5)
         ORDER BY lower(COALESCE(p.display_name,p.given_name)),p.id LIMIT $3 OFFSET $4`,
        [orgId, classIds, page.limit, page.offset, needle],
      )
    ).rows;
  }
}
