import {
  useMutation,
  type Mutation,
  type QueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../../auth";
import { request } from "../../../lib/api";
import { invalidateAccount } from "../../../lib/query";
import type { Persona } from "../activation";
import { rememberPlace } from "../place-memory";

/* A parent's kids, as setup edits them. The server owns them; every screen
   reads them from `/me` in the Query cache. Each change is one mutation that
   invalidates the account (its `/me` and its family reads), so every step
   that shows them shows the change. */

const kid = z.object({ id: z.string(), name: z.string() });

/** Every save setup makes for this account (its answer and its kids), under
 * one key, so a step can see in the Query cache whether one is in flight. */
export const setupSavesKey = (session: Pick<AuthSession, "accountId">) =>
  ["setup-saves", session.accountId] as const;

/**
 * Resolves once no setup save of this account is in flight, including one
 * that starts as another ends (a family's answer, then its first child):
 * true when every save it waited for succeeded, false when one failed (its
 * own handler has said which, where). Next waits on this, never refusing a
 * tap while a save finishes.
 */
export function setupSavesSettled(
  client: QueryClient,
  session: Pick<AuthSession, "accountId">,
): Promise<boolean> {
  const cache = client.getMutationCache();
  const key = setupSavesKey(session);
  const seen = new Set<Mutation<unknown, unknown, unknown, unknown>>();
  const pending = () =>
    cache.findAll({ mutationKey: key, status: "pending" }) as Mutation<
      unknown,
      unknown,
      unknown,
      unknown
    >[];
  return new Promise((resolve) => {
    const check = () => {
      for (const mutation of pending()) seen.add(mutation);
      if ([...seen].some((mutation) => mutation.state.status === "pending"))
        return;
      unsubscribe();
      resolve(
        [...seen].every((mutation) => mutation.state.status === "success"),
      );
    };
    const unsubscribe = cache.subscribe(check);
    check();
  });
}
export type NewKid = {
  name: string;
  birthYear: number;
  /** The first run's answer, recorded first when the first child makes the
   * family (a parent sent here by a link): one save, never two in a row. */
  answer?: Persona;
};

/** Adds one child to the family (and makes the family with the first). */
export function useAddKid(session: AuthSession) {
  return useMutation({
    mutationKey: setupSavesKey(session),
    mutationFn: async ({ name, birthYear, answer }: NewKid) => {
      if (answer)
        await request("/start/choice", z.unknown(), {
          token: session.token,
          body: { answer },
        });
      return request("/learners", kid, {
        token: session.token,
        body: { birthYear, ...(name.trim() ? { name: name.trim() } : {}) },
      });
    },
    // `/` returns to the family just made.
    onSuccess: () => rememberPlace(session.accountId, "home"),
  });
}

/** A saved child's name; blank goes back to their number ("Child 2"). */
export function useRenameKid(session: AuthSession) {
  return useMutation({
    mutationKey: setupSavesKey(session),
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      request(
        `/family/learners/${encodeURIComponent(id)}/rename`,
        z.unknown(),
        {
          token: session.token,
          body: { name: name.trim() },
        },
      ),
    onSuccess: () => invalidateAccount(session.accountId),
  });
}

/** A saved child's birth year (Q-56): their start and class grade follow. */
export function useKidYear(session: AuthSession) {
  return useMutation({
    mutationKey: setupSavesKey(session),
    mutationFn: ({ id, birthYear }: { id: string; birthYear: number }) =>
      request(
        `/family/learners/${encodeURIComponent(id)}/birth-year`,
        z.unknown(),
        { token: session.token, body: { birthYear } },
      ),
    onSuccess: () => invalidateAccount(session.accountId),
  });
}

/** Takes a saved child with nothing yet in their name back out. */
export function useRemoveKid(session: AuthSession) {
  return useMutation({
    mutationKey: setupSavesKey(session),
    mutationFn: (id: string) =>
      request(
        `/family/learners/${encodeURIComponent(id)}/remove`,
        z.unknown(),
        {
          token: session.token,
          body: {},
        },
      ),
    onSuccess: () => invalidateAccount(session.accountId),
  });
}
