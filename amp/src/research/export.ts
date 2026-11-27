/** A study's research extract (docs/research-export.md): one CSV per table,
 * keyed by study ID only, a codebook and a SHA-256 manifest, as one ZIP
 * stream. Everything is read inside one read-only snapshot, a cursor batch at
 * a time, and each batch leaves as ZIP bytes before the next is fetched, so
 * memory stays at a batch whatever the study's size. Nothing is written to
 * disk: the caller encrypts the stream (`encrypt.ts`) and uploads it.
 *
 * No file holds a name, address, account or learner id, birth date, typed
 * text or calendar date: participants are keyed by study ID and time is the
 * instructional week. That is the de-identification the study's data
 * security plan promises, and FERPA's for school records released for
 * research (34 CFR 99.31(b)(1)). */
import { createHash, type Hash } from "node:crypto";
import type { PoolClient } from "pg";
import { Zip, ZipDeflate, strToU8 } from "fflate";
import { skills } from "../curriculum/catalog.js";
import { areaOf } from "../curriculum/areas.js";
import { gradeNumber } from "../learning/item-calibration.js";
import {
  codebookJson,
  codebookMarkdown,
  EXTRACT_VERSION,
  headerOf,
  type ExtractFileName,
} from "./codebook.js";
import { assertStudyCode } from "./participants.js";
import { studyIdMapper, type StudyIdKey } from "./study-id.js";

export const EXTRACT_BATCH = 1000;

type Database = Pick<PoolClient, "query">;
type Cell = string | number | boolean | null | undefined;

export type ManifestFile = {
  name: string;
  rows: number | null;
  bytes: number;
  sha256: string;
};
export type ExtractManifest = {
  format: "amp-research-extract";
  version: number;
  study: string;
  generatedAt: string;
  participants: number;
  files: ManifestFile[];
};

/** The study's participants as each query sees them: enrolled by the
 * snapshot, not withdrawn, learner not deleted, with the learner's local
 * calendar zone and enrolment day. Week n of a participant is local days
 * [enrolled_day + 7(n-1), enrolled_day + 7n). */
const PARTICIPANTS = `WITH p AS MATERIALIZED (
  SELECT r.learner_id,r.account_id,r.enrolled_at,z.zone,
    (r.enrolled_at AT TIME ZONE z.zone)::date AS enrolled_day
  FROM amp_research_participants r
  JOIN amp_learners l ON l.id=r.learner_id AND l.deleted_at IS NULL
  CROSS JOIN LATERAL (SELECT amp_learner_zone(r.learner_id) AS zone) z
  WHERE r.study=$1 AND r.withdrawn_at IS NULL AND r.enrolled_at<=now()
)`;
const weekOf = (at: string) =>
  `((((${at}) AT TIME ZONE p.zone)::date-p.enrolled_day)/7+1)`;
const CURRENT_WEEK = weekOf("now()");
const helpHas = (kind: string) =>
  `CASE WHEN a.id IS NULL THEN NULL WHEN jsonb_typeof(a.outcome->'help')='array' THEN a.outcome->'help' ? '${kind}' ELSE false END`;
const surface = (name: string) =>
  `floor(COALESCE(sum(d.active_ms) FILTER (WHERE d.surface='${name}'),0)/1000)::bigint`;
const helpKind = (name: string) =>
  `COALESCE(sum(h.opened) FILTER (WHERE h.kind::text='${name}'),0)`;

/** Each participant file: its query returns `learner_id` (and `account_id`
 * where the file has a family column) plus exactly its other columns, by
 * name, in the order the codebook gives. */
