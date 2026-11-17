import type { FamilyPlaces } from "../../../family/projection-contracts";

/** Personal account settings keep a parent's own family context. Teaching
 * someone else's family does not make that family the adult's settings. */
export function settingsFamilyOf(places: FamilyPlaces | null | undefined) {
  return (
    places?.families.find((family) => family.role === "holder") ??
    places?.families.find((family) => family.role === "second-parent") ??
    null
  );
}
