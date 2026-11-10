import { availableGift } from "../access-grants/repository.js";
import type { Pool } from "pg";
import { meSchema, type SignedInMe } from "./contracts.js";
import type { FamilyRepository } from "../family/repository.js";
import { activeToday, isSchoolAccount } from "../schools/principal.js";
import { familyClassOf } from "../family/family-class.js";
import { pendingApprovalOf } from "../family/approvals.js";
import { absorbLiveTrial } from "../server/absorb-trial.js";
import { secondParentFamilies } from "../family/second-parent.js";
import type { FamilySummary } from "../family/contracts.js";

/** A family's children as `/me` lists them: each with their access. */
function childEntries(family: FamilySummary) {
  return family.learners
    .filter((l) => !l.deletedAt && !l.adult)
    .map((l) => {
      const grant = l.access
        .filter(
          (a) =>
            a.status === "active" &&
            Date.parse(a.startsAt) <= Date.now() &&
            Date.parse(a.endsAt) > Date.now(),
        )
        .sort((a, b) => b.endsAt.localeCompare(a.endsAt))[0];
      return {
        id: l.id,
        name: l.name,
        birthYear: l.birthYear ?? null,
        namePending: l.namePending,
        pictureIdentity: l.pictureIdentity,
        freeAllowance: l.freeAllowance,
        entitlement: {
          active: l.canPractice === true,
          licensed: l.hasAccess ?? !!grant,
          plan: grant?.channel ?? null,
          endsAt: grant?.endsAt ?? null,
        },
      };
    });
}
/** One authenticated account snapshot. No trial capability or child draft is stored here. */
export async function accountSummary(
  pool: Pool,
  families: FamilyRepository,
  accountId: string,
  /** The configured Stripe namespace; without billing no purchase is offered. */
  billingNamespace: string | null = null,
): Promise<SignedInMe> {
  // A student session is answered before this runs. A school account is not
  // a family, so its trial, if it has one, stays where it is.
  if (!isSchoolAccount(accountId)) {
    const client = await pool.connect();
    try {
      await absorbLiveTrial(client, accountId);
    } finally {
      client.release();
    }
  }
  const family = await families.summary(accountId);
  let email: string | null = null,
    emailVerified = true;
  if (
    accountId.startsWith("amp|") &&
    (await pool.query("SELECT to_regclass('amp_auth_users') AS relation"))
      .rows[0].relation
  ) {
    const user = (
      await pool.query(
        'SELECT email,"emailVerified" FROM amp_auth_users WHERE id=$1',
        [accountId.slice(4)],
      )
    ).rows[0];
    email = user?.email ?? null;
    emailVerified = user?.emailVerified === true;
  }
  const record = (
    await pool.query(
      "SELECT verification_method FROM amp_parent_consents WHERE account_id=$1",
      [accountId],
    )
  ).rows[0];
  const active = ["active", "development"].includes(family.consent.status);
  // A verified purchase-backed enrollment that no learner holds yet. Assignment
  // itself rechecks consent, ownership and refunds; this only routes the parent.
  const unassigned =
    active &&
    billingNamespace &&
    (
      await pool.query(
        "SELECT to_regclass('amp_account_entitlements') AS relation",
      )
    ).rows[0].relation
      ? (
          await pool.query(
            `SELECT c.id,c.billing_interval,max(e.ends_at) AS ends_at
             FROM amp_stripe_checkouts c JOIN amp_account_entitlements e ON e.checkout_id=c.id AND e.namespace=c.namespace
             WHERE c.account_id=$1 AND c.namespace=$2 AND c.learner_id IS NULL AND c.assigned_learner_id IS NULL AND e.status='active' AND e.ends_at>now()
             AND NOT EXISTS(SELECT 1 FROM amp_enrollment_cancellations x WHERE x.checkout_id=c.id)
             GROUP BY c.id,c.billing_interval ORDER BY max(e.ends_at) DESC,c.id LIMIT 1`,
            [accountId, billingNamespace],
          )
        ).rows[0]
      : undefined;
  // The family's learners; the adult's own learner is its own place.
  const adult = family.learners.find((l) => l.adult && !l.deletedAt);
  const learners = childEntries(family);
  const gift = await availableGift(pool, accountId);
  // In parallel. A fixture at an earlier migration boundary has no schools,
  // and reads as none: no extra round trip to check first on the path every
  // parent's `/me` takes.
  const missing =
    (...codes: string[]) =>
    (error: { code?: string }) => {
      if (error.code && codes.includes(error.code)) return { rows: [] };
      throw error;
    };
  const [staffRows, familyClass, familyApproval, coParented] =
    await Promise.all([
      pool
        .query<{
          orgId: string;
          orgName: string;
          role: string;
          setupPending: boolean;
          demo: boolean;
        }>(
          `SELECT DISTINCT ON (o.id) o.id AS "orgId",o.name AS "orgName",r.role,
         o.setup_pending AND r.role='admin' AS "setupPending",o.demo
       FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id AND r.role<>'student'
       JOIN amp_orgs o ON o.id=r.org_id AND (o.kind<>'family' OR o.created_by<>$1)
       WHERE p.account_id=$1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")}
       ORDER BY o.id,array_position(ARRAY['admin','teacher','aide','viewer'],r.role)`,
          [accountId],
        )
        .catch(missing("42P01")),
      // The family's class, which `families.summary` above keeps current. It's
      // this account's family side, so it isn't among the places above; a
      // co-teacher from another account finds it there.
      familyClassOf(pool, accountId),
      // A link from another family's teacher this parent opened and hasn't
      // approved yet: after consent, approving is the next step.
      pendingApprovalOf(pool, accountId),
      // Families this account is the second parent of, with their children.
      isSchoolAccount(accountId)
        ? Promise.resolve([])
        : secondParentFamilies(pool, accountId).catch(
            (error: { code?: string }) => {
              if (error.code === "42P01" || error.code === "42703") return [];
              throw error;
            },
          ),
    ]);
  const secondParentOf = await Promise.all(
    coParented.map(async ({ holder, ...place }) => ({
      ...place,
      learners: childEntries(await families.summary(holder)),
    })),
  );
  const adultPractice = {
    eligible: adult ? adult.canPractice === true : true,
    learner: adult
      ? {
          id: adult.id,
          name: adult.name,
          active: adult.canPractice === true,
        }
      : null,
  };
  const staffOf = staffRows.rows.map(({ setupPending, demo, ...place }) => ({
    ...place,
    // Only an admin finishes setup, so only theirs says so.
    ...(setupPending ? { setupPending: true as const } : {}),
    ...(demo ? { demo: true as const } : {}),
  }));
  const value = {
    signedIn: true as const,
    account: {
      id: accountId,
      email,
      emailVerified,
      confirmationRequired: !emailVerified && !families.development,
    },
    consent: {
      status: active
        ? ("active" as const)
        : family.consent.status === "withdrawn"
          ? ("withdrawn" as const)
          : ("none" as const),
      method: record?.verification_method ?? null,
    },
    learners,
    family,
    ...(staffOf.length ? { staffOf } : {}),
    ...(familyClass ? { familyClass } : {}),
    ...(familyApproval ? { familyApproval } : {}),
    ...(secondParentOf.length ? { secondParentOf } : {}),
    ...(adultPractice ? { adultPractice } : {}),
    ...(gift ? { availableAccessGrant: gift } : {}),
    ...(unassigned
      ? {
          unassignedPurchase: {
            id: unassigned.id,
            interval: unassigned.billing_interval,
            endsAt: unassigned.ends_at.toISOString(),
          },
        }
      : {}),
    // A place to open: the family's children or class, the adult's own
    // practice, or a school. Without one, the account answers the starter
    // (another family's approval link it opened is not a place: the first
    // run opens it first). A paid purchase no learner holds yet goes to a
    // learner first.
    next:
      gift && !unassigned
        ? "accept-gift"
        : active && unassigned
          ? "add-learner"
          : learners.length || adult || familyClass || staffOf.length
            ? "practice"
            : "start",
  };
  return meSchema.parse(value) as SignedInMe;
}
