import type { OrgResource } from "../../../../schools/contracts";

/** What an account already has at a school, read from its places: the next
 * step for each is different (docs/architecture/spaces.md, "School first
 * runs"). A demo is something to explore, never an institution. */
export type SchoolState =
  | { kind: "invited"; token: string }
  | { kind: "setup"; org: OrgResource }
  | { kind: "admin"; org: OrgResource }
  | { kind: "teacher"; org: OrgResource }
  /** A school its admin is still setting up: nothing to open yet. */
  | { kind: "pending"; org: OrgResource }
  | { kind: "none"; demo: OrgResource | null };

/** The token of an invitation kept on this device, if it reads as one. */
export const inviteToken = (invite: string | null) => {
  const token = invite?.replace(/^#/, "").split(".")[0] ?? "";
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
};

const real = (org: OrgResource) => !org.demo && org.kind !== "family";

export function schoolState(
  orgs: readonly OrgResource[],
  /** An invitation the server says is still open, else null. */
  invite: string | null,
): SchoolState {
  const token = inviteToken(invite);
  if (token) return { kind: "invited", token };
  const mine = orgs.filter(real);
  const setup = mine.find(
    (org) => org.setupPending && org.roles.includes("admin"),
  );
  if (setup) return { kind: "setup", org: setup };
  // Setup is its admin's alone: anyone else waits, never into it.
  const ready = mine.filter((org) => !org.setupPending);
  const admin = ready.find(
    (org) => org.roles.includes("admin") || org.roles.includes("viewer"),
  );
  if (admin) return { kind: "admin", org: admin };
  const teacher = ready.find((org) => org.roles.length > 0);
  if (teacher) return { kind: "teacher", org: teacher };
  const pending = mine.find((org) => org.setupPending);
  if (pending) return { kind: "pending", org: pending };
  return {
    kind: "none",
    demo: orgs.find((org) => org.demo && org.kind !== "family") ?? null,
  };
}
