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
