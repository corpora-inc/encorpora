import { RouteSheetOutlet } from "../../nav/RouteSheet";
import {
  ChildScreen,
  FamilySettingsScreen,
  FamilyTodayScreen,
} from "../family/screens";

/*
 * The screens a pay overlay opens over (address.ts): each stays mounted,
 * and visible behind the overlay on a wide screen, while its `pay` child
 * route draws the overlay in the screen's one sheet (nav/RouteSheet.tsx).
 * Opening and closing never reload or remount the screen behind, and going
 * from one overlay to another over it keeps the same scrim and sheet.
 */

export function ChildPayHost() {
  return (
    <>
      <ChildScreen />
      <RouteSheetOutlet />
    </>
  );
}
export function TodayPayHost() {
  return (
    <>
      <FamilyTodayScreen />
      <RouteSheetOutlet />
    </>
  );
}
/** A family's Settings, and the account overlay open over it
 * (app/account-overlays.tsx): billing, privacy, sign-in, deleting the
 * account, Pay. */
export function SettingsHost() {
  return (
    <>
      <FamilySettingsScreen />
      <RouteSheetOutlet />
    </>
  );
}
