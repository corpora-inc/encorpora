import { PERSON_NAME } from "./term-grades.js";
import { visibleToSql } from "./demo/sql.js";
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
import { YEAR_IN_USE } from "./years.js";
import { allocateLabel } from "../server/learner-label.js";

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
export const generateJoinCode = () =>
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

/** SQL, in a query grouped by org `o` with the viewer's roles `r`: a shared
 * demo school is the viewer's own class ("solo") unless they joined it as
 * its admin, so a teacher's demo looks like their class. */
const SOLO = `CASE WHEN o.demo AND o.created_by LIKE 'amp-demo:%'
  THEN NOT COALESCE(bool_or(r.role='admin'),false) ELSE o.solo END AS solo`;
/** Only a demo says so. */
const withDemo = ({ demo, ...org }: OrgResource & { demo?: boolean }) =>
  (demo ? { ...org, demo: true as const } : org) as OrgResource;

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
  async org(client: Pick<PoolClient, "query">, orgId: string): Promise<Org> {
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
    options: { deferSeat?: boolean } = {},
  ) {
    const named = await this.org(client, orgId);
    const home = input.classId
      ? await this.classIn(client, input.classId, named.path)
      : null;
    const org: Org = home
      ? { id: home.org_id, path: home.path, timezone: home.timezone }
      : named;
    const agreement = (
      await client.query(
        `SELECT ended_at FROM amp_data_agreements WHERE org_id=ANY($1::uuid[])
       ORDER BY array_position($1::uuid[],org_id) DESC,accepted_at DESC,id LIMIT 1`,
        [org.path],
      )
    ).rows[0];
    const classAuthorization =
      !agreement && input.classId
        ? (
            await client.query(
              "SELECT ended_at FROM amp_class_authorizations WHERE class_id=$1 ORDER BY accepted_at DESC,id LIMIT 1",
              [input.classId],
            )
          ).rows[0]
        : undefined;
    if (
      agreement?.ended_at ||
      (input.givenName !== undefined &&
        !agreement &&
        (!classAuthorization || classAuthorization.ended_at))
    )
      throw new SchoolError(409, "agreement_required");
    // Without a name, the student goes by a nickname or their number
    // ("Student 3") until a parent or the school names them.
    const label =
      input.givenName === undefined
        ? await allocateLabel(client, `school:${org.path[0]}`)
        : null;
    const givenName = input.givenName ?? input.nickname ?? label!.name;
    const learnerId = randomUUID();
    await client.query(
      `INSERT INTO amp_learners(id,account_id,name,birth_year,name_pending,label_number,identity_scope)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        learnerId,
        schoolAccountId(personId),
        learnerName({ ...input, givenName }),
        input.birthYear ??
          (input.gradeLevel === undefined
            ? null
            : birthYearForGrade(input.gradeLevel, now)),
        label !== null,
        label?.number ?? null,
        label?.scope ?? null,
      ],
    );
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,family_name,display_name,handle,email,identifier,grade_level,learner_id,timezone)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        personId,
        org.path[0],
        givenName,
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
    const seated = options.deferSeat
      ? false
      : await this.takeSeat(client, personId, learnerId, org.path);
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
  async takeSeat(
    client: PoolClient,
    personId: string,
    learnerId: string,
    path: string[],
  ): Promise<boolean> {
    await this.lockSeats(client, path[0]!);
    await this.releaseInvalidSeats(client, path[0]!, personId);
    if (
      (
        await client.query(
          `SELECT 1 FROM amp_seats s WHERE s.person_id=$1
      AND s.released_at IS NULL AND amp_school_grant_valid(s.grant_id)`,
          [personId],
        )
      ).rowCount
    )
      return true;
    const licenses = (
      await client.query(
        `SELECT l.id,l.seats,l.ends_at FROM amp_school_licenses l
         WHERE l.org_id=ANY($1::uuid[]) AND ${IN_FORCE("l")}
           AND (l.class_ids IS NULL OR EXISTS(SELECT 1 FROM amp_enrollments e
             JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL JOIN amp_orgs o ON o.id=c.org_id
             WHERE e.person_id=$2 AND e.role='student' AND e.class_id=ANY(l.class_ids) AND ${activeToday("e", "o")}))
         ORDER BY array_position($1::uuid[],l.org_id) DESC,l.ends_at DESC,l.id
         FOR UPDATE`,
        [path, personId],
      )
    ).rows;
    for (const license of licenses)
      if ((await this.seatsUsed(client, license.id)) < license.seats) {
        await this.assignSeat(client, license, personId, learnerId);
        return true;
      }
    return false;
  }
  private async lockSeats(client: PoolClient, tenantId: string) {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-seats:${tenantId}`,
    ]);
  }
  private async releaseInvalidSeats(
    client: PoolClient,
    tenantId: string,
    personId: string | null = null,
  ) {
    // The same eligibility rules as amp_school_grant_valid, evaluated as one
    // set. Calling the per-grant function for every district seat repeatedly
    // plans/scans the same membership data during a bulk reconciliation.
    // Keep the membership subqueries as hashable IN/NOT IN expressions: just
    // after a large import, stale statistics can select a quadratic nested-loop
    // semi/anti join over these materialized sets. Valid grant IDs cannot be null.
    await client.query(
      `WITH candidates AS MATERIALIZED (
        SELECT s.id,s.grant_id
        FROM amp_seats s JOIN amp_people p ON p.id=s.person_id
        WHERE p.tenant_id=$1 AND ($2::uuid IS NULL OR p.id=$2) AND s.released_at IS NULL
      ), eligible AS MATERIALIZED (
        SELECT s.grant_id,s.person_id,l.class_ids FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
        JOIN amp_people p ON p.id=s.person_id
        JOIN amp_org_roles r ON r.person_id=s.person_id AND r.role='student'
        JOIN amp_orgs o ON o.id=r.org_id AND o.path @> ARRAY[l.org_id]::uuid[]
        WHERE (s.grant_id IN(SELECT grant_id FROM candidates)) IS TRUE AND s.released_at IS NULL
          AND p.deleted_at IS NULL AND ${IN_FORCE("l")} AND ${activeToday("r", "o")}
      ), valid AS MATERIALIZED (
        SELECT grant_id FROM eligible WHERE class_ids IS NULL
        UNION ALL
        SELECT s.grant_id FROM eligible s JOIN amp_enrollments e
          ON e.person_id=s.person_id AND e.role='student' AND e.class_id=ANY(s.class_ids)
        JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL JOIN amp_orgs o ON o.id=c.org_id
        WHERE s.class_ids IS NOT NULL AND ${activeToday("e", "o")}
      ), released AS (
        UPDATE amp_seats s SET released_at=now() FROM candidates candidate
        WHERE s.id=candidate.id AND s.released_at IS NULL AND candidate.grant_id LIKE 'school-seat:%'
          AND candidate.grant_id NOT IN(SELECT grant_id FROM valid) RETURNING s.grant_id)
      UPDATE amp_grants SET status='revoked' WHERE id IN(SELECT grant_id FROM released)`,
      [tenantId, personId],
    );
  }
  /** Roster updates and scheduled license starts share one allocator. A learner
   * consumes at most one active school seat across overlapping purchased scopes. */
  async dueSeatTenants(): Promise<string[]> {
    return (
      await this.pool.query(
        `SELECT DISTINCT o.path[1] AS id FROM amp_school_licenses l JOIN amp_orgs o ON o.id=l.org_id
       WHERE l.status='active' AND l.starts_at<=now() AND (
         (l.ends_at>now() AND (l.seats_checked_at IS NULL OR l.seats_checked_at<l.starts_at
           OR l.seats_checked_at<now()-interval '15 minutes'
           OR (l.seats_checked_at AT TIME ZONE o.timezone)::date<(now() AT TIME ZONE o.timezone)::date))
         OR (l.ends_at<=now() AND EXISTS(SELECT 1 FROM amp_seats s WHERE s.license_id=l.id AND s.released_at IS NULL)))`,
      )
    ).rows.map((row) => row.id);
  }
  async reconcileSeats(tenantId: string) {
    return this.transaction(async (client) => {
      await this.lockSeats(client, tenantId);
      await this.releaseInvalidSeats(client, tenantId);
      const licenses = (
        await client.query(
          `SELECT l.id,l.org_id,l.seats,l.ends_at FROM amp_school_licenses l
        JOIN amp_orgs o ON o.id=l.org_id WHERE o.path[1]=$1 AND ${IN_FORCE("l")}
        ORDER BY cardinality(o.path) DESC,l.ends_at DESC,l.id FOR UPDATE OF l`,
          [tenantId],
        )
      ).rows;
      let assigned = 0;
      for (const license of licenses)
        assigned += await this.seatWaitingStudents(client, license);
      await client.query(
        "UPDATE amp_school_licenses l SET seats_checked_at=now() FROM amp_orgs o WHERE o.id=l.org_id AND o.path[1]=$1 AND l.starts_at<=now()",
        [tenantId],
      );
      return { assigned };
    });
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
   * ended, which this replaces. Caller holds the license row lock and has
   * released invalid seats for the tenant. A concurrent roster change can
   * invalidate coverage afterward; live access checks reject it and the
   * roster's reconciliation (or the periodic poll) updates the allocation. */
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
           AND ((SELECT class_ids FROM amp_school_licenses WHERE id=$3) IS NULL OR EXISTS(
             SELECT 1 FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
             JOIN amp_orgs o ON o.id=c.org_id WHERE e.person_id=p.id AND e.role='student'
               AND e.class_id=ANY((SELECT class_ids FROM amp_school_licenses WHERE id=$3)::uuid[])
               AND ${activeToday("e", "o")}))
           AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
             WHERE r.person_id=p.id AND r.role='student' AND o.path @> ARRAY[$1]::uuid[] AND ${activeToday("r", "o")})
           AND NOT EXISTS(SELECT 1 FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
             WHERE s.person_id=p.id AND s.released_at IS NULL AND s.grant_id IS NOT NULL AND ${IN_FORCE("l")})
         ORDER BY p.created_at,p.id LIMIT $2`,
        [license.org_id, room, license.id],
      )
    ).rows;
    // Keep grant/seat creation on the database side in bounded batches. The
    // tenant and license locks cover the entire allocation, so parallel school
    // purchases cannot overbook or seat a learner twice.
    for (let offset = 0; offset < waiting.length; offset += 1000) {
      const batch = waiting.slice(offset, offset + 1000).map((person) => ({
        id: randomUUID(),
        person_id: person.id,
        learner_id: person.learner_id,
      }));
      await client.query(
        `WITH released AS (
          UPDATE amp_seats SET released_at=now() WHERE person_id=ANY($1::uuid[]) AND released_at IS NULL RETURNING grant_id
        ) UPDATE amp_grants SET status='revoked' WHERE id IN(SELECT grant_id FROM released)`,
        [batch.map((person) => person.person_id)],
      );
      await client.query(
        `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
         SELECT 'school-seat:'||x.id,x.learner_id,'pilot',x.id::text,'active',now(),$2
         FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,person_id uuid,learner_id text)`,
        [JSON.stringify(batch), license.ends_at],
      );
      await client.query(
        `INSERT INTO amp_seats(id,license_id,person_id,grant_id)
         SELECT x.id,$2,x.person_id,'school-seat:'||x.id
         FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,person_id uuid,learner_id text)`,
        [JSON.stringify(batch), license.id],
      );
    }
    return waiting.length;
  }

  async issueLicense(raw: unknown) {
    const input = issueLicenseSchema.parse(raw);
    return this.transaction((client) => this.issueLicenseIn(client, input));
  }
  async issueLicenseIn(client: PoolClient, input: IssueLicense) {
    const org = await this.org(client, input.orgId);
    await this.lockSeats(client, org.path[0]!);
    await this.releaseInvalidSeats(client, org.path[0]!);
    if (input.classIds) {
      const ids = [...new Set(input.classIds)];
      const classes = await client.query(
        `SELECT c.id FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
        WHERE c.id=ANY($1::uuid[]) AND o.path @> ARRAY[$2]::uuid[] AND c.archived_at IS NULL`,
        [ids, org.id],
      );
      if (classes.rowCount !== ids.length)
        throw new SchoolError(400, "license_class_scope_invalid");
    }
    const id = randomUUID();
    const license = (
      await client.query(
        `INSERT INTO amp_school_licenses(id,org_id,seats,starts_at,ends_at,reference,class_ids)
           VALUES($1,$2,$3,COALESCE($4::timestamptz,now()),$5,$6,$7)
           RETURNING id,org_id,seats,starts_at,ends_at,starts_at<=now() AND ends_at>now() AS in_force`,
        [
          id,
          org.id,
          input.seats,
          input.startsAt ?? null,
          input.endsAt,
          input.reference ?? null,
          input.classIds ? [...new Set(input.classIds)] : null,
        ],
      )
    ).rows[0];
    const assigned = license.in_force
      ? await this.seatWaitingStudents(client, license)
      : 0;
    await client.query(
      "UPDATE amp_school_licenses SET seats_checked_at=now() WHERE id=$1",
      [license.id],
    );
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
      const root = (
        await client.query(
          "SELECT o.path[1] AS id FROM amp_school_licenses l JOIN amp_orgs o ON o.id=l.org_id WHERE l.id=$1",
          [input.licenseId],
        )
      ).rows[0];
      if (!root) throw new SchoolError(404, "license_not_found");
      await this.lockSeats(client, root.id);
      await this.releaseInvalidSeats(client, root.id);
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
          teachers: [],
        };
      }
      if (attempt >= 5) throw new Error("No unused class code was found");
    }
  }

  /** The orgs this account holds a role at, one entry per org. */
  async myOrgs(accountId: string): Promise<OrgResource[]> {
    return (
      await this.pool.query(
        `SELECT o.id,o.kind,o.name,o.parent_id AS "parentId",o.timezone,${SOLO},o.setup_pending AS "setupPending",o.demo,
           array_agg(DISTINCT r.role ORDER BY r.role) AS roles
         FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id AND r.role<>'student'
         JOIN amp_orgs o ON o.id=r.org_id AND (o.kind<>'family' OR o.created_by<>$1)
         WHERE p.account_id=$1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")}
         GROUP BY o.id ORDER BY o.name,o.id`,
        [accountId],
      )
    ).rows.map(withDemo);
  }
  async orgFor(accountId: string, orgId: string): Promise<OrgResource | null> {
    const row = (
      await this.pool.query(
        `SELECT o.id,o.kind,o.name,o.parent_id AS "parentId",o.timezone,${SOLO},o.setup_pending AS "setupPending",o.demo,
           COALESCE(array_agg(DISTINCT r.role) FILTER (WHERE r.id IS NOT NULL),'{}') AS roles
         FROM amp_orgs o
         LEFT JOIN amp_people p ON p.account_id=$1 AND p.deleted_at IS NULL
         LEFT JOIN amp_org_roles r ON r.person_id=p.id AND r.org_id=o.id AND r.role<>'student' AND ${activeToday("r", "o")}
         WHERE o.id=$2 GROUP BY o.id`,
        [accountId, orgId],
      )
    ).rows[0];
    return row ? withDemo(row) : null;
  }
  /** Classes at this org and below; `classIds` narrows to a teacher's own. The
   * year in use, unless `year` asks for another. */
  async classes(
    orgId: string,
    { classIds }: { classIds: string[] | null },
    page: Page,
    year: string | null = null,
    /** The reader: another visitor of a shared demo isn't named. */
    viewer: string | null = null,
  ): Promise<ClassResource[]> {
    return (
      await this.pool.query(
        `SELECT c.id,c.org_id AS "orgId",c.session_id AS "sessionId",c.name,c.course_bands AS "courseBands",
           c.grading_kind AS "gradingKind",c.join_code AS "joinCode",
           (SELECT count(*)::int FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
             WHERE e.class_id=c.id AND e.role='student' AND p.deleted_at IS NULL AND ${activeToday("e", "o")}) AS "studentCount",
           ARRAY(SELECT ${PERSON_NAME} FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
             WHERE e.class_id=c.id AND e.role='teacher' AND p.deleted_at IS NULL AND ${activeToday("e", "o")}
               AND ${visibleToSql("p", "$6::text")}
             ORDER BY e.begin_on,p.id) AS teachers
         FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
         JOIN amp_academic_sessions cs ON cs.id=c.session_id
         WHERE o.path @> ARRAY[$1]::uuid[] AND c.archived_at IS NULL
           AND ($2::uuid[] IS NULL OR c.id=ANY($2::uuid[]))
           AND (CASE WHEN $5::uuid IS NULL THEN ${YEAR_IN_USE} ELSE COALESCE(cs.parent_id,cs.id)=$5::uuid END)
         ORDER BY c.name,c.id LIMIT $3 OFFSET $4`,
        [orgId, classIds, page.limit, page.offset, year, viewer],
      )
    ).rows;
  }
  /** Active students at this org and below; `classIds` narrows to a teacher's
   * own classes, and only those classes are listed on each student. */
  async students(
    orgId: string,
    { classIds }: { classIds: string[] | null },
    page: Page,
    status: "needs-seat" | "never-signed-in" | null = null,
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
             WHERE s.person_id=p.id AND s.released_at IS NULL AND ${IN_FORCE("l")} AND amp_school_grant_valid(s.grant_id)) AS seated,
           COALESCE(p.learner_id IS NOT NULL AND amp_school_pilot_until(p.learner_id)>now(),false) AS "pilotCovered"
         FROM amp_people p
         WHERE p.tenant_id=(SELECT path[1] FROM amp_orgs WHERE id=$1) AND p.deleted_at IS NULL
           AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
             WHERE r.person_id=p.id AND r.role='student' AND o.path @> ARRAY[$1]::uuid[] AND ${activeToday("r", "o")})
           AND ($2::uuid[] IS NULL OR EXISTS(SELECT 1 FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs eo ON eo.id=c.org_id
             WHERE e.person_id=p.id AND e.role='student' AND e.class_id=ANY($2::uuid[]) AND c.archived_at IS NULL AND ${activeToday("e", "eo")}))
           AND ($5::text IS NULL OR lower(concat_ws(' ',p.display_name,p.given_name,p.family_name,p.identifier)) LIKE $5)
           AND ($6::text IS DISTINCT FROM 'needs-seat' OR NOT EXISTS(SELECT 1 FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
             WHERE s.person_id=p.id AND s.released_at IS NULL AND ${IN_FORCE("l")} AND amp_school_grant_valid(s.grant_id)))
           AND ($6::text IS DISTINCT FROM 'never-signed-in' OR NOT EXISTS(SELECT 1 FROM amp_student_sessions n WHERE n.person_id=p.id))
         ORDER BY lower(COALESCE(p.display_name,p.given_name)),p.id LIMIT $3 OFFSET $4`,
        [orgId, classIds, page.limit, page.offset, needle, status],
      )
    ).rows;
  }
}
