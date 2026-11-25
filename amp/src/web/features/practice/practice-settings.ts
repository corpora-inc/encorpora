import { useEffect, useRef } from "react";
import { isCancelledError, queryOptions } from "@tanstack/react-query";
import {
  practiceStateSchema,
  type PracticeChange,
} from "../../../learning/practice-settings";
import { request } from "../../lib/api";
import { qk } from "../../lib/keys";
import { queryClient } from "../../lib/query";
import { AppError } from "../../lib/AppError";

export type PracticeScope = {
  identity: string;
  learnerId: string;
  token?: string;
};
export type PracticeIntent = PracticeChange extends infer C
  ? C extends PracticeChange
    ? Omit<C, "requestId" | "revision">
    : never
  : never;
export const practiceSettingsOptions = (scope: PracticeScope) =>
  queryOptions({
    queryKey: qk.practiceSettings(scope.identity, scope.learnerId),
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(scope.learnerId)}/practice-state`,
        practiceStateSchema,
        { token: scope.token, signal },
      ),
    staleTime: 0,
  });

/**
 * The settings a change is made on. A read that a newer one replaced while
 * this waited on it (a settings event's read, a credited answer stopping it:
 * Query's `CancelledError`) says nothing went wrong, so it is read again
 * instead of ending the change with no problem on the screen.
 */
async function readForWrite(scope: PracticeScope) {
  for (let attempt = 1; ; attempt++)
    try {
      return await queryClient.fetchQuery(practiceSettingsOptions(scope));
    } catch (error) {
      if (attempt >= READ_ATTEMPTS || !isCancelledError(error)) throw error;
    }
}
/** How many times a replaced read is read again before it is shown. */
const READ_ATTEMPTS = 4;

/** Preserve the mutation identity when delivery fails. No account or learner
 * can receive another scope's late response or pending retry. */
export function usePracticeAdjustment(scope: PracticeScope) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = useRef(scope);
  current.current = scope;
  const pending = useRef<{
    identity: string;
    intent: string;
    change: PracticeChange;
  } | null>(null);
  async function change(intent: PracticeIntent) {
    const identity = `${scope.identity}:${scope.learnerId}`;
    const active = () =>
      mounted.current &&
      `${current.current.identity}:${current.current.learnerId}` === identity;
    const key = JSON.stringify(intent);
    let saved = pending.current;
    if (saved?.identity !== identity || saved.intent !== key) {
      const settings = await readForWrite(scope);
      if (!active()) return null;
      saved = {
        identity,
        intent: key,
        change: {
          ...intent,
          revision: settings.revision,
          requestId: crypto.randomUUID(),
        },
      };
      pending.current = saved;
    }
    try {
      const result = await request(
        `/learners/${encodeURIComponent(scope.learnerId)}/practice-state`,
        practiceStateSchema,
        { token: scope.token, body: saved.change },
      );
      if (!active()) return null;
      pending.current = null;
      queryClient.setQueryData(practiceSettingsOptions(scope).queryKey, result);
      return result;
    } catch (error) {
      if (
        active() &&
        error instanceof AppError &&
        !["network", "unavailable"].includes(error.kind)
      ) {
        pending.current = null;
        void queryClient.invalidateQueries({
          queryKey: practiceSettingsOptions(scope).queryKey,
        });
      }
      throw error;
    }
  }
  const isCurrent = () =>
    mounted.current &&
    current.current.identity === scope.identity &&
    current.current.learnerId === scope.learnerId;
  /**
   * Practice held to the skill it was just opened for (or to none): the
   * newest choice by what it is, so it is made over whatever else was saved
   * meanwhile. Something saved for this learner between this screen's read
   * and its write (another device opening their practice, their look
   * changing: the server's 409) is read and the hold sent again, a few
   * times, instead of leaving a practice screen with no problem.
   */
  async function hold(skillId: string | null) {
    for (let attempt = 1; ; attempt++)
      try {
        return await change({ kind: "focus", skillId });
      } catch (error) {
        if (
          attempt >= HOLD_ATTEMPTS ||
          !isCurrent() ||
          !(error instanceof AppError) ||
          error.status !== 409
        )
          throw error;
        console.warn(
          "Practice changed elsewhere as this screen opened; holding it again",
          { attempt, skillId },
        );
      }
  }
  return { scope, change, hold, isCurrent };
}
/** How many times a hold is sent before its conflict is shown. */
const HOLD_ATTEMPTS = 4;
