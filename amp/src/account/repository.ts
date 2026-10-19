import type { Pool } from "pg";
import { meSchema, type SignedInMe } from "./contracts.js";
import type { FamilyRepository } from "../family/repository.js";
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
  const learners = family.learners
    .filter((l) => !l.deletedAt)
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
  const value = {
    signedIn: true as const,
    account: { id: accountId, email, emailVerified },
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
    next:
      !emailVerified && !families.development
        ? "verify-email"
        : !active
          ? "choose-plan"
          : learners.some((l) => l.entitlement.active)
            ? "practice"
            : unassigned || !learners.length
              ? "add-learner"
              : "choose-plan",
  };
  return meSchema.parse(value) as SignedInMe;
}
