import { QueryClient, queryOptions } from "@tanstack/react-query";
import { meSchema } from "../../account/contracts";
import type { AuthSession } from "../auth";
import { accessSession } from "../auth";
import { request } from "./api";
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
    return session;
  },
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
