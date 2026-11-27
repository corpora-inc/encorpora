/**
 * A procedure run as a `harvest-run/1` report (harvest/CONTRACT.md, "Run
 * report"): the one format the core's `Records::report()` writes for the
 * queued upload, and the format the app exports. Every step of the procedure
 * is listed, recorded or not.
 *
 * Mapping from the app's run store (harvest-core #2558):
 *   run.id -> run_id, procId -> proc_id, equipment -> equip_id,
 *   startedAt/finishedAt -> started_at/finished_at, steps[i].result -> outcome,
 *   photoIds -> photos[{path, sha256}], at -> recorded_at, section_ids as is.
 */
import type { Procedure } from "../engine/types.ts";
import type { Run, StepRecord } from "../store/runs.ts";

export type Outcome = "pass" | "fail" | "na" | "value" | "note" | "photo";

export interface PhotoRef {
  path: string;
  sha256: string;
}

export interface ReportStep {
  ord: number;
  text: string | null;
  section_ids: string[];
  check_kind: string | null;
  outcome: Outcome | null;
  value: string | null;
  note: string | null;
  photos: PhotoRef[];
  structured: unknown;
  deficiency: boolean;
  recorded_at: string | null;
}

export interface RunReport {
  format: "harvest-run/1";
  pack_id: string;
  pack_version: string;
  run_id: string;
  proc_id: string;
  title: string | null;
  role: string;
  equip_id: string | null;
  asset: string | null;
  status: "open" | "complete" | "abandoned";
  steps_known: boolean;
  started_at: string;
  finished_at: string | null;
  steps: ReportStep[];
}

/** Where a step photo sits inside an export bundle. */
export const photoPath = (id: string) => `photos/${id}.jpg`;

const filled = (s: string) => (s.trim() ? s.trim() : null);

/**
 * The outcome a step record carries, under the core's rules for its check
 * kind: pass_fail takes pass/fail; value, note and photo steps count as
 * recorded only with their value, note or photo.
 */
export function outcomeOf(checkKind: string, rec: StepRecord): Outcome | null {
  switch (checkKind) {
    case "pass_fail":
      return rec.result;
    case "value":
      return filled(rec.value) ? "value" : null;
    case "note":
      return filled(rec.note) ? "note" : null;
    case "photo":
      return rec.photoIds.length > 0 ? "photo" : null;
    default:
      throw new Error(`Unknown check kind ${checkKind}`);
  }
}

/**
 * Build the report. `photoSha256` maps every photo id the run references to
 * the hex SHA-256 of the bytes written at `photoPath(id)`.
 */
export function runReport(run: Run, proc: Procedure, pack: { pack_id: string; version: string }, photoSha256: ReadonlyMap<string, string>): RunReport {
  // The app records steps by position; if the pack's procedure no longer has
  // the same number of steps, positions cannot be trusted to name steps.
  const stepsKnown = proc.proc_id === run.procId && proc.steps.length === run.steps.length;
  const steps: ReportStep[] = [];
  run.steps.forEach((rec, i) => {
    const step = stepsKnown ? proc.steps[i]! : null;
    const outcome = step ? outcomeOf(step.check_kind, rec) : rec.result;
    const photos = rec.photoIds.map((id) => {
      const sha256 = photoSha256.get(id);
      if (!sha256 || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`Photo ${id} has no SHA-256`);
      return { path: photoPath(id), sha256 };
    });
    const recorded = outcome !== null || photos.length > 0 || filled(rec.note) !== null || filled(rec.value) !== null;
    // Without the pack's steps, only what was recorded is listed.
    if (!step && !recorded) return;
    steps.push({
      ord: i + 1,
      text: step ? step.text : null,
      section_ids: step ? [...step.section_ids] : [],
      check_kind: step ? step.check_kind : null,
      outcome,
      value: filled(rec.value),
      note: filled(rec.note),
      photos,
      structured: null,
      deficiency: outcome === "fail",
      recorded_at: recorded ? rec.at : null,
    });
  });
  return {
    format: "harvest-run/1",
    pack_id: pack.pack_id,
    pack_version: pack.version,
    run_id: run.id,
    proc_id: run.procId,
    title: stepsKnown ? proc.title : run.title,
    role: run.role,
    equip_id: run.equipment,
    asset: null,
    status: run.finishedAt ? "complete" : "open",
    steps_known: stepsKnown,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    steps,
  };
}

/** File name for an exported run: procedure, date and run id, safe on every platform. */
export function exportName(run: Run): string {
  // No path separators, no leading dot or dash (hidden files, option-like names).
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return `${safe(run.procId)}-${run.startedAt.slice(0, 10)}-${safe(run.id).slice(-6)}.zip`;
}
