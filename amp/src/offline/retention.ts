import type { Pool } from "pg";
/** Expired originals and provisional responses have a 30-day recovery/export window. */
export async function purgeOfflinePacks(pool: Pool): Promise<number> {
  const result = await pool.query(
    "DELETE FROM amp_offline_packs WHERE expires_at<=now()-interval '30 days'",
  );
  return result.rowCount ?? 0;
}
