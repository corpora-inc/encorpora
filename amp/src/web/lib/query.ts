import { QueryClient, queryOptions } from "@tanstack/react-query";
import { meSchema } from "../../account/contracts";
import type { AuthSession } from "../auth";
import { accessSession, authConfig } from "../auth";
import { request } from "./api";
import { setAnalyticsSession } from "./analytics";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
export const sessionOptions = queryOptions({
  queryKey: ["session"],
  queryFn: async ({ signal }) => {
    const session = await accessSession();
    signal.throwIfAborted();
    setAnalyticsSession(session);
    return session;
  },
  staleTime: Infinity,
});
/** How this deployment signs parents in (password, configured providers).
 * Loaded before the sign-in screen renders, so its controls never shift. */
export const authConfigOptions = queryOptions({
  queryKey: ["auth-config"],
  queryFn: () => authConfig(),
  staleTime: Infinity,
});
export const meKey = (identity: string | null) =>
  ["account", identity, "me"] as const;
export const meOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: meKey(session.accountId),
    queryFn: async ({ signal }) => {
      const me = await request("/me", meSchema, {
        token: session.token,
        signal,
      });
      return me;
    },
  });
export function invalidateAccount(identity: string) {
  return queryClient.invalidateQueries({ queryKey: ["account", identity] });
}

export async function refreshMe(session: AuthSession) {
  await queryClient.cancelQueries({ queryKey: meKey(session.accountId) });
  return queryClient.fetchQuery(meOptions(session));
}
