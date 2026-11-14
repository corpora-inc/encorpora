/**
 * Whose learning screen an address names (docs/architecture/spaces.md,
 * "Learning screens"), in one order everywhere: the route's own learner
 * (`/learners/<id>/…`, `/continue/<id>`), then a practice profile
 * (`?profile=`, a mode), then `?learner=`. Null: the address names nobody,
 * and the device's choice stands. Pure, so a loader, the resolver, the
 * learning view and practice all read the same identity from the same
 * address.
 */
export type AddressedIdentity = { kind: "learner" | "profile"; id: string };

const PATH = /^\/(?:learners|continue)\/([^/]+)/;
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
