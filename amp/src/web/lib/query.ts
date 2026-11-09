import { QueryClient, queryOptions } from "@tanstack/react-query";
import { meSchema } from "../../account/contracts";
import type { AuthSession } from "../auth";
import { accessSession, authConfig } from "../auth";
import { request } from "./api";
import { setAnalyticsSession } from "./analytics";
/** A screen's route loads its data, then the screen mounts and reads it.
 * Data that arrived in the last moment is the screen's to use: mounting
 * doesn't ask again (one request per resource per load). Anything older, or
 * invalidated by a change, still refreshes on mount. */
export const MOUNT_REFETCH_AFTER_MS = 2_000;
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnMount: (query) =>
        query.state.isInvalidated ||
        Date.now() - query.state.dataUpdatedAt > MOUNT_REFETCH_AFTER_MS,
    },
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
    // Navigation owns account freshness. Consumers share its snapshot even
    // when a chunk loads late or an observer becomes enabled afterwards.
    // Mutations, session changes and window focus still refresh it.
    staleTime: Infinity,
    refetchOnMount: (query) => query.state.isInvalidated,
    refetchOnWindowFocus: "always",
  });
export function invalidateAccount(identity: string) {
  return queryClient.invalidateQueries({ queryKey: ["account", identity] });
}

export async function refreshMe(session: AuthSession) {
  await queryClient.cancelQueries({ queryKey: meKey(session.accountId) });
  return queryClient.fetchQuery({ ...meOptions(session), staleTime: 0 });
}
