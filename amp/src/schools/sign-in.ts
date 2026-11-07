import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import {
  issueCardsSchema,
  SchoolError,
  type IssuedCards,
  type JoinRoster,
  type Presence,
  type SchoolPicture,
  type SignInRoster,
  type StudentGrant,
} from "./contracts.js";
import { enrollmentSettings } from "./enrollment-settings.js";
import { recordEvent } from "./events.js";
import { activeToday } from "./principal.js";
import { generateJoinCode, type SchoolRepository } from "./repository.js";
import { studentDeviceMode } from "./settings.js";

/** Five wrong tries pause one student, briefly: a child who forgot asks the
 * teacher, and a guesser gets almost nowhere. */
export const STUDENT_FAILURES = 5;
export const STUDENT_LOCK_SECONDS = 60;
/** Net of right answers, so a class that's mostly getting in never gets here.
 * Reaching it takes dozens of guesses across the class. */
export const CLASS_FAILURES = 50;
export const CLASS_LOCK_SECONDS = 300;
const CARD_LIFETIME_DAYS = 366;

/* The picture secret. 16 × 15 × 14 orders is a small space, so the counters are
   what protect it; the hash keeps a database copy from being read at a glance,
   at a cost a whole class signing in together can afford. */
const SCRYPT = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const derive = (pictures: readonly string[], salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(pictures.join(" "), salt, 32, SCRYPT, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
export async function hashPictures(pictures: readonly SchoolPicture[]) {
  const salt = randomBytes(16);
  const key = await derive(pictures, salt);
  return `${salt.toString("base64url")}.${key.toString("base64url")}`;
}
export async function picturesMatch(
  pictures: readonly SchoolPicture[],
  stored: string,
) {
  const [salt, key] = stored.split(".");
  const expected = Buffer.from(key ?? "", "base64url");
  const actual = await derive(pictures, Buffer.from(salt ?? "", "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
/** The same work when there's nothing to compare, so a response's timing says
 * no more than the response does. */
const NOTHING = randomBytes(16);
const burn = (pictures: readonly SchoolPicture[]) => derive(pictures, NOTHING);

const CARD_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const generateCardToken = () => randomBytes(32).toString("base64url");
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** SQL: what a roster shows a student as. `display_name` is the school's own. */
export const STUDENT_NAME = `COALESCE(p.display_name,p.given_name||COALESCE(' '||left(p.family_name,1)||'.',''))`;
/** SQL: `p` is a live student of class `c`, whose org is `o`, today. */
const IN_CLASS = `e.class_id=c.id AND e.role='student' AND ${activeToday("e", "o")}
  AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
  AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs ro ON ro.id=r.org_id
    WHERE r.person_id=p.id AND r.role='student' AND ${activeToday("r", "ro")})`;
const STUDENTS_OF_CLASS = `amp_classes c JOIN amp_orgs o ON o.id=c.org_id
  JOIN amp_enrollments e ON e.class_id=c.id
  JOIN amp_people p ON p.id=e.person_id`;
const WORKING_CARD = `k.kind='card' AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at>now())`;
const ROSTER_LIMIT = 1000;

export type LiveClass = {
  id: string;
  name: string;
  org_id: string;
  path: string[];
  locked_for: number;
  sign_in_providers: string[];
};
const isId = (value: string) => z.uuid().safeParse(value).success;

/** Signing in as a student, and everything staff do to a student's sign-in.
 * Students hold cards and pictures; a parent's accounts never enter into it. */
export class SchoolSignIn {
  constructor(private readonly schools: SchoolRepository) {}
  private get pool() {
    return this.schools.pool;
  }

  /** A class a student can still join: not archived, term not over. */
  async liveClass(code: string): Promise<LiveClass> {
    const found = (
      await this.pool.query(
        `SELECT c.id,c.name,c.org_id,o.path,o.sign_in_providers,
           GREATEST(0,CEIL(EXTRACT(EPOCH FROM c.join_locked_until-now())))::int AS locked_for
         FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
         JOIN amp_academic_sessions s ON s.id=c.session_id
         WHERE c.join_code=$1 AND c.archived_at IS NULL
           AND s.ends_on>=(now() AT TIME ZONE o.timezone)::date`,
        [code],
      )
    ).rows[0] as LiveClass | undefined;
    if (!found) throw new SchoolError(404, "class_not_found");
    if (found.locked_for > 0)
      throw new SchoolError(423, "class_locked", found.locked_for);
    return found;
  }

  async lookup({ code }: { code: string }): Promise<JoinRoster> {
    const found = await this.liveClass(code);
    const { rows } = await this.pool.query(
      `SELECT p.id,${STUDENT_NAME} AS name,
         EXISTS(SELECT 1 FROM amp_person_credentials k
           WHERE k.person_id=p.id AND k.kind='picture' AND k.revoked_at IS NULL) AS "picturesSet"
       FROM ${STUDENTS_OF_CLASS}
       WHERE c.id=$1 AND ${IN_CLASS} ORDER BY lower(${STUDENT_NAME}),p.id LIMIT ${ROSTER_LIMIT}`,
      [found.id],
    );
    return {
      class: { name: found.name },
      signIn: found.sign_in_providers as JoinRoster["signIn"],
      students: rows,
    };
  }

  async picture(input: {
    code: string;
    personId: string;
    pictures: SchoolPicture[];
    set?: boolean;
  }): Promise<StudentGrant> {
    const found = await this.liveClass(input.code);
    const student = await this.pool.query(
      `SELECT p.id FROM ${STUDENTS_OF_CLASS} WHERE c.id=$1 AND p.id=$2 AND ${IN_CLASS}`,
      [found.id, input.personId],
    );
    if (!student.rowCount) {
      await burn(input.pictures);
      await this.classFailure(found);
      throw new SchoolError(422, "wrong_pictures");
    }
    let credential = await this.activePictures(input.personId);
    if (!credential) {
      if (!input.set) {
        await burn(input.pictures);
        throw new SchoolError(409, "pictures_not_set");
      }
      if (await this.setPictures(found, input.personId, input.pictures))
        return this.grant(found, input.personId);
      // Another device chose first: these are a guess at those.
      credential = await this.activePictures(input.personId);
    }
    if (!credential) throw new SchoolError(409, "pictures_not_set");
    // The try is counted before it's checked, so sending many at once can't
    // get more of them than one at a time. The fifth locks up front; a right
    // answer unlocks, and a crash mid-try only costs 60 seconds.
    const tries = `CASE WHEN locked_until IS NOT NULL THEN 0 ELSE failed_count END + 1`;
    const reserved = await this.pool.query(
      `UPDATE amp_person_credentials SET failed_count=${tries},
         locked_until=CASE WHEN ${tries}>=${STUDENT_FAILURES} THEN now()+interval '${STUDENT_LOCK_SECONDS} seconds' END
       WHERE id=$1 AND (locked_until IS NULL OR locked_until<=now())
       RETURNING failed_count AS tries`,
      [credential.id],
    );
    if (!reserved.rowCount) {
      const left = await this.pool.query(
        `SELECT GREATEST(1,CEIL(EXTRACT(EPOCH FROM locked_until-now())))::int AS seconds
         FROM amp_person_credentials WHERE id=$1`,
        [credential.id],
      );
      throw new SchoolError(
        423,
        "student_locked",
        left.rows[0]?.seconds ?? STUDENT_LOCK_SECONDS,
      );
    }
    if (await picturesMatch(input.pictures, credential.secret_hash)) {
      await this.pool.query(
        "UPDATE amp_person_credentials SET failed_count=0,locked_until=NULL WHERE id=$1",
        [credential.id],
      );
      await this.pool.query(
        "UPDATE amp_classes SET join_failed_count=join_failed_count-1 WHERE id=$1 AND join_failed_count>0",
        [found.id],
      );
      return this.grant(found, input.personId);
    }
    await this.classFailure(found);
    if (reserved.rows[0].tries >= STUDENT_FAILURES)
      throw new SchoolError(423, "student_locked", STUDENT_LOCK_SECONDS);
    throw new SchoolError(422, "wrong_pictures");
  }
  private async activePictures(personId: string) {
    return (
      await this.pool.query(
        `SELECT id,secret_hash FROM amp_person_credentials
         WHERE person_id=$1 AND kind='picture' AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [personId],
      )
    ).rows[0] as { id: string; secret_hash: string } | undefined;
  }
  private async setPictures(
    found: LiveClass,
    personId: string,
    pictures: readonly SchoolPicture[],
  ) {
    const secret = await hashPictures(pictures);
    return this.schools.transaction(async (client) => {
      await this.lockCredentials(client, personId);
      const taken = await client.query(
        "SELECT 1 FROM amp_person_credentials WHERE person_id=$1 AND kind='picture' AND revoked_at IS NULL",
        [personId],
      );
      if (taken.rowCount) return false;
      await client.query(
        `INSERT INTO amp_person_credentials(id,person_id,kind,lookup_hash,secret_hash)
         VALUES($1,$2,'picture',$3,$4)`,
        [randomUUID(), personId, sha256(personId), secret],
      );
      await recordEvent(client, {
        orgId: found.org_id,
        actorPersonId: personId,
        action: "student.pictures-set",
        targetKind: "person",
        targetId: personId,
      });
      return true;
    });
  }
  /** One credential change for this person at a time. */
  private lockCredentials(client: Pick<PoolClient, "query">, personId: string) {
    return client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [`school-credential:${personId}`],
    );
  }
  private async classFailure(found: LiveClass) {
    await this.schools.transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE amp_classes SET
           join_failed_count=CASE WHEN join_failed_count+1>=${CLASS_FAILURES} THEN 0 ELSE join_failed_count+1 END,
           join_locked_until=CASE WHEN join_failed_count+1>=${CLASS_FAILURES} THEN now()+interval '${CLASS_LOCK_SECONDS} seconds' ELSE join_locked_until END
         WHERE id=$1 RETURNING join_failed_count=0 AS locked`,
        [found.id],
      );
      if (rows[0]?.locked)
        await recordEvent(client, {
          orgId: found.org_id,
          action: "class.join-locked",
          targetKind: "class",
          targetId: found.id,
        });
    });
  }
  /** A session in the mode this class resolves to. */
  private async grant(
    found: LiveClass,
    personId: string,
  ): Promise<StudentGrant> {
    const mode = studentDeviceMode(
      await enrollmentSettings(this.pool, personId, { path: found.path }, [
        { id: found.id, path: found.path },
      ]),
    );
    return this.session(personId, mode);
  }
  private async session(personId: string, mode: StudentGrant["mode"]) {
    const { token, accountId, expiresAt } =
      await this.schools.issueStudentSession({ personId, mode });
    return { token, accountId, mode, expiresAt };
  }

  /** One answer for a card that was never real, was reissued or has expired:
   * whoever holds it needs a new one either way. */
  async card({ token }: { token: string }): Promise<StudentGrant> {
    const invalid = () => new SchoolError(410, "card_expired");
    if (!CARD_TOKEN.test(token)) throw invalid();
    const card = (
      await this.pool.query(
        `SELECT k.person_id FROM amp_person_credentials k
         WHERE k.lookup_hash=$1 AND ${WORKING_CARD}`,
        [sha256(token)],
      )
    ).rows[0] as { person_id: string } | undefined;
    if (!card) throw invalid();
    const grant = await this.signInPerson(card.person_id);
    if (!grant) throw invalid();
    return grant;
  }

  /** A session for a student a credential has already vouched for, in the mode
   * their classes resolve to. Null when they aren't a student here today. */
  async signInPerson(personId: string): Promise<StudentGrant | null> {
    const home = (
      await this.pool.query(
        `SELECT o.path FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
         WHERE r.person_id=$1 AND r.role='student' AND ${activeToday("r", "o")}
         ORDER BY r.begin_on DESC,o.id LIMIT 1`,
        [personId],
      )
    ).rows[0] as { path: string[] } | undefined;
    if (!home) return null;
    const classes = await this.pool.query(
      `SELECT c.id,o.path FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
       JOIN amp_orgs o ON o.id=c.org_id
       WHERE e.person_id=$1 AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "o")}`,
      [personId],
    );
    const mode = studentDeviceMode(
      await enrollmentSettings(this.pool, personId, home, classes.rows),
    );
    try {
      return await this.session(personId, mode);
    } catch (error) {
      if (error instanceof SchoolError && error.statusCode === 404) return null;
      throw error;
    }
  }

  /* Staff. `can` has already allowed this class; students are looked up in it. */
  private async classInfo(classId: string) {
    const found = (
      await this.pool.query(
        `SELECT c.id,c.name,c.join_code AS "joinCode",
           CASE WHEN c.join_locked_until>now() THEN c.join_locked_until END AS "lockedUntil"
         FROM amp_classes c WHERE c.id=$1 AND c.archived_at IS NULL`,
        [classId],
      )
    ).rows[0] as
      | { id: string; name: string; joinCode: string; lockedUntil: Date | null }
      | undefined;
    if (!found) throw new SchoolError(404, "not_found");
    return found;
  }
  private async assertStudent(classId: string, personId: string) {
    const found =
      isId(personId) &&
      (
        await this.pool.query(
          `SELECT 1 FROM ${STUDENTS_OF_CLASS} WHERE c.id=$1 AND p.id=$2 AND ${IN_CLASS}`,
          [classId, personId],
        )
      ).rowCount;
    if (!found) throw new SchoolError(404, "not_found");
  }

  /** Who's here: a session seen since midnight at the school. A device that
   * stayed signed in counts once it's been used today. */
  async presence(classId: string): Promise<Presence> {
    const found = await this.classInfo(classId);
    const { rows } = await this.pool.query(
      `SELECT p.id,${STUDENT_NAME} AS name,
         EXISTS(SELECT 1 FROM amp_student_sessions s WHERE s.person_id=p.id AND s.revoked_at IS NULL
           AND s.last_seen_at>=(date_trunc('day',now() AT TIME ZONE o.timezone) AT TIME ZONE o.timezone)) AS here
       FROM ${STUDENTS_OF_CLASS}
       WHERE c.id=$1 AND ${IN_CLASS} ORDER BY lower(${STUDENT_NAME}),p.id LIMIT ${ROSTER_LIMIT}`,
      [classId],
    );
    return {
      class: { id: found.id, name: found.name, joinCode: found.joinCode },
      students: rows,
    };
  }

  async roster(classId: string, canManage: boolean): Promise<SignInRoster> {
    const found = await this.classInfo(classId);
    const { rows } = await this.pool.query(
      `SELECT p.id,${STUDENT_NAME} AS name,
         (SELECT max(k.created_at) FROM amp_person_credentials k WHERE k.person_id=p.id AND ${WORKING_CARD}) AS "cardIssuedAt",
         EXISTS(SELECT 1 FROM amp_person_credentials k WHERE k.person_id=p.id AND k.kind='picture' AND k.revoked_at IS NULL) AS "picturesSet",
         EXISTS(SELECT 1 FROM amp_person_credentials k WHERE k.person_id=p.id AND k.kind='picture' AND k.revoked_at IS NULL AND k.locked_until>now()) AS locked,
         (SELECT count(*)::int FROM amp_student_sessions s WHERE s.person_id=p.id AND s.revoked_at IS NULL AND s.expires_at>now()) AS "activeSessions",
         (SELECT max(s.last_seen_at) FROM amp_student_sessions s WHERE s.person_id=p.id) AS "lastSeenAt"
       FROM ${STUDENTS_OF_CLASS}
       WHERE c.id=$1 AND ${IN_CLASS} ORDER BY lower(${STUDENT_NAME}),p.id LIMIT ${ROSTER_LIMIT}`,
      [classId],
    );
    return {
      class: {
        id: found.id,
        name: found.name,
        joinCode: found.joinCode,
        joinLockedUntil: found.lockedUntil?.toISOString() ?? null,
      },
      canManage,
      students: rows.map((row) => ({
        ...row,
        cardIssuedAt: row.cardIssuedAt?.toISOString() ?? null,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      })),
    };
  }

  /** A new code also reopens a class paused by guessing. Printed cards are
   * tied to the student, not the code, so they keep working. */
  async rotateCode(
    target: { classId: string; orgId: string },
    actorPersonId: string | null,
  ) {
    return this.schools.transaction(async (client) => {
      for (let attempt = 0; attempt < 6; attempt++) {
        const joinCode = generateJoinCode();
        const updated = await client.query(
          `UPDATE amp_classes SET join_code=$2,join_failed_count=0,join_locked_until=NULL
           WHERE id=$1 AND archived_at IS NULL
             AND NOT EXISTS(SELECT 1 FROM amp_classes other WHERE other.join_code=$2)`,
          [target.classId, joinCode],
        );
        if (!updated.rowCount) continue;
        await recordEvent(client, {
          orgId: target.orgId,
          actorPersonId,
          action: "class.code-rotated",
          targetKind: "class",
          targetId: target.classId,
        });
        return { joinCode };
      }
      throw new Error("No unused class code was found");
    });
  }

  /** The student picks new pictures next time, and any lock goes with the old
   * ones. Devices already signed in stay signed in. */
  async resetPictures(
    target: { classId: string; orgId: string },
    personId: string,
    actorPersonId: string | null,
  ) {
    await this.assertStudent(target.classId, personId);
    return this.schools.transaction(async (client) => {
      await this.lockCredentials(client, personId);
      const reset = await client.query(
        `UPDATE amp_person_credentials SET revoked_at=now()
         WHERE person_id=$1 AND kind='picture' AND revoked_at IS NULL`,
        [personId],
      );
      await recordEvent(client, {
        orgId: target.orgId,
        actorPersonId,
        action: "student.pictures-reset",
        targetKind: "person",
        targetId: personId,
        detail: { before: { picturesSet: !!reset.rowCount } },
      });
      return { reset: !!reset.rowCount };
    });
  }

  async revokeSessions(
    target: { classId: string; orgId: string },
    personId: string,
    actorPersonId: string | null,
  ) {
    await this.assertStudent(target.classId, personId);
    return this.schools.transaction(async (client) => {
      const revoked = await client.query(
        `UPDATE amp_student_sessions SET revoked_at=now()
         WHERE person_id=$1 AND revoked_at IS NULL AND expires_at>now()`,
        [personId],
      );
      await recordEvent(client, {
        orgId: target.orgId,
        actorPersonId,
        action: "student.sessions-revoked",
        targetKind: "person",
        targetId: personId,
        detail: { after: { revoked: revoked.rowCount } },
      });
      return { revoked: revoked.rowCount ?? 0 };
    });
  }

  /** Only a hash is kept, so this is the one moment a card's link exists: to
   * print again is to make new cards, and the old ones stop working. */
  async issueCards(
    target: { classId: string; orgId: string },
    raw: unknown,
    actorPersonId: string | null,
  ): Promise<IssuedCards> {
    const input = issueCardsSchema.parse(raw ?? {});
    const found = await this.classInfo(target.classId);
    return this.schools.transaction(async (client) => {
      const { rows: students } = await client.query(
        `SELECT p.id,${STUDENT_NAME} AS name FROM ${STUDENTS_OF_CLASS}
         WHERE c.id=$1 AND ${IN_CLASS}
           AND ($2::uuid[] IS NULL OR p.id=ANY($2::uuid[]))
           AND (NOT $3::boolean OR NOT EXISTS(SELECT 1 FROM amp_person_credentials k WHERE k.person_id=p.id AND ${WORKING_CARD}))
         ORDER BY p.id LIMIT ${ROSTER_LIMIT}`,
        [target.classId, input.personIds ?? null, !!input.missingOnly],
      );
      if (input.personIds && !students.length && !input.missingOnly)
        throw new SchoolError(404, "not_found");
      const cards: IssuedCards["cards"] = [];
      for (const student of students) {
        await this.lockCredentials(client, student.id);
        const replaced = await client.query(
          `UPDATE amp_person_credentials SET revoked_at=now()
           WHERE person_id=$1 AND kind='card' AND revoked_at IS NULL`,
          [student.id],
        );
        const token = generateCardToken();
        await client.query(
          `INSERT INTO amp_person_credentials(id,person_id,kind,lookup_hash,expires_at)
           VALUES($1,$2,'card',$3,now()+interval '${CARD_LIFETIME_DAYS} days')`,
          [randomUUID(), student.id, sha256(token)],
        );
        await recordEvent(client, {
          orgId: target.orgId,
          actorPersonId,
          action: replaced.rowCount
            ? "student.card-reissued"
            : "student.card-issued",
          targetKind: "person",
          targetId: student.id,
        });
        cards.push({ personId: student.id, name: student.name, token });
      }
      cards.sort((a, b) => a.name.localeCompare(b.name));
      return { class: { name: found.name }, cards };
    });
  }
}
