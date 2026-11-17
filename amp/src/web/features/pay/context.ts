import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { meOptions, sessionOptions } from "../../lib/query";
import { liveLearner } from "./paths";

export type PayLearner = SignedInMe["family"]["learners"][number];
export type PayContext = {
  session: AuthSession;
  me: SignedInMe;
  learner: PayLearner;
};

/**
 * The pay screen's canonical facts, read where they are needed (no props):
 * the session and `/me` from the Query cache, the learner from the path.
 * `ready` is null until all three are known; PayFrame renders a panel only
 * after that, so a panel uses `usePay()`.
 */
export function usePayState() {
  const session = useSuspenseQuery(sessionOptions).data;
  const { learnerId } = useParams({ strict: false }) as { learnerId: string };
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
