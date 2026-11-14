import { redirect } from "@tanstack/react-router";
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
} from "../features/family/redirects";

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
    .catch(() => null);
  const candidates = (places?.families ?? []).filter((entry) =>
    parent.holder ? entry.role === "holder" : entry.role === "second-parent",
  );
  for (const entry of candidates) {
    const projection = await queryClient
      .ensureQueryData(familyOptions(session, entry.familyId))
      .catch(() => null);
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
) {
  const { org, class: classId } = params as { org: string; class: string };
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(() => null);
  const account = me?.signedIn ? me : null;
  const parent = parentFamilyAt(account, org);
  if (!account || !parent || parent.classId !== classId) return;
  const family = await familyOfClass(session, account, parent);
  if (!family) return;
  const projection = await queryClient
    .ensureQueryData(familyOptions(session, family))
    .catch(() => null);
  // A class that also holds other families' children is a tutoring group:
  // it stays at its class address, the whole group's classroom (R2). Only
  // a family's own class becomes the family's screens.
  if (!projection || projection.teachingPlace?.classId === classId) return;
  const prefix = `/school/${org}/classes/${classId}`;
  const parts = location.pathname
    .slice(prefix.length)
    .split("/")
    .filter(Boolean);
  const target = familyClassTarget({
    family,
    parts,
    search: (location.search ?? {}) as Record<string, unknown>,
    hash: location.hash || undefined,
    people: peopleOf(projection?.children ?? [], classId),
  });
  throw redirect({ ...target, replace: true } as never);
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
) {
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(() => null);
  const account = me?.signedIn ? me : null;
  const parent = parentFamilyAt(account, org);
  if (!account || !parent) return;
  const family = await familyOfClass(session, account, parent);
  if (!family) return;
  const projection = await queryClient
    .ensureQueryData(familyOptions(session, family))
    .catch(() => null);
  // A tutoring group's class keeps its classroom.
  if (projection?.teachingPlace?.classId === parent.classId) return;
  if (classId && classId !== parent.classId)
    throw redirect({
      to: `/family/${family}/unavailable`,
      replace: true,
    } as never);
  throw redirect({
    ...familyOrgTarget({
      family,
      page,
      search: (location.search ?? {}) as Record<string, unknown>,
      hash: location.hash || undefined,
      people: peopleOf(projection?.children ?? [], parent.classId),
    }),
    replace: true,
  } as never);
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
) {
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(() => null);
  const account = me?.signedIn ? me : null;
  const parent = parentFamilyAt(account, org);
  if (!account || !parent) return;
  const family = await familyOfClass(session, account, parent);
  if (!family) return;
  const projection = await queryClient
    .ensureQueryData(familyOptions(session, family))
    .catch(() => null);
  throw redirect({
    ...familyClassTarget({
      family,
      parts: attempt ? ["map", person, "work", attempt] : ["map", person],
      search: (location.search ?? {}) as Record<string, unknown>,
      hash: location.hash || undefined,
      people: peopleOf(projection?.children ?? [], parent.classId),
    }),
    replace: true,
  } as never);
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
    queryClient.ensureQueryData(meOptions(session)).catch(() => null),
    queryClient
      .ensureQueryData(familyOptions(session, family))
      .catch(() => null),
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