const QUERIES: Record<Exclude<ExtractFileName, "skills.csv">, string> = {
  "participants.csv": `${PARTICIPANTS}
    SELECT p.learner_id,p.account_id,${CURRENT_WEEK} AS current_week
    FROM p ORDER BY p.learner_id`,
  "answers.csv": `${PARTICIPANTS}
    SELECT p.learner_id,
      row_number() OVER (PARTITION BY p.learner_id ORDER BY i.created_at,i.id) AS sequence,
      ${weekOf("i.created_at")} AS week,
      i.content->'public'->>'skillId' AS skill_id,
      i.content->'public'->>'templateId' AS template_id,
      i.content->'selection'->>'reason' AS selection_reason,
      i.content->'selection'->>'strand' AS selection_strand,
      i.content->'selection'->>'practicePolicy' AS policy_version,
      COALESCE((i.content->>'workingTogether')::boolean,false) AS working_together,
      CASE WHEN a.id IS NOT NULL THEN 'answered'
        WHEN COALESCE((i.content->>'skipped')::boolean,false) THEN 'skipped'
        ELSE 'unanswered' END AS outcome,
      (a.outcome->>'correct')::boolean AS correct,
      CASE WHEN jsonb_typeof(a.outcome->'parts')='array' THEN
        (SELECT count(*) FILTER (WHERE x='true'::jsonb) FROM jsonb_array_elements(a.outcome->'parts') x) END AS parts_correct,
      CASE WHEN jsonb_typeof(a.outcome->'parts')='array' THEN jsonb_array_length(a.outcome->'parts') END AS parts_total,
      (a.outcome->>'assisted')::boolean AS assisted,
      CASE WHEN a.id IS NOT NULL THEN COALESCE((a.outcome->>'correct')::boolean,false)
        AND NOT COALESCE((a.outcome->>'assisted')::boolean,false)
        AND COALESCE((a.outcome->>'evidenceWeight')::numeric,1)>=1 END AS independent,
      ${helpHas("hint")} AS help_hint,
      ${helpHas("lesson")} AS help_lesson,
      ${helpHas("video")} AS help_video,
      ${helpHas("example")} AS help_example,
      ${helpHas("person")} AS help_adult,
      CASE WHEN a.id IS NOT NULL THEN COALESCE(a.outcome->>'evidenceSource','app') END AS evidence_source,
      CASE WHEN a.id IS NOT NULL THEN COALESCE((a.outcome->>'evidenceWeight')::numeric,1)::float8 END AS evidence_weight,
      CASE WHEN a.id IS NOT NULL AND a.outcome->>'evidenceSource' IS NULL
        THEN round(extract(epoch FROM a.created_at-i.created_at)::numeric,1)::float8 END AS seconds_to_answer,
      round(lvl.overall_level::numeric,2)::float8 AS learner_level
    FROM p
    JOIN amp_instances i ON i.learner_id=p.learner_id AND i.created_at>=p.enrolled_at
    LEFT JOIN amp_attempts a ON a.problem_id=i.id
    LEFT JOIN LATERAL (
      SELECT d.overall_level FROM amp_level_days d
      WHERE d.learner_id=p.learner_id AND d.day<=(i.created_at AT TIME ZONE p.zone)::date
      ORDER BY d.day DESC LIMIT 1
    ) lvl ON true
    ORDER BY p.learner_id,i.created_at,i.id`,
  "workbooks.csv": `${PARTICIPANTS}
    SELECT p.learner_id,
      ${weekOf("w.created_at")} AS week,
      w.number,w.minutes,
      CASE WHEN jsonb_typeof(w.spec->'sections')='array' THEN jsonb_array_length(w.spec->'sections') ELSE 0 END AS sections,
      CASE WHEN jsonb_typeof(w.spec->'sections')='array' THEN
        (SELECT COALESCE(sum(CASE WHEN jsonb_typeof(s->'items')='array' THEN jsonb_array_length(s->'items') ELSE 0 END),0)::int
           FROM jsonb_array_elements(w.spec->'sections') s) ELSE 0 END AS problems,
      (w.spec->'choices'->>'lesson')::boolean AS lesson,
      w.spec->'choices'->>'lean' AS lean,
      w.spec->>'focusSkill' AS focus_skill_id,
      (w.spec->>'level')::float8 AS working_level
    FROM p JOIN amp_workbooks w ON w.learner_id=p.learner_id AND w.created_at>=p.enrolled_at
    ORDER BY p.learner_id,w.created_at,w.number,w.minutes`,
  "adult_checkins.csv": `${PARTICIPANTS}
    SELECT p.learner_id,${weekOf("c.at")} AS week,c.role::text AS role,c.kind::text AS kind
    FROM p JOIN amp_adult_checkins c ON c.learner_id=p.learner_id AND c.at>=p.enrolled_at
    ORDER BY p.learner_id,c.at`,
  "weekly_activity.csv": `${PARTICIPANTS}
    SELECT p.learner_id,w.week,
      COALESCE(t.active_seconds,0) AS active_seconds,COALESCE(t.practice_seconds,0) AS practice_seconds,
      COALESCE(t.feedback_seconds,0) AS feedback_seconds,COALESCE(t.lesson_seconds,0) AS lesson_seconds,
      COALESCE(t.hint_seconds,0) AS hint_seconds,COALESCE(t.example_seconds,0) AS example_seconds,
      COALESCE(t.video_seconds,0) AS video_seconds,COALESCE(t.map_seconds,0) AS map_seconds,
      COALESCE(t.other_seconds,0) AS other_seconds,
      COALESCE(s.answers,0) AS answers,COALESCE(s.correct,0) AS correct,COALESCE(s.independent,0) AS independent,
      COALESCE(h.lessons_opened,0) AS lessons_opened,COALESCE(h.hints_opened,0) AS hints_opened,
      COALESCE(h.examples_opened,0) AS examples_opened,COALESCE(h.videos_opened,0) AS videos_opened,
      COALESCE(h.video_plays,0) AS video_plays,COALESCE(h.video_completes,0) AS video_completes,
      COALESCE(h.prints,0) AS prints
    FROM p
    CROSS JOIN LATERAL generate_series(1,${CURRENT_WEEK}) AS w(week)
    LEFT JOIN LATERAL (
      SELECT floor(COALESCE(sum(d.active_ms),0)/1000)::bigint AS active_seconds,
        ${surface("practice")} AS practice_seconds,${surface("feedback")} AS feedback_seconds,
        ${surface("lesson")} AS lesson_seconds,${surface("hint")} AS hint_seconds,
        ${surface("example")} AS example_seconds,${surface("video")} AS video_seconds,
        ${surface("map")} AS map_seconds,${surface("other")} AS other_seconds
      FROM amp_active_days d
      WHERE d.learner_id=p.learner_id AND d.day>=p.enrolled_day+(w.week-1)*7 AND d.day<p.enrolled_day+w.week*7
    ) t ON true
    LEFT JOIN LATERAL (
      SELECT sum(k.attempts) AS answers,sum(k.correct) AS correct,sum(k.independent) AS independent
      FROM amp_skill_days k
      WHERE k.learner_id=p.learner_id AND k.day>=p.enrolled_day+(w.week-1)*7 AND k.day<p.enrolled_day+w.week*7
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT ${helpKind("lesson")} AS lessons_opened,${helpKind("hint")} AS hints_opened,
        ${helpKind("example")} AS examples_opened,${helpKind("video")} AS videos_opened,
        ${helpKind("video_play")} AS video_plays,${helpKind("video_complete")} AS video_completes,
        ${helpKind("print")} AS prints
      FROM amp_help_days h
      WHERE h.learner_id=p.learner_id AND h.day>=p.enrolled_day+(w.week-1)*7 AND h.day<p.enrolled_day+w.week*7
    ) h ON true
    ORDER BY p.learner_id,w.week`,
};

