import { z } from "zod";
import type { Pool, PoolClient } from "pg";
import { FamilyError } from "../family/contracts.js";
import { isSchoolAccount } from "../schools/principal.js";

const part = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value))
  .nullable();
export const profileInput = z.strictObject({
  givenName: part,
  familyName: part,
});
export type AdultProfile = {
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
};
type Database = Pick<PoolClient, "query">;
/** Legacy role labels are not people's names. Never infer a name from email. */
export const realAdultName = (name: string | null | undefined) => {
  const value = name?.trim();
  return value && !/^(parent|teacher|adult|me|staff)$/i.test(value)
    ? value
    : null;
};
export async function accountProfile(
  db: Database,
  account: string,
): Promise<AdultProfile> {
  const exists = (
    await db.query(
      "SELECT to_regclass('amp_account_profiles') AS profile,to_regclass('amp_auth_users') AS auth",
    )
  ).rows[0];
  const profile = exists.profile
    ? (
        await db.query(
          "SELECT given_name,family_name FROM amp_account_profiles WHERE account_id=$1",
          [account],
        )
      ).rows[0]
    : null;
  if (profile)
    return {
      givenName: profile.given_name,
      familyName: profile.family_name,
      displayName:
        [profile.given_name, profile.family_name].filter(Boolean).join(" ") ||
        null,
    };
  const name =
    account.startsWith("amp|") && exists.auth
      ? realAdultName(
          (
            await db.query("SELECT name FROM amp_auth_users WHERE id=$1", [
              account.slice(4),
            ])
          ).rows[0]?.name,
        )
      : null;
  // A provider's full name is usable as supplied, but does not establish how
  // that person divides it into given and family names.
  return { givenName: null, familyName: null, displayName: name };
}
export async function setAccountProfile(
  pool: Pool,
  account: string,
  input: z.infer<typeof profileInput>,
) {
  if (isSchoolAccount(account) || account.startsWith("trial:"))
    throw new FamilyError(403, "adult_account_required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      account,
    ]);
    if (
      (
        await client.query(
          "SELECT 1 FROM amp_account_deletions WHERE account_id=$1",
          [account],
        )
      ).rowCount
    )
      throw new FamilyError(404, "account_not_found");
    await client.query(
      `INSERT INTO amp_account_profiles(account_id,given_name,family_name) VALUES($1,$2,$3)
      ON CONFLICT(account_id) DO UPDATE SET given_name=$2,family_name=$3,updated_at=now()`,
      [account, input.givenName, input.familyName],
    );
    const display = [input.givenName, input.familyName]
      .filter(Boolean)
      .join(" ");
    if (account.startsWith("amp|"))
      await client.query(
        'UPDATE amp_auth_users SET name=$2,"updatedAt"=now() WHERE id=$1',
        [account.slice(4), display],
      );
    // Roster storage requires a given_name; public adult payloads resolve the
    // canonical nullable profile, including an explicitly cleared name.
    await client.query(
      "UPDATE amp_people SET given_name=$2,family_name=$3 WHERE account_id=$1 AND deleted_at IS NULL",
      [account, input.givenName ?? "Staff", input.familyName],
    );
    await client.query(
      "UPDATE amp_learners SET name=$2 WHERE account_id=$1 AND adult AND NOT simulation AND deleted_at IS NULL",
      [account, display || "Me"],
    );
    await client.query("COMMIT");
    return accountProfile(pool, account);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
/** One SQL expression for payloads that already select an adult roster row. */
export const adultNameSql = (person = "p") => `CASE
  WHEN EXISTS(SELECT 1 FROM amp_account_profiles ap WHERE ap.account_id=${person}.account_id)
  THEN (SELECT NULLIF(concat_ws(' ',ap.given_name,ap.family_name),'') FROM amp_account_profiles ap WHERE ap.account_id=${person}.account_id)
  ELSE NULLIF(CASE WHEN lower(trim(concat_ws(' ',${person}.given_name,${person}.family_name))) IN ('parent','teacher','adult','me','staff') OR (${person}.email IS NOT NULL AND ${person}.given_name=split_part(${person}.email,'@',1) AND ${person}.family_name IS NULL) THEN '' ELSE trim(concat_ws(' ',${person}.given_name,${person}.family_name)) END,'') END`;
