import { QueryClient, queryOptions } from "@tanstack/react-query";
import { meSchema } from "../../account/contracts";
import type { AuthSession } from "../auth";
import { retireToken, reviveToken } from "./session-generation";
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
});// The session on screen is never a retired one: whatever sets it (a sign-in,
// a handback to the parent after a child's session), its own requests are
// its own (lib/session-generation.ts).
queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== "updated" || event.query.queryKey[0] !== "session") return;
  const session = event.query.state.data as AuthSession | null | undefined;
  reviveToken(session?.token);
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
/** The adult's own record (`features/me`), under the account's key. */
export const ownPracticeKey = (identity: string) =>
  ["account", identity, "own-practice"] as const;
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
/**
 * A new session for the same account (a new token behind the same keys)
 * retires everything the old one asked: in-flight requests are cancelled, so
 * their answers are discarded, and every cached answer is removed. What the
 * cache holds afterwards was asked with the new session
 * (docs/architecture/spaces.md, "Generations"). Another account is retired
 * by the caller's own account change.
 */
export function retireSession(
  previous: AuthSession | null | undefined,
  next: AuthSession | null,
  client = queryClient,
) {
  // Any session left behind, by sign-out, another account or a new token:
  // nothing it asked is sent, read or cached from now on.
  if (previous?.token && previous.token !== next?.token)
    retireToken(previous.token);
  reviveToken(next?.token);
  if (
    !previous ||
    !next ||
    previous.accountId !== next.accountId ||
    previous.token === next.token
  )
    return false;
  void client.cancelQueries({ queryKey: ["account", previous.accountId] });
  client.removeQueries({ queryKey: ["account", previous.accountId] });
  return true;
}
export function invalidateAccount(identity: string) {
  return queryClient.invalidateQueries({ queryKey: ["account", identity] });
}

export async function refreshMe(session: AuthSession) {
  await queryClient.cancelQueries({ queryKey: meKey(session.accountId) });
  return queryClient.fetchQuery({ ...meOptions(session), staleTime: 0 });
}
