import { useMutation } from "@tanstack/react-query";
import { giftActivationSchema } from "../../../access-grants/contracts";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { invalidateAccount } from "../../lib/query";

export function useActivateGift(session: AuthSession) {
  return useMutation({
    mutationFn: ({ id, learnerId }: { id: string; learnerId: string }) =>
      request(
        `/access-grants/${encodeURIComponent(id)}/activate`,
        giftActivationSchema,
        {
          token: session.token,
          body: { learnerId },
        },
      ),
    onSuccess: () => invalidateAccount(session.accountId),
  });
}
