import { useEffect, useRef } from "react";
import { queryOptions } from "@tanstack/react-query";
import {
  practiceSettingsSchema,
  type PracticeChange,
} from "../../../learning/practice-settings";
import { request } from "../../lib/api";
import { queryClient } from "../../lib/query";
import { AppError } from "../../lib/AppError";

export type PracticeScope = {
  identity: string;
  learnerId: string;
  token?: string;
  trial?: string;
};
export type PracticeIntent = PracticeChange extends infer C
  ? C extends PracticeChange
    ? Omit<C, "requestId" | "revision">
    : never
  : never;
export const practiceSettingsOptions = (scope: PracticeScope) =>
  queryOptions({
    queryKey: ["practice-settings", scope.identity, scope.learnerId],
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(scope.learnerId)}/practice-state`,
        practiceSettingsSchema,
        { token: scope.token, trial: scope.trial, signal },
      ),
    staleTime: 0,
  });

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
      const settings = await queryClient.fetchQuery(
        practiceSettingsOptions(scope),
      );
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
        practiceSettingsSchema,
        { token: scope.token, trial: scope.trial, body: saved.change },
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
  return { scope, change, isCurrent };
}
