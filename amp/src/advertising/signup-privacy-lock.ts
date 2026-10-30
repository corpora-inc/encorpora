import type { PoolClient } from "pg";

/** Signup delivery shares this dedicated lock. Withdrawal/deletion takes it
 * exclusively; ordinary account and learning operations do not wait on ad I/O. */
export async function lockSignupSharing(
  db: PoolClient,
  accountId: string,
  shared = false,
) {
  await db.query(
    shared
      ? "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))"
      : "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [`signup-sharing:${accountId}`],
  );
}
