/* Repair the template version recorded on stored problems.

   Until the engine stamped it, every served problem recorded
   templateVersion 1 except count-objects, so a problem drawn at version 2 or
   3 regenerated differently from (template, version, seed). This finds each
   stored copy's true version by regenerating at every catalog version and
   matching (src/math/recorded-version.ts), and writes it back.

   Dry run by default: reads only and prints counts per template.

     AMP_DATABASE_URL=... tsx scripts/repair-template-versions.ts
     AMP_DATABASE_URL=... tsx scripts/repair-template-versions.ts --apply --journal <file>
     AMP_DATABASE_URL=... tsx scripts/repair-template-versions.ts --revert <file>

   --apply writes the journal (every change: table, id, from, to) before it
   changes anything, and each update only applies while the row still holds
   the version it read. --revert puts back `from` wherever the row still
   holds `to`. Problem flags take their instance's repaired version.
   Workbook specs and offline pack signatures are not changed: a workbook
   records its catalog version already, and a signed pack expires in a day. */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import {
  recordedVersionOf,
  type StoredCopy,
} from "../src/math/recorded-version.js";
import { createDatabasePool } from "../src/server/database.js";

type Change = {
  table: "amp_instances" | "amp_offline_instances" | "amp_problem_flags";
  id: string;
  templateId: string;
  from: number | null;
  to: number;
};
type Counts = Record<string, number>;
export type RepairReport = {
  rows: Counts;
  byTemplate: Record<string, Counts>;
  changes: Change[];
};

