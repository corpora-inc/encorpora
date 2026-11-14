import {
  familyHasLearnerRoom,
  freeAllowance,
} from "../learning/free-allowance.js";
import { StripeRepository } from "../billing/stripe/repository.js";
import type { StripeBillingConfig } from "../billing/stripe/config.js";
import type { Pool } from "pg";
import { FamilyError } from "./contracts.js";
import { familyDisplayNameSql, holderDisplayNameSql } from "./identity.js";
import { gradeFor } from "./family-class.js";
import {
  can,
  loadActor,
  type Actor,
  type SchoolTarget,
} from "../schools/authz.js";
import { activeToday, isSchoolAccount } from "../schools/principal.js";
import { readProgress, readToday } from "../schools/teacher-reads.js";
import {
  classContext,
  courseBand,
  weeklyTargetFor,
  type ClassContext,
} from "../schools/term-grades.js";
import { parentConsentStates } from "../server/account-access.js";
import { adultNameSql } from "../account/profile.js";

export type FamilyRole = "holder" | "second-parent" | "co-teacher";
type Identity = {
  familyId: string;
  orgId: string | null;
  holder: string;
  displayName: string | null;
  holderName: string | null;
  classId: string | null;
  secondParent: string | null;
  className: string | null;
  hasHosted: boolean;
  timezone: string;
};
const IDENTITIES = `SELECT fs.id AS "familyId",f.org_id AS "orgId",fs.account_id AS holder,
  ${familyDisplayNameSql("fs.account_id", "o")} AS "displayName",${holderDisplayNameSql("fs.account_id")} AS "holderName",f.class_id AS "classId",f.second_parent AS "secondParent",
  (SELECT name FROM amp_classes WHERE id=f.class_id) AS "className",
  EXISTS(SELECT 1 FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
    JOIN amp_learners l ON l.id=p.learner_id AND l.deleted_at IS NULL AND NOT l.adult
    WHERE e.class_id=f.class_id AND e.role='student' AND ${activeToday("e", "o")} AND l.account_id<>fs.account_id) AS "hasHosted",
  COALESCE(o.timezone,'America/New_York') AS timezone
  FROM amp_family_spaces fs LEFT JOIN amp_families f ON f.account_id=fs.account_id
  LEFT JOIN amp_orgs o ON o.id=f.org_id`;
const targetFor = (familyId: string, classId: string): SchoolTarget => ({
  kind: "class",
  classId,
  orgId: familyId,
  path: [familyId],
});
const teachingPlace = (row: Identity, role: FamilyRole, actor: Actor) =>
  row.classId &&
  (row.hasHosted || role === "co-teacher") &&
  can(actor, "students.read", targetFor(row.orgId!, row.classId))
    ? {
        classId: row.classId,
        displayName: row.className!,
        scope: "whole-class" as const,
        path: `/api/v1/families/${row.familyId}/teaching`,
      }
    : null;
const adultOnly = (account: string) => {
  if (isSchoolAccount(account) || account.startsWith("trial:"))
    throw new FamilyError(403, "adult_account_required");
};
function roleFor(
  row: Identity,
  account: string,
  actor: Actor,
): FamilyRole | null {
  if (row.holder === account) return "holder";
  if (
    row.secondParent &&
    actor.roles.some(
      (entry) =>
        entry.personId === row.secondParent &&
        entry.orgId === row.orgId &&
        entry.role === "teacher",
    )
  )
    return "second-parent";
  if (
    row.classId &&
    actor.classes.some((entry) => entry.classId === row.classId) &&
    can(actor, "students.read", targetFor(row.orgId!, row.classId))
  )
    return "co-teacher";
  return null;
}
/** A bounded switcher read. Only an account with children or an existing
 * family acquires a Family place; being a teacher alone does not create one. */
