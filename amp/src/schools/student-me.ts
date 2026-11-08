import type { Pool } from "pg";
import { meSchema, type SignedInMe } from "../account/contracts.js";
import { retentionNotice } from "../family/contracts.js";
import { ApiError } from "../server/repository.js";
import { learningConsentActive } from "../server/account-access.js";
import {
  activeToday,
  isSchoolAccount,
  resolveStudentSession,
  schoolAccountId,
  schoolConsentActive,
} from "./principal.js";
import { enrollmentSettings } from "./enrollment-settings.js";
import { studentLevelVisibility } from "./settings.js";
import { hasOpenBoard } from "./standings.js";

/** `/me` for a student token, parent-shaped so the existing app runs unchanged.
 * An invalid token answers 401 rather than `signedIn:false`, which is how the
 * client knows to go to `/join`. Reads only: a family's `/me` takes an account
 * lock, and a class signing in together must not queue. A family's child is a
 * student too: their one learner, on their parent's consent and grants. */
export async function studentMe(
  pool: Pool,
  token: string,
  development = false,
): Promise<SignedInMe> {
  const session = await resolveStudentSession(pool, token);
  if (!session) throw new ApiError(401, "Sign in to continue");
  const { accountId, personId } = session;
  const learner = (
    await pool.query(
      `SELECT l.id,l.name,l.birth_year,l.sat_math_focus FROM amp_people p
       JOIN amp_learners l ON l.id=p.learner_id AND l.deleted_at IS NULL WHERE p.id=$1`,
      [personId],
    )
  ).rows[0];
  const home = (
    await pool.query(
      `SELECT o.name,o.path FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
       WHERE r.person_id=$1 AND r.role='student' AND ${activeToday("r", "o")}
       ORDER BY r.begin_on DESC,o.id LIMIT 1`,
      [personId],
    )
  ).rows[0];
  if (!learner || !home) throw new ApiError(401, "Sign in to continue");
  const classes = (
    await pool.query(
      `SELECT c.id,c.name,o.path FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
       JOIN amp_orgs o ON o.id=c.org_id
       WHERE e.person_id=$1 AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "o")}
       ORDER BY e.begin_on DESC,c.name,c.id`,
      [personId],
    )
  ).rows;
  const grants = (
    await pool.query(
      `SELECT channel,status,starts_at,ends_at,status='active' AND starts_at<=now() AND ends_at>now() AS in_force
       FROM amp_grants WHERE learner_id=$1 ORDER BY starts_at,id`,
      [learner.id],
    )
  ).rows;
  const current = grants
    .filter((grant) => grant.in_force)
    .sort((a, b) => b.ends_at.getTime() - a.ends_at.getTime())[0];
  // A school's agreement, or for a family's child their parent's consent.
  const canPractice =
    !!current &&
    (isSchoolAccount(accountId)
      ? await schoolConsentActive(pool, accountId)
      : await learningConsentActive(pool, accountId, development, learner.id));
  const settings = await enrollmentSettings(pool, personId, home, classes);
  return meSchema.parse({
    signedIn: true,
    account: {
      // The browser's key for this sign-in: the person, never the parent.
      id: schoolAccountId(personId),
      email: null,
      emailVerified: true,
      confirmationRequired: false,
      kind: "student",
    },
    // The school's agreement stands in for parent consent. When it ends,
    // `canPractice` goes false and the app says to ask the teacher.
    consent: { status: "active", method: null },
    learners: [
      {
        id: learner.id,
        name: learner.name,
        birthYear: learner.birth_year ?? null,
        entitlement: {
          active: canPractice,
          plan: current?.channel ?? null,
          endsAt: current?.ends_at.toISOString() ?? null,
        },
      },
    ],
    family: {
      consent: {
        status: "active",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: [
        {
          id: learner.id,
          name: learner.name,
          birthYear: learner.birth_year ?? null,
          satMathFocus: learner.sat_math_focus,
          deletedAt: null,
          stripeLinked: false,
          canPractice,
          access: grants.map((grant) => ({
            channel: grant.channel,
            status: grant.status,
            startsAt: grant.starts_at.toISOString(),
            endsAt: grant.ends_at.toISOString(),
          })),
        },
      ],
      retained: retentionNotice,
    },
    next: "practice",
    school: {
      orgName: home.name,
      ...(classes[0] ? { className: classes[0].name } : {}),
      levels: studentLevelVisibility(settings).value,
      standings: await hasOpenBoard(pool, personId, classes, settings),
    },
  }) as SignedInMe;
}
