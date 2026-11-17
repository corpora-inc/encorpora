import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { qk } from "../../lib/keys";
import { meOptions } from "../../lib/query";
import { forSession, useSessionOrNull } from "../../lib/session";
import { hasAccountContext } from "../../lib/account-page";
import { useCurrentLearner } from "../../learner-store";
import { nativeRuntime } from "../../native-runtime";
import { useFamilyCache } from "../../lib/family-cache";
import {
  practiceLearners,
  practicingAsAdult,
  practicingAsProfile,
} from "../../lib/adult-learner";

/** Resolve presentation identity without loading progress or assessment evidence. */
export function useCurriculumScope() {
  const location = useLocation();
  const session = useSessionOrNull();
  // Whether the session is still being read, or its last check failed: the
  // scope waits rather than show a guest's or a stale account's.
  const client = useQueryClient();
  const sessionStatus = useSyncExternalStore(
    (changed) => client.getQueryCache().subscribe(changed),
    () => client.getQueryState(qk.session())?.status,
  );
  const sessionPending = !session && sessionStatus !== "success";
  const sessionError = sessionStatus === "error";
  const accountPage = hasAccountContext(location.pathname);
  const me = useQuery({
    ...forSession(session, meOptions),
    enabled: !nativeRuntime && accountPage && !!session,
  });
  const nativeFamily = useFamilyCache(
    nativeRuntime ? (session?.accountId ?? null) : null,
  );
  const selected = useCurrentLearner();
  if (nativeRuntime) {
    // The Rust session owns native requests. Reuse the family snapshot loaded
    // through that bridge, including LegacyApp's first-learner fallback.
    const learners = nativeFamily?.learners.filter((l) => !l.deletedAt) ?? [];
    const learner = learners.find((l) => l.id === selected) ?? learners[0];
    const ready = !!session && !!learner && !sessionError;
    return {
      scope: ready ? `account:${session!.accountId}:${learner!.id}` : "pending",
      ready,
      levels: undefined,
    };
  }
  const account = me.data?.signedIn ? me.data : null;
  // An adult always sees their own levels, and a profile's.
  const own =
    practicingAsAdult(account, selected) ||
    practicingAsProfile(account, selected);
  return {
    ...resolveCurriculumScope({
      session,
      me: account
        ? { ...account, learners: practiceLearners(account) }
        : me.data,
      selected,
      loading: sessionPending || (!!session && me.isPending),
      identityError: sessionError || !!me.error,
    }),
    levels: own ? ("shown" as const) : account?.school?.levels,
  };
}

export function resolveCurriculumScope({
  session,
  me,
  selected,
  loading,
  identityError,
}: {
  session?: { accountId: string } | null;
  me?: {
    signedIn: boolean;
    account?: { id: string };
    learners?: { id: string }[];
  } | null;
  selected?: string | null;
  loading: boolean;
  identityError: boolean;
}) {
  const account =
    me?.signedIn && me.account?.id === session?.accountId ? me : null;
  const learners = account?.learners ?? [];
  const learner =
    learners.find((l) => l.id === selected) ??
    (learners.length === 1 ? learners[0] : undefined);
  if (session)
    return {
      scope: learner ? `account:${session.accountId}:${learner.id}` : "pending",
      ready: !!learner && !loading && !identityError,
    };
  return {
    scope: "guest",
    ready: !loading && !identityError,
  };
}
