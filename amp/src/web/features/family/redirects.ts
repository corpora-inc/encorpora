import type { SignedInMe } from "../../../account/contracts";
import type { FamilyPlaces } from "../../../family/projection-contracts";
import { appReturn } from "../spaces/returns";
import {
  OPEN_KEY,
  readStack,
  workParts,
  writeStack,
  type Entity,
} from "../../nav/entities";

/*
 * A family's older addresses (docs/architecture/spaces.md, "Family-org legacy
 * addresses"). Before P2 a family lived at its class,
 * `/school/<family org>/classes/<class>/…`; each of those leaves now opens the
 * matching `/family/<family>/…` screen, carrying the query, the hash and the
 * layers opened over it. A child named by their roster person becomes the
 * child's own page. Pure, so every row is tested (family-redirects.test.ts).
 */

/** Where a family's screens live: Today at its root. */
export const familyPath = (family: string, leaf = "") =>
  leaf ? `/family/${family}/${leaf}` : `/family/${family}`;

/** A family this account belongs to as a parent: its holder or its second
 * parent, with the class it lives in. A co-teacher's family class stays a
 * class (a tutoring group), and is never redirected. */
export function parentFamilyAt(
  me: SignedInMe | null | undefined,
  org: string,
): { org: string; classId: string; holder: boolean } | null {
  if (me?.familyClass?.orgId === org)
    return { org, classId: me.familyClass.classId, holder: true };
  const shared = me?.secondParentOf?.find((entry) => entry.orgId === org);
  return shared ? { org, classId: shared.classId, holder: false } : null;
}

/** A child of the family, by the roster person that names them in its
 * class. */
export type PersonMap = ReadonlyMap<string, string>;

type Search = Record<string, unknown>;
export type FamilyTarget = {
  /** The new address, with its leading slash. */
  to: string;
  search: Search;
  /** Only a known settings section, never a secret. */
  hash?: string;
  /** The sheet the screen opens on arrival (nav/sheet.ts), in history
   * state, never the address: their own devices. */
  state?: { sheet: string };
};

const pick = (search: Search, keys: readonly string[]) =>
  Object.fromEntries(
    Object.entries(search).filter(
      ([key, value]) => keys.includes(key) && value !== undefined,
    ),
  );

/** The address keys each leaf's screen reads, besides `open`. */
const CARRIED: Record<string, readonly string[]> = {
  "": [],
  "reports/grades": ["term", "year", "student"],
  settings: [],
};

/**
 * The layers over an old address, with a child named by their roster person
 * taken out as the page they now are: the first `student` layer chooses the
 * child's page and its answers stay layers over it. A person who isn't one
 * of the family's own children (another family's child in a tutoring
 * group) leaves the stack as it was, for the group.
 */
function childOf(
  raw: unknown,
  people: PersonMap,
): { learner: string | null; rest: Entity[]; foreign: boolean } {
  const stack = readStack(raw);
  const at = stack.findIndex((layer) => layer.kind === "student");
  if (at < 0) return { learner: null, rest: stack, foreign: false };
  const person = stack[at]!.id;
  const learner = people.get(person) ?? null;
  if (!learner) return { learner: null, rest: stack, foreign: true };
  // Their answers stay over their page; anyone else's go with them.
  const rest = stack.filter(
    (layer, index) =>
      index !== at &&
      (layer.kind !== "work" || workParts(layer.id).student === person),
  );
  return { learner, rest, foreign: false };
}

const withOpen = (search: Search, stack: Entity[]) => {
  const open = writeStack(stack);
  return open ? { ...search, [OPEN_KEY]: open } : search;
};

/**
 * A target through the one return contract (`appReturn`,
 * docs/architecture/spaces.md "Returns"): only the search keys that describe
 * a view survive, a layer stack is revalidated, and the fragment, where a
 * link's secret lives, is never carried. `opens` adds what the new screen
 * opens itself (the devices sheet).
 */
function viaReturn(
  to: string,
  search: Search,
  opens: Search = {},
): FamilyTarget {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search))
    if (typeof value === "string" || typeof value === "number")
      query.set(key, String(value));
  const text = query.toString();
  const kept = appReturn(text ? `${to}?${text}` : to);
  const url = new URL(kept ?? to, "https://amp.invalid");
  return {
    to: url.pathname,
    search: { ...Object.fromEntries(url.searchParams), ...opens },
  };
}

