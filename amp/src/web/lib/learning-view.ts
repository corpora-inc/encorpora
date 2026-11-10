import { useEffect } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { meOptions, sessionOptions } from "./query";
import { useLearnerStore } from "../learner-store";
import {
  adultLearner,
  practiceProfile,
  practicingAsAdult,
  profileLearner,
} from "./adult-learner";
import { request } from "./api";
import {
  catalogSchema,
  progressSchema,
  frontierSchema,
} from "../features/pathways/model";
import type { AuthSession } from "../auth";
import {
  secondParentChild,
  secondParentChildren,
} from "../features/second-parent/api";

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

/** One explicit learning context for navigation and inventory: the chosen
 * learner of the signed-in account, or the adult's own.
 * `records: false` (the drawer) asks only who and where, never the learner's
 * evidence, so opening it fetches nothing the screen behind it hasn't. */
export function useLearningView({
  records = true,
}: { records?: boolean } = {}) {
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
  // A second parent's family's children: their progress, read-only.
  const shared = secondParentChildren(account);
  const selectedId = useLearnerStore((s) => s.learnerId);
  // The adult's own learner, when it's the one chosen: their own practice.
  // One of their practice profiles is their own practice too, as someone else.
  const profile = practiceProfile(account, selectedId);
  // An adult who practices only as themselves has no one else to choose:
  // their own record, whatever this device last chose.
  const solo =
    !learners.length && !shared.length ? adultLearner(account) : null;
  const own = practicingAsAdult(account, selectedId)
    ? adultLearner(account)
    : profile
      ? profileLearner(account, selectedId)
      : solo;
  const learner =
    own ??
    learners.find((l) => l.id === selectedId) ??
    shared.find((l) => l.id === selectedId) ??
    (learners.length === 1 ? learners[0] : undefined);
  const viewOnly = !own && !!secondParentChild(account, learner?.id);
  useEffect(() => {
    if (solo && own === solo && selectedId !== solo.id)
      useLearnerStore.getState().select(solo.id);
    if (own) return;
    if (learners.length === 1 && selectedId !== learners[0]?.id)
      useLearnerStore.getState().select(learners[0]!.id);
  }, [account, selectedId]);
  const loadingIdentity = session.isPending || (!!session.data && me.isPending);
  const evidence = useQuery({
    ...learnerEvidenceOptions(
      session.data ?? { accountId: "", token: "" },
      learner?.id ?? "",
    ),
    enabled: records && !!session.data && !!learner,
  });
  const frontier = useQuery({
    ...learnerFrontierOptions(
      session.data ?? { accountId: "", token: "" },
      learner?.id ?? "",
    ),
    enabled: records && !!session.data && !!learner,
  });
  const active = !!learner;
  const canPractice =
    !!learner &&
    !viewOnly &&
    !!account?.family.learners.find((l) => l.id === learner.id)?.canPractice;
  const identityError = session.error || (session.data && me.error);
  const loading =
    loadingIdentity ||
    (active && records && (evidence.isPending || frontier.isPending));
  const error =
    identityError || (active && records && (evidence.error || frontier.error));
  return {
    session,
    identityLoading: loadingIdentity,
    identityError,
    account,
    /** The learners to choose between: the family's, then those of a family
     * this account is the second parent of. */
    learners: [...learners, ...shared],
    learner,
    /** The chosen child is a second parent's family's: their progress is
     * read here, and practice is the family's class. */
    viewOnly,
    /** The chosen learner is the adult's own: their own practice, or one of
     * their practice profiles. */
    ownPractice: !!own,
    /** The adult is practicing as this profile of theirs. */
    profile,
    active,
    canPractice,
    evidence: active ? evidence.data : undefined,
    frontier: active ? frontier.data : undefined,
    loading,
    error,
    // A second parent's family's child practises from the family's class.
    // Otherwise practice, or the pause in practice when the free problems
    // are used; with no learner yet, the starter.
    practiceHref:
      learner && viewOnly
        ? `/${secondParentChild(account, learner.id)!.classPath}`
        : learner
          ? "/practice"
          : "/start",
    retry: () => {
      void session.refetch();
      if (session.data) void me.refetch();
      if (active) {
        void evidence.refetch();
        void frontier.refetch();
      }
    },
  };
}
