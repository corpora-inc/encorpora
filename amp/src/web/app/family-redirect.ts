import type { AuthSession } from "../auth";
import { meOptions, queryClient } from "../lib/query";
import type { SignedInMe } from "../../account/contracts";
import { familyOptions, familyPlacesOptions } from "../features/family/api";
import { ownClassOf } from "../features/spaces/resolve";
import { appReturn } from "../features/spaces/returns";
import { OPEN_KEY, readStack, writeStack } from "../nav/entities";
import {
  familyClassTarget,
  familyOrgTarget,
  parentFamilyAt,
  peopleOf,
  type FamilyTarget,
} from "../features/family/redirects";

/* Where a parent's family lives now, for an older address of it (its class,
   its org's pages, a child by their roster person): the alias rows in
   app/legacy-aliases.ts hop there. Each returns the new address, or null for
   anyone else (the old address is still theirs). A failed read is logged and
   answers null: the address then stays as it was, and its screen shows the
   failure. */

/** A read whose failure leaves the address as it is, logged. */
const orNull =
  (what: string) =>
  (error: unknown): null => {
    console.warn(`${what} didn’t load; the address stays`, error);
    return null;
  };

/**
 * The family a parent's class belongs to. A family's id is an opaque key that
 * need not be its class's org (docs/architecture/family-api.md): it is the
 * family whose own class, by its projection, is this one, among the families
 * this account is that kind of parent of. Null when none is (a refused or
 * failed read): the old address then stays as it was.
 */
async function familyOfClass(
  session: AuthSession,
  me: SignedInMe,
  parent: { classId: string; holder: boolean },
): Promise<string | null> {
  const places = await queryClient
    .ensureQueryData(familyPlacesOptions(session))
    .catch(orNull("Your families"));
  const candidates = (places?.families ?? []).filter((entry) =>
    parent.holder ? entry.role === "holder" : entry.role === "second-parent",
  );
  for (const entry of candidates) {
    const projection = await queryClient
      .ensureQueryData(familyOptions(session, entry.familyId))
      .catch(orNull("A family"));
    if (ownClassOf(me, entry.familyId, projection)?.id === parent.classId)
      return entry.familyId;
  }
  return null;
}

type Located = {
  location: {
    pathname: string;
    search: unknown;
    hash?: string;
  };
  params: unknown;
};

/**
 * A parent opening their family's class at its older address
 * (`/school/<family>/classes/<class>/…`): the family's own screen, with the
 * query, the hash and the layers carried, a child named by their roster
 * person opened as the child's page. Only for the class the relationship
 * names; anyone else (a co-teacher, another class) stays where they are.
 */
export async function toFamilyAddress(
  session: AuthSession,
  { location, params }: Located,
): Promise<FamilyTarget | null> {
  const { org, class: classId } = params as { org: string; class: string };
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(orNull("Your account"));
  const account = me?.signedIn ? me : null;
  const parent = parentFamilyAt(account, org);
  if (!account || !parent || parent.classId !== classId) return null;
  const family = await familyOfClass(session, account, parent);
  if (!family) return null;
  const projection = await queryClient
    .ensureQueryData(familyOptions(session, family))
    .catch(orNull("Your family"));
  // A class that also holds other families' children is a tutoring group:
  // it stays at its class address, the whole group's classroom (R2). Only
  // a family's own class becomes the family's screens.
  if (!projection || projection.teachingPlace?.classId === classId)
    return null;
  const prefix = `/school/${org}/classes/${classId}`;
  const parts = location.pathname
    .slice(prefix.length)
    .split("/")
    .filter(Boolean);
  return familyClassTarget({
    family,
    parts,
    search: (location.search ?? {}) as Record<string, unknown>,
    hash: location.hash || undefined,
    people: peopleOf(projection?.children ?? [], classId),
    only: onlyChild(projection),
  });
}

/** A school-level page of a parent's own family org: the family's own
 * screen, a child named by their person their page. A class the address
 * names that isn't the family's own is the family's unavailable view, never
 * another class. Null for anyone else. */
export async function toFamilyPage(
  session: AuthSession,
  org: string,
  page: "roster" | "map" | "settings" | "today",
  location: Located["location"],
  classId?: string,
): Promise<FamilyTarget | null> {
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(orNull("Your account"));
  const account = me?.signedIn ? me : null;
  const parent = parentFamilyAt(account, org);
  if (!account || !parent) return null;
  const family = await familyOfClass(session, account, parent);
  if (!family) return null;
  const projection = await queryClient
    .ensureQueryData(familyOptions(session, family))
    .catch(orNull("Your family"));
  // A tutoring group's class keeps its classroom.
  if (projection?.teachingPlace?.classId === parent.classId) return null;
  if (classId && classId !== parent.classId)
    return { href: `/family/${family}/unavailable` };
  return familyOrgTarget({
      family,
      page,
      search: (location.search ?? {}) as Record<string, unknown>,
      hash: location.hash || undefined,
      people: peopleOf(projection?.children ?? [], parent.classId),
      only: onlyChild(projection),
    });
}

/** A family child's older school-level address
 * (`/school/<family>/students/<person>[/work/<attempt>]`): the child's own
 * page, the answer a layer over it. Anyone else keeps the school's. */
export async function toFamilyChild(
  session: AuthSession,
  org: string,
  person: string,
  attempt: string | null,
  location: Located["location"],
): Promise<FamilyTarget | null> {
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(orNull("Your account"));
  const account = me?.signedIn ? me : null;
  const parent = parentFamilyAt(account, org);
  if (!account || !parent) return null;
  const family = await familyOfClass(session, account, parent);
  if (!family) return null;
  const projection = await queryClient
    .ensureQueryData(familyOptions(session, family))
    .catch(orNull("Your family"));
  return familyClassTarget({
    family,
    parts: attempt ? ["map", person, "work", attempt] : ["map", person],
    search: (location.search ?? {}) as Record<string, unknown>,
    hash: location.hash || undefined,
    people: peopleOf(projection?.children ?? [], parent.classId),
    only: onlyChild(projection),
  });
}

/** Where a family's tutoring group lives: its class's own classroom
 * screens, at the class's address under the org that holds it. Null when
 * the family has no tutoring group. */
export async function groupAddress(
  session: AuthSession,
  family: string,
  search: Record<string, unknown> = {},
): Promise<string | null> {
  const [me, projection] = await Promise.all([
    queryClient
      .ensureQueryData(meOptions(session))
      .catch(orNull("Your account")),
    queryClient
      .ensureQueryData(familyOptions(session, family))
      .catch(orNull("Your family")),
  ]);
  const classId = projection?.teachingPlace?.classId;
  if (!classId || !me?.signedIn) return null;
  const own = ownClassOf(me, family, projection);
  if (!own || own.id !== classId) return null;
  // A record or an answer opens over the group's Students, as the class's
  // own addresses do; its validated layers and skill come along.
  const stack = readStack(search[OPEN_KEY]);
  const leaf = stack.some((layer) => layer.kind === "student")
    ? "roster"
    : "today";
  const query = new URLSearchParams();
  const open = writeStack(stack);
  if (open) query.set(OPEN_KEY, open);
  if (typeof search.skill === "string") query.set("skill", search.skill);
  const path = `/school/${own.org}/classes/${classId}/${leaf}`;
  const text = query.toString();
  return appReturn(text ? `${path}?${text}` : path) ?? path;
}

/** A family's one child, when it has exactly one: its records open on
 * their page. */
function onlyChild(
  projection: { children: readonly { id: string }[] } | null | undefined,
) {
  return projection?.children.length === 1
    ? projection.children[0]!.id
    : undefined;
}
