import { ConsentPanel } from "./ConsentPanel";
import { LearningDataDelete } from "./LearningDataDelete";

/*
 * A child's privacy actions as bodies with no layer of their own: the child's
 * settings fold them as disclosures (never a sheet over a sheet), and the
 * Privacy overlay's own panels are the same components, so each action has
 * one implementation. Each cites its requirement where it is built:
 * ConsentPanel (16 CFR 312.4(c), 312.5(b)(2)(vi), 312.6(a)(2)) and
 * LearningDataDelete (16 CFR 312.6(a)(2); Cal. Civ. Code 1798.105).
 * Both read the session and `/me` themselves (lib/session.ts).
 */

/** The family's learning permission, as a child's settings show it. The
 * family's consent covers every child under 13, so it is the family's. */
export function ChildConsentPanel() {
  return <ConsentPanel />;
}

/** Delete one child's learning data: what goes, then one button. `onDone`
 * runs once it is deleted and before the account refreshes, so a screen
 * about the child can leave first (the child is gone). */
export function ChildDeletePanel({
  child,
  onDone,
}: {
  child: { id: string; name: string };
  onDone?: () => Promise<unknown> | void;
}) {
  return <LearningDataDelete learner={child} onDeleted={onDone} />;
}
