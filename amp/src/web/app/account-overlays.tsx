import {
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from "@tanstack/react-router";
import { queryClient, sessionOptions } from "../lib/query";
import { payOverlays } from "./pay-routes";
import { logAhead } from "../lib/ahead";

/*
 * The account overlays over a settings hub (the IA v2 spec, §2.2): family
 * Settings (`/family/<id>/settings`) and the adults' `/account`. The hub's
 * route component is a host that renders the hub and an `<Outlet/>`
 * (features/pay/hosts.tsx), so the hub stays mounted, and visible beside the
 * overlay on a wide screen, while one of these draws in the outlet:
 *
 *   <hub>/billing          Billing (plans, Stripe portal, invoices, receipts)
 *   <hub>/privacy          Privacy & data (its panels are disclosures)
 *   <hub>/security         Sign-in & security
 *   <hub>/delete-account   Delete account
 *   <hub>/pay/<learner>    Pay (features/pay), with `/done` and `/invoice/<id>`
 *
 * Each has its address because something returns into it (Stripe, a mailed
 * link, a sign-in) or it is worth a shared link. Which panel opens first is
 * state (features/account/panels.ts), never the address. Every overlay's code
 * loads only when it opens, never with the app's entry. The host's own guard
 * (a signed-in adult) runs first, so the overlays add none of their own.
 */

const account = () => import("../features/account/overlays");
const privacy = () => import("../features/privacy/PrivacyOverlay");

export function accountOverlays<Host extends AnyRoute>(host: Host) {
  const overlay = <Path extends string>(
    path: Path,
    component: ReturnType<typeof lazyRouteComponent>,
    loader?: () => Promise<void>,
  ) =>
    createRoute({
      getParentRoute: () => host,
      path,
      // Over the hub: opening and closing keep its scroll (router.tsx).
      staticData: { overList: true },
      ...(loader ? { loader } : {}),
      component,
    });
  const session = () => queryClient.getQueryData(sessionOptions.queryKey);
  return [
    overlay(
      "billing",
      lazyRouteComponent(account, "BillingOverlay"),
      async () => {
        const current = session();
        if (current)
          await (
            await import("../features/account/billing-prefetch")
          ).prefetchBilling(current);
      },
    ),
    overlay("privacy", lazyRouteComponent(privacy, "PrivacyOverlay")),
    overlay("security", lazyRouteComponent(account, "SecurityOverlay")),
    overlay(
      "delete-account",
      lazyRouteComponent(account, "DeleteAccountOverlay"),
      async () => {
        const current = session();
        if (!current) return;
        const { deletionPreviewOptions } =
          await import("../features/account/delete-api");
        // What the account holds arrives with the overlay, so its list
        // paints whole; a failure is the overlay's own to show.
        await queryClient
          .ensureQueryData(deletionPreviewOptions(current))
          .catch((error: unknown) =>
            logAhead("What the account holds didn’t load ahead", error),
          );
      },
    ),
    // The index (the hub alone) and the pay overlay.
    ...payOverlays(host, "pay/$learner"),
  ] as const;
}
