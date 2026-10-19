import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { invalidateAccount } from "../../lib/query";
export const learnerInput = z.object({
  name: z.string().trim().min(1, "Enter a name or nickname.").max(60),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
});
const learnerResponse = z.object({
  id: z.string(),
  name: z.string(),
  birthYear: z.number().nullable().optional(),
});
export function useCreateLearner(session: AuthSession) {
  return useMutation({
    mutationFn: (input: z.infer<typeof learnerInput>) =>
      request("/learners", learnerResponse, {
        token: session.token,
        body: learnerInput.parse(input),
      }),
    onSuccess: () => invalidateAccount(session.accountId),
  });
}

/** Corrects the starting point of a learner saved before a failed claim. */
export function useSetBirthYear(session: AuthSession) {
  return useMutation({
    mutationFn: (input: { learnerId: string; birthYear: number }) =>
      request(
        `/learners/${encodeURIComponent(input.learnerId)}/birth-year`,
        z.object({ birthYear: z.number() }),
        { token: session.token, body: { birthYear: input.birthYear } },
      ),
    onSuccess: () => invalidateAccount(session.accountId),
  });
}

/** Moves this device's anonymous free practice, with every answer, into the
 * family as a named learner. Only after consent; the server rechecks it. */
export function useAdoptTrial(session: AuthSession) {
  return useMutation({
    mutationFn: (input: { token: string; name: string }) =>
      request("/trials/adopt", learnerResponse, {
        token: session.token,
        body: {
          token: input.token,
          name: learnerInput.shape.name.parse(input.name),
        },
      }),
    onSuccess: () => invalidateAccount(session.accountId),
  });
}
