import type { Pool } from "pg";
import {
  resolveSettings,
  type ResolvedSettings,
  type ScopeKind,
  type SettingsScope,
} from "./settings.js";

/** Each enrollment's resolved settings: its org path root first, then the
 * class, then the person. A student in no class still has their school's. */
export async function enrollmentSettings(
  pool: Pick<Pool, "query">,
  personId: string,
  home: { path: string[] },
  classes: readonly { id: string; path: string[] }[],
): Promise<ResolvedSettings[]> {
  const orgs = [...new Set([home, ...classes].flatMap((row) => row.path))];
  const stored = await pool.query(
    `SELECT scope_kind,scope_id,"values",locked FROM amp_scope_settings
     WHERE (scope_kind='org' AND scope_id=ANY($1::uuid[]))
        OR (scope_kind='class' AND scope_id=ANY($2::uuid[]))
        OR (scope_kind='person' AND scope_id=$3)`,
    [orgs, classes.map((c) => c.id), personId],
  );
  const scope = (kind: ScopeKind, id: string): SettingsScope[] => {
    const row = stored.rows.find(
      (r) => r.scope_kind === kind && r.scope_id === id,
    );
    return row ? [{ kind, id, values: row.values, locked: row.locked }] : [];
  };
  const chain = (path: string[], classId?: string) => [
    ...path.flatMap((id) => scope("org", id)),
    ...(classId ? scope("class", classId) : []),
    ...scope("person", personId),
  ];
  return (
    classes.length
      ? classes.map((c) => chain(c.path, c.id))
      : [chain(home.path)]
  ).map(resolveSettings);
}
