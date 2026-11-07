import type { PoolClient } from "pg";
import type { Actor, SchoolTarget } from "./authz.js";
import { can } from "./authz.js";
import {
  classExperienceWriteSchema,
  experienceKeys,
  leaveOffSchema,
  orgExperienceWriteSchema,
  type Experience,
  type ExperienceKey,
  type NamedScope,
} from "./classroom-contracts.js";
import { SchoolError } from "./contracts.js";
import { recordEvent } from "./events.js";
import { activeToday } from "./principal.js";
import type { SchoolRepository } from "./repository.js";
import {
  assertSettingsWritable,
  resolveSettings,
  SettingLockedError,
  standingsScopes,
  type SchoolSettings,
  type ScopeRef,
  type SettingsScope,
} from "./settings.js";
import { STUDENT_NAME } from "./sign-in.js";
import { clearStandingsCache } from "./standings.js";

type Database = Pick<PoolClient, "query">;
type Target = Extract<SchoolTarget, { kind: "org" | "class" }>;

/** The class-scope key listing students a teacher left off standings. Beside the
 * settings in `amp_scope_settings`, read by `standings.ts`; `resolveSettings`
 * only reads its own keys. */
export const LEFT_OFF_KEY = "leftOff";

const scopeId = (target: Target) =>
  target.kind === "class" ? target.classId : target.orgId;

/** Everything above this scope, then this scope, in the order that resolves. */
async function chainFor(db: Database, target: Target) {
  const orgIds =
    target.kind === "org"
      ? target.path.slice(0, target.path.indexOf(target.orgId))
      : target.path;
  const stored = await db.query(
    `SELECT scope_kind AS kind,scope_id AS id,"values",locked FROM amp_scope_settings
     WHERE (scope_kind='org' AND scope_id=ANY($1::uuid[])) OR (scope_kind=$2 AND scope_id=$3)`,
    [orgIds, target.kind, scopeId(target)],
  );
  const rows = stored.rows as (SettingsScope & { id: string })[];
  const above = orgIds.flatMap((id) =>
    rows.filter((row) => row.kind === "org" && row.id === id),
  );
  const here = rows.find(
    (row) => row.kind === target.kind && row.id === scopeId(target),
  );
  return { above, here: here ?? null };
}

async function scopeNames(db: Database, target: Target) {
  const names = new Map<string, string>();
  const orgs = await db.query(
    "SELECT id,name FROM amp_orgs WHERE id=ANY($1::uuid[])",
    [target.path],
  );
  for (const org of orgs.rows) names.set(org.id, org.name);
  if (target.kind === "class") {
    const klass = await db.query("SELECT name FROM amp_classes WHERE id=$1", [
      target.classId,
    ]);
    names.set(target.classId, klass.rows[0]?.name ?? "");
  }
  return names;
}

/** What a scope is showing, who set each thing, and what it can change. */
export async function experienceView(
  db: Database,
  actor: Actor,
  target: Target,
): Promise<Experience> {
  const { above, here } = await chainFor(db, target);
  const names = await scopeNames(db, target);
  const named = (ref: ScopeRef | null): NamedScope | null =>
    ref && { kind: ref.kind, id: ref.id, name: names.get(ref.id) ?? "" };
  const resolved = resolveSettings(here ? [...above, here] : above);
  const inherited = resolveSettings(above);
  const setting = <K extends ExperienceKey>(key: K) => ({
    value: resolved[key].value,
    setBy: named(resolved[key].setBy),
    lockedBy: named(resolved[key].lockedBy),
    own: here?.values[key] !== undefined,
    inherited: {
      value: inherited[key].value,
      from: named(inherited[key].setBy),
    },
  });
  // A student is on a district board only if there is a district above them.
  const org = (
    await db.query("SELECT kind FROM amp_orgs WHERE id=$1", [target.orgId])
  ).rows[0];
  const hasDistrict = target.path.length > 1 || org?.kind !== "school";
  const students =
    target.kind === "class" ? await classRows(db, target, here) : undefined;
  const edit = can(actor, "settings.write", target);
  return {
    scope: {
      kind: target.kind,
      id: scopeId(target),
      name: names.get(scopeId(target)) ?? "",
    },
    canEdit: edit,
    canLock: edit && target.kind === "org",
    standingsOptions: standingsScopes.filter(
      (scope) => scope !== "district" || hasDistrict,
    ),
    settings: {
      levels: setting("levels"),
      standings: setting("standings"),
      measure: setting("measure"),
      deviceMode: setting("deviceMode"),
    },
    ...(students ? { students } : {}),
  };
}

const leftOffIn = (scope: SettingsScope | null) => {
  const list = (scope?.values as Record<string, unknown> | undefined)?.[
    LEFT_OFF_KEY
  ];
  return new Set(Array.isArray(list) ? (list as string[]) : []);
};

