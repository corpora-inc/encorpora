import {
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRoute,
} from "@tanstack/react-router";
import type { SignedInMe } from "../../account/contracts";
import type { AuthSession } from "../auth";
import { meOptions, queryClient, sessionOptions } from "../lib/query";
import { fundedProgramForPath, fundedPrograms } from "../lib/funded-entry";
import { studentSession } from "../lib/student-device";
import { nativeRuntime } from "../native-runtime";
import type { PayInterval } from "../features/pay/store";

/** The flow's own modules load only when a pay address is opened, never
 * with the app's entry. */
const pay = () => import("../features/pay/legacy");

/*
 * The pay flow (features/pay/paths.ts has the map): one route family keyed
 * by the learner. Its only redirects are the auth gate and one hop from
 * each older pay address (docs/architecture/web-app.md, "URLs, query
 * strings, redirects"): what an old address carried (a plan, a program) is
 * written into the pay store on the way through and never read from the
 * address again.
 */

/** Pay screens are a signed-in adult's, on the web. */
async function payGate(): Promise<AuthSession> {
  // A school student's device, and the store apps, never pay here.
  if (studentSession() || nativeRuntime) throw redirect({ to: "/", replace: true });
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) throw redirect({ to: "/sign-in" });
  return session;
}

async function signedInMe(session: AuthSession): Promise<SignedInMe> {
  const me = await queryClient.ensureQueryData(meOptions(session));
  if (!me.signedIn) throw redirect({ to: "/sign-in" });
  return me;
}

const interval = (value: unknown): PayInterval | undefined =>
  value === "year" || value === "month" ? value : undefined;

const hop = (href: string) => redirect({ href, replace: true });

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
  const legacy = <Path extends string>(
    path: Path,
    target: (input: {
      params: Record<string, string>;
      search: Record<string, unknown>;
      searchStr: string;
      pathname: string;
    }) => Promise<string>,
  ) =>
    createRoute({
      getParentRoute: () => root,
      path,
      staticData: { space: "account" },
      beforeLoad: async ({ params, location }) => {
        throw hop(
          await target({
            params: params as Record<string, string>,
            search: location.search as Record<string, unknown>,
            searchStr: location.searchStr,
            pathname: location.pathname,
          }),
        );
      },
    });

  /** An education-funds address: signed out, the public invoice form for
   * its program (with its campaign labels); signed in, the learner's flow. */
  const fundsTarget = async (
    search: Record<string, unknown>,
    searchStr: string,
    programId?: string,
  ) => {
    if (studentSession() || nativeRuntime) return "/";
    const session = await queryClient.ensureQueryData(sessionOptions);
    const named = Object.values(fundedPrograms).find(
      (entry) => entry.id === programId,
    );
    if (!session) {
      if (!named) return "/sign-in";
      const labels = new URLSearchParams(searchStr);
      for (const key of [...labels.keys()])
        if (!key.startsWith("utm_")) labels.delete(key);
      return `/invoice/${named.slug}${labels.size ? `?${labels}` : ""}`;
    }
    const me = await signedInMe(session);
    const { carry, legacyPayTarget, offerChoice } = await pay();
    const offered =
      typeof search.offer === "string" ? await offerChoice(search.offer) : null;
    const program = offered?.program ?? named?.id;
    const plan = offered?.interval ?? interval(search.interval);
    const target = legacyPayTarget(
      me,
      typeof search.learner === "string" ? search.learner : undefined,
    );
    carry(session, target.learnerId, { method: "esa", interval: plan, program });
    return target.href;
  };

  return [
    screen("/pay/$learnerId", "PayScreen"),
    screen("/pay/$learnerId/card/done", "PayCardDoneScreen"),
    screen("/pay/$learnerId/invoice/$invoiceId", "PayInvoiceScreen"),

    // "Continue with AMP" for one learner (2026-11): its flow.
    legacy("/continue/$learnerId", async ({ params, search }) => {
      const session = await payGate();
      const me = await signedInMe(session);
      const { carry, legacyPayTarget } = await pay();
      const target = legacyPayTarget(me, params.learnerId);
      carry(session, target.learnerId, {
        method: "card",
        interval: interval(search.interval),
      });
      return target.href;
    }),
    // The card plan, and the return address of an older learner checkout.
    legacy("/purchase/annual", async ({ search }) => {
      const session = await payGate();
      const { carry, legacyPayTarget, stripeReturnTarget } = await pay();
      if (typeof search.purchase === "string" || typeof search.billing === "string")
        return (
          (await stripeReturnTarget(session, search, "learner")) ??
          "/account/billing"
        );
      const me = await signedInMe(session);
      const target = legacyPayTarget(
        me,
        typeof search.learner === "string" ? search.learner : undefined,
      );
      carry(session, target.learnerId, {
        method: "card",
        interval: interval(search.interval),
      });
      return target.href;
    }),
    legacy("/purchase/choose", async () => {
      const session = await payGate();
      const { legacyPayTarget } = await pay();
      return legacyPayTarget(await signedInMe(session)).href;
    }),
    legacy("/purchase/funded", async ({ search, searchStr }) => {
      if (typeof search.invoice === "string") {
        await payGate();
        // An invoice's record, status and PDF are in Billing.
        return "/account/billing";
      }
      return fundsTarget(
        search,
        searchStr,
        typeof search.program === "string" ? search.program : undefined,
      );
    }),
    // A program's bookmarked entry, and where its sign-up returns.
    ...Object.values(fundedPrograms).map((program) =>
      legacy(program.path, ({ search, searchStr, pathname }) =>
        fundsTarget(search, searchStr, fundedProgramForPath(pathname)?.id),
      ),
    ),
  ] as const;
}
