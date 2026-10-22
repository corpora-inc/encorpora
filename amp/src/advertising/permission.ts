import { RETENTION } from "../privacy/retention-periods.js";
import { eraseAccountAdClicks } from "./click-evidence.js";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Authenticator } from "../server/auth.js";
import {
  AdvertisingPermissionError,
  measurementNotice,
  metaPermissionChangeSchema,
  type AdvertisingProvider,
  advertisingOptOut,
  permissionChangeSchema,
  type PurchaseMeasurement,
} from "./permission-contracts.js";

// SQL identifiers come only from this closed mapping, never request input.
function permissionTable(provider: AdvertisingProvider) {
  switch (provider) {
    case "google":
      return "amp_advertising_permissions";
    case "meta":
      return "amp_meta_advertising_permissions";
    default:
      throw new Error("Unsupported advertising provider");
  }
}
async function installed(
  client: PoolClient | Pool,
  provider: AdvertisingProvider,
) {
  return !!(
    await client.query("SELECT to_regclass($1) AS relation", [
      permissionTable(provider),
    ])
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
  provider: AdvertisingProvider = "google",
): Promise<PurchaseMeasurement> {
  const notice = measurementNotice(provider);
  const available = await installed(client, provider);
  const email = available
    ? await confirmedAdvertisingEmail(client, account)
    : null;
  const row = available
    ? (
        await client.query(
          `SELECT *,expires_at>clock_timestamp() AS current FROM ${permissionTable(provider)} WHERE account_id=$1`,
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
            row.notice_version !== notice.version
          ? "review-required"
          : "active";
  return {
    available,
    eligible: !!email,
    status,
    revision: row?.revision ?? null,
    // Shipped v1 browsers require this literal to parse the whole /me snapshot.
    noticeVersion:
      provider === "google" ? "google-adult-purchase-v1" : notice.version,
    currentNoticeVersion: notice.version,
    grantedAt: row?.granted_at?.toISOString() ?? null,
    expiresAt: row?.expires_at?.toISOString() ?? null,
  };
}
/** Must hold the exclusive account privacy lock, also used by purchase delivery.
 * Repeated withdrawal is a no-op. A new tombstone prevents an older form
 * with no revision from overriding a newly received privacy signal. */
export async function revokeAdvertisingPermission(
  client: PoolClient,
  account: string,
  provider?: AdvertisingProvider,
) {
  // Global privacy/learning withdrawals revoke both. An explicit provider
  // preference changes only that recipient.
  for (const recipient of provider
    ? [provider]
    : (["google", "meta"] as const)) {
    if (!(await installed(client, recipient))) continue;
    const table = permissionTable(recipient);
    if (
      (
        await client.query(
          "SELECT to_regclass('amp_ad_collection_withdrawals') AS relation",
        )
      ).rows[0]?.relation
    )
      await client.query(
        "INSERT INTO amp_ad_collection_withdrawals(account_id,provider) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [account, recipient],
      );
    if (
      (
        await client.query(
          "SELECT to_regclass('amp_ad_click_evidence') AS relation",
        )
      ).rows[0]?.relation
    )
      await eraseAccountAdClicks(client, account, recipient);
    if (
      recipient === "meta" &&
      (
        await client.query(
          "SELECT to_regclass('amp_meta_purchase_queue') AS relation",
        )
      ).rows[0]?.relation
    )
      await client.query(
        "UPDATE amp_meta_purchase_queue SET state='cancelled' WHERE account_id=$1 AND state='ready'",
        [account],
      );
    if (
      recipient === "meta" &&
      (
        await client.query(
          "SELECT to_regclass('amp_meta_purchase_contexts') AS relation",
        )
      ).rows[0]?.relation
    )
      await client.query(
        "DELETE FROM amp_meta_purchase_contexts WHERE account_id=$1",
        [account],
      );
    if (
      recipient === "google" &&
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
      `INSERT INTO ${table}(account_id,revision,notice_version,adult_attested,withdrawn_at)
      VALUES($1,$2,$3,false,clock_timestamp()) ON CONFLICT(account_id) DO UPDATE SET withdrawn_at=clock_timestamp(),email_digest=NULL,revision=$2 WHERE ${table}.withdrawn_at IS NULL`,
      [account, randomUUID(), measurementNotice(recipient).version],
    );
  }
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
  provider: AdvertisingProvider = "google",
) {
  const notice = measurementNotice(provider);
  const change = (
    provider === "meta" ? metaPermissionChangeSchema : permissionChangeSchema
  ).parse(input);
  return transaction(pool, account, async (client) => {
    if (!(await installed(client, provider)))
      throw new AdvertisingPermissionError(
        503,
        "purchase_measurement_unavailable",
      );
    if (change.action === "withdraw" || optedOut) {
      await revokeAdvertisingPermission(
        client,
        account,
        optedOut ? undefined : provider,
      );
      return purchaseMeasurementView(client, account, provider);
    }
    const current = await purchaseMeasurementView(client, account, provider);
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
      `INSERT INTO ${permissionTable(provider)}(account_id,revision,notice_version,adult_attested,email_digest,granted_at,expires_at)
      VALUES($1,$2,$3,true,$4,statement_timestamp(),statement_timestamp()+interval '365 days')
      ON CONFLICT(account_id) DO UPDATE SET revision=EXCLUDED.revision,notice_version=EXCLUDED.notice_version,adult_attested=true,email_digest=EXCLUDED.email_digest,granted_at=EXCLUDED.granted_at,expires_at=EXCLUDED.expires_at,withdrawn_at=NULL`,
      [account, randomUUID(), notice.version, fingerprint(email)],
    );
    if (
      (
        await client.query(
          "SELECT to_regclass('amp_ad_collection_withdrawals') AS relation",
        )
      ).rows[0]?.relation
    )
      await client.query(
        "DELETE FROM amp_ad_collection_withdrawals WHERE account_id=$1 AND provider=$2",
        [account, provider],
      );
    return purchaseMeasurementView(client, account, provider);
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
  let deleted = 0;
  for (const provider of ["google", "meta"] as const) {
    if (!(await installed(pool, provider))) continue;
    const result = await pool.query(
      `DELETE FROM ${permissionTable(provider)} WHERE COALESCE(withdrawn_at,expires_at)<clock_timestamp()-($1::int * interval '1 day')`,
      [RETENTION.advertisingPermissionDays],
    );
    deleted += result.rowCount ?? 0;
  }
  return deleted;
}
