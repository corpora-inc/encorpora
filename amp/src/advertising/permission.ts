import { RETENTION } from "../privacy/retention-periods.js";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Authenticator } from "../server/auth.js";
import {
  AdvertisingPermissionError,
  PURCHASE_MEASUREMENT_NOTICE,
  advertisingOptOut,
  permissionChangeSchema,
  type PurchaseMeasurement,
} from "./permission-contracts.js";

async function installed(client: PoolClient) {
  return !!(
    await client.query(
      "SELECT to_regclass('amp_advertising_permissions') AS relation",
    )
  ).rows[0]?.relation;
}
/** Unlike learning's legacy identity fallback, advertising requires an actual
 * confirmed AMP account email. Missing tables and external identities fail closed. */
export async function confirmedAdvertisingEmail(
  client: PoolClient,
  account: string,
): Promise<string | null> {
  if (
    !account.startsWith("amp|") ||
    !(await client.query("SELECT to_regclass('amp_auth_users') AS relation"))
      .rows[0]?.relation
  )
    return null;
  const row = (
    await client.query(
      'SELECT email,"emailVerified" FROM amp_auth_users WHERE id=$1 FOR SHARE',
      [account.slice(4)],
    )
  ).rows[0];
  return row?.emailVerified === true && typeof row.email === "string"
    ? row.email
    : null;
}
const fingerprint = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
/** Caller holds the account lock. The digest binds permission to the address
 * shown at grant time; it is never the provider payload or a learner identifier. */
export async function purchaseMeasurementView(
  client: PoolClient,
  account: string,
): Promise<PurchaseMeasurement> {
  const available = await installed(client);
  const email = available
    ? await confirmedAdvertisingEmail(client, account)
    : null;
  const row = available
    ? (
        await client.query(
          "SELECT *,expires_at>clock_timestamp() AS current FROM amp_advertising_permissions WHERE account_id=$1",
          [account],
        )
      ).rows[0]
    : null;
  const status =
    !row || row.withdrawn_at
      ? "off"
      : !row.current
        ? "expired"
        : !email ||
            row.email_digest !== fingerprint(email) ||
            row.notice_version !== PURCHASE_MEASUREMENT_NOTICE.version
          ? "review-required"
          : "active";
  return {
    available,
    eligible: !!email,
    status,
    revision: row?.revision ?? null,
    // Shipped v1 browsers require this literal to parse the whole /me snapshot.
    noticeVersion: "google-adult-purchase-v1",
    currentNoticeVersion: PURCHASE_MEASUREMENT_NOTICE.version,
    grantedAt: row?.granted_at?.toISOString() ?? null,
    expiresAt: row?.expires_at?.toISOString() ?? null,
  };
}
/** Must hold the exclusive account privacy lock, also used by future dispatchers.
 * Repeated withdrawal is a no-op. A new tombstone prevents an older form
 * with no revision from overriding a newly received privacy signal. */
export async function revokeAdvertisingPermission(
  client: PoolClient,
  account: string,
) {
  if (!(await installed(client))) return;
  if (
    (
      await client.query(
        "SELECT to_regclass('amp_google_purchase_queue') AS relation",
      )
    ).rows[0]?.relation
  )
    await client.query(
      "UPDATE amp_google_purchase_queue SET state='cancelled',cancellation_reason='withdrawn',hold_reason=NULL,updated_at=clock_timestamp() WHERE account_id=$1 AND state IN ('ready','held')",
      [account],
    );
  await client.query(
    `INSERT INTO amp_advertising_permissions(account_id,revision,notice_version,adult_attested,withdrawn_at)
    VALUES($1,$2,$3,false,clock_timestamp()) ON CONFLICT(account_id) DO UPDATE SET withdrawn_at=clock_timestamp(),email_digest=NULL,revision=$2 WHERE amp_advertising_permissions.withdrawn_at IS NULL`,
    [account, randomUUID(), PURCHASE_MEASUREMENT_NOTICE.version],
  );
}
async function transaction<T>(
  pool: Pool,
  account: string,
  action: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      account,
    ]);
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function changeAdvertisingPermission(
  pool: Pool,
  account: string,
  input: unknown,
  optedOut = false,
) {
  const change = permissionChangeSchema.parse(input);
  return transaction(pool, account, async (client) => {
    if (!(await installed(client)))
      throw new AdvertisingPermissionError(
        503,
        "purchase_measurement_unavailable",
      );
    if (change.action === "withdraw" || optedOut) {
      await revokeAdvertisingPermission(client, account);
      return purchaseMeasurementView(client, account);
    }
    const current = await purchaseMeasurementView(client, account);
    const email = await confirmedAdvertisingEmail(client, account);
    if (!email)
      throw new AdvertisingPermissionError(
        403,
        "purchase_measurement_email_required",
      );
    if (current.revision !== change.revision)
      throw new AdvertisingPermissionError(409, "purchase_measurement_changed");
    if (current.status === "active") return current;
    await client.query(
      `INSERT INTO amp_advertising_permissions(account_id,revision,notice_version,adult_attested,email_digest,granted_at,expires_at)
      VALUES($1,$2,$3,true,$4,statement_timestamp(),statement_timestamp()+interval '365 days')
      ON CONFLICT(account_id) DO UPDATE SET revision=EXCLUDED.revision,notice_version=EXCLUDED.notice_version,adult_attested=true,email_digest=EXCLUDED.email_digest,granted_at=EXCLUDED.granted_at,expires_at=EXCLUDED.expires_at,withdrawn_at=NULL`,
      [
        account,
        randomUUID(),
        PURCHASE_MEASUREMENT_NOTICE.version,
        fingerprint(email),
      ],
    );
    return purchaseMeasurementView(client, account);
  });
}
/** Wrap the common authenticator so GPC/DNT received on any authenticated API
 * request persistently stops purchase sharing. Absence never restores permission. */
export function withAdvertisingPrivacySignals(
  pool: Pool,
  authenticate: Authenticator,
): Authenticator {
  return async (request) => {
    const account = await authenticate(request);
    if (advertisingOptOut(request.headers))
      await transaction(pool, account, (client) =>
        revokeAdvertisingPermission(client, account),
      );
    return account;
  };
}
/** Called by the privacy worker. No event, payload or email is exported. */
export async function purgeAdvertisingPermissions(pool: Pool) {
  const result = await pool.query(
    "DELETE FROM amp_advertising_permissions WHERE COALESCE(withdrawn_at,expires_at)<clock_timestamp()-($1::int * interval '1 day')",
    [RETENTION.advertisingPermissionDays],
  );
  return result.rowCount ?? 0;
}
