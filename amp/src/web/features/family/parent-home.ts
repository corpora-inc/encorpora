import type { SignedInMe } from "../../../account/contracts";

/** A parent's own practice is a member's activity inside their family. */
export function parentHome(me: SignedInMe | null | undefined): string | null {
  if (!me || me.account.kind === "student") return null;
  if (me.learners.length) return "/family";
  const shared = me.secondParentOf?.[0];
  return shared ? `/family/${shared.orgId}` : null;
}