const cell = (value: Cell): string => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csvLine = (cells: readonly Cell[]) => `${cells.map(cell).join(",")}\r\n`;

/** A file being written into the ZIP: its bytes, rows and running hash. */
class Entry {
  private readonly hash: Hash = createHash("sha256");
  private readonly zip: ZipDeflate;
  bytes = 0;
  rows = 0;
  constructor(
    zip: Zip,
    readonly name: string,
  ) {
    this.zip = new ZipDeflate(name, { level: 6 });
    zip.add(this.zip);
  }
  write(text: string, rows = 0) {
    const data = strToU8(text);
    this.hash.update(data);
    this.bytes += data.length;
    this.rows += rows;
    this.zip.push(data, false);
  }
  end(counted = true): ManifestFile {
    this.zip.push(new Uint8Array(0), true);
    return {
      name: this.name,
      rows: counted ? this.rows : null,
      bytes: this.bytes,
      sha256: this.hash.digest("hex"),
    };
  }
}

/** Streams a study's extract as ZIP bytes; `manifest` resolves when the
 * stream has ended. The client is held for the whole extract (one snapshot)
 * and released by the caller. */
export function researchExtract(options: {
  client: Database;
  study: string;
  key: StudyIdKey;
  batchSize?: number;
  now?: () => Date;
}): { chunks: AsyncGenerator<Uint8Array>; manifest: Promise<ExtractManifest> } {
  const study = assertStudyCode(options.study);
  const batch = options.batchSize ?? EXTRACT_BATCH;
  if (!Number.isInteger(batch) || batch < 1 || batch > 10_000)
    throw new Error("batchSize must be 1-10000");
  const ids = studyIdMapper(options.key, study);
  const { client } = options;
  let resolve!: (manifest: ExtractManifest) => void;
  let reject!: (error: unknown) => void;
  const manifest = new Promise<ExtractManifest>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  // A caller that never awaits the manifest still sees the stream's error.
  manifest.catch(() => {});

  async function* chunks(): AsyncGenerator<Uint8Array> {
    const ready: Uint8Array[] = [];
    let failed: Error | null = null;
    const zip = new Zip((error, data) => {
      if (error) failed = error;
      else ready.push(data);
    });
    const drain = function* () {
      if (failed) throw failed;
      while (ready.length) yield ready.shift()!;
    };
    const files: ManifestFile[] = [];
    let participants = 0;
    let began = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      began = true;
      await client.query("SET LOCAL statement_timeout='120s'");
      // The upload paces the reads; a stalled upload ends the snapshot.
      await client.query(
        "SET LOCAL idle_in_transaction_session_timeout='10min'",
      );
      const generatedAt = (options.now?.() ?? new Date()).toISOString();
      for (const [name, sql] of Object.entries(QUERIES) as [
        keyof typeof QUERIES,
        string,
      ][]) {
        const header = headerOf(name);
        const entry = new Entry(zip, name);
        entry.write(csvLine(header));
        await client.query(
          `DECLARE research_rows NO SCROLL CURSOR FOR ${sql}`,
          [study],
        );
        for (;;) {
          const { rows } = await client.query(
            `FETCH FORWARD ${batch} FROM research_rows`,
          );
          if (!rows.length) break;
          entry.write(
            rows.map((row) => csvLine(cellsOf(header, row, ids))).join(""),
            rows.length,
          );
          yield* drain();
        }
        await client.query("CLOSE research_rows");
        files.push(entry.end());
        if (name === "participants.csv") participants = entry.rows;
        yield* drain();
      }
      await client.query("COMMIT");
      began = false;

      const catalog = new Entry(zip, "skills.csv");
      catalog.write(csvLine(headerOf("skills.csv")));
      for (const skill of skills)
        catalog.write(
          csvLine([
            skill.id,
            skill.title,
            skill.strand,
            areaOf(skill),
            skill.gradeBand,
            gradeNumber[skill.gradeBand],
          ]),
          1,
        );
      files.push(catalog.end());
      for (const [name, text] of [
        ["codebook.md", codebookMarkdown(study)],
        ["codebook.json", JSON.stringify(codebookJson(study), null, 2) + "\n"],
      ] as const) {
        const entry = new Entry(zip, name);
        entry.write(text);
        files.push(entry.end(false));
      }
      yield* drain();

      const result: ExtractManifest = {
        format: "amp-research-extract",
        version: EXTRACT_VERSION,
        study,
        generatedAt,
        participants,
        files,
      };
      const entry = new Entry(zip, "manifest.json");
      entry.write(JSON.stringify(result, null, 2) + "\n");
      entry.end(false);
      zip.end();
      yield* drain();
      resolve(result);
    } catch (error) {
      reject(error);
      throw error;
    } finally {
      if (began)
        await client.query("ROLLBACK").catch((error: unknown) => {
          console.error(
            "research export rollback failed",
            error instanceof Error ? error.message : error,
          );
        });
    }
  }
  return { chunks: chunks(), manifest };
}

/** A query row as the file's cells, in header order. A row with any column
 * the file doesn't declare is refused: nothing reaches a file unnamed. */
function cellsOf(
  header: readonly string[],
  row: Record<string, unknown>,
  ids: ReturnType<typeof studyIdMapper>,
): Cell[] {
  for (const key of Object.keys(row))
    if (key !== "learner_id" && key !== "account_id" && !header.includes(key))
      throw new Error(`Research export column ${key} is not in the codebook`);
  return header.map((column) => {
    if (column === "study_learner_id")
      return ids("learner", String(row.learner_id));
    if (column === "study_family_id")
      return ids("family", String(row.account_id));
    if (!(column in row))
      throw new Error(`Research export query lacks column ${column}`);
    return row[column] as Cell;
  });
}
