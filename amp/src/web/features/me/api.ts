import { queryOptions, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { ownPracticeResponse } from "../../../account/adult-contracts";
import type { AuthSession } from "../../auth";
import { useLearnerStore } from "../../learner-store";
import { request } from "../../lib/api";
import {
  invalidateAccount,
  ownPracticeKey,
  queryClient,
  refreshMe,
} from "../../lib/query";
import { adultStarts } from "../../../learning/starting-point";
import { rememberPlace } from "../onboarding/place-memory";

/** The adult's own record. Under the account's key, so any change to the
 * account refreshes it with everything else. */
export const ownPracticeOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: ownPracticeKey(session.accountId),
    queryFn: ({ signal }) =>
      request("/me/practice", ownPracticeResponse, {
        token: session.token,
        signal,
      }),
  });

/** The day boundary for their time: this device's own zone. */
function deviceTimeZone() {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
    );
  } catch {
    return "America/New_York";
  }
}

/** Starts the adult's own practice where they chose, then makes it the place
 * they are and the learner practicing, with `/me` refreshed everywhere. */
export function useStartOwnPractice(session: AuthSession) {
  return useMutation({
    // The year is enough: the server sets where it starts (an adult's
    // mid-scale) and practice finds the level from the first answers.
    mutationFn: async (birthYear: number) => {
      const { learnerId } = await request(
        "/me/practice",
        z.object({ learnerId: z.string() }),
        {
          token: session.token,
          body: { birthYear, timezone: deviceTimeZone() },
        },
      );
      useLearnerStore.getState().select(learnerId);
      rememberPlace(session.accountId, "me");
      await refreshMe(session);
      void queryClient.invalidateQueries({
        queryKey: ["account", session.accountId, "own-practice"],
      });
      return learnerId;
    },
  });
}

/** Corrects where the adult's own practice starts, from the year they were
 * born, given again. The account's one store refreshes everywhere: the start
 * in Account → Learners, the level on `/me` and in practice. */
export function useChangeOwnStart(session: AuthSession) {
  return useMutation({
    mutationFn: (birthYear: number) =>
      request(
        "/me/practice/birth-year",
        z.object({ start: z.enum(adultStarts) }),
        { token: session.token, body: { birthYear } },
      ),
    onSuccess: () => invalidateAccount(session.accountId),
  });
}
