import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

/** Called under the account/family transaction. No class or enrollment is made. */
export async function ensureFamilyIdentity(
  db: Pick<PoolClient, "query">,
  account: string,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO amp_family_spaces(account_id,id)
     VALUES($1,COALESCE((SELECT org_id FROM amp_families WHERE account_id=$1),$2::uuid))
     ON CONFLICT(account_id) DO UPDATE SET account_id=excluded.account_id RETURNING id`,
    [account, randomUUID()],
  );
  return result.rows[0]!.id;
}

/** Profile names are authoritative, including an explicitly cleared name. */
export const holderDisplayNameSql = (account: string) => `CASE
  WHEN EXISTS(SELECT 1 FROM amp_account_profiles ap WHERE ap.account_id=${account})
  THEN (SELECT NULLIF(concat_ws(' ',ap.given_name,ap.family_name),'') FROM amp_account_profiles ap WHERE ap.account_id=${account})
  ELSE (SELECT CASE WHEN lower(trim(u.name)) IN ('parent','teacher','adult','me','staff') THEN NULL ELSE NULLIF(trim(u.name),'') END FROM amp_auth_users u WHERE u.id=substring(${account} from 5) AND ${account} LIKE 'amp|%') END`;

/** Old generated org labels are storage defaults, not explicit family names.
 * A saved explicit name takes precedence, even when it resembles a default. */
export const familyDisplayNameSql = (account: string, org = "o") => `COALESCE(
  (SELECT display_name FROM amp_family_spaces WHERE account_id=${account}),
  CASE WHEN ${org}.name <> 'Our family' AND ${org}.name NOT LIKE '%’s family' THEN ${org}.name END,
  (SELECT ap.family_name||' family' FROM amp_account_profiles ap WHERE ap.account_id=${account}))`;
