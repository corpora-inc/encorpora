import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  learningConsentActive,
  lockLearningAccount,
} from "../server/account-access.js";
import { AccessGiftError, issueGiftSchema } from "./contracts.js";

type Database = Pool | PoolClient;
/** Only the authenticated identity store supplies the recipient, never a request body. */
async function verifiedEmail(db: Database, accountId: string) {
  if (!accountId.startsWith("amp|")) return null;
  if (
    !(await db.query("SELECT to_regclass('amp_auth_users') AS relation"))
      .rows[0].relation
  )
    return null;
  const row = (
    await db.query(
      'SELECT lower(btrim(email)) AS email FROM amp_auth_users WHERE id=$1 AND "emailVerified"=true FOR SHARE',
      [accountId.slice(4)],
    )
  ).rows[0];
  return (row?.email as string | undefined) ?? null;
}
async function installed(db: Database) {
  return !!(
    await db.query("SELECT to_regclass('amp_access_gifts') AS relation")
  ).rows[0].relation;
}
export async function availableGift(db: Database, accountId: string) {
  if (!(await installed(db))) return undefined;
  const email = await verifiedEmail(db, accountId);
  if (!email) return undefined;
  const row = (
    await db.query(
      `SELECT id,months,claim_by FROM amp_access_gifts WHERE recipient_email=$1
     AND activated_at IS NULL AND revoked_at IS NULL AND (claim_by IS NULL OR claim_by>now())
     ORDER BY issued_at,id LIMIT 1`,
      [email],
    )
  ).rows[0];
  return row
    ? {
        id: row.id as string,
        months: row.months as 1 | 12,
        claimBy: row.claim_by?.toISOString() ?? null,
      }
    : undefined;
}

/** Calendar months in UTC, clamped to the last day of the destination month. */
export function giftEnd(start: Date, months: number) {
  const end = new Date(start);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();
  end.setUTCDate(Math.min(start.getUTCDate(), last));
  return end;
}

/** Caller holds the account lock in a transaction. Also used by learner creation/adoption. */
export async function activateGiftInTransaction(
  db: PoolClient,
  accountId: string,
  learnerId: string,
  options: { giftId?: string; development?: boolean } = {},
) {
  if (!(await installed(db))) {
    if (options.giftId) throw new AccessGiftError(404, "gift_unavailable");
    return null;
  }
  const email = await verifiedEmail(db, accountId);
  if (!email) {
    if (options.giftId) throw new AccessGiftError(403, "email_unconfirmed");
    return null;
  }
  if (!(await learningConsentActive(db, accountId, options.development)))
    throw new AccessGiftError(403, "consent_required");
  const learner = await db.query(
    "SELECT id FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE",
    [learnerId, accountId],
  );
  if (!learner.rowCount)
    throw new AccessGiftError(404, "gift_learner_unavailable");
  // Do not consume a gift while assigning a paid enrollment to this learner.
  if (
    !options.giftId &&
    (
      await db.query(
        "SELECT to_regclass('amp_account_entitlements') AS relation",
      )
    ).rows[0].relation
  ) {
    const paid = await db.query(
      `SELECT 1 FROM amp_stripe_checkouts c JOIN amp_account_entitlements e ON e.checkout_id=c.id AND e.namespace=c.namespace
       WHERE c.account_id=$1 AND c.learner_id IS NULL AND c.assigned_learner_id IS NULL
       AND e.status='active' AND e.ends_at>now()
       AND NOT EXISTS(SELECT 1 FROM amp_enrollment_cancellations x WHERE x.checkout_id=c.id) LIMIT 1`,
      [accountId],
    );
    if (paid.rowCount) return null;
  }
  const gift = (
    await db.query(
      options.giftId
        ? "SELECT * FROM amp_access_gifts WHERE id=$1 AND (recipient_email=$2 OR account_id=$3) FOR UPDATE"
        : `SELECT * FROM amp_access_gifts WHERE recipient_email=$1 AND activated_at IS NULL AND revoked_at IS NULL
         AND (claim_by IS NULL OR claim_by>now()) ORDER BY issued_at,id LIMIT 1 FOR UPDATE`,
      options.giftId ? [options.giftId, email, accountId] : [email],
    )
  ).rows[0];
  if (!gift) {
    if (options.giftId) throw new AccessGiftError(404, "gift_unavailable");
    return null;
  }
  if (gift.revoked_at) throw new AccessGiftError(409, "gift_unavailable");
  if (gift.activated_at) {
    if (
      gift.account_id !== accountId ||
      gift.learner_id !== learnerId ||
      !gift.grant_id
    )
      throw new AccessGiftError(409, "gift_already_assigned");
    return {
      id: gift.id,
      learnerId,
      startsAt: gift.activated_at.toISOString(),
      endsAt: gift.ends_at.toISOString(),
    };
  }
  const now = new Date();
  if (gift.claim_by && gift.claim_by <= now)
    throw new AccessGiftError(409, "gift_unavailable");
  // Future paid terms also reserve this learner; gifts neither replace nor stack on subscriptions.
  const licensed = await db.query(
    "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND ends_at>now() LIMIT 1",
    [learnerId],
  );
  const stripeLinked = (
    await db.query("SELECT to_regclass('amp_stripe_checkouts') AS relation")
  ).rows[0].relation
    ? await db.query(
        "SELECT 1 FROM amp_stripe_checkouts WHERE account_id=$1 AND (learner_id=$2 OR assigned_learner_id=$2) AND NOT closed LIMIT 1",
        [accountId, learnerId],
      )
    : null;
  if (licensed.rowCount || stripeLinked?.rowCount) {
    if (options.giftId)
      throw new AccessGiftError(409, "learner_already_licensed");
    return null;
  }
  const ends = giftEnd(now, gift.months);
  const grantId = `email-gift:${gift.id}`;
  await db.query(
    `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
     VALUES($1,$2,'pilot',$1,'active',$3,$4)`,
    [grantId, learnerId, now, ends],
  );
  await db.query(
    `UPDATE amp_access_gifts SET account_id=$2,learner_id=$3,grant_id=$4,activated_at=$5,ends_at=$6 WHERE id=$1`,
    [gift.id, accountId, learnerId, grantId, now, ends],
  );
  return {
    id: gift.id,
    learnerId,
    startsAt: now.toISOString(),
    endsAt: ends.toISOString(),
  };
}

