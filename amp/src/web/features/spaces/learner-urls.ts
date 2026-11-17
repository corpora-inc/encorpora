import type { SignedInMe } from "../../../account/contracts";
import type { FamilyPlaces } from "../../../family/projection-contracts";
import { childPath, type ChildScreen } from "./identity";

/*
 * One canonical address per learner's screen (docs/architecture/spaces.md,
 * "Learning screens"):
 *
 *   yourself          /pathways, /inventory, /practice, /me …   (no id: self)
 *   a family's child  /family/<family>/kids/<learner>[/pathways|/inventory]
 *   a practice profile /practice?profile=<profile>&from=…        (unchanged)
 *
 * `?learner=` is only an older link: its route sends it here.
 */

/** The family whose child this learner is, for this account: the family it
 * holds, or one it is the second parent of. Null when the learner is none of
 * its children. The family's id comes from its places when they are loaded,
 * else from the family's class org (the same id in every family today). */
export function childFamily(
  me: SignedInMe,
  learner: string,
  places?: FamilyPlaces | null,
): string | null {
  const families = places?.families ?? [];
  if (me.learners.some((entry) => entry.id === learner))
    return (
      families.find((entry) => entry.role === "holder")?.familyId ??
      me.familyClass?.orgId ??
      null
    );
  const shared = (me.secondParentOf ?? []).find((family) =>
    family.learners.some((entry) => entry.id === learner),
  );
  if (!shared) return null;
  return (
    families.find(
      (entry) => entry.role === "second-parent" && entry.orgId === shared.orgId,
    )?.familyId ?? shared.orgId
  );
}

/** Which of a child's screens a shared learning screen is. Lessons and books
 * are the curriculum's, with no child's address of their own. */
function childScreen(pathname: string): ChildScreen | null {
  if (pathname === "/pathways") return "pathways";
  if (pathname === "/inventory") return "inventory";
  if (/^\/(?:overview|progress|practice)\/?$/.test(pathname)) return "overview";
  return null;
}

/** The child a parent who doesn't practice themselves sees on a shared
 * learning screen that names nobody: this device's choice, if it is one of
 * their children, else their first child (as practice always took it). */
function chosenChild(me: SignedInMe, selected: string | null) {
  const children = [
    ...me.learners,
    ...(me.secondParentOf ?? []).flatMap((family) => family.learners),
  ];
  return (
    children.find((entry) => entry.id === selected)?.id ??
    children[0]?.id ??
    null
  );
}

/**
 * Where an older learning address belongs, or null to stay. Pure.
 * - `?learner=` naming the adult's own learner: the same screen without it
 *   (self is implicit); naming one of their children: that child's screen in
 *   their family; naming nobody this account reads: it stays, and the screen
 *   says it isn't available (never another learner).
 * - A profile outranks `?learner=`: the learner key is dropped.
 * - A parent with no practice of their own, on Pathways, Inventory or the
 *   Overview without a name: the child the screen would show, at that
 *   child's address, so the address always says whose it is.
 */
export function canonicalLearning(
  pathname: string,
  params: URLSearchParams,
  me: SignedInMe,
  places: FamilyPlaces | null | undefined,
  selected: string | null,
): string | null {
  const learner = params.get("learner");
  const own = me.adultPractice?.learner?.id ?? null;
  const rest = new URLSearchParams(params);
  rest.delete("learner");
  const here = () => `${pathname}${rest.size ? `?${rest}` : ""}`;
  if (
    learner !== null &&
    (params.get("profile") || learner === "" || learner === own)
  )
    return here();
  const screen = childScreen(pathname);
  const child =
    learner ??
    (!own && !params.get("profile") && screen && pathname !== "/practice"
      ? chosenChild(me, selected)
      : null);
  if (!child || !screen) return null;
  const family = childFamily(me, child, places);
  if (!family) return null;
  // A child's map and inventory keep their own view (search, layers);
  // their page opens as itself.
  const keep = screen !== "overview" && rest.size ? `?${rest}` : "";
  return `${childPath(family, child, screen)}${keep}`;
}
