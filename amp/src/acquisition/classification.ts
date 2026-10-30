import type { Pool } from "pg";
import { z } from "zod";

export const classificationCommandSchema = z.strictObject({
  action: z.literal("classify-account"),
  email: z
    .email()
    .max(320)
    .transform((v) => v.toLowerCase()),
  eventKey: z.string().trim().min(1).max(500),
  category: z.enum(["prospect", "friends_family", "internal"]),
  note: z.string().trim().min(1).max(500),
});

/** Operator-only; never changes access, consent, attribution or mail subscriptions. */
export async function classifyAccount(pool: Pool, input: unknown) {
  const c = classificationCommandSchema.parse(input);
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SET LOCAL statement_timeout='15s'");
    // Same recipient lock as outreach claims; a classification cannot race a send claim.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `outreach:${c.email}`,
    ]);
    const users = await db.query(
      "SELECT id FROM amp_auth_users WHERE lower(email)=$1",
      [c.email],
    );
    if (users.rowCount !== 1) throw new Error("Expected exactly one account");
    const uid = users.rows[0].id as string;
    await db.query(
      "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",
      [`amp|${uid}`],
    );
    if (
      !(
        await db.query(
          "SELECT 1 FROM amp_auth_users WHERE id=$1 AND lower(email)=$2 FOR UPDATE",
          [uid, c.email],
        )
      ).rowCount
    )
      throw new Error("Account identity changed; review it again");
    const previous = (
      await db.query(
        "SELECT category,note FROM amp_account_classification_events WHERE user_id=$1 AND event_key=$2",
        [uid, c.eventKey],
      )
    ).rows[0];
    if (previous) {
      if (previous.category !== c.category || previous.note !== c.note)
        throw new Error("Event key already represents different evidence");
      await db.query("COMMIT");
      return { replay: true, result: { category: c.category } };
    }
    if (
      (
        await db.query(
          "SELECT 1 FROM amp_acquisition_messages WHERE (user_id=$1 OR recipient=$2) AND status='sending'",
          [uid, c.email],
        )
      ).rowCount
    )
      throw new Error("Reconcile the outstanding send before classifying");
    await db.query(
      "INSERT INTO amp_account_classification_events(user_id,event_key,category,note) VALUES($1,$2,$3,$4)",
      [uid, c.eventKey, c.category, c.note],
    );
    await db.query(
      `INSERT INTO amp_account_classifications(user_id,category,note) VALUES($1,$2,$3)
       ON CONFLICT(user_id) DO UPDATE SET category=excluded.category,note=excluded.note,updated_at=now()`,
      [uid, c.category, c.note],
    );
    await db.query("COMMIT");
    return { replay: false, result: { category: c.category } };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
