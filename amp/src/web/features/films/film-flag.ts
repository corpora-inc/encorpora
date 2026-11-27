import {
  filmFlagReasonLabels,
  filmFlagReasons,
  type FilmFlagInput,
  type FilmFlagReason,
} from "../../../feedback/film-flags";
import { noteAllowed } from "../../../feedback/problem-flags";
import type { FamilyLearner } from "../../../family/contracts";
import { webBuildCommit } from "../../problem-flag";
import type { Report } from "../../ReportForm";

/** The sheet's reasons, in display order. */
export const filmReportReasons = filmFlagReasons.map((value) => ({
  value,
  label: filmFlagReasonLabels[value],
}));

/** The moment the viewer pressed the flag (film/player.ts `report`). */
export type FilmMoment = { seconds: number; layout: "wide" | "tall" };

/**
 * Whether this viewer's sheet offers the note, by the server's own rule
 * (server/app.ts `filmReporter`): an adult's own sign-in always; a learner's
 * session (a student token) by `noteAllowed`, with the year and roster state
 * of the learner the session is for; nobody signed in, never. A learner not
 * yet known here chooses reasons only.
 */
export function filmNoteAllowed(
  session: { token: string } | null,
  learner: Pick<FamilyLearner, "birthYear" | "namePending"> | null,
): boolean {
  if (!session) return false;
  if (!session.token.startsWith("st_")) return true;
  return (
    !!learner &&
    noteAllowed({
      trial: false,
      schoolRestricted: learner.namePending === true,
      birthYear: learner.birthYear,
    })
  );
}

/** The request body for `POST /film-flags`. The server takes the film's id
 * from its manifest and who sent it from the credential. */
export async function filmFlagBody(
  film: { templateId: string; version: string; problemId?: string },
  moment: FilmMoment,
  requestId: string,
  report: Report<FilmFlagReason>,
): Promise<FilmFlagInput> {
  const note = report.note?.trim();
  return {
    templateId: film.templateId,
    filmVersion: film.version,
    ...(film.problemId ? { problemId: film.problemId } : {}),
    requestId,
    seconds: Math.max(0, Math.round(moment.seconds * 10) / 10),
    layout: moment.layout,
    reasons: report.reasons,
    ...(note ? { note } : {}),
    webCommit: await webBuildCommit(),
    client: {
      kind: "web",
      viewport: {
        width: Math.max(1, Math.round(innerWidth)),
        height: Math.max(1, Math.round(innerHeight)),
      },
    },
  };
}
