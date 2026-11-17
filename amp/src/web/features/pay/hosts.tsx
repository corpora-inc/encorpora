import { Outlet } from "@tanstack/react-router";
import { BillingPage } from "../account/BillingPage";
import { ChildScreen, FamilyTodayScreen } from "../family/screens";

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
export function BillingPayHost() {
  return (
    <>
      <BillingPage />
      <Outlet />
    </>
  );
}