/** The family screen an old class leaf opens. */
function leafFor(parts: readonly string[]): {
  leaf: string;
  /** A child named in the address itself (`map/<person>`). */
  person?: string;
  attempt?: string;
  devices?: true;
  /** A Settings section this leaf opens at. */
  section?: string;
} {
  const [first = "today", second, third, fourth] = parts;
  switch (first) {
    case "today":
      return { leaf: "" };
    case "map":
      return second
        ? third === "work" && fourth
          ? { leaf: "", person: second, attempt: fourth }
          : { leaf: "", person: second }
        : { leaf: "map" };
    case "gradebook":
      return { leaf: "reports/grades" };
    case "report-cards":
      return { leaf: "reports" };
    case "time":
      return { leaf: "time" };
    case "workbooks":
      return { leaf: second ? `workbooks/${second}` : "workbooks" };
    // The family's people are Settings' People.
    case "roster":
      return { leaf: "settings" };
    // Cards and the sign-in board are the children's own devices, a sheet
    // over Settings (its sign-in cards print there).
    case "cards":
      return { leaf: "settings", devices: true };
    case "start":
      return { leaf: "", devices: true };
    case "settings":
      return { leaf: "settings" };
    // What children see: the family's practice defaults.
    case "experience":
      return { leaf: "settings", section: "family-practice" };
    default:
      // Import, and any leaf the family doesn't have: its unavailable view.
      return { leaf: first };
  }
}

/**
 * Where `/school/<family>/classes/<class>/<parts…>` opens now, for a parent
 * of that family, through the one return contract: the layers (a child by
 * their roster person becomes the child's page) and the view keys the old
 * screen read come along; the fragment never does.
 */
export function familyClassTarget({
  family,
  parts,
  search,
  hash,
  people,
  only,
}: {
  family: string;
  parts: readonly string[];
  search: Search;
  /** Never carried, except a known settings section: a fragment is where a
   * link's secret lives. */
  hash?: string;
  people: PersonMap;
  /** The family's one child, when it has exactly one. */
  only?: string;
}): FamilyTarget {
  const target = leafFor(parts);
  const { learner, rest, foreign } = childOf(search[OPEN_KEY], people);
  const named = target.person ? (people.get(target.person) ?? null) : null;
  // A child named in the path: their page, with the one answer opened.
  if (target.person) {
    const answer = target.attempt
      ? [{ kind: "work" as const, id: `${target.person}.${target.attempt}` }]
      : [];
    if (!named)
      return viaReturn(
        familyPath(family, "group"),
        withOpen(pick(search, ["skill"]), [
          { kind: "student", id: target.person },
          ...answer,
        ]),
      );
    return viaReturn(
      familyPath(family, `kids/${named}`),
      withOpen(pick(search, ["skill"]), answer),
    );
  }
  // Another family's child: their tutoring group, with the same layers.
  if (foreign)
    return viaReturn(familyPath(family, "group"), withOpen({}, rest));
  if (learner)
    return viaReturn(
      familyPath(family, `kids/${learner}`),
      withOpen(pick(search, ["skill"]), rest),
    );
  const part = childPart(family, target.leaf, search, rest, only);
  if (part) return part;
  const keys =
    CARRIED[target.leaf] ??
    (target.leaf.startsWith("workbooks")
      ? Object.keys(search).filter((key) => key !== OPEN_KEY)
      : []);
  // What the screen opens itself, typed and validated beyond the shared
  // return keys: the devices sheet (history state), a workbook's identity
  // (its set on a day, the stack's day, minutes, paper and chosen children)
  // and a settings section. Anything else, and every other fragment, is
  // dropped.
  const devices =
    target.devices || search.devices === 1 || search.devices === "1";
  const opens: Search = target.leaf.startsWith("workbooks")
    ? workbookIdentity(search)
    : {};
  const result = viaReturn(
    familyPath(family, target.leaf),
    withOpen(pick(search, keys), rest),
    opens,
  );
  const section = target.section ?? hash;
  return {
    ...result,
    ...(target.leaf === "settings" && section && SETTINGS_SECTIONS.has(section)
      ? { hash: section }
      : {}),
    ...(devices ? { state: { sheet: "devices" } } : {}),
  };
}

/** The record leaves that are parts of each child's page now (family-routes'
 * aliases), and the part each opens at. */
const CHILD_PARTS: Record<string, string | null> = {
  map: null,
  time: "child-time",
  reports: "child-reports",
  workbooks: "child-workbooks",
};

/**
 * Where a record leaf opens, computed once so no alias hop follows: for a
 * family of one child, that child's page at the part (Progress keeps its
 * curriculum layers); for several, Today, where each child's card opens
 * their page. The workbook print for several keeps its own address. Null
 * for any other leaf.
 */
