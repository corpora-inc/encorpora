import { useQuery } from "@tanstack/react-query";
import type { SignedInMe } from "../../../account/contracts";
import { meOptions } from "../../lib/query";
import { useSession } from "../../lib/session";
import { buttonClass } from "../../ui/Button";
import { PayLink } from "../pay/link";
import styles from "./AccountSections.module.css";

type Learner = SignedInMe["family"]["learners"][number];

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const names = (learners: readonly Learner[]) => {
  const list = learners.map((learner) =>
    learner.adult ? "you" : learner.name,
  );
  return list.length < 2
    ? (list[0] ?? "")
    : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
};

/** The learners a plan is for: the account's own and its children, never a
 * practice profile or a deleted learner without access. */
export function planLearners(me: SignedInMe) {
  return me.family.learners.filter(
    (learner) =>
      !learner.simulation && (!learner.deletedAt || learner.access.length),
  );
}

/** The last day of a learner's active access, or null. */
const lastDay = (learner: Learner) =>
  learner.access
    .filter((entry) => entry.status === "active")
    .map((entry) => entry.endsAt)
    .sort()
    .at(-1) ?? null;

/** The plan in lines of words: who has AMP and through when, and who
 * practices free with how many problems left. Pure, so it is tested. */
export function planLines(learners: readonly Learner[]): string[] {
  const paid = learners.filter((learner) => learner.hasAccess);
  const free = learners.filter((learner) => !learner.hasAccess);
  const lines: string[] = [];
  const byEnd = new Map<string, Learner[]>();
  for (const learner of paid) {
    const end = lastDay(learner);
    const key = end ? DATE.format(new Date(end)) : "";
    byEnd.set(key, [...(byEnd.get(key) ?? []), learner]);
  }
  for (const [end, group] of byEnd)
    lines.push(`AMP for ${names(group)}${end ? ` · through ${end}` : ""}`);
  for (const learner of free) {
    const left = learner.freeAllowance?.problems.remaining;
    lines.push(
      left === undefined
        ? `Free · ${learner.adult ? "you" : learner.name}`
        : `Free · ${left} ${left === 1 ? "problem" : "problems"} left for ${
            learner.adult ? "you" : learner.name
          }`,
    );
  }
  return lines;
}

/**
 * One look at the plan (the IA v2 spec, §3.2): a line per kind of access,
 * and Choose a plan when someone lacks it, which opens Pay over the hub this
 * is composed on. No route knowledge: the pay link opens over this screen.
 */
export function BillingSummary() {
  const session = useSession();
  const me = useQuery(meOptions(session)).data;
  const account = me?.signedIn ? me : null;
  if (!account)
    return <div className={`amp-skeleton ${styles.summaryReserve}`} />;
  const learners = planLearners(account);
  const lines = planLines(learners);
  const lacking = learners.find((learner) => !learner.hasAccess);
  return (
    <div className={styles.summary} data-billing-summary="">
      {lines.length > 0 ? (
        <ul className={styles.lines}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.lines}>No plan yet.</p>
      )}
      {lacking && (
        <PayLink
          learnerId={lacking.id}
          className={buttonClass("primary")}
          data-choose-plan={lacking.id}
        >
          Choose a plan
        </PayLink>
      )}
    </div>
  );
}
