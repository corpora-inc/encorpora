import type { SyncStatus } from "../engine/types.ts";

export type LinkState = "online" | "offline" | "refused";

/**
 * Where the link to the hub stands, as of the last attempt. A hub that
 * answered but refused this device's uploads is "refused", not offline.
 * Interim: the engine reports the refusal only as HTTP 403 on receive
 * (CONTRACT "Hub", Receive); a structured `hub.refused` replaces this test.
 */
export function linkState(sync: SyncStatus | null): LinkState {
  const hub = sync?.hub;
  if (!hub) return "offline";
  if (hub.last_error && /\b403\b/.test(hub.last_error)) return "refused";
  return hub.reachable ? "online" : "offline";
}

export const LINK_LABEL: Record<LinkState, string> = { online: "Hub connected", offline: "Offline", refused: "Not enrolled" };
