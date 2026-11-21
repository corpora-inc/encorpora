import { useQuery } from "@tanstack/react-query";
import { earnsPoint } from "../../../learning/points";
import { useSessionOrNull } from "../../lib/session";
import { queryClient } from "../../lib/query";
import { nativeRuntime } from "../../native-runtime";
import { useAddressedIdentity } from "../spaces/useAddressed";
import {
  practiceSettingsOptions,
  type PracticeScope,
} from "./practice-settings";

type Answer = {
  id: string;
  correct: boolean;
  assisted: boolean;
  skipped?: boolean;
};

/**
 * Whose practice is on screen, as the practice host reads it: the learner
 * practice's own address names (features/spaces/identity.ts), for this
 * session's account. Null where there is none (signed out, the gallery, the
 * native app, which has no practice-state route).
 */
export function usePracticeScope(): PracticeScope | null {
  const session = useSessionOrNull();
  const learnerId = useAddressedIdentity()?.id;
  if (nativeRuntime || !session || !learnerId) return null;
  return { identity: session.accountId, learnerId, token: session.token };
}

/** Answers already counted into the total, per learner: a remount (a new
 * problem, a return from a book) never counts one twice. */
const credited = new Set<string>();
const creditKey = (scope: PracticeScope, answerId: string) =>
  `${scope.identity}\u0000${scope.learnerId}\u0000${answerId}`;
const CREDITED_LIMIT = 500;

/**
 * Counts a right answer without help into the learner's total, once: the
 * practice-state in the Query cache (the one owner of the total, from the
 * server's evidence) gains the point the server has just recorded. Any later
 * read of practice-state replaces it with the server's own count.
 */
export function creditAnswer(scope: PracticeScope, answer: Answer) {
  if (!earnsPoint(answer)) return false;
  const key = creditKey(scope, answer.id);
  if (credited.has(key)) return false;
  const { queryKey } = practiceSettingsOptions(scope);
  // A read already on its way may predate the answer: it must not land
  // over the point.
  void queryClient
    .cancelQueries({ queryKey, exact: true })
    .catch((error: unknown) =>
      console.warn("A practice-state read was not stopped", error),
    );
  // Same synchronous turn as the cache write, so no render sees one
  // without the other (`usePoints`).
  credited.add(key);
  if (credited.size > CREDITED_LIMIT)
    credited.delete(credited.values().next().value!);
  queryClient.setQueryData(queryKey, (state) =>
    state && state.points != null
      ? { ...state, points: state.points + 1 }
      : state,
  );
  return true;
}

/**
 * The learner's points (`learning/points.ts`): every right answer without
 * help. With `after`, the total once that answer counts, so the "+1" and the
 * total it joins agree from the first frame, before `creditAnswer` has run.
 * Null when it isn't known (no learner, an older server).
 */
export function usePoints(after?: Answer | null): number | null {
  const scope = usePracticeScope();
  const total = useQuery({
    ...practiceSettingsOptions(scope ?? { identity: "", learnerId: "" }),
    enabled: !!scope,
    // The practice host keeps it fresh; a new problem's remount must not ask
    // the server again.
    refetchOnMount: false,
    select: (state) => state.points ?? null,
  }).data;
  if (total == null || !scope) return null;
  return after && earnsPoint(after) && !credited.has(creditKey(scope, after.id))
    ? total + 1
    : total;
}

/** Whether `creditAnswer` has counted this answer (tests and the gallery). */
export const isCredited = (scope: PracticeScope, answerId: string) =>
  credited.has(creditKey(scope, answerId));
