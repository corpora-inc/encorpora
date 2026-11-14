import type { PoolClient } from "pg";
import type { CleverEnvironment } from "./model.js";

export type CleverPerson = {
  connectionId: string;
  tenantId: string;
  personId: string;
  accountId: string | null;
  learnerId: string | null;
  roles: string[];
};
/** Source IDs are the only automatic login match. Email is not verified by
 * Clever and cannot attach a person to an existing AMP account. */
export async function resolveCleverPerson(
  db: Pick<PoolClient, "query">,
  input: { environment: CleverEnvironment; districtId: string; userId: string },
): Promise<CleverPerson | null> {
  const result = await db.query(
    `SELECT c.id AS connection_id,c.tenant_id,
    p.id AS person_id,p.account_id,p.learner_id,b.metadata->'roles' AS roles
    FROM amp_clever_connections c JOIN amp_clever_bindings b ON b.connection_id=c.id
    JOIN amp_people p ON p.id=b.local_id AND p.tenant_id=c.tenant_id
    WHERE c.environment=$1 AND c.district_id=$2 AND c.status='active'
      AND b.kind='user' AND b.clever_id=$3 AND b.archived_at IS NULL AND p.deleted_at IS NULL`,
    [input.environment, input.districtId, input.userId],
  );
  const row = result.rows[0];
  return row
    ? {
        connectionId: row.connection_id,
        tenantId: row.tenant_id,
        personId: row.person_id,
        accountId: row.account_id,
        learnerId: row.learner_id,
        roles: row.roles ?? [],
      }
    : null;
}