async function classRows(
  db: Database,
  target: Extract<Target, { kind: "class" }>,
  here: SettingsScope | null,
) {
  const left = leftOffIn(here);
  const rows = await db.query(
    `SELECT p.id,${STUDENT_NAME} AS name FROM amp_enrollments e
     JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
     JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
     WHERE e.class_id=$1 AND e.role='student' AND ${activeToday("e", "o")}
     ORDER BY lower(${STUDENT_NAME}),p.id`,
    [target.classId],
  );
  return rows.rows.map((row) => ({
    id: row.id,
    name: row.name,
    leftOff: left.has(row.id),
  }));
}

async function lockedRow(client: PoolClient, target: Target) {
  await client.query(
    `INSERT INTO amp_scope_settings(scope_kind,scope_id) VALUES($1,$2)
     ON CONFLICT(scope_kind,scope_id) DO NOTHING`,
    [target.kind, scopeId(target)],
  );
  const row = await client.query(
    `SELECT "values",locked FROM amp_scope_settings WHERE scope_kind=$1 AND scope_id=$2 FOR UPDATE`,
    [target.kind, scopeId(target)],
  );
  return row.rows[0] as {
    values: Record<string, unknown>;
    locked: string[];
  };
}
const eventScope = (target: Target) => ({
  orgId: target.orgId,
  targetKind: target.kind,
  targetId: scopeId(target),
});

/** A class's teacher or a school's admin changes this scope's own settings. A
 * value locked above is refused, and a lock sets a rule for everyone below. */
export async function writeExperience(
  repository: SchoolRepository,
  actor: Actor,
  target: Target,
  raw: unknown,
  actorPersonId: string | null,
): Promise<Experience> {
  const input =
    target.kind === "org"
      ? orgExperienceWriteSchema.parse(raw)
      : { ...classExperienceWriteSchema.parse(raw), locks: undefined };
  const values = input.values ?? {};
  const locks = input.locks ?? {};
  const touched = experienceKeys.filter(
    (key) => values[key] !== undefined || locks[key] !== undefined,
  );
  return repository.transaction(async (client) => {
    const { above } = await chainFor(client, target);
    try {
      assertSettingsWritable(
        above,
        Object.fromEntries(
          touched.map((key) => [key, true]),
        ) as Partial<SchoolSettings>,
      );
    } catch (error) {
      if (error instanceof SettingLockedError)
        throw new SchoolError(409, "setting_locked");
      throw error;
    }
    const current = await lockedRow(client, target);
    const nextValues = { ...current.values };
    const nextLocked = new Set(current.locked);
    for (const key of touched) {
      const value = values[key];
      if (value === null) delete nextValues[key];
      else if (value !== undefined) nextValues[key] = value;
      if (locks[key] === true) nextLocked.add(key);
      if (locks[key] === false) nextLocked.delete(key);
    }
    const pick = (from: Record<string, unknown>) =>
      Object.fromEntries(touched.map((key) => [key, from[key] ?? null]));
    const lockedKeys = [...nextLocked].sort();
    const changed =
      JSON.stringify(pick(current.values)) !==
        JSON.stringify(pick(nextValues)) ||
      JSON.stringify([...current.locked].sort()) !== JSON.stringify(lockedKeys);
    if (changed) {
      await client.query(
        `UPDATE amp_scope_settings SET "values"=$3,locked=$4,updated_at=now() WHERE scope_kind=$1 AND scope_id=$2`,
        [target.kind, scopeId(target), JSON.stringify(nextValues), lockedKeys],
      );
      await recordEvent(client, {
        ...eventScope(target),
        actorPersonId,
        action: "settings.changed",
        detail: {
          before: { values: pick(current.values), locked: current.locked },
          after: { values: pick(nextValues), locked: lockedKeys },
        },
      });
      clearStandingsCache();
    }
    return experienceView(client, actor, target);
  });
}

/** Leaves a student off this class's board and every wider one. */
export async function setLeftOff(
  repository: SchoolRepository,
  actor: Actor,
  target: Extract<Target, { kind: "class" }>,
  studentId: string,
  raw: unknown,
  actorPersonId: string | null,
): Promise<Experience> {
  const { leftOff } = leaveOffSchema.parse(raw);
  return repository.transaction(async (client) => {
    const { here } = await chainFor(client, target);
    const onRoster = (await classRows(client, target, here)).some(
      (row) => row.id === studentId,
    );
    if (!onRoster) throw new SchoolError(404, "not_found");
    const current = await lockedRow(client, target);
    const list = leftOffIn({
      kind: "class",
      id: target.classId,
      values: current.values,
      locked: [],
    });
    if (list.has(studentId) !== leftOff) {
      if (leftOff) list.add(studentId);
      else list.delete(studentId);
      await client.query(
        `UPDATE amp_scope_settings SET "values"=$3,updated_at=now() WHERE scope_kind=$1 AND scope_id=$2`,
        [
          "class",
          target.classId,
          JSON.stringify({
            ...current.values,
            [LEFT_OFF_KEY]: [...list].sort(),
          }),
        ],
      );
      await recordEvent(client, {
        orgId: target.orgId,
        actorPersonId,
        action: "standings.left_off",
        targetKind: "person",
        targetId: studentId,
        detail: { before: { leftOff: !leftOff }, after: { leftOff } },
      });
      clearStandingsCache();
    }
    return experienceView(client, actor, target);
  });
}
