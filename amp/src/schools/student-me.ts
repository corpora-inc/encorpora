import type { Pool } from "pg";
import {
  schoolPilotAccess,
  schoolAllowance,
  studentPracticeGate,
} from "./pilot-access.js";
import { meSchema, type SignedInMe } from "../account/contracts.js";
import { retentionNotice } from "../family/contracts.js";
import { ApiError } from "../server/repository.js";
import { learningConsentActive } from "../server/account-access.js";
import { freeAllowance } from "../learning/free-allowance.js";
import {
  activeToday,
  resolveStudentSession,
  schoolAccountId,
} from "./principal.js";
import { enrollmentSettings } from "./enrollment-settings.js";
import { studentLevelVisibility } from "./settings.js";
import { hasOpenBoard } from "./standings.js";
import { goesByNumber } from "../learning/nickname.js";
import type { LevelVisibility } from "./settings.js";

/**
 * Whether a student sees grade levels on the screens they see as themselves
 * (practice, their levels, their Pathways): hidden when a grown-up switched
 * "Show grade level" off for them, or when their school hides levels. A
 * family's or tutor's class no longer sets this for its children: the
 * grown-up's switch on each child does. Grown-ups' own views always show
 * grades.
 */
export function studentLevels(
  school: LevelVisibility,
  familyHome: boolean,
  gradeLevelShown: boolean,
): "hidden" | "shown" {
  if (!gradeLevelShown) return "hidden";
  return !familyHome && school === "hidden" ? "hidden" : "shown";
}

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
      `SELECT l.id,l.name,l.birth_year,l.sat_math_focus,l.name_pending,l.identity_scope,l.label_number,l.free_online_used,l.free_workbooks_used FROM amp_people p
       JOIN amp_learners l ON l.id=p.learner_id AND l.deleted_at IS NULL WHERE p.id=$1`,
      [personId],
    )
  ).rows[0];
  const home = (
    await pool.query(
      `SELECT o.name,o.path,o.kind FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
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
      `SELECT channel,status,starts_at,ends_at,status='active' AND starts_at<=now() AND ends_at>now() AND amp_school_grant_valid(id) AS in_force
       FROM amp_grants WHERE learner_id=$1 ORDER BY starts_at,id`,
      [learner.id],
    )
  ).rows;
  const current = grants
    .filter((grant) => grant.in_force)
    .sort((a, b) => b.ends_at.getTime() - a.ends_at.getTime())[0];
  const pilot = await schoolPilotAccess(pool, learner.id);
  const covered = !!current || pilot.active;
  const allowance = schoolAllowance(
    freeAllowance(learner.free_online_used, learner.free_workbooks_used),
    pilot.managed,
  );
  const learningAllowed = await learningConsentActive(
    pool,
    accountId,
    development,
    learner.id,
  );
  // A family's child on a development server is covered, as the family's
  // own projection of them is (family/repository.ts); a school's student
  // still waits on their school.
  const familyDevelopment = development && home.kind === "family";
  const canPractice =
    learningAllowed &&
    (familyDevelopment || covered || allowance.problems.remaining > 0);
  // A school's student whom nothing covers is waiting on their teacher, never
  // on a family's free problems: the app says which, in school terms.
  const practice = covered
    ? null
    : await studentPracticeGate(pool, pilot, home.path);
  const settings = await enrollmentSettings(pool, personId, home, classes);
  const practiceState = (
    await pool.query(
      "SELECT state FROM amp_practice_settings WHERE learner_id=$1",
      [learner.id],
    )
  ).rows[0]?.state;
  const levels = studentLevels(
    studentLevelVisibility(settings).value,
    home.kind === "family",
    // Unset (every learner before the switch existed) is on.
    practiceState?.gradeLevelShown !== false,
  );
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
    // The school's agreement stands in for parent consent. A student never
    // acts on consent: when the agreement ends, `canPractice` and
    // `learningAllowed` go false and the app says to ask the teacher.
    consent: { status: "active", method: null },
    learners: [
      {
        id: learner.id,
        name: learner.name,
        birthYear: learner.birth_year ?? null,
        namePending: learner.name_pending,
        ...(goesByNumber(learner) ? { defaultName: true as const } : {}),
        freeAllowance: allowance,
        entitlement: {
          active: canPractice,
          licensed: covered,
          plan: current?.channel ?? (pilot.active ? "pilot" : null),
          endsAt:
            current?.ends_at.toISOString() ??
            (pilot.active ? pilot.until?.toISOString() : null),
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
          learningAllowed,
          hasAccess: covered,
          namePending: learner.name_pending,
          ...(goesByNumber(learner) ? { defaultName: true as const } : {}),
          freeAllowance: allowance,
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
      levels,
      ...(practice ? { practice } : {}),
      standings: await hasOpenBoard(pool, personId, classes, settings),
    },
  }) as SignedInMe;
}
