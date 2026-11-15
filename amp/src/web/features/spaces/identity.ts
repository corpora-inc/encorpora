/**
 * Whose learning screen an address names (docs/architecture/spaces.md,
 * "Learning screens"), in one order everywhere: the path's own learner (a
 * family's child, `/family/<family>/kids/<learner>/…`; `/learners/<id>/…`;
 * `/continue/<id>`), then a practice profile (`?profile=`, a mode), then the
 * legacy `?learner=` (an older link; its route redirects it to the canonical
 * address before it shows). Null: the address names nobody. Pure, so a
 * loader, the resolver, the learning view and practice all read the same
 * identity from the same address.
 */
export type AddressedIdentity = { kind: "learner" | "profile"; id: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH = new RegExp(
  `^/(?:learners|continue|family/${UUID}/kids)/([^/]+)`,
  "i",
);
const text = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : null;

export function addressedIdentity(
  pathname: string,
  search: Record<string, unknown> = {},
): AddressedIdentity | null {
  const own = PATH.exec(pathname)?.[1];
  if (own) return { kind: "learner", id: decodeURIComponent(own) };
  const profile = text(search.profile);
  if (profile) return { kind: "profile", id: profile };
  const learner = text(search.learner);
  return learner ? { kind: "learner", id: learner } : null;
}

/** The shared learning screens: an address among them that names nobody is
 * the adult's own (self is implicit, never a learner chosen earlier). */
const SELF =
  /^\/(?:practice|overview|progress|pathways|inventory|lessons|books)(?:\/|$)/;
export const isSelfAddress = (pathname: string) => SELF.test(pathname);

/**
 * Whose a learning screen is, with self filled in: what the address names,
 * else, on a shared learning screen, the adult's own learner (`own`). An
 * account with no learner of its own (a parent who doesn't practice, a
 * student's session) has no self here: null, as before.
 */
export function learningIdentity(
  pathname: string,
  search: Record<string, unknown> = {},
  own: string | null | undefined = null,
): AddressedIdentity | null {
  return (
    addressedIdentity(pathname, search) ??
    (own && isSelfAddress(pathname) ? { kind: "learner", id: own } : null)
  );
}

/** A family's child's learning screens: their page (the Overview) and its
 * Pathways and Inventory tabs. */
export type ChildScreen = "overview" | "pathways" | "inventory";
const CHILD = new RegExp(
  `^/family/(${UUID})/kids/([^/]+)(?:/(pathways|inventory))?/?$`,
  "i",
);

/** The canonical address of a family's child's screen. */
export const childPath = (
  family: string,
  learner: string,
  screen: ChildScreen = "overview",
) =>
  `/family/${family}/kids/${encodeURIComponent(learner)}${screen === "overview" ? "" : `/${screen}`}`;

/** The family, child and screen a child's address names, or null. */
export function childAddress(pathname: string) {
  const found = CHILD.exec(pathname);
  return found
    ? {
        family: found[1]!.toLowerCase(),
        learner: decodeURIComponent(found[2]!),
        screen: (found[3] ?? "overview") as ChildScreen,
      }
    : null;
}
