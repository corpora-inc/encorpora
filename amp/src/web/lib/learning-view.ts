import { useEffect } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useLocation, useSearch } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "./query";
import { useLearnerStore } from "../learner-store";
import { adultLearner, practicingAsAdult } from "./adult-learner";
import { request } from "./api";
import { trialSessionOptions, progressOptions } from "../features/trial/api";
import { trialEvidenceOptions } from "../features/pathways/queries";
import {
  catalogSchema,
  progressSchema,
  frontierSchema,
} from "../features/pathways/model";
import type { AuthSession } from "../auth";

export const skillCatalogOptions = queryOptions({
  queryKey: ["pathways-catalog"],
  queryFn: ({ signal }) => request("/catalog", catalogSchema, { signal }),
  staleTime: 60_000,
});
export const learnerEvidenceOptions = (
  session: AuthSession,
  learnerId: string,
) =>
  queryOptions({
    queryKey: ["account", session.accountId, "pathways", learnerId],
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(learnerId)}/progress`,
        progressSchema,
        { token: session.token, signal },
      ),
  });
export const learnerFrontierOptions = (
  session: AuthSession,
  learnerId: string,
) =>
  queryOptions({
    queryKey: ["account", session.accountId, "pathways-frontier", learnerId],
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(learnerId)}/frontier`,
        frontierSchema,
        { token: session.token, signal },
      ),
  });

/** One explicit learning context for navigation and inventory. Account identity
 * never silently replaces the anonymous assessment currently on screen.
 * `records: false` (the drawer) asks only who and where, never the learner's
 * evidence, so opening it fetches nothing the screen behind it hasn't. */
export function useLearningView({
  records = true,
}: { records?: boolean } = {}) {
  const location = useLocation();
  const search = useSearch({ strict: false });
  const session = useQuery(sessionOptions);
  const me = useQuery({
    ...meOptions(session.data ?? { accountId: "", token: "" }),
    enabled: !!session.data,
  });
  const account =
    me.data?.signedIn && me.data.account.id === session.data?.accountId
      ? me.data
      : null;
  const learners = account?.learners ?? [];
  const selectedId = useLearnerStore((s) => s.learnerId);
  // The adult's own learner, when it's the one chosen: their own practice.
  const own = practicingAsAdult(account, selectedId)
    ? adultLearner(account)
    : null;
  const learner =
    own ??
    learners.find((l) => l.id === selectedId) ??
    (learners.length === 1 ? learners[0] : undefined);
  useEffect(() => {
    if (own) return;
    if (learners.length === 1 && selectedId !== learners[0]?.id)
      useLearnerStore.getState().select(learners[0]!.id);
  }, [account, selectedId]);
  const explicitTrial =
    location.pathname.startsWith("/try") || search.context === "trial";
  const trial = useQuery(trialSessionOptions);
  const loadingIdentity = session.isPending || (!!session.data && me.isPending);
  const trialMode =
    explicitTrial ||
    (!loadingIdentity &&
      !session.error &&
      !me.error &&
      !learners.length &&
      !own &&
      !!trial.data);
  const activeLearner = trialMode ? undefined : learner;
  const trialSession = trial.data ?? { token: "", learnerId: "" };
  const trialProgress = useQuery({
    ...progressOptions(trialSession),
    enabled: records && trialMode && !!trial.data,
  });
  const trialEvidence = useQuery({
    ...trialEvidenceOptions(trialSession),
    enabled: records && trialMode && !!trial.data,
    refetchInterval: false,
  });
  const accountEvidence = useQuery({
    ...learnerEvidenceOptions(
      session.data ?? { accountId: "", token: "" },
      activeLearner?.id ?? "",
    ),
    enabled: records && !!session.data && !!activeLearner,
  });
  const accountFrontier = useQuery({
    ...learnerFrontierOptions(
      session.data ?? { accountId: "", token: "" },
      activeLearner?.id ?? "",
    ),
    enabled: records && !!session.data && !!activeLearner,
  });
  const evidence = trialMode ? trialEvidence : accountEvidence;
  const frontier = trialMode
    ? trialProgress.data?.frontier.current
    : accountFrontier.data;
  const active = trialMode ? !!trial.data : !!activeLearner;
  const canPractice = trialMode
    ? !!trialProgress.data && trialProgress.data.remaining > 0
    : !!activeLearner &&
      !!account?.family.learners.find((l) => l.id === activeLearner.id)
        ?.canPractice;
  const identityError = session.error || (session.data && me.error);
  const loading =
    (!explicitTrial && loadingIdentity) ||
    ((explicitTrial || !learners.length) && trial.isPending) ||
    (active &&
      ((records && evidence.isPending) ||
        (trialMode
          ? trialProgress.isPending
          : records && accountFrontier.isPending)));
  const error =
    (!explicitTrial && identityError) ||
    ((explicitTrial || !learners.length) && trial.error) ||
    (active &&
      ((records && evidence.error) ||
        (trialMode ? trialProgress.error : records && accountFrontier.error)));
  return {
    session,
    identityLoading: loadingIdentity,
    identityError,
    account,
    learners,
    learner: activeLearner,
    /** The chosen learner is the adult's own: their own practice. */
    ownPractice: !trialMode && !!own,
    trial,
    trialMode,
    trialProgress: trialMode ? trialProgress.data : undefined,
    /** The assessment's budget is on its way: the lookup or its progress. */
    trialProgressLoading:
      trialMode &&
      (trial.isPending || (!!trial.data && trialProgress.isPending)),
    active,
    canPractice,
    evidence: active ? evidence.data : undefined,
    frontier: active ? frontier : undefined,
    loading,
    error,
    contextSearch: trialMode ? { context: "trial" as const } : {},
    practiceHref: trialMode
      ? trialProgress.data?.remaining === 0
        ? "/try/plans"
        : trial.data
          ? "/try/practice"
          : "/try"
      : activeLearner
        ? canPractice
          ? "/practice"
          : "/start"
        : "/try",
    retry: () => {
      void session.refetch();
      if (session.data) void me.refetch();
      void trial.refetch();
      if (active) {
        void evidence.refetch();
        void (trialMode ? trialProgress.refetch() : accountFrontier.refetch());
      }
    },
  };
}
