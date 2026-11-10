import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import type { AdultStart } from "../../../learning/starting-point";
import type { AuthSession } from "../../auth";
import { useLearnerStore } from "../../learner-store";
import { request } from "../../lib/api";
import { queryClient, refreshMe } from "../../lib/query";
import { rememberPlace } from "./place-memory";

/** Where their own practice starts: a school-age birth year, or, past
 * school age, the start they chose (`pastSchoolAge`). */
export type OwnStart = { birthYear: number } | { start: AdultStart };
/** What the starter sends: one answer and only what that answer needs. */
export type StarterAnswer =
  | ({ as: "myself"; timezone: string } & OwnStart)
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

/** The demo a teacher or a school explores before any agreement or payment:
 * what `POST /school/demo` answers (src/schools/demo/routes.ts). */
const demoResult = z.object({
  demo: z.object({
    kind: z.enum(["class", "school"]),
    orgId: z.string().min(1),
    path: z.string().min(1),
  }),
});
/** Where a demo opens: a class on its Today, a school on its overview. */
export function demoHome({ demo }: z.infer<typeof demoResult>) {
  return demo.kind === "school"
    ? `school/${demo.orgId}`
    : demo.path.replace(/^\/+/, "");
}
/** Starts the class or school demo, remembers it as the place `/` opens, and
 * says where it opens. */
export function useStartDemo(session: AuthSession) {
  return useMutation({
    mutationFn: async (kind: "class" | "school") => {
      const result = await request("/school/demo", demoResult, {
        token: session.token,
        // The device's own zone, so the demo's today is the viewer's.
        body: { kind, timezone: deviceTimeZone() },
      });
      rememberPlace(session.accountId, `school:${result.demo.orgId}`);
      await refreshMe(session);
      return demoHome(result);
    },
  });
}
