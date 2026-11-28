import type { SyncStatus } from "../engine/types.ts";

export type LinkState = "online" | "offline" | "unenrolled" | "revoked" | "refused";

/**
 * Where the link to the hub stands, as of the last attempt. A hub that
 * answered but refused this device is not "offline": the engine says why.
 */
export function linkState(sync: SyncStatus | null): LinkState {
  const hub = sync?.hub;
  if (!hub) return "offline";
  if (hub.refused === "unenrolled") return "unenrolled";
  if (hub.refused === "revoked") return "revoked";
  if (hub.refused) return "refused";
  return hub.reachable ? "online" : "offline";
}

export const LINK_LABEL: Record<LinkState, string> = { online: "Hub connected", offline: "Offline", unenrolled: "Not enrolled", revoked: "Device revoked", refused: "Refused by hub" };

/** What a refusal means, in plain words; null when the hub accepted the device. */
export function refusalText(state: LinkState): string | null {
  switch (state) {
    case "unenrolled":
      return "The hub does not accept uploads from this device yet. An administrator enrolls it at the hub with the key below. Everything stays queued here until then.";
    case "revoked":
      return "An administrator revoked this device at the hub. Its uploads stay queued here; ask the administrator.";
    case "refused":
      return "The hub could not check this device's signature. Its uploads stay queued here; ask the administrator.";
    default:
      return null;
  }
}
