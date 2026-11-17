import { useQuery } from "@tanstack/react-query";
import type { AuthSession } from "../../auth";
import type { FamilyPlaces } from "../../../family/projection-contracts";
import { queryClient } from "../../lib/query";
import { useSession } from "../../lib/session";
import { familyPlacesOptions } from "../family/api";
import { settingsFamilyOf } from "../family/settings-family";

/*
 * Where an account's settings live (the IA v2 spec, §2.3 and §4): one hub.
 * A family's holder or second parent keeps every account setting in that
 * family's Settings (`/family/<own>/settings`); every other adult in the one
 * `/account` page. Computed from canonical state (the account's places in the
 * Query cache), never from how a page was reached, so every link to billing,
 * privacy or sign-in is built from it once and goes straight there.
 */

export type SettingsOverlay =
  "billing" | "privacy" | "security" | "delete-account";

/** The account's settings hub: its family's Settings, or `/account`. */
export function settingsHub(places: FamilyPlaces | null | undefined): string {
  const family = settingsFamilyOf(places);
  return family
    ? `/family/${encodeURIComponent(family.familyId)}/settings`
    : "/account";
}

/** An overlay over the hub (`<hub>/privacy`), or the hub itself. */
export function settingsHref(
  places: FamilyPlaces | null | undefined,
  overlay?: SettingsOverlay,
): string {
  const hub = settingsHub(places);
  return overlay ? `${hub}/${overlay}` : hub;
}

/** Outside React (a legacy hop, a loader): the hub, from the account's
 * places. A failed read is a failure, never a guess at the hub. */
export async function loadSettingsHub(
  session: AuthSession,
  overlay?: SettingsOverlay,
): Promise<string> {
  const places = await queryClient.ensureQueryData(
    familyPlacesOptions(session),
  );
  return settingsHref(places, overlay);
}

/** The hub (or an overlay over it) for the signed-in account. Until the
 * places arrive it is `/account`'s address, which renders for anyone. */
export function useSettingsHref(overlay?: SettingsOverlay): string {
  const session = useSession();
  const places = useQuery(familyPlacesOptions(session));
  return settingsHref(places.data, overlay);
}
