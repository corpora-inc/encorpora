import { redirect } from "@tanstack/react-router";
import type { AuthSession } from "../auth";
import { meOptions, queryClient } from "../lib/query";
import { familyOptions } from "../features/family/api";
import {
  familyClassTarget,
  familyOrgTarget,
  parentFamilyAt,
  peopleOf,
} from "../features/family/redirects";

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
  const parent = parentFamilyAt(me?.signedIn ? me : null, org);
  if (!parent || parent.classId !== classId) return;
  const projection = await queryClient
    .ensureQueryData(familyOptions(session, parent.family))
    .catch(() => null);
  // A tutor's class with no children of their own: the tutoring group.
  if (projection && !projection.children.length && projection.teachingPlace)
    throw redirect({
      to: `/family/${parent.family}/group`,
      search: (location.search ?? {}) as never,
      replace: true,
    } as never);
  const prefix = `/school/${org}/classes/${classId}`;
  const parts = location.pathname
    .slice(prefix.length)
    .split("/")
    .filter(Boolean);
  const target = familyClassTarget({
    family: parent.family,
    parts,
    search: (location.search ?? {}) as Record<string, unknown>,
    hash: location.hash || undefined,
    people: peopleOf(projection?.children ?? [], classId),
  });
  throw redirect({ ...target, replace: true } as never);
}

/** A school-level page of a parent's own family org: the family's own
 * screen. Null for anyone else. */
export async function toFamilyPage(
  session: AuthSession,
  org: string,
  page: "roster" | "map" | "settings" | "today",
  location: Located["location"],
) {
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(() => null);
  if (!parentFamilyAt(me?.signedIn ? me : null, org)) return;
  throw redirect({
    ...familyOrgTarget({
      family: org,
      page,
      search: (location.search ?? {}) as Record<string, unknown>,
      hash: location.hash || undefined,
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
  const parent = parentFamilyAt(me?.signedIn ? me : null, org);
  if (!parent) return;
  const projection = await queryClient
    .ensureQueryData(familyOptions(session, parent.family))
    .catch(() => null);
  throw redirect({
    ...familyClassTarget({
      family: parent.family,
      parts: attempt ? ["map", person, "work", attempt] : ["map", person],
      search: (location.search ?? {}) as Record<string, unknown>,
      hash: location.hash || undefined,
      people: peopleOf(projection?.children ?? [], parent.classId),
    }),
    replace: true,
  } as never);
}
