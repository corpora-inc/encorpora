import { availableGift } from "../access-grants/repository.js";
import type { Pool } from "pg";
import { meSchema, type SignedInMe } from "./contracts.js";
import type { FamilyRepository } from "../family/repository.js";
import { activeToday } from "../schools/principal.js";
import { adultPracticeEnd } from "./adult-access.js";
/** One authenticated account snapshot. No trial capability or child draft is stored here. */
export async function accountSummary(
  pool: Pool,
  families: FamilyRepository,
  accountId: string,
  /** The configured Stripe namespace; without billing no purchase is offered. */
  billingNamespace: string | null = null,
): Promise<SignedInMe> {
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
  const learners = family.learners
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
        entitlement: {
          active: l.canPractice === true,
          plan: grant?.channel ?? null,
          endsAt: grant?.endsAt ?? null,
        },
      };
    });
  const gift = await availableGift(pool, accountId);
  // Both in parallel. A fixture at an earlier migration boundary has no
  // schools, or trials without owners, and reads as none: no extra round trip
  // to check first on the path every parent's `/me` takes.
  const missing =
    (...codes: string[]) =>
    (error: { code?: string }) => {
      if (error.code && codes.includes(error.code)) return { rows: [] };
      throw error;
    };
  const [staffRows, trialRows, adultEnds] = await Promise.all([
    pool
      .query<{
        orgId: string;
        orgName: string;
        role: string;
        setupPending: boolean;
      }>(
        `SELECT DISTINCT ON (o.id) o.id AS "orgId",o.name AS "orgName",r.role,
         o.setup_pending AND r.role='admin' AS "setupPending"
       FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id AND r.role<>'student'
       JOIN amp_orgs o ON o.id=r.org_id
       WHERE p.account_id=$1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")}
       ORDER BY o.id,array_position(ARRAY['admin','teacher','aide','viewer'],r.role)`,
        [accountId],
      )
      .catch(missing("42P01")),
    // A free assessment this account started and hasn't made a learner yet.
    pool
      .query(
        `SELECT 1 FROM amp_trials WHERE owner_account_id=$1 AND adopted_at IS NULL AND expires_at>now() LIMIT 1`,
        [accountId],
      )
      .catch(missing("42P01", "42703")),
    // Without their own learner yet, whether this adult may start one. With
    // one, its refreshed grant already says.
    adult
      ? null
      : adultPracticeEnd(pool, accountId).catch((error: { code?: string }) => {
          if (error.code === "42P01" || error.code === "42703") return null;
          throw error;
        }),
  ]);
  const adultPractice =
    adult || adultEnds
      ? {
          eligible: adult ? adult.canPractice === true : true,
          learner: adult
            ? {
                id: adult.id,
                name: adult.name,
                active: adult.canPractice === true,
              }
            : null,
        }
      : null;
  const staffOf = staffRows.rows.map(({ setupPending, ...place }) => ({
    ...place,
    // Only an admin finishes setup, so only theirs says so.
    ...(setupPending ? { setupPending: true as const } : {}),
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
    ...(trialRows.rows.length ? { trial: true as const } : {}),
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
    // Purchase-first enrollment: plan and payment (the verified consent) come
    // before any learner profile; a paid, unassigned purchase resumes there.
    // An unconfirmed address does not block the trial; the consent steps ask
    // for it (`confirmationRequired`), and the server refuses them without it.
    next:
      gift && !unassigned
        ? "accept-gift"
        : !active
          ? family.consent.status === "withdrawn"
            ? "choose-plan"
            : "try"
          : learners.some((l) => l.entitlement.active)
            ? "practice"
            : unassigned || !learners.length
              ? "add-learner"
              : "choose-plan",
  };
  return meSchema.parse(value) as SignedInMe;
}
