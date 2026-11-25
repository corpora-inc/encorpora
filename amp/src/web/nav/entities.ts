/**
 * The entity registry and the layer stack (docs/design/ia.md, "Navigation").
 *
 * Every detail a person can dip into from anywhere (a student, one of their
 * answers, a skill, a problem type's lesson, an area of a level, a learner's
 * workbook for a day) is an entity: a kind and an id.
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
/** A day, as a workbook's address names it. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The address key naming the learner a layer was opened for
 * (`?open=skill:<id>&for=<learner>`): a parent opens a skill from one
 * child's block on a screen that shows several children, and the practice
 * the layer offers is that child's. An id only; whoever reads it checks it
 * against the family's own children (features/practice/CurriculumPractice).
 */
export const FOR_KEY = "for";
/** A learner's id, as a layer's `for` holds it. */
export const isLearnerId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

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
  /** One of the reader's own answers (`/me`), replayed: `<attempt>`. */
  "own-work": {
    id: (id: string) => ATTEMPT.test(id),
    noun: "answer",
    keys: ["skill"],
  },
  /** A skill of the curriculum. */
  skill: {
    id: (id: string) => SLUG.test(id),
    noun: "skill",
    /** Whose it was opened for (a child's block on a family's Today): the
     * practice it offers is theirs. It goes with the layer. */
    keys: [FOR_KEY],
  },
  /** A problem type's short lesson. */
  lesson: {
    id: (id: string) => SLUG.test(id),
    noun: "lesson",
    keys: [FOR_KEY],
  },
  /** One area of a learner's level (a strand, or `overall`): its skills on
   * the grade scale, over the page whose level it is. */
  area: { id: (id: string) => SLUG.test(id), noun: "area", keys: [FOR_KEY] },
  /** A learner's workbook for a day, in the workbook maker:
   * `<learner>.<date>`. Opened from a skill's layer, over the screen the
   * skill was opened on (features/workbooks/SkillWorkbook.tsx). Its layer
   * opens only for one of the reader's own learners (WorkbookLayer.tsx). */
  workbook: {
    id: (id: string) => {
      const [learner, date, extra] = id.split(".");
      return (
        extra === undefined && UUID.test(learner ?? "") && DAY.test(date ?? "")
      );
    },
    noun: "workbook",
  },
} as const;

export type EntityKind = keyof typeof ENTITIES;

/** Whether a kind's layer reads an address key beside its id. */
export const readsKey = (kind: EntityKind, key: string) =>
  "keys" in ENTITIES[kind] &&
  (ENTITIES[kind] as { keys: readonly string[] }).keys.includes(key);

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
/** One of the reader's own answers. */
export const ownWork = (attempt: string): Entity => ({
  kind: "own-work",
  id: attempt,
});
/** A learner's workbook for a day. */
export const workbookDay = (learner: string, date: string): Entity => ({
  kind: "workbook",
  id: `${learner}.${date}`,
});
/** The learner and day of a workbook's entity. */
export function workbookDayParts(id: string) {
  const [learner = "", date = ""] = id.split(".");
  return { learner, date };
}
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
/** Where putting the whole overlay away returns (the scrim; an answer's
 * own close): back to the page it was opened over, except that an answer
 * replay is a base of its own. A layer above a replay (its lesson) closes
 * back to the replay; the replay closes back to the page. The depth of the
 * stack to keep: 0 for the page. */
export function closeDepth(stack: Entity[], index: number): number {
  for (let at = index - 1; at >= 0; at--)
    if (stack[at]!.kind === "work" || stack[at]!.kind === "own-work")
      return at + 1;
  return 0;
}
/** The stack with its top layer swapped (stepping through answers). */
export const replaceTop = (raw: unknown, entity: Entity) =>
  writeStack([...readStack(raw).slice(0, -1), entity]);
