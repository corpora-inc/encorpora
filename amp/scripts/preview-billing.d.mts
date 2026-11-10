import type { Connect } from "vite";
/** The design preview's prices; see preview-billing.mjs. */
export function previewBilling(
  databaseUrl: string | undefined,
): Connect.NextHandleFunction;
