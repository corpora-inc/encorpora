/**
 * The entity registry and the layer stack (docs/design/ia.md, "Navigation").
 *
 * Every detail a person can dip into from anywhere (a student, one of their
 * answers, a skill, a problem type's lesson, an area of a level) is an entity: a kind and an id.
 * Opening one never leaves the page: it becomes a layer over it, carried in
 * the page's own address as `?open=student:<id>,work:<id>.<attempt>`. The
 * page under it stays mounted with its scroll, sort and filters; X, Escape
 * and Back pop one layer; refresh and a shared link restore the whole stack.
 *
 * This file is the only place a layer's address is built or read. It is pure,
 * so the crawler (scripts/verify-navigation-ui.ts) reads the same registry.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;
/** An answer's id: a uuid, or a stored attempt's hex digest. */
const ATTEMPT = /^[0-9a-f][0-9a-f-]{7,99}$/i;

/** Each kind: how its id reads, and what it is called. */
export const ENTITIES = {
  /** A student's record, in their class or school. */
  student: {
    id: (id: string) => UUID.test(id),
    noun: "student",
    /** Only in a school or class: a staff member's view of a student. */
    staff: true,
  },
  /** One answer of a student's, replayed: `<student>.<attempt>`. */
  work: {
    id: (id: string) => {
      const [student, attempt, extra] = id.split(".");
      return (
        extra === undefined &&
        UUID.test(student ?? "") &&
        ATTEMPT.test(attempt ?? "")
      );
    },
    noun: "answer",
    staff: true,
    /** Narrows Previous and Next to one skill; it goes with the answer. */
    keys: ["skill"],
  },
  /** A skill of the curriculum. */
  skill: { id: (id: string) => SLUG.test(id), noun: "skill" },
  /** A problem type's short lesson. */
  lesson: { id: (id: string) => SLUG.test(id), noun: "lesson" },
  /** One area of a learner's level (a strand, or `overall`): its skills on
   * the grade scale, over the page whose level it is. */
  area: { id: (id: string) => SLUG.test(id), noun: "area" },
} as const;

export type EntityKind = keyof typeof ENTITIES;

/** The address keys a stack's layers read, beyond `open`, that leave with
 * the last layer that reads them. */
export function layerKeysLeft(before: Entity[], after: Entity[]) {
  const reads = (stack: Entity[]) =>
    new Set(
      stack.flatMap((layer) =>
        "keys" in ENTITIES[layer.kind]
          ? [...(ENTITIES[layer.kind] as { keys: readonly string[] }).keys]
          : [],
      ),
    );
  const still = reads(after);
  return [...reads(before)].filter((key) => !still.has(key));
}
export const ENTITY_KINDS = Object.keys(ENTITIES) as EntityKind[];
export type Entity = { kind: EntityKind; id: string };

/** The deepest a stack goes: deeper, the newest replaces the top. */
export const MAX_LAYERS = 5;
/** The address key that holds the stack. */
export const OPEN_KEY = "open";

/** Whether a kind opens only in a school or class (a student, an answer);
 * own practice opens the rest (a skill, a lesson). */
export const staffOnly = (kind: EntityKind) =>
  "staff" in ENTITIES[kind] && ENTITIES[kind].staff === true;

export const isEntity = (entity: Entity) =>
  ENTITY_KINDS.includes(entity.kind) && ENTITIES[entity.kind].id(entity.id);

/** One answer's entity. */
export const work = (student: string, attempt: string): Entity => ({
  kind: "work",
  id: `${student}.${attempt}`,
});
/** The student and attempt of an answer's entity. */
export function workParts(id: string) {
  const [student = "", attempt = ""] = id.split(".");
  return { student, attempt };
}

/** The stack an address holds, oldest first: only well-formed layers. */
export function readStack(raw: unknown): Entity[] {
  if (typeof raw !== "string" || raw.length > 1000) return [];
  return raw
    .split(",")
    .map((part) => {
      const at = part.indexOf(":");
      return {
        kind: part.slice(0, at) as EntityKind,
        id: part.slice(at + 1),
      };
    })
    .filter(isEntity)
    .slice(0, MAX_LAYERS);
}
/** The address value of a stack, or undefined when it is empty. */
export function writeStack(stack: Entity[]): string | undefined {
  return stack.length
    ? stack.map((entity) => `${entity.kind}:${entity.id}`).join(",")
    : undefined;
}

/** The stack with `entity` opened over it. Opening what is already on top
 * changes nothing; opening something already lower brings the stack back to
 * it. */
export function pushLayer(raw: unknown, entity: Entity) {
  const stack = readStack(raw);
  const at = stack.findIndex(
    (layer) => layer.kind === entity.kind && layer.id === entity.id,
  );
  if (at >= 0) return writeStack(stack.slice(0, at + 1));
  const next = [...stack, entity];
  return writeStack(
    next.length > MAX_LAYERS ? [...stack.slice(0, -1), entity] : next,
  );
}
/** The stack without its top layer. */
export const popLayer = (raw: unknown) =>
  writeStack(readStack(raw).slice(0, -1));
/** The stack with its top layer swapped (stepping through answers). */
export const replaceTop = (raw: unknown, entity: Entity) =>
  writeStack([...readStack(raw).slice(0, -1), entity]);
