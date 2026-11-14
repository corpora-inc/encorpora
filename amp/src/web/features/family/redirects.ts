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
): { family: string; classId: string } | null {
  if (me?.familyClass?.orgId === org)
    return { family: org, classId: me.familyClass.classId };
  const shared = me?.secondParentOf?.find((entry) => entry.orgId === org);
  return shared ? { family: org, classId: shared.classId } : null;
}

/** A child of the family, by the roster person that names them in its
 * class. */
export type PersonMap = ReadonlyMap<string, string>;

type Search = Record<string, unknown>;
export type FamilyTarget = {
  /** The new address, with its leading slash. */
  to: string;
  search: Search;
};

const pick = (search: Search, keys: readonly string[]) =>
  Object.fromEntries(
    Object.entries(search).filter(
      ([key, value]) => keys.includes(key) && value !== undefined,
    ),
  );

/** The address keys each leaf's screen reads, besides `open`. */
const CARRIED: Record<string, readonly string[]> = {
  "": ["devices"],
  map: ["skill", "lens", "sort"],
  "reports/grades": ["term", "year", "student"],
  reports: ["term", "year"],
  time: ["week", "from", "to", "student"],
  people: ["devices"],
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
    case "roster":
      return { leaf: "people" };
    // Cards and the sign-in board are the children's own devices.
    case "cards":
      return { leaf: "people", devices: true };
    case "start":
      return { leaf: "", devices: true };
    case "settings":
    case "experience":
      return { leaf: "settings" };
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
  people,
}: {
  family: string;
  parts: readonly string[];
  search: Search;
  /** Read, never carried: a fragment is where a link's secret lives. */
  hash?: string;
  people: PersonMap;
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
        withOpen({}, [{ kind: "student", id: target.person }, ...answer]),
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
  const keys =
    CARRIED[target.leaf] ??
    (target.leaf.startsWith("workbooks")
      ? Object.keys(search).filter((key) => key !== OPEN_KEY)
      : []);
  // What the screen opens itself: the devices sheet, and a workbook
  // stack's chosen children (person ids, bounded).
  const devices =
    target.devices || search.devices === 1 || search.devices === "1";
  const students =
    target.leaf.startsWith("workbooks") &&
    typeof search.students === "string" &&
    search.students.length <= 1000 &&
    /^[0-9a-f,-]+$/i.test(search.students)
      ? { students: search.students }
      : {};
  return viaReturn(
    familyPath(family, target.leaf),
    withOpen(pick(search, keys), rest),
    {
      ...(devices && target.leaf !== "settings" ? { devices: 1 } : {}),
      ...students,
    },
  );
}

/** A school-level page of a family's org (`/school/<family>/<page>`): the
 * family's own equivalent, through the one return contract. */
export function familyOrgTarget({
  family,
  page,
  search,
}: {
  family: string;
  page: "roster" | "map" | "settings" | "today";
  search: Search;
  hash?: string;
}): FamilyTarget {
  const leaf = {
    roster: "people",
    map: "map",
    settings: "settings",
    today: "",
  }[page];
  return viaReturn(familyPath(family, leaf), search);
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