export async function listFamilies(
  pool: Pool,
  account: string,
  after?: string,
) {
  adultOnly(account);
  const rows = (
    await pool.query<Identity>(
      `${IDENTITIES}
    WHERE (fs.account_id=$1 OR EXISTS(
      SELECT 1 FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id
      WHERE p.id=f.second_parent AND p.account_id=$1 AND p.deleted_at IS NULL
        AND r.org_id=f.org_id AND r.role='teacher' AND ${activeToday("r", "o")} AND amp_school_role_current(r.id)) OR EXISTS(
      SELECT 1 FROM amp_people p JOIN amp_enrollments e ON e.person_id=p.id
      WHERE p.account_id=$1 AND p.deleted_at IS NULL AND e.class_id=f.class_id
      AND e.role<>'student' AND ${activeToday("e", "o")}
      AND EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id
        AND r.org_id=ANY(o.path) AND r.role<>'student' AND ${activeToday("r", "o")} AND amp_school_role_current(r.id))))
      AND ($2::uuid IS NULL OR fs.id>$2::uuid)
    ORDER BY fs.id LIMIT 51`,
      [account, after ?? null],
    )
  ).rows;
  const actor = await loadActor(
    pool,
    account,
    rows.flatMap((row) => (row.orgId ? [row.orgId] : [])),
  );
  const places = rows
    .map((row) => ({ row, role: roleFor(row, account, actor) }))
    .filter((entry) => entry.role !== null);
  return {
    families: places.slice(0, 50).map(({ row, role }) => ({
      familyId: row.familyId,
      classId: row.classId,
      orgId: row.orgId,
      displayName: row.displayName,
      role: role!,
      teachingPlace: teachingPlace(row, role!, actor),
      capabilities: {
        readFamily: role !== "co-teacher",
        readTeaching:
          !!row.classId &&
          can(actor, "students.read", targetFor(row.orgId!, row.classId)),
      },
    })),
    next: rows.length > 50 ? rows[49]!.familyId : null,
  };
}
async function authorize(pool: Pool, account: string, familyId: string) {
  adultOnly(account);
  const row = (
    await pool.query<Identity>(`${IDENTITIES} WHERE fs.id=$1`, [familyId])
  ).rows[0];
  const actor = await loadActor(pool, account, row?.orgId ? [row.orgId] : []);
  const role = row && roleFor(row, account, actor);
  if (!row || !role) throw new FamilyError(404, "family_not_found");
  return { row, role, actor };
}
async function familyContext(pool: Pool, row: Identity): Promise<ClassContext> {
  if (row.classId)
    return { ...(await classContext(pool, row.classId)), courseBands: [] };
  const clock = (
    await pool.query(
      "SELECT to_char(now() AT TIME ZONE $1,'YYYY-MM-DD') AS today,extract(hour FROM now() AT TIME ZONE $1)::int AS hour",
      [row.timezone],
    )
  ).rows[0];
  return {
    id: row.familyId,
    orgId: row.familyId,
    path: [row.familyId],
    name: row.displayName ?? "Your family",
    orgName: row.displayName ?? "Your family",
    orgKind: "family",
    courseBands: [],
    gradingKind: "year",
    sessionId: "",
    timezone: row.timezone,
    ...clock,
  };
}
async function hostedCount(pool: Pool, row: Identity) {
  if (!row.classId) return 0;
  return (
    await pool.query(
      `SELECT count(DISTINCT p.id)::int AS n FROM amp_enrollments e
    JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
    JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
    JOIN amp_learners l ON l.id=p.learner_id AND l.deleted_at IS NULL AND NOT l.adult
    WHERE e.class_id=$1 AND e.role='student' AND ${activeToday("e", "o")} AND l.account_id<>$2`,
      [row.classId, row.holder],
    )
  ).rows[0].n as number;
}
export async function familyProjection(
  pool: Pool,
  account: string,
  familyId: string,
  development = false,
  billingConfig: StripeBillingConfig | null = null,
) {
  const { row, role } = await authorize(pool, account, familyId);
  if (role === "co-teacher") throw new FamilyError(403, "family_parent_only");
  const holder = role === "holder";
  const consent = (
    await parentConsentStates(pool, [row.holder], development)
  ).get(row.holder)!;
  const owned = (
    await pool.query(
      `SELECT l.id,l.name,l.birth_year,l.name_pending,l.free_online_used,l.free_workbooks_used,
      (NOT EXISTS(SELECT 1 FROM amp_people p WHERE p.learner_id=l.id)
        OR EXISTS(SELECT 1 FROM amp_people p JOIN amp_orgs o ON o.id=p.tenant_id
          WHERE p.learner_id=l.id AND p.deleted_at IS NULL AND o.kind='family')) AS family_practice,
      EXISTS(SELECT 1 FROM amp_grants g WHERE g.learner_id=l.id AND g.status='active'
        AND g.starts_at<=now() AND g.ends_at>now()) AS has_access
     FROM amp_learners l WHERE l.account_id=$1 AND l.deleted_at IS NULL AND NOT l.adult
     ORDER BY l.created_at,l.id LIMIT 1001`,
      [row.holder],
    )
  ).rows;
  if (owned.length > 1000) throw new FamilyError(409, "family_child_limit");
  const grants = (
    await pool.query(
      `SELECT l.id AS learner_id,g.* FROM unnest($1::text[]) l(id)
     CROSS JOIN LATERAL (SELECT channel,status,starts_at,ends_at FROM amp_grants
       WHERE learner_id=l.id ORDER BY starts_at DESC,id DESC LIMIT 20) g`,
      [owned.map((child) => child.id)],
    )
  ).rows;
  const children = owned.map((child) => {
    const learningAllowed =
      consent.active || (child.name_pending && !consent.withdrawn);
    return {
      id: child.id as string,
      name: child.name as string,
      birthYear: child.birth_year as number | null,
      hasAccess: child.has_access as boolean,
      familyPractice: child.family_practice as boolean,
      learningAllowed,
      canPractice:
        learningAllowed &&
        (development || child.has_access || child.free_online_used < 100),
      freeAllowance: freeAllowance(
        child.free_online_used,
        child.free_workbooks_used,
      ),
      access: grants
        .filter((g) => g.learner_id === child.id)
        .map((g) => ({
          channel: g.channel,
          status: g.status,
          startsAt: g.starts_at.toISOString(),
          endsAt: g.ends_at.toISOString(),
        })),
    };
  });
  const purchase =
    holder && billingConfig
      ? await new StripeRepository(
          pool,
          billingConfig,
        ).ownedCheckoutEligibility(
          pool,
          row.holder,
          children.map((child) => child.id),
        )
      : new Set<string>();
  const [context, hosted, memberships] = await Promise.all([
    familyContext(pool, row),
    hostedCount(pool, row),
    pool.query(
      `SELECT p.learner_id,p.id AS person_id,o.kind AS tenant_kind,
      c.id AS class_id,c.name AS class_name,c.org_id,o.path,c.course_bands,p.grade_level
      FROM amp_people p JOIN amp_enrollments e ON e.person_id=p.id AND e.role='student'
      JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
      JOIN amp_orgs o ON o.id=c.org_id
      WHERE p.learner_id=ANY($1::text[]) AND p.deleted_at IS NULL AND ${activeToday("e", "o")}
        AND EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id AND r.role='student' AND r.org_id=ANY(o.path) AND ${activeToday("r", "o")})
      ORDER BY c.id`,
      [children.map((child) => child.id)],
    ),
  ]);
  // Include only the actual displayed memberships, so a parent who also
  // teaches their child's host class receives its real canOpen capability.
  const actor = await loadActor(pool, account, [
    ...new Set([
      ...(row.orgId ? [row.orgId] : []),
      ...memberships.rows.flatMap((member) => member.path as string[]),
    ]),
  ]);
  const gradeOf = (child: (typeof children)[number]) => {
    const membership = memberships.rows.find(
      (entry) => entry.learner_id === child.id,
    );
    return (
      gradeFor(child.birthYear ?? null) ??
      membership?.grade_level ??
      courseBand(membership?.course_bands ?? [])?.level ??
      null
    );
  };
  const targetMinutes = row.classId
    ? (await weeklyTargetFor(pool, context)).minutes
    : null;
  const today = await readToday(pool, context, null, {
    children: children.map((child) => ({
      id: child.id,
      learnerId: child.id,
      name: child.name,
      first: child.name,
      gradeLevel: gradeOf(child),
      identifier: null,
    })),
    weeklyTargetMinutes: targetMinutes,
  });
  const lastPractice = new Map(
    (
      await pool.query<{ learner_id: string; day: string }>(
        `SELECT l.id AS learner_id,greatest(s.day,a.day)::text AS day FROM unnest($1::text[]) l(id)
       LEFT JOIN LATERAL (SELECT day FROM amp_skill_days WHERE learner_id=l.id AND attempts>0 ORDER BY day DESC LIMIT 1) s ON true
       LEFT JOIN LATERAL (SELECT day FROM amp_active_days WHERE learner_id=l.id AND active_ms>0 ORDER BY day DESC LIMIT 1) a ON true`,
        [children.map((child) => child.id)],
      )
    ).rows.map((entry) => [entry.learner_id, entry.day]),
  );
  const projected = [];
  for (const child of children) {
    const roster = memberships.rows.filter(
      (member) => member.learner_id === child.id,
    );
    const home = roster.find((member) => member.org_id === row.orgId);
    const target = home ? targetFor(row.orgId!, home.class_id) : null;
    const teaching = (action: Parameters<typeof can>[1]) =>
      !!target && can(actor, action, target);
    // Parent-entry naming remains allowed after withdrawal; namingConsentActive
    // determines the evidence basis, not whether the owner can correct a name.
    const names = holder;
    // The mutation repairs an unrostered owned child into their home family.
    // An existing roster person must belong to a family, as its session
    // predicate requires; displayed enrollments are not that predicate.
    const practiceHere = child.canPractice === true && child.familyPractice;
    const facts = today.students.find((student) => student.id === child.id)!;
    const capabilities = {
      readProgress: true,
      readWorkbooks: holder && child.learningAllowed === true,
      createWorkbook:
        holder &&
        child.learningAllowed === true &&
        (development ||
          child.hasAccess === true ||
          (child.freeAllowance?.workbooks.available ?? 0) > 0),
      recordWorkbook: holder && child.learningAllowed === true,
      practiceHere,
      continuePurchase: holder,
      purchase: purchase.has(child.id),
      rename: names,
      changeBirthYear: holder,
      changePracticeSettings: holder && child.learningAllowed === true,
      manageConsent: holder,
      delete: holder,
      readGrades: teaching("grades.read"),
      editGrades: teaching("grades.write"),
      manageDevices: teaching("signin.manage"),
    };
    projected.push({
      id: child.id,
      name: child.name,
      birthYear: child.birthYear ?? null,
      gradeLevel: gradeOf(child),
      access: {
        grants: child.access,
        hasAccess: child.hasAccess === true,
        canPractice: child.canPractice === true,
        learningAllowed: child.learningAllowed === true,
        freeAllowance: child.freeAllowance,
      },
      week: {
        minutes: facts.weekMinutes,
        problems: facts.weekProblems,
        lastPracticed: lastPractice.get(child.id) ?? null,
      },
      nextUp: {
        kind: child.canPractice
          ? "adaptive-practice"
          : child.learningAllowed
            ? "access"
            : "consent",
        learnerId: child.id,
        task:
          today.todos.find((task) =>
            task.students.some((student) => student.id === child.id),
          ) ?? null,
      },
      capabilities,
      classes: roster.map((member) => ({
        id: member.class_id,
        name: member.class_name,
        orgId: member.org_id,
        personId: member.person_id,
        hostedByFamily: member.org_id === row.orgId,
        canOpen: can(actor, "students.read", {
          kind: "class",
          classId: member.class_id,
          orgId: member.org_id,
          path: member.path,
        }),
      })),
      paths: {
        progress: `/api/v1/families/${familyId}/children/${encodeURIComponent(child.id)}/progress`,
        workbooks: capabilities.readWorkbooks
          ? `/api/v1/learners/${encodeURIComponent(child.id)}/workbooks`
          : null,
        practiceHere: practiceHere
          ? `/api/v1/family/learners/${encodeURIComponent(child.id)}/practice-here`
          : null,
        continue: holder ? `/continue/${encodeURIComponent(child.id)}` : null,
      },
    });
  }
  return {
    familyId,
    displayName: row.displayName,
    holderName: row.holderName,
    role,
    teachingPlace: teachingPlace(row, role, actor),
    capabilities: {
      readFamily: true,
      addChildren:
        holder &&
        !consent.withdrawn &&
        (await familyHasLearnerRoom(pool, row.holder)),
      manageConsent: holder,
      manageBilling: holder,
      inviteSecondParent:
        holder && hosted === 0 && !!row.classId && !row.secondParent,
      manageSecondParent: holder && !!row.classId,
      readTeaching:
        !!row.classId &&
        can(actor, "students.read", targetFor(row.orgId!, row.classId)),
    },
    children: projected,
    today: { date: today.today, tasks: today.todos, week: today.week },
  };
}
/** Individual evidence requires parent authority, never host-class authority. */
export async function familyChildProgress(
  pool: Pool,
  account: string,
  familyId: string,
  learnerId: string,
) {
  const { row, role } = await authorize(pool, account, familyId);
  if (role === "co-teacher") throw new FamilyError(403, "family_parent_only");
  const child = (
    await pool.query(
      "SELECT name,birth_year FROM amp_learners WHERE id=$1 AND account_id=$2 AND NOT adult AND deleted_at IS NULL",
      [learnerId, row.holder],
    )
  ).rows[0];
  if (!child) throw new FamilyError(404, "learner_not_found");
  const context = await familyContext(pool, row);
  return {
    id: learnerId,
    name: child.name,
    today: context.today,
    familyDisplayName: row.displayName,
    ...(await readProgress(
      pool,
      {
        personId: learnerId,
        learnerId,
        gradeLevel: gradeFor(child.birth_year),
      },
      row.timezone,
      context.today,
      null,
      "all",
    )),
  };
}
/** Legacy teaching authority deliberately remains the authority for the whole
 * roster. No parent's household, billing or consent is projected here. */
