import type { FamilyPlaces } from "../../../family/projection-contracts";

/** A parent's account screens (Billing among them) are details within
 * family Settings too. Paying for a learner (`/pay/…`) is not a setting: it
 * is a step of whatever led there, so it highlights no tab. */
export const usesFamilySettingsFrame = (pathname: string) =>
  /^\/account\/(?:security|billing|privacy)(?:\/|$)/.test(pathname);

/** Personal account settings keep a parent's own family context. Teaching
 * someone else's family does not make that family the adult's settings. */
export function settingsFamilyOf(places: FamilyPlaces | null | undefined) {
  return (
    places?.families.find((family) => family.role === "holder") ??
    places?.families.find((family) => family.role === "second-parent") ??
    null
  );
}
