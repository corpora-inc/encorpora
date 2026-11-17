import { useLocation, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { closeTo } from "../../lib/return-to";
import { Sheet } from "../../ui/Sheet";
import { payOver } from "../pay/address";

/*
 * The frame of an account overlay (app/account-overlays.tsx): Billing,
 * Privacy, Sign-in & security, Delete account, drawn in the shared Sheet over
 * their hub (family Settings or `/account`). ✕, Escape and Back close it to
 * exactly the hub behind, with its scroll: Back when it was opened in the
 * app, else a replace to the hub. Never a "‹ Back" line, and never a sheet
 * over this sheet: its panels are disclosures, and moving on to Pay replaces
 * it (`useReplaceWithPay`).
 */

/** The account overlays' last parts under a hub. */
export const ACCOUNT_OVERLAYS = [
  "billing",
  "privacy",
  "security",
  "delete-account",
] as const;
export type AccountOverlayName = (typeof ACCOUNT_OVERLAYS)[number];

const OVERLAY = new RegExp(`/(?:${ACCOUNT_OVERLAYS.join("|")})/?$`);

/** The hub an overlay's address is over: its address without the overlay. */
export function overlayHub(pathname: string): string {
  return pathname.replace(OVERLAY, "") || "/account";
}

/** The hub behind the open overlay. */
export function useOverlayHub(): string {
  return useLocation({ select: (location) => overlayHub(location.pathname) });
}

/** Closes the open overlay to its hub. */
export function useOverlayClose() {
  const router = useRouter();
  const hub = useOverlayHub();
  return () => closeTo(router, hub, hub);
}

/** From an overlay to Pay for one learner, over the same hub: Pay takes this
 * overlay's place, so ✕ on Pay returns to the hub, never to this overlay. */
export function useReplaceWithPay() {
  const router = useRouter();
  const hub = useOverlayHub();
  return (learnerId: string) =>
    void router.navigate({
      href: payOver(hub, learnerId),
      replace: true,
      resetScroll: false,
    });
}

export function AccountOverlay({
  name,
  title,
  description,
  children,
}: {
  name: AccountOverlayName;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const close = useOverlayClose();
  return (
    <Sheet
      open
      tall
      title={title}
      description={description}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <div data-account-overlay={name}>{children}</div>
    </Sheet>
  );
}
