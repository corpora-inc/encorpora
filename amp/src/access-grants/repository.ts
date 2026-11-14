import { accessGrantsFor, grantReserved } from "../account/adult-access.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { refreshAdultAccess } from "../account/adult-access.js";
import {
  learningConsentActive,
  lockLearningAccount,
  purchaseConsentSatisfied,
} from "../server/account-access.js";
import { AccessGiftError, issueGiftSchema } from "./contracts.js";

type Database = Pool | PoolClient;
/** Only the authenticated identity store supplies the recipient, never a request body. */
async function verifiedEmail(db: Database, accountId: string, lock = true) {
  if (!accountId.startsWith("amp|")) return null;
  if (
    !(await db.query("SELECT to_regclass('amp_auth_users') AS relation"))
      .rows[0].relation
  )
    return null;
  const row = (
    await db.query(
      'SELECT lower(btrim(email)) AS email FROM amp_auth_users WHERE id=$1 AND "emailVerified"=true' +
        (lock ? " FOR SHARE" : ""),
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
  const email = await verifiedEmail(db, accountId, false);
  if (!email) return undefined;
  const row = (
    await db.query(
      `SELECT id,months,claim_by,covers FROM amp_access_gifts WHERE recipient_email=$1
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
        covers: row.covers as "learner" | "family",
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

/** Learning writers share the account lock, so this exclusive one orders an
 * account's gift activations, revocations and new children: a child added
 * while a family gift starts or ends is never missed. */
async function lockAccountGifts(db: PoolClient, accountId: string) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `access-gifts:${accountId}`,
  ]);
}
/** A learner gift has one grant; a family gift has one per child. */
const familyGrantId = (giftId: string, learnerId: string) =>
  `email-gift:${giftId}:${learnerId}`;
async function grantFamilyChild(
  db: PoolClient,
  accountId: string,
  giftId: string,
  learnerId: string,
  starts: Date | null,
  ends: Date,
) {
  // Retries are idempotent; a child's other grants are left as they are.
  await db.query(
    `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
     SELECT $1,id,'pilot',$1,'active',COALESCE($4,now()),$5 FROM amp_learners
     WHERE id=$2 AND account_id=$3 AND NOT adult AND deleted_at IS NULL
     ON CONFLICT DO NOTHING`,
    [familyGrantId(giftId, learnerId), learnerId, accountId, starts, ends],
  );
}
/** A parent practices free while a child has access (docs/families.md). */
async function refreshFamilyAdult(db: PoolClient, accountId: string) {
  const adult = (
    await db.query<{ id: string }>(
      "SELECT id FROM amp_learners WHERE account_id=$1 AND adult AND NOT simulation AND deleted_at IS NULL",
      [accountId],
    )
  ).rows[0];
  if (adult) await refreshAdultAccess(db, accountId, adult.id);
}
/** A paid enrollment waiting for its learner is assigned before any gift. */
async function paidAssignmentWaiting(db: PoolClient, accountId: string) {
  if (
    !(
      await db.query(
        "SELECT to_regclass('amp_account_entitlements') AS relation",
      )
    ).rows[0].relation
  )
    return false;
  return !!(
    await db.query(
      `SELECT 1 FROM amp_stripe_checkouts c JOIN amp_account_entitlements e ON e.checkout_id=c.id AND e.namespace=c.namespace
       WHERE c.account_id=$1 AND c.learner_id IS NULL AND c.assigned_learner_id IS NULL
       AND e.status='active' AND e.ends_at>now()
       AND NOT EXISTS(SELECT 1 FROM amp_enrollment_cancellations x WHERE x.checkout_id=c.id) LIMIT 1`,
      [accountId],
    )
  ).rowCount;
}

/** A child who joins an account while its family gift is in force is covered
 * to that gift's end, in the transaction that adds them. The account owns an
 * activated gift, so its address no longer matters. The caller holds the
 * account lock and has checked consent. Null when no family gift is in force,
 * or while a paid enrollment waits for its learner. */
export async function coverWithFamilyGift(
  db: PoolClient,
  accountId: string,
  learnerId: string,
) {
  if (!(await installed(db))) return null;
  await lockAccountGifts(db, accountId);
  if (await paidAssignmentWaiting(db, accountId)) return null;
  return familyCover(db, accountId, learnerId);
}
async function familyCover(
  db: PoolClient,
  accountId: string,
  learnerId: string,
) {
  const gifts = (
    await db.query<{ id: string; activated_at: Date; ends_at: Date }>(
      `SELECT id,activated_at,ends_at FROM amp_access_gifts WHERE account_id=$1 AND covers='family'
       AND activated_at IS NOT NULL AND revoked_at IS NULL AND ends_at>now() ORDER BY ends_at DESC,id`,
      [accountId],
    )
  ).rows;
  // Each gift in force, so revoking one leaves the others' cover.
  for (const gift of gifts)
    await grantFamilyChild(
      db,
      accountId,
      gift.id,
      learnerId,
      null,
      gift.ends_at,
    );
  if (!gifts[0]) return null;
  await refreshFamilyAdult(db, accountId);
  return {
    id: gifts[0].id,
    learnerId,
    startsAt: gifts[0].activated_at.toISOString(),
    endsAt: gifts[0].ends_at.toISOString(),
  };
}

/** Grants every live child of the account and the parent's own practice. The
 * gift records the learner it was activated for (the first child when none
 * was chosen) and that learner's grant. */
async function activateFamilyGift(
  db: PoolClient,
  accountId: string,
  gift: { id: string; months: number },
  learnerId: string | undefined,
) {
  const children = (
    await db.query<{ id: string }>(
      "SELECT id FROM amp_learners WHERE account_id=$1 AND NOT adult AND deleted_at IS NULL ORDER BY created_at,id FOR UPDATE",
      [accountId],
    )
  ).rows.map((row) => row.id);
  if (!children.length)
    throw new AccessGiftError(409, "family_learner_required");
  const first =
    learnerId && children.includes(learnerId) ? learnerId : children[0]!;
  // The transaction's own time, so the parent's refresh below sees these
  // grants as started.
  const now = (await db.query<{ now: Date }>("SELECT now() AS now")).rows[0]!
    .now;
  const ends = giftEnd(now, gift.months);
  for (const child of children)
    await grantFamilyChild(db, accountId, gift.id, child, now, ends);
  await db.query(
    `UPDATE amp_access_gifts SET account_id=$2,learner_id=$3,grant_id=$4,activated_at=$5,ends_at=$6 WHERE id=$1`,
    [gift.id, accountId, first, familyGrantId(gift.id, first), now, ends],
  );
  await refreshFamilyAdult(db, accountId);
  return {
    id: gift.id,
    learnerId: first,
    startsAt: now.toISOString(),
    endsAt: ends.toISOString(),
  };
}

/** Caller holds the account lock in a transaction. Also used by learner
 * creation/adoption, where a family gift in force covers the new child first. */
export async function activateGiftInTransaction(
  db: PoolClient,
  accountId: string,
  learnerId: string | undefined,
  options: { giftId?: string; development?: boolean } = {},
) {
  if (!(await installed(db))) {
    if (options.giftId) throw new AccessGiftError(404, "gift_unavailable");
    return null;
  }
  await lockAccountGifts(db, accountId);
  if (!options.giftId) {
    // Do not consume or extend a gift while assigning a paid enrollment to
    // this learner.
    if (await paidAssignmentWaiting(db, accountId)) return null;
    const covered = await familyCover(db, accountId, learnerId!);
    if (covered) return covered;
  }
  const email = await verifiedEmail(db, accountId);
  if (!email) {
    if (options.giftId) throw new AccessGiftError(403, "email_unconfirmed");
    return null;
  }
  // An adult activating a gift for their own learner acts for themselves; a
  // child, or a family gift (every child), needs the parent's consent.
  const consented = await learningConsentActive(
    db,
    accountId,
    options.development,
  );
  const ownAdult =
    !consented &&
    learnerId !== undefined &&
    (await purchaseConsentSatisfied(
      db,
      accountId,
      learnerId,
      options.development,
    ));
  if (!consented && !ownAdult)
    throw new AccessGiftError(403, "consent_required");
  if (learnerId !== undefined) {
    const learner = await db.query(
      // A practice profile has no access of its own: the account's covers it.
      "SELECT id FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL AND NOT simulation FOR UPDATE",
      [learnerId, accountId],
    );
    if (!learner.rowCount)
      throw new AccessGiftError(404, "gift_learner_unavailable");
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
  if (gift.covers === "family" && gift.activated_at) {
    if (gift.account_id !== accountId)
      throw new AccessGiftError(409, "gift_already_assigned");
    return {
      id: gift.id,
      learnerId: (gift.learner_id as string | null) ?? null,
      startsAt: gift.activated_at.toISOString(),
      endsAt: gift.ends_at.toISOString(),
    };
  }
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
  if (gift.covers === "family") {
    if (!consented) throw new AccessGiftError(403, "consent_required");
    return activateFamilyGift(db, accountId, gift, learnerId);
  }
  if (learnerId === undefined)
    throw new AccessGiftError(400, "invalid_gift_request");
  // Future paid terms also reserve this learner; gifts neither replace nor stack on subscriptions.
  const access = await accessGrantsFor(
    db,
    learnerId === null ? [] : [learnerId],
  );
  const licensed = {
    rowCount: access.grants.some((g) => grantReserved(g, access.now)),
  };
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
  async activate(accountId: string, giftId: string, learnerId?: string) {
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
        `INSERT INTO amp_access_gifts(id,recipient_email,months,source,reference,campaign,claim_by,covers)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(source,reference) DO NOTHING`,
        [
          randomUUID(),
          value.email,
          value.months,
          value.source,
          value.reference,
          value.campaign ?? null,
          value.claimBy ?? null,
          value.covers,
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
        row.covers !== value.covers ||
        row.campaign !== (value.campaign ?? null) ||
        (row.claim_by?.toISOString() ?? null) !==
          (value.claimBy ? new Date(value.claimBy).toISOString() : null)
      )
        throw new AccessGiftError(409, "gift_reference_conflict");
      return {
        id: row.id as string,
        covers: row.covers as "learner" | "family",
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
        if (owner.account_id) {
          await lockLearningAccount(db, owner.account_id);
          await lockAccountGifts(db, owner.account_id);
        }
        const gift = (
          await db.query(
            "SELECT account_id,grant_id,covers FROM amp_access_gifts WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (gift.account_id !== owner.account_id) return null;
        await db.query(
          "UPDATE amp_access_gifts SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1",
          [id],
        );
        // A family gift ends every child's grant it made, kept as revoked.
        if (gift.covers === "family")
          await db.query(
            "UPDATE amp_grants SET status='revoked' WHERE starts_with(id,$1)",
            [`email-gift:${id}:`],
          );
        else if (gift.grant_id)
          await db.query("UPDATE amp_grants SET status='revoked' WHERE id=$1", [
            gift.grant_id,
          ]);
        if (gift.account_id) await refreshFamilyAdult(db, gift.account_id);
        return { id, status: "revoked" };
      });
      if (result) return result;
    }
  }
}
