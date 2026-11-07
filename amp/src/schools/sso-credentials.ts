import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { SsoProvider } from "./contracts.js";

type Database = Pick<PoolClient, "query">;

/** How an outside sign-in finds its credential: the provider, the tenant and the
 * address, hashed, so the table holds no address and one tenant's credential can
 * never answer in another. `sso_lookup_sql` below must agree. */
export const ssoLookupHash = (
  provider: SsoProvider,
  tenantId: string,
  email: string,
) =>
  createHash("sha256")
    .update(`sso:${provider}:${tenantId}:${email.toLowerCase()}`)
    .digest("hex");

/** Brings a tenant's `sso` credentials in line with its roster and what each
 * school has turned on. A student gets one for each provider their school has on,
 * if they have an email address no other student in the tenant shares. Everything
 * else is revoked. Safe to run any time, and the caller's transaction holds it. */
export async function syncSsoCredentials(
  client: Database,
  tenantId: string,
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `school-sso:${tenantId}`,
  ]);
  await client.query(
    `WITH student AS (
       SELECT DISTINCT p.id,lower(p.email) AS email,o.sign_in_providers AS providers
       FROM amp_people p
       JOIN amp_org_roles r ON r.person_id=p.id AND r.role='student'
       JOIN amp_orgs o ON o.id=r.org_id
       WHERE p.tenant_id=$1 AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL AND p.email IS NOT NULL
         AND r.begin_on<=(now() AT TIME ZONE o.timezone)::date
         AND (r.end_on IS NULL OR r.end_on>(now() AT TIME ZONE o.timezone)::date)
     ), shared AS (
       SELECT email FROM student GROUP BY email HAVING count(DISTINCT id)>1
     ), wanted AS (
       SELECT s.id AS person_id,
         encode(sha256(convert_to('sso:'||provider||':'||$1::text||':'||s.email,'UTF8')),'hex') AS lookup_hash
       FROM student s CROSS JOIN LATERAL unnest(s.providers) AS provider
       WHERE s.email NOT IN (SELECT email FROM shared)
     ), revoked AS (
       UPDATE amp_person_credentials k SET revoked_at=now() FROM amp_people p
       WHERE p.id=k.person_id AND p.tenant_id=$1 AND k.kind='sso' AND k.revoked_at IS NULL
         AND NOT EXISTS(SELECT 1 FROM wanted w WHERE w.person_id=k.person_id AND w.lookup_hash=k.lookup_hash)
     )
     INSERT INTO amp_person_credentials(id,person_id,kind,lookup_hash)
     SELECT gen_random_uuid(),w.person_id,'sso',w.lookup_hash FROM wanted w
     WHERE NOT EXISTS(SELECT 1 FROM amp_person_credentials k
       WHERE k.person_id=w.person_id AND k.kind='sso' AND k.lookup_hash=w.lookup_hash AND k.revoked_at IS NULL)`,
    [tenantId],
  );
}
