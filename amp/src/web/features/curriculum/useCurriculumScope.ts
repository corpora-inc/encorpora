import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { useLearnerStore } from "../../learner-store";
import { trialSessionOptions } from "../trial/api";

/** Resolve presentation identity without loading progress or assessment evidence. */
export function useCurriculumScope() {
  const location = useLocation();
  const search = useSearch({ strict: false });
  const session = useQuery(sessionOptions);
  const me = useQuery({
    ...meOptions(session.data ?? { accountId: "", token: "" }),
    enabled: !!session.data,
  });
  const trial = useQuery(trialSessionOptions);
  const selected = useLearnerStore((s) => s.learnerId);
  return resolveCurriculumScope({
    pathname: location.pathname,
    trialContext: search.context === "trial",
    session: session.data,
    me: me.data,
    trial: trial.data,
    selected,
    loading: session.isPending || (!!session.data && me.isPending),
    identityError: !!session.error || !!me.error,
    trialPending: trial.isPending,
    trialError: !!trial.error,
  });
}

export function resolveCurriculumScope({
  pathname,
  trialContext,
  session,
  me,
  trial,
  selected,
  loading,
  identityError,
  trialPending,
  trialError,
}: {
  pathname: string;
  trialContext: boolean;
  session?: { accountId: string } | null;
  me?: {
    signedIn: boolean;
    account?: { id: string };
    learners?: { id: string }[];
  } | null;
  trial?: { learnerId: string } | null;
  selected?: string | null;
  loading: boolean;
  identityError: boolean;
  trialPending: boolean;
  trialError: boolean;
}) {
  const account =
    me?.signedIn && me.account?.id === session?.accountId ? me : null;
  const learners = account?.learners ?? [];
  const learner =
    learners.find((l) => l.id === selected) ??
    (learners.length === 1 ? learners[0] : undefined);
  const explicitTrial = pathname.startsWith("/try") || trialContext;
  const trialMode =
    explicitTrial ||
    (!loading &&
      !identityError &&
      !!trial &&
      (!session || (!!account && learners.length === 0)));
  if (trialMode)
    return {
      scope: trial ? `trial:${trial.learnerId}` : "pending",
      ready: !!trial && !trialPending && !trialError,
    };
  if (session)
    return {
      scope: learner ? `account:${session.accountId}:${learner.id}` : "pending",
      ready: !!learner && !loading && !identityError,
    };
  return {
    scope: "guest",
    ready: !loading && !identityError && !trialPending && !trialError,
  };
}
