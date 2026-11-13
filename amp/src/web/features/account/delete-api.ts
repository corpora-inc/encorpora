import { queryOptions, useMutation } from "@tanstack/react-query";
import {
  deletionSessionPreviewSchema,
  deletionReceiptSchema,
} from "../../../account/deletion-contracts";
import { notifyAccountSessionChanged, type AuthSession } from "../../auth";
import { request } from "../../lib/api";

/* "Delete my account" (src/account/delete-account.ts): what goes, read under
   the account's key so it refreshes with every other change to the account,
   and the deletion. */

export const deletionPreviewOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: ["account", session.accountId, "deletion"] as const,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
    queryFn: async ({ signal }) => {
      const started = Date.now();
      const preview = await request(
        "/account/deletion",
        deletionSessionPreviewSchema,
        {
          token: session.token,
          signal,
        },
      );
      return { ...preview, freshUntil: started + preview.freshForMs };
    },
  });

/** Deletes the account. Its sign-in ends with it: the screen moves on, then
 * `accountGone` signs the app out. */
export function useDeleteAccount(session: AuthSession) {
  return useMutation({
    mutationFn: () =>
      request("/account/delete", deletionReceiptSchema, {
        token: session.token,
        body: { confirmation: "delete-my-account" },
      }),
    onError: (error) => console.error("The account wasn’t deleted", error),
  });
}

/** The provider clears the account's cached data and installs the
 * signed-out session (app/providers.tsx). */
export const accountGone = () => notifyAccountSessionChanged(null);