function childPart(
  family: string,
  leaf: string,
  search: Search,
  rest: readonly Entity[],
  only: string | undefined,
): FamilyTarget | null {
  if (!(leaf in CHILD_PARTS)) return null;
  const part = CHILD_PARTS[leaf]!;
  if (
    leaf === "workbooks" &&
    (search.several !== undefined || workbookIdentity(search).several)
  )
    return null;
  // Progress's view goes with it to a child's page; Today keeps only the
  // layers (and an answer's skill).
  const carried =
    part === null
      ? pick(search, only ? ["skill", "lens", "sort"] : ["skill"])
      : {};
  const result = viaReturn(
    familyPath(family, only ? `kids/${only}` : ""),
    withOpen(carried, part === null ? [...rest] : []),
  );
  return part && only ? { ...result, hash: part } : result;
}

/** The family Settings sections an old settings anchor may name. */
const SETTINGS_SECTIONS = new Set([
  "family-children",
  "family-year",
  "family-practice",
  "family-account",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A workbook's own identity in an old address: the set printed on a day
 * (its QR code names it), and a stack's day, minutes, paper and children. */
export function workbookIdentity(search: Search): Search {
  const text = (key: string) =>
    typeof search[key] === "string" || typeof search[key] === "number"
      ? String(search[key])
      : "";
  const students = text("students")
    .split(",")
    .filter((id) => UUID.test(id))
    .slice(0, 60);
  return {
    ...(/^[1-9]\d{0,2}$/.test(text("set")) ? { set: Number(text("set")) } : {}),
    ...(DAY.test(text("date")) ? { date: text("date") } : {}),
    ...(/^(30|45|60)$/.test(text("minutes"))
      ? { minutes: Number(text("minutes")) }
      : {}),
    ...(/^(letter|a4)$/.test(text("paper")) ? { paper: text("paper") } : {}),
    ...(students.length ? { students: students.join(","), several: 1 } : {}),
  };
}

/** A school-level page of a family's org (`/school/<family>/<page>`): the
 * family's own equivalent, through the one return contract; a child named
 * by their roster person opens as their page, as on a class address. */
export function familyOrgTarget({
  family,
  page,
  search,
  hash,
  people = new Map(),
  only,
}: {
  family: string;
  page: "roster" | "map" | "settings" | "today";
  search: Search;
  hash?: string;
  people?: PersonMap;
  /** The family's one child, when it has exactly one. */
  only?: string;
}): FamilyTarget {
  const leaf = {
    roster: "settings",
    map: "map",
    settings: "settings",
    today: "",
  }[page];
  const { learner, rest } = childOf(search[OPEN_KEY], people);
  if (learner)
    return viaReturn(
      familyPath(family, `kids/${learner}`),
      withOpen(pick(search, ["skill"]), rest),
    );
  const part = childPart(family, leaf, search, rest, only);
  if (part) return part;
  const result = viaReturn(familyPath(family, leaf), search);
  return leaf === "settings" && hash && SETTINGS_SECTIONS.has(hash)
    ? { ...result, hash }
    : result;
}

/** The person→learner map of a family's own children in its class. */
export function peopleOf(
  children: readonly {
    id: string;
    classes: readonly { id: string; personId: string }[];
  }[],
  classId: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const child of children)
    for (const entry of child.classes)
      if (entry.id === classId) map.set(entry.personId, child.id);
  return map;
}

/** The family `/family` opens: the account's own, else the one family it
 * belongs to; null when there are several to choose between, or none. */
export function landingFamily(places: FamilyPlaces | null | undefined) {
  const parents = (places?.families ?? []).filter(
    (family) => family.role !== "co-teacher",
  );
  const own = parents.find((family) => family.role === "holder");
  if (own) return own.familyId;
  return parents.length === 1 ? parents[0]!.familyId : null;
}

/** The family's own children who aren't in its own class: each practices
 * in another family's group, so the class's own reports never read them. */
export function childrenElsewhere<
  T extends { classes: readonly { id: string }[] },
>(children: readonly T[], classId: string | null): T[] {
  return children.filter(
    (child) => !classId || !child.classes.some((entry) => entry.id === classId),
  );
}

/** The address keys that once opened a sheet over a family screen, and the
 * sheet each opens now (nav/sheet.ts). */
const SHEET_KEYS: Record<string, string> = {
  devices: "devices",
  add: "add-children",
};

/**
 * An older family address that opened a sheet with a key (`?devices=1`,
 * `?add=1`): one hop to the same screen without it, the sheet opening from
 * history state. Null when the address has none.
 */
export function sheetHop(
  pathname: string,
  search: Search,
): { href: string; state: { sheet: string } } | null {
  const key = Object.keys(SHEET_KEYS).find(
    (name) => search[name] !== undefined,
  );
  if (!key) return null;
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(search))
    if (!(name in SHEET_KEYS) && value !== undefined)
      query.set(
        name,
        typeof value === "string" ? value : JSON.stringify(value),
      );
  const text = query.toString();
  return {
    href: text ? `${pathname}?${text}` : pathname,
    state: { sheet: SHEET_KEYS[key]! },
  };
}
