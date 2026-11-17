import {
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from "@tanstack/react-router";
import { fundedPrograms } from "../lib/funded-entry";
import { queryClient, sessionOptions } from "../lib/query";
import { requireSignedIn, type GateLocation } from "./sign-in-gate";

/*
 * Paying is an overlay nested under the screen it was opened from
 * (features/pay/address.ts): a child's page, the family's Today, Billing.
 * Its only hop is the sign-in gate (app/sign-in-gate.ts). Each older pay
 * address is an app/legacy-aliases.ts row (docs/architecture/web-app.md,
 * "Pay"): what an old address carried (a plan, a program) is written into
 * the pay store on the way through and never read from the address again.
 * The hops' logic, like the overlay, loads only when it is opened, never
 * with the app's entry.
 */

/** Pay screens are a signed-in adult's, on the web: a school student's
 * device and the store apps never pay here. One hop to sign in. */
async function payGate({ location }: { location: GateLocation }) {
  await requireSignedIn(location, { web: true, adults: true });
}

const screens = () => import("../features/pay/screens");

/**
 * A pay overlay's routes under the screen it opens over (its host, which
 * renders that screen and an outlet): an empty index (the screen alone),
 * then `<at>` (choose), `<at>/done` (back from Stripe) and
 * `<at>/invoice/$invoiceId` (the invoice made). `at` is `pay` under a
 * child's own page and `pay/$learner` elsewhere (features/pay/address.ts).
 */
export function payOverlays<Parent extends AnyRoute>(
  parent: Parent,
  at: "pay" | "pay/$learner",
) {
  const overlay = <Path extends string>(path: Path, name: string) =>
    createRoute({
      getParentRoute: () => parent,
      path,
      beforeLoad: payGate,
      loader: async ({ params }: { params: { learner?: string } }) => {
        const session = queryClient.getQueryData(sessionOptions.queryKey);
        if (session && params.learner)
          await (await import("../features/pay/prefetch")).prefetchPay(
            session,
            params.learner,
          );
      },
      component: lazyRouteComponent(screens, name as never),
    });
  return [
    createRoute({ getParentRoute: () => parent, path: "/" }),
    overlay(at, "PayScreen"),
    overlay(`${at}/done`, "PayCardDoneScreen"),
    overlay(`${at}/invoice/$invoiceId`, "PayInvoiceScreen"),
  ] as const;
}

/** The older pay addresses' paths, for the typed route table only: each is
 * an app/legacy-aliases.ts row, which hops before any route here loads.
 * Onboarding still links to them (features/onboarding); once those links
 * go straight to the pay overlay, delete these. */
export function payAddresses<Root extends AnyRoute>(root: Root) {
  const address = <Path extends string>(path: Path) =>
    createRoute({ getParentRoute: () => root, path });
  return [
    address("/continue/$learnerId"),
    ...Object.values(fundedPrograms).map((program) => address(program.path)),
  ] as const;
}