export class AccessGiftRepository {
  constructor(
    private pool: Pool,
    private development = false,
  ) {}
  private async transaction<T>(run: (db: PoolClient) => Promise<T>) {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      const result = await run(db);
      await db.query("COMMIT");
      return result;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }
  async activate(accountId: string, giftId: string, learnerId: string) {
    return this.transaction(async (db) => {
      await lockLearningAccount(db, accountId);
      return activateGiftInTransaction(db, accountId, learnerId, {
        giftId,
        development: this.development,
      });
    });
  }
  /** Operator-only. A stable award reference makes imports safe to retry. */
  async issue(input: unknown) {
    const value = issueGiftSchema.parse(input);
    return this.transaction(async (db) => {
      await db.query(
        `INSERT INTO amp_access_gifts(id,recipient_email,months,source,reference,campaign,claim_by)
         VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source,reference) DO NOTHING`,
        [
          randomUUID(),
          value.email,
          value.months,
          value.source,
          value.reference,
          value.campaign ?? null,
          value.claimBy ?? null,
        ],
      );
      const row = (
        await db.query(
          "SELECT * FROM amp_access_gifts WHERE source=$1 AND reference=$2",
          [value.source, value.reference],
        )
      ).rows[0];
      if (
        row.recipient_email !== value.email ||
        row.months !== value.months ||
        row.campaign !== (value.campaign ?? null) ||
        (row.claim_by?.toISOString() ?? null) !==
          (value.claimBy ? new Date(value.claimBy).toISOString() : null)
      )
        throw new AccessGiftError(409, "gift_reference_conflict");
      return {
        id: row.id as string,
        status: row.revoked_at
          ? "revoked"
          : row.activated_at
            ? "activated"
            : "reserved",
      };
    });
  }
  async revoke(id: string) {
    // Account before gift before grant, matching the privacy deletion order.
    // A pending gift can become bound while we acquire locks; retry once with
    // that immutable account binding rather than invert the lock order.
    for (;;) {
      const result = await this.transaction(async (db) => {
        const owner = (
          await db.query(
            "SELECT account_id FROM amp_access_gifts WHERE id=$1",
            [id],
          )
        ).rows[0];
        if (!owner) throw new AccessGiftError(404, "gift_unavailable");
        if (owner.account_id) await lockLearningAccount(db, owner.account_id);
        const gift = (
          await db.query(
            "SELECT account_id,grant_id FROM amp_access_gifts WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (gift.account_id !== owner.account_id) return null;
        await db.query(
          "UPDATE amp_access_gifts SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1",
          [id],
        );
        if (gift.grant_id)
          await db.query("UPDATE amp_grants SET status='revoked' WHERE id=$1", [
            gift.grant_id,
          ]);
        return { id, status: "revoked" };
      });
      if (result) return result;
    }
  }
}
