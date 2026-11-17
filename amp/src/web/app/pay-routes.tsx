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
 * The pay flow (features/pay/paths.ts has the map): one route family keyed
 * by the learner. Its only redirects are the auth gate and one hop from
 * each older pay address (docs/architecture/web-app.md, "Pay"): what an old
 * address carried (a plan, a program) is written into the pay store on the
 * way through and never read from the address again. The hops' logic, like
 * the screens, loads only when a pay address is opened, never with the
 * app's entry (features/pay/legacy.ts).
 */

/** Pay screens are a signed-in adult's, on the web: a school student's
 * device and the store apps never pay here. One hop to sign in. */
async function payGate() {
  if (studentSession() || nativeRuntime)
    throw redirect({ to: "/", replace: true });
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) throw redirect({ to: "/sign-in" });
}

/** Typed by the root it hangs from, so `to="/pay/$learnerId"` is checked. */
export function payRoutes<Root extends AnyRoute>(root: Root) {
  const screens = () => import("../features/pay/screens");
  const screen = <Path extends string>(path: Path, name: string) =>
    createRoute({
      getParentRoute: () => root,
      path,
      staticData: { space: "account" },
      beforeLoad: payGate,
      loader: async ({ params }: { params: { learnerId?: string } }) => {
        const session = queryClient.getQueryData(sessionOptions.queryKey);
        if (session && params.learnerId)
          await (await import("../features/pay/prefetch")).prefetchPay(
            session,
            params.learnerId,
          );
      },
      component: lazyRouteComponent(screens, name as never),
    });
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
    screen("/pay/$learnerId", "PayScreen"),
    screen("/pay/$learnerId/card/done", "PayCardDoneScreen"),
    screen("/pay/$learnerId/invoice/$invoiceId", "PayInvoiceScreen"),
    // "Continue with AMP" for one learner (2026-11): its flow.
    legacy("/continue/$learnerId", "continue"),
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
