import { randomUUID } from "node:crypto";
import { lessonFilms } from "../content/lesson-films";
import { ApiError } from "../server/repository";
import type { FilmFlag, FilmFlagInput, FilmViewer } from "./film-flags";

/** Who is sending a report, as the server decided it from the credential
 * (server/app.ts `filmReporter`), and whether this viewer may add a note. */
export type FilmReporter = {
  viewer: FilmViewer;
  learnerId: string | null;
  accountId: string | null;
  noteAllowed: boolean;
};

/**
 * Saves a viewer's report on a lesson film at a moment of it. The film's id
 * comes from the server's manifest for the problem type; the client supplies
 * the edition it played, the moment, reasons, an optional note and its own
 * build and viewport. One viewer may report the same film many times (each
 * moment is its own report); a retried request returns the report it
 * already saved.
 */
export async function recordFilmFlag(
  save: (flag: FilmFlag) => Promise<{ id: string } | null>,
  input: FilmFlagInput,
  reporter: FilmReporter,
  apiCommit: string | null,
): Promise<{ id: string; recorded: true }> {
  const film = lessonFilms[input.templateId];
  if (!film) throw new ApiError(404, "Film not found");
  const note = input.note?.trim() || null;
  if (note && !reporter.noteAllowed)
    throw new ApiError(400, "Notes are not available for this viewer");
  const flag: FilmFlag = {
    id: randomUUID(),
    requestId: input.requestId,
    filmId: film.id,
    filmVersion: input.filmVersion,
    templateId: input.templateId,
    problemId: input.problemId ?? null,
    seconds: Math.round(input.seconds * 10) / 10,
    layout: input.layout,
    reasons: input.reasons,
    note,
    viewer: reporter.viewer,
    learnerId: reporter.learnerId,
    accountId: reporter.accountId,
    webCommit: input.webCommit ?? null,
    apiCommit,
    clientKind: input.client.kind,
    viewport: input.client.viewport,
  };
  const saved = await save(flag);
  // The request id is another viewer's report: not this one's to repeat.
  if (!saved) throw new ApiError(409, "This report was already sent");
  return { id: saved.id, recorded: true };
}
