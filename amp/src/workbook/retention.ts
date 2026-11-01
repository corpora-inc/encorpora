import type { Pool, PoolClient } from "pg";
import { RETENTION } from "../privacy/retention-periods.js";

/** Rendered workbook PDFs are a cache: each is deleted a day after it was
 * made. Called on every new render and by the retention job. */
export async function purgeWorkbookPdfs(
  db: Pool | PoolClient,
): Promise<number> {
  const result = await db.query(
    "DELETE FROM amp_workbook_pdfs WHERE created_at<=now()-make_interval(hours=>$1)",
    [RETENTION.workbookPdfHours],
  );
  return result.rowCount ?? 0;
}
