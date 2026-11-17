import { Outlet } from "@tanstack/react-router";
import {
  ChildScreen,
  FamilySettingsScreen,
  FamilyTodayScreen,
} from "../family/screens";

/*
 * The screens a pay overlay opens over (address.ts): each stays mounted,
 * and visible behind the overlay on a wide screen, while its `pay` child
 * route draws the overlay in the outlet. Opening and closing never reload
 * or remount the screen behind.
 */

export function ChildPayHost() {
  return (
    <>
      <ChildScreen />
      <Outlet />
    </>
  );
}
export function TodayPayHost() {
  return (
    <>
      <FamilyTodayScreen />
      <Outlet />
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
      <Outlet />
    </>
  );
}
