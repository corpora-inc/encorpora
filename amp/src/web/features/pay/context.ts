import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import { closeTo } from "../../lib/return-to";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { meOptions, sessionOptions } from "../../lib/query";
import { payAddress } from "./address";
import { liveLearner } from "./paths";

export type PayLearner = SignedInMe["family"]["learners"][number];
export type PayContext = {
  session: AuthSession;
  me: SignedInMe;
  learner: PayLearner;
};

/**
 * The pay screen's canonical facts, read where they are needed (no props):
 * the session and `/me` from the Query cache, the learner from the
 * overlay's address. `ready` is null until all three are known; the
 * overlay renders a panel only
 * after that, so a panel uses `usePay()`.
 */
export function usePayState() {
  const session = useSuspenseQuery(sessionOptions).data;
  // The overlay's address names the learner (address.ts).
  const learnerId = useLocation({
    select: (location) => payAddress(location.pathname)?.learnerId ?? "",
  });
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  });
  const account = me.data?.signedIn ? me.data : null;
  const learner = account ? liveLearner(account, learnerId) : undefined;
  const ready: PayContext | null =
    session && account && learner ? { session, me: account, learner } : null;
  return { session, learnerId, me, account, learner, ready };
}

/** Inside a rendered panel: the facts PayFrame waited for. */
export function usePay(): PayContext {
  const { ready } = usePayState();
  if (!ready) throw new Error("A pay panel rendered before its learner loaded");
  return ready;
}

/** The open overlay's address (address.ts): its origin, its base, its view. */
export function usePayAddress() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const address = payAddress(pathname);
  if (!address) throw new Error(`Not a pay overlay: ${pathname}`);
  return address;
}

/** Closes the overlay to the screen behind it, its origin: Back in history
 * when that is where it was opened from, else to it, never a new entry. */
export function usePayClose() {
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });
  const origin = payAddress(pathname)?.origin ?? "/";
  return () => closeTo(router, origin, origin);
}
