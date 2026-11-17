import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../../auth";
import { request } from "../../../lib/api";
import { invalidateAccount } from "../../../lib/query";
import { rememberPlace } from "../place-memory";

/* A parent's kids, as setup edits them. The server owns them; every screen
   reads them from `/me` in the Query cache. Each change is one mutation that
   invalidates the account (its `/me` and its family reads), so every step
   that shows them shows the change. */

const kid = z.object({ id: z.string(), name: z.string() });
export type NewKid = { name: string; birthYear: number };

/** Adds one child to the family (and makes the family with the first). */
export function useAddKid(session: AuthSession) {
  return useMutation({
    mutationFn: ({ name, birthYear }: NewKid) =>
      request("/learners", kid, {
        token: session.token,
        body: { birthYear, ...(name.trim() ? { name: name.trim() } : {}) },
      }),
    // `/` returns to the family just made.
    onSuccess: () => rememberPlace(session.accountId, "home"),
  });
}

/** A saved child's name; blank goes back to their number ("Child 2"). */
export function useRenameKid(session: AuthSession) {
  return useMutation({
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
