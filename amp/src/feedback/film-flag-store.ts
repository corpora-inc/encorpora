import type { Pool } from "pg";
import type { FilmFlag, FilmFlagReason, FilmViewer } from "./film-flags";

/**
 * Writes one report. A retry (the same request id from the same viewer)
 * returns the report already saved; a request id another viewer used
 * returns null.
 */
export async function saveFilmFlag(
  pool: Pick<Pool, "query">,
  flag: FilmFlag,
): Promise<{ id: string } | null> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO amp_film_flags(id,request_id,film_id,film_version,template_id,problem_id,seconds,layout,
       reasons,note,viewer,learner_id,account_id,web_commit,api_commit,client_kind,viewport_width,viewport_height)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (request_id) DO NOTHING RETURNING id`,
    [
      flag.id,
      flag.requestId,
      flag.filmId,
      flag.filmVersion,
      flag.templateId,
      flag.problemId,
      flag.seconds,
      flag.layout,
      flag.reasons,
      flag.note,
      flag.viewer,
      flag.learnerId,
      flag.accountId,
      flag.webCommit,
      flag.apiCommit,
      flag.clientKind,
      flag.viewport.width,
      flag.viewport.height,
    ],
  );
  if (inserted.rows[0]) return inserted.rows[0];
  const retried = await pool.query<{ id: string }>(
    `SELECT id FROM amp_film_flags WHERE request_id=$1 AND viewer=$2
       AND learner_id IS NOT DISTINCT FROM $3 AND account_id IS NOT DISTINCT FROM $4`,
    [flag.requestId, flag.viewer, flag.learnerId, flag.accountId],
  );
  return retried.rows[0] ?? null;
}

/** One report as the film team reads it: no learner or account identifier,
 * and the note only when asked for. */
export type FilmFlagReport = {
  id: string;
  createdAt: string;
  filmId: string;
  filmVersion: string;
  templateId: string;
  problemId: string | null;
  seconds: number;
  /** The moment as the player shows it (1:23). */
  at: string;
  layout: "wide" | "tall";
  reasons: FilmFlagReason[];
  viewer: FilmViewer;
  clientKind: string;
  viewport: string;
  webCommit: string | null;
  apiCommit: string | null;
  note?: string | null;
};

/** Reports, newest first: one film's (`filmId`), or every film's, sent in
 * the last `days` days, at most `limit`. */
export async function filmFlagReports(
  pool: Pick<Pool, "query">,
  options: {
    filmId?: string;
    days: number;
    limit: number;
    notes: boolean;
    now?: Date;
  },
): Promise<FilmFlagReport[]> {
  const since = new Date(
    (options.now ?? new Date()).getTime() - options.days * 86_400_000,
  );
  const rows = await pool.query(
    `SELECT id,created_at,film_id,film_version,template_id,problem_id,seconds::float8 AS seconds,layout,
       reasons,viewer,client_kind,viewport_width,viewport_height,web_commit,api_commit${options.notes ? ",note" : ""}
     FROM amp_film_flags
     WHERE created_at>=$1 AND ($2::text IS NULL OR film_id=$2)
     ORDER BY created_at DESC, id LIMIT $3`,
    [since, options.filmId ?? null, options.limit],
  );
  return rows.rows.map((row) => {
    const seconds = Number(row.seconds);
    return {
      id: row.id as string,
      createdAt: new Date(row.created_at as string).toISOString(),
      filmId: row.film_id as string,
      filmVersion: row.film_version as string,
      templateId: row.template_id as string,
      problemId: (row.problem_id as string | null) ?? null,
      seconds,
      at: `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`,
      layout: row.layout as "wide" | "tall",
      reasons: row.reasons as FilmFlagReason[],
      viewer: row.viewer as FilmViewer,
      clientKind: row.client_kind as string,
      viewport: `${row.viewport_width}x${row.viewport_height}`,
      webCommit: (row.web_commit as string | null) ?? null,
      apiCommit: (row.api_commit as string | null) ?? null,
      ...(options.notes ? { note: (row.note as string | null) ?? null } : {}),
    };
  });
}
