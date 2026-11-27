import { z } from "zod";
import { clientKinds, FLAG_NOTE_MAX } from "./problem-flags";

/** "Report this film": the reasons a viewer can choose, in display order. */
export const filmFlagReasons = [
  "picture-wrong",
  "voice-wrong",
  "too-fast",
  "confusing",
  "other",
] as const;
export type FilmFlagReason = (typeof filmFlagReasons)[number];
/** Short labels: the interface is translated into about 50 languages. */
export const filmFlagReasonLabels: Record<FilmFlagReason, string> = {
  "picture-wrong": "Picture looks wrong",
  "voice-wrong": "Voice sounds wrong",
  "too-fast": "Too fast",
  confusing: "Confusing",
  other: "Other",
};
/** Who sent a report, as the server decided from the request's credential:
 * a learner's own session (a school or family student), an anonymous trial,
 * an adult's account, or nobody signed in. */
export const filmViewers = ["learner", "trial", "adult", "signed-out"] as const;
export type FilmViewer = (typeof filmViewers)[number];
/** The player's two stages (film/stage.ts `Layout`). */
export const filmLayouts = ["wide", "tall"] as const;

const commit = z.string().regex(/^[0-9a-f]{40}$/);
export const filmFlagSchema = z
  .object({
    /** The problem type the film was opened for (its manifest key). */
    templateId: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    /** The edition the viewer watched: the version the server's manifest
     * named for this film when the player opened it. */
    filmVersion: z.string().regex(/^[a-f0-9]{64}$/),
    /** Present when the film was opened as help for one problem
     * (`/lessons/<type>/watch/<problem>`). */
    problemId: z
      .string()
      .regex(/^[A-Za-z0-9._:-]{1,160}$/)
      .optional(),
    requestId: z.string().uuid(),
    /** Playback time when the viewer pressed the flag. */
    seconds: z.number().finite().min(0).max(36_000),
    layout: z.enum(filmLayouts),
    reasons: z
      .array(z.enum(filmFlagReasons))
      .min(1)
      .max(filmFlagReasons.length)
      .refine((list) => new Set(list).size === list.length, "Duplicate reason"),
    note: z.string().trim().max(FLAG_NOTE_MAX).optional(),
    webCommit: commit.nullable().optional(),
    client: z
      .object({
        kind: z.enum(clientKinds),
        viewport: z
          .object({
            width: z.number().int().min(1).max(20000),
            height: z.number().int().min(1).max(20000),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type FilmFlagInput = z.infer<typeof filmFlagSchema>;

/** One stored report, as written by the server. */
export type FilmFlag = {
  id: string;
  requestId: string;
  filmId: string;
  filmVersion: string;
  templateId: string;
  problemId: string | null;
  seconds: number;
  layout: (typeof filmLayouts)[number];
  reasons: FilmFlagReason[];
  note: string | null;
  viewer: FilmViewer;
  /** The learner whose session sent it (a learner or a trial), when their
   * learning is permitted; otherwise null. */
  learnerId: string | null;
  /** The adult account that sent it; null for every other viewer. */
  accountId: string | null;
  webCommit: string | null;
  apiCommit: string | null;
  clientKind: (typeof clientKinds)[number];
  viewport: { width: number; height: number };
};