export async function familyTeaching(
  pool: Pool,
  account: string,
  familyId: string,
) {
  const { row, actor } = await authorize(pool, account, familyId);
  if (!row.classId) throw new FamilyError(404, "teaching_place_not_found");
  const target = targetFor(row.orgId!, row.classId);
  if (!can(actor, "students.read", target))
    throw new FamilyError(403, "teaching_forbidden");
  const context = await classContext(pool, row.classId);
  const readStaff = can(actor, "staff.read", {
    kind: "org",
    orgId: row.orgId!,
    path: [row.orgId!],
  });
  const readApprovals = row.holder === account;
  const [today, staff, approvals] = await Promise.all([
    readToday(pool, context, null),
    readStaff
      ? pool.query(
          `SELECT p.id,p.account_id,${adultNameSql()} AS name,e.role,f.second_parent=p.id AS second_parent
      FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
      JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id JOIN amp_families f ON f.class_id=c.id
      WHERE e.class_id=$1 AND e.role<>'student' AND ${activeToday("e", "o")}
      AND EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id AND r.org_id=ANY(o.path) AND r.role<>'student' AND ${activeToday("r", "o")}) ORDER BY p.id`,
          [row.classId],
        )
      : Promise.resolve({ rows: [] }),
    readApprovals
      ? pool.query(
          `SELECT a.id,a.person_id,a.account_id,a.expires_at,a.approved_at,a.ended_at,a.opened_at,
        (SELECT withdrawn_at FROM amp_parent_consents WHERE account_id=a.account_id) AS withdrawn_at
      FROM amp_family_approvals a WHERE a.class_id=$1 ORDER BY a.created_at,a.id LIMIT 1000`,
          [row.classId],
        )
      : Promise.resolve({ rows: [] }),
  ]);
  const approvalConsents = await parentConsentStates(
    pool,
    approvals.rows
      .filter((a) => !a.ended_at && a.approved_at && a.account_id)
      .map((a) => a.account_id),
  );
  const states = [];
  for (const approval of approvals.rows) {
    const consent = approvalConsents.get(approval.account_id)?.active ?? false;
    states.push({
      id: approval.id,
      personId: approval.person_id,
      status: approval.ended_at
        ? "ended"
        : approval.approved_at
          ? consent
            ? "approved"
            : approval.withdrawn_at
              ? "withdrawn"
              : "paused"
          : approval.expires_at <= new Date()
            ? "expired"
            : approval.opened_at
              ? "opened"
              : "waiting",
      expiresAt: approval.expires_at.toISOString(),
      approvedAt: approval.approved_at?.toISOString() ?? null,
      endedAt: approval.ended_at?.toISOString() ?? null,
    });
  }
  return {
    familyId,
    place: "teaching" as const,
    scope: "whole-class" as const,
    class: today.class,
    students: today.students,
    today: { date: today.today, week: today.week, tasks: today.todos },
    approvals: states,
    coTeachers: staff.rows.map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      status: person.account_id ? "active" : "invited",
      secondParent: person.second_parent === true,
    })),
    capabilities: {
      readClass: true,
      readStaff,
      readApprovals,
      manageApprovals: row.holder === account,
      manageStaff: can(actor, "staff.manage", {
        kind: "org",
        orgId: row.orgId!,
        path: [row.orgId!],
      }),
      manageDevices: can(actor, "signin.manage", target),
      editGrades: can(actor, "grades.write", target),
      createWorkbooks: can(actor, "workbooks.write", target),
    },
  };
}
