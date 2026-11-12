import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { gradingKinds, type GradingKind } from "./contracts.js";
import { recordEvent } from "./events.js";
import type { SchoolRepository } from "./repository.js";
import { ensureDivision } from "./setup.js";
import { YEAR_IN_USE } from "./years.js";

/**
 * A school's grading periods: set once for every class, beside its year and
 * terms. A class follows the school while its periods are the school's, and
 * has its own when they differ, so nothing marks which is which and every
 * reader of a class's `grading_kind` keeps reading the periods in effect.
 *
 * Until the school sets them, its periods are the ones most of its classes
 * use (semesters with no classes yet). Changing them moves every class that
 * followed, except a class with a closed term: its terms and grades stay
 * exactly as they are, and it keeps its periods as its own.
 */
export type SchoolGrading = {
  kind: GradingKind;
  /** The school chose them; otherwise read from its classes. */
  chosen: boolean;
  classes: number;
  /** Classes whose periods differ from the school's. */
  own: number;
};

const CLASSES_HERE = `
  FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
  JOIN amp_academic_sessions cs ON cs.id=c.session_id
  WHERE o.path @> ARRAY[$1]::uuid[] AND c.archived_at IS NULL AND ${YEAR_IN_USE}`;

export async function schoolGrading(
  db: Pool | PoolClient,
  orgId: string,
): Promise<SchoolGrading> {
  const [setting, kinds] = await Promise.all([
    db.query(
      `SELECT "values"->>'gradingKind' AS kind FROM amp_scope_settings
       WHERE scope_kind='org' AND scope_id=$1`,
      [orgId],
    ),
    db.query(
      `SELECT c.grading_kind AS kind,count(*)::int AS n ${CLASSES_HERE}
       GROUP BY c.grading_kind ORDER BY n DESC,c.grading_kind`,
      [orgId],
    ),
  ]);
  const stored = setting.rows[0]?.kind as GradingKind | undefined;
  const rows = kinds.rows as { kind: GradingKind; n: number }[];
  const kind: GradingKind =
    stored && gradingKinds.includes(stored)
      ? stored
      : (rows[0]?.kind ?? "semester");
  const classes = rows.reduce((sum, row) => sum + row.n, 0);
  const own = rows
    .filter((row) => row.kind !== kind)
    .reduce((sum, row) => sum + row.n, 0);
  return { kind, chosen: !!stored, classes, own };
}

export const schoolGradingSchema = z.strictObject({
  kind: z.enum(gradingKinds),
});

export async function setSchoolGrading(
  repo: SchoolRepository,
  orgId: string,
  body: unknown,
  actorPersonId: string | null,
) {
  const { kind } = schoolGradingSchema.parse(body);
  return repo.transaction(async (client: PoolClient) => {
    const before = await schoolGrading(client, orgId);
    await ensureDivision(client, repo, orgId, kind);
    await client.query(
      `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values")
       VALUES('org',$1,jsonb_build_object('gradingKind',$2::text))
       ON CONFLICT(scope_kind,scope_id) DO UPDATE
       SET "values"=amp_scope_settings."values"||EXCLUDED."values",updated_at=now()`,
      [orgId, kind],
    );
    // The classes that followed the school move with it; one with a closed
    // term keeps its periods, so its terms and grades never change.
    const moved =
      before.kind === kind
        ? 0
        : ((
            await client.query(
              `UPDATE amp_classes SET grading_kind=$2
               WHERE id IN (SELECT c.id ${CLASSES_HERE} AND c.grading_kind=$3
                 AND NOT EXISTS (SELECT 1 FROM amp_term_grades g
                   WHERE g.class_id=c.id AND g.frozen_at IS NOT NULL))`,
              [orgId, kind, before.kind],
            )
          ).rowCount ?? 0);
    await recordEvent(client, {
      orgId,
      actorPersonId,
      action: "calendar.grading",
      targetKind: "org",
      targetId: orgId,
      detail: { before: { kind: before.kind }, after: { kind, moved } },
    });
    return schoolGrading(client, orgId);
  });
}