const BATCH = 500;
const bump = (counts: Counts, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

async function scanTable(
  pool: Pool,
  table: "amp_instances" | "amp_offline_instances",
  report: RepairReport,
) {
  let after = "";
  for (;;) {
    const { rows } = await pool.query<{ id: string; content: unknown }>(
      `SELECT id, content FROM ${table} WHERE id > $1 ORDER BY id LIMIT ${BATCH}`,
      [after],
    );
    if (!rows.length) return;
    after = rows[rows.length - 1]!.id;
    for (const row of rows) {
      const content = (row.content ?? {}) as StoredCopy;
      const templateId = String(
        (content.public as { templateId?: unknown } | null | undefined)
          ?.templateId ?? "(none)",
      );
      const verdict = recordedVersionOf(content);
      const key =
        verdict.kind === "ok"
          ? `ok:${verdict.tier}`
          : verdict.kind === "repair"
            ? `repair:${verdict.tier}`
            : `unmatched:${verdict.reason}`;
      bump(report.rows, `${table} ${key}`);
      bump((report.byTemplate[templateId] ??= {}), key);
      if (verdict.kind === "repair")
        report.changes.push({
          table,
          id: row.id,
          templateId,
          from: verdict.recorded,
          to: verdict.version,
        });
    }
  }
}

/** Flags copy their instance's version; a flag whose instance is gone keeps
 * its own, since the flag holds only the prompt. */
async function flagChanges(pool: Pool, report: RepairReport) {
  const repaired = new Map(
    report.changes
      .filter((c) => c.table === "amp_instances")
      .map((c) => [c.id, c]),
  );
  if (!repaired.size) return;
  const { rows } = await pool.query<{
    id: string;
    problem_id: string;
    template_version: number;
  }>(
    "SELECT id, problem_id, template_version FROM amp_problem_flags WHERE problem_id = ANY($1::text[])",
    [[...repaired.keys()]],
  );
  for (const flag of rows) {
    const instance = repaired.get(flag.problem_id)!;
    if (flag.template_version === instance.to) continue;
    bump(report.rows, "amp_problem_flags repair:instance");
    report.changes.push({
      table: "amp_problem_flags",
      id: flag.id,
      templateId: instance.templateId,
      from: flag.template_version,
      to: instance.to,
    });
  }
}

export async function findRepairs(pool: Pool): Promise<RepairReport> {
  const report: RepairReport = { rows: {}, byTemplate: {}, changes: [] };
  await scanTable(pool, "amp_instances", report);
  await scanTable(pool, "amp_offline_instances", report);
  await flagChanges(pool, report);
  return report;
}

/** Set each change's `to` where the row still holds `from` (or, reverting,
 * the reverse). Returns how many rows changed. */
export async function applyChanges(
  pool: Pool,
  changes: readonly Change[],
  direction: "apply" | "revert",
): Promise<number> {
  let changed = 0;
  for (let i = 0; i < changes.length; i += BATCH) {
    const batch = changes.slice(i, i + BATCH);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const table of [
        "amp_instances",
        "amp_offline_instances",
        "amp_problem_flags",
      ] as const) {
        const rows = batch.filter((c) => c.table === table);
        if (!rows.length) continue;
        const ids = rows.map((c) => c.id);
        const expect = rows.map((c) => (direction === "apply" ? c.from : c.to));
        const set = rows.map((c) => (direction === "apply" ? c.to : c.from));
        const result =
          table === "amp_problem_flags"
            ? await client.query(
                `UPDATE amp_problem_flags f SET template_version = v.set
                 FROM unnest($1::uuid[], $2::int[], $3::int[]) AS v(id, expect, set)
                 WHERE f.id = v.id AND f.template_version IS NOT DISTINCT FROM v.expect`,
                [ids, expect, set],
              )
            : await client.query(
                `UPDATE ${table} t
                 SET content = jsonb_set(t.content, '{public,templateVersion}', to_jsonb(v.set))
                 FROM unnest($1::text[], $2::int[], $3::int[]) AS v(id, expect, set)
                 WHERE t.id = v.id
                   AND (t.content->'public'->>'templateVersion')::int IS NOT DISTINCT FROM v.expect`,
                [ids, expect, set],
              );
        changed += result.rowCount ?? 0;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return changed;
}

function printReport(report: RepairReport) {
  console.log("Rows by table and verdict:");
  for (const [key, n] of Object.entries(report.rows).sort())
    console.log(`  ${key.padEnd(52)} ${n}`);
  const repaired = Object.entries(report.byTemplate)
    .filter(([, counts]) =>
      Object.keys(counts).some((key) => !key.startsWith("ok:")),
    )
    .sort(([a], [b]) => a.localeCompare(b));
  console.log(
    `\nTemplates with rows to repair or unmatched: ${repaired.length}`,
  );
  for (const [templateId, counts] of repaired)
    console.log(
      `  ${templateId.padEnd(40)} ${Object.entries(counts)
        .sort()
        .map(([k, n]) => `${k}=${n}`)
        .join(" ")}`,
    );
  const moves: Counts = {};
  for (const c of report.changes) bump(moves, `${c.table} ${c.from}→${c.to}`);
  console.log("\nChanges:");
  for (const [key, n] of Object.entries(moves).sort())
    console.log(`  ${key.padEnd(40)} ${n}`);
  console.log(`  total ${report.changes.length}`);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : (args[i + 1] ?? "");
  };
  if (!process.env.AMP_DATABASE_URL)
    throw new Error("AMP_DATABASE_URL is required");
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  try {
    const revert = flag("--revert");
    if (revert) {
      const changes = JSON.parse(await readFile(revert, "utf8")) as Change[];
      const n = await applyChanges(pool, changes, "revert");
      console.log(`Reverted ${n} of ${changes.length} rows from ${revert}.`);
      return;
    }
    const report = await findRepairs(pool);
    printReport(report);
    if (!args.includes("--apply")) {
      console.log("\nDry run: nothing written. Pass --apply --journal <file>.");
      return;
    }
    const journal = flag("--journal");
    if (!journal) throw new Error("--apply needs --journal <file>");
    await writeFile(journal, JSON.stringify(report.changes, null, 1), {
      flag: "wx",
    });
    const n = await applyChanges(pool, report.changes, "apply");
    console.log(
      `\nApplied ${n} of ${report.changes.length}; journal ${journal}. Undo with --revert ${journal}.`,
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
