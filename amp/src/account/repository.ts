import type { Pool } from "pg";
import { meSchema, type SignedInMe } from "./contracts.js";
import type { FamilyRepository } from "../family/repository.js";
/** One authenticated account snapshot. No trial capability or child draft is stored here. */
export async function accountSummary(
  pool: Pool,
  families: FamilyRepository,
  accountId: string,
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
    next:
      !emailVerified && !families.development
        ? "verify-email"
        : !active
          ? "choose-plan"
          : !learners.length
            ? "add-learner"
            : learners.some((l) => l.entitlement.active)
              ? "practice"
              : "choose-plan",
  };
  return meSchema.parse(value) as SignedInMe;
}
