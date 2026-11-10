import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { useLearnerStore } from "../../learner-store";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import { queryClient, refreshMe } from "../../lib/query";
import { rememberPlace } from "./place-memory";

/** What the starter sends: one answer and only what that answer needs. */
export type StarterAnswer =
  | { as: "myself"; timezone: string }
  | { as: "parent"; children: { birthYear: number }[] }
  | { as: "tutor"; students: { birthYear: number }[] };

const result = z.object({
  home: z.string().min(1),
  learnerId: z.string().optional(),
  /** Children or students added; 0 when the place already had them all. */
  added: z.number().int().min(0).optional(),
});
export type StarterResult = z.infer<typeof result>;

/** The day boundary for a new place: this device's own zone. */
export function deviceTimeZone() {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
    );
  } catch {
    return "America/New_York";
  }
}

/** Creates the place the answer needs, in one call. The account's `/me` is
 * read again before the screen moves, so the place is there everywhere when
 * it opens, and the learner who practices first is the one chosen. */
export function useStartPlace(session: AuthSession) {
  return useMutation({
    mutationFn: async (answer: StarterAnswer) => {
      const started = await request("/start", result, {
        token: session.token,
        body: answer,
      });
      if (started.learnerId)
        useLearnerStore.getState().select(started.learnerId);
      // `/` returns to the place just made: their own practice, or the
      // family's class, which is its family side.
      rememberPlace(session.accountId, answer.as === "myself" ? "me" : "home");
      await refreshMe(session);
      void queryClient.invalidateQueries({
        queryKey: ["account", session.accountId],
      });
      return started;
    },
  });
}

/** The demo a teacher or a school explores before any agreement or payment
 * (`POST /school/demo`). Read leniently: a `home` path, or the org and class
 * it opens on. */
const demoResult = z
  .object({
    home: z.string().min(1).optional(),
    orgId: z.string().optional(),
    classId: z.string().optional(),
  })
  .passthrough();
export function demoHome(result: z.infer<typeof demoResult>) {
  const home = result.home?.replace(/^\/+/, "");
  if (home) return home;
  if (result.orgId && result.classId)
    return `school/${result.orgId}/classes/${result.classId}/today`;
  if (result.orgId) return `school/${result.orgId}`;
  return null;
}
/** Starts the class or school demo, remembers it as the place `/` opens, and
 * says where it opens. */
export function useStartDemo(session: AuthSession) {
  return useMutation({
    mutationFn: async (kind: "class" | "school") => {
      const result = await request("/school/demo", demoResult, {
        token: session.token,
        body: { kind },
      });
      const home = demoHome(result);
      if (!home)
        throw new AppError(
          "contract",
          "The demo didn’t open. Try again in a moment.",
          true,
        );
      const org =
        result.orgId ?? /^school\/([0-9a-f-]{36})(\/|$)/i.exec(home)?.[1];
      if (org) rememberPlace(session.accountId, `school:${org.toLowerCase()}`);
      await refreshMe(session);
      return home;
    },
  });
}
