import {
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRoute,
} from "@tanstack/react-router";
import { queryClient, sessionOptions } from "../lib/query";
import { fundedPrograms } from "../lib/funded-entry";
import { studentSession } from "../lib/student-device";
import { nativeRuntime } from "../native-runtime";
import type { LegacyHop } from "../features/pay/legacy";

/*
 * Paying is an overlay nested under the screen it was opened from
 * (features/pay/address.ts): a child's page, the family's Today, Billing.
 * Its only redirects are the auth gate and one hop from each older pay
 * address (docs/architecture/web-app.md, "Pay"): what an old address
 * carried (a plan, a program) is written into the pay store on the way
 * through and never read from the address again. The hops' logic, like the
 * overlay, loads only when it is opened, never with the app's entry.
 */

/** Pay screens are a signed-in adult's, on the web: a school student's
 * device and the store apps never pay here. One hop to sign in. */
async function payGate() {
  if (studentSession() || nativeRuntime)
    throw redirect({ to: "/", replace: true });
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) throw redirect({ to: "/sign-in" });
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

/** The older pay addresses, each one hop to a pay overlay. Typed by the
 * root they hang from. */
export function payRoutes<Root extends AnyRoute>(root: Root) {
  const legacy = <Path extends string>(path: Path, hop: LegacyHop) =>
    createRoute({
      getParentRoute: () => root,
      path,
      staticData: { space: "account" },
      beforeLoad: async ({ params, location }) => {
        const { legacyHop } = await import("../features/pay/legacy");
        throw redirect({
          href: await legacyHop(hop, {
            params: params as Record<string, string>,
            search: location.search as Record<string, unknown>,
            searchStr: location.searchStr,
            pathname: location.pathname,
          }),
          replace: true,
        });
      },
    });
  return [
    // "Continue with AMP" for one learner (2026-11), and the pay screen of
    // its own address for a day: the overlay over the learner's page.
    legacy("/continue/$learnerId", "continue"),
    legacy("/pay/$learnerId", "continue"),
    // The card plan, and the return address of an older learner checkout.
    legacy("/purchase/annual", "card"),
    legacy("/purchase/choose", "choose"),
    legacy("/purchase/funded", "funds"),
    // A program's bookmarked entry, and where its sign-up returns.
    ...Object.values(fundedPrograms).map((program) =>
      legacy(program.path, "program"),
    ),
  ] as const;
}
