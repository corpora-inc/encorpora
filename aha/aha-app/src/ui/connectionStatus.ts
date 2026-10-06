import type { StudioProps } from "./types";

export const SETTLING_LABEL = "Finishing an earlier AI request…";

/**
 * The Settings connection pill. "AI ready" only when no earlier request is still settling: an unsettled receipt
 * blocks every new paid call (#882), so showing ready then would promise AI the app cannot send.
 */
export function connectionPill(account: StudioProps["account"]): { label: string; ready: boolean } {
  if (!account.connected) return { label: "Local practice", ready: false };
  if (account.settling) return { label: SETTLING_LABEL, ready: false };
  return account.aiReady ? { label: "AI ready", ready: true } : { label: "Connected · AI not ready", ready: false };
}
