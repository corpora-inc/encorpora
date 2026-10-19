import type { Pool } from "pg";
import { RETENTION } from "../privacy/retention-periods.js";
/** Expired originals and provisional responses have a 30-day recovery/export window. */
export async function purgeOfflinePacks(pool: Pool): Promise<number> {
  const result = await pool.query(
    "DELETE FROM amp_offline_packs WHERE expires_at<=now()-make_interval(days=>$1)",
    [RETENTION.offlinePackDaysAfterExpiry],
  );
  return result.rowCount ?? 0;
}
