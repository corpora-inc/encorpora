import { useEffect } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useLocation, useSearch } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "./query";
import { useLearnerStore } from "../learner-store";
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
 * never silently replaces the anonymous assessment currently on screen. */
export function useLearningView() {
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
  const learner =
    learners.find((l) => l.id === selectedId) ??
    (learners.length === 1 ? learners[0] : undefined);
  useEffect(() => {
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
      !!trial.data);
  const activeLearner = trialMode ? undefined : learner;
  const trialSession = trial.data ?? { token: "", learnerId: "" };
  const trialProgress = useQuery({
    ...progressOptions(trialSession),
    enabled: trialMode && !!trial.data,
  });
  const trialEvidence = useQuery({
    ...trialEvidenceOptions(trialSession),
    enabled: trialMode && !!trial.data,
    refetchInterval: false,
  });
  const accountEvidence = useQuery({
    ...learnerEvidenceOptions(
      session.data ?? { accountId: "", token: "" },
      activeLearner?.id ?? "",
    ),
    enabled: !!session.data && !!activeLearner,
  });
  const accountFrontier = useQuery({
    ...learnerFrontierOptions(
      session.data ?? { accountId: "", token: "" },
      activeLearner?.id ?? "",
    ),
    enabled: !!session.data && !!activeLearner,
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
        ?.canPractice &&
      ["active", "development"].includes(account?.family.consent.status ?? "");
  const identityError = session.error || (session.data && me.error);
  const loading =
    (!explicitTrial && loadingIdentity) ||
    ((explicitTrial || !learners.length) && trial.isPending) ||
    (active &&
      (evidence.isPending ||
        (trialMode ? trialProgress.isPending : accountFrontier.isPending)));
  const error =
    (!explicitTrial && identityError) ||
    ((explicitTrial || !learners.length) && trial.error) ||
    (active &&
      (evidence.error ||
        (trialMode ? trialProgress.error : accountFrontier.error)));
  return {
    session,
    identityLoading: loadingIdentity,
    identityError,
    account,
    learners,
    learner: activeLearner,
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
