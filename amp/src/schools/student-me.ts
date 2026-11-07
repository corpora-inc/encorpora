import type { Pool } from "pg";
import { meSchema, type SignedInMe } from "../account/contracts.js";
import { retentionNotice } from "../family/contracts.js";
import { ApiError } from "../server/repository.js";
import {
  activeToday,
  resolveStudentToken,
  schoolConsentActive,
  schoolPersonId,
} from "./principal.js";
import {
  resolveSettings,
  studentLevelVisibility,
  type LevelVisibility,
  type ScopeKind,
  type SettingsScope,
} from "./settings.js";

/** Each enrollment's chain: its org path root first, then the class, then the
 * person. A student in no class still has their school's settings. */
async function levelsFor(
  pool: Pool,
  personId: string,
  home: { path: string[] },
  classes: { id: string; path: string[] }[],
): Promise<LevelVisibility> {
  const orgs = [...new Set([home, ...classes].flatMap((row) => row.path))];
  const stored = await pool.query(
    `SELECT scope_kind,scope_id,"values",locked FROM amp_scope_settings
     WHERE (scope_kind='org' AND scope_id=ANY($1::uuid[]))
        OR (scope_kind='class' AND scope_id=ANY($2::uuid[]))
        OR (scope_kind='person' AND scope_id=$3)`,
    [orgs, classes.map((c) => c.id), personId],
  );
  const scope = (kind: ScopeKind, id: string): SettingsScope[] => {
    const row = stored.rows.find(
      (r) => r.scope_kind === kind && r.scope_id === id,
    );
    return row ? [{ kind, id, values: row.values, locked: row.locked }] : [];
  };
  const chain = (path: string[], classId?: string) => [
    ...path.flatMap((id) => scope("org", id)),
    ...(classId ? scope("class", classId) : []),
    ...scope("person", personId),
  ];
  return studentLevelVisibility(
    (classes.length
      ? classes.map((c) => chain(c.path, c.id))
      : [chain(home.path)]
    ).map(resolveSettings),
  ).value;
}

/** `/me` for a student token, parent-shaped so the existing app runs unchanged.
 * An invalid token answers 401 rather than `signedIn:false`, which is how the
 * client knows to go to `/join`. Reads only: a family's `/me` takes an account
 * lock, and a class signing in together must not queue. */
export async function studentMe(
  pool: Pool,
  token: string,
): Promise<SignedInMe> {
  const accountId = await resolveStudentToken(pool, token);
  const personId = accountId && schoolPersonId(accountId);
  if (!accountId || !personId) throw new ApiError(401, "Sign in to continue");
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
  const canPractice = !!current && (await schoolConsentActive(pool, accountId));
  return meSchema.parse({
    signedIn: true,
    account: {
      id: accountId,
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
      levels: await levelsFor(pool, personId, home, classes),
    },
  }) as SignedInMe;
}
