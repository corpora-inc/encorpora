import type { PlaceId } from "./guard";

/** Where this account last worked, on this device, so `/` returns there. Kept
 * per account: two people sharing a browser each come back to their own. */
const key = (accountId: string) => `amp.place.${accountId}`;

export function rememberPlace(accountId: string, place: PlaceId) {
  try {
    localStorage.setItem(key(accountId), place);
  } catch (error) {
    console.warn(
      "Where you last worked couldn’t be saved on this device",
      error,
    );
  }
}

export function rememberedPlace(accountId: string): string | null {
  try {
    return localStorage.getItem(key(accountId));
  } catch {
    return null;
  }
}
