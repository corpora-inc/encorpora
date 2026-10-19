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
