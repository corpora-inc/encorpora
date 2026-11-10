import { useQuery } from "@tanstack/react-query";
import { gradeName } from "../../../learning/level-check";
import type { AuthSession } from "../../auth";
import { meOptions, sessionOptions } from "../../lib/query";
import { ownPracticeOptions } from "../me/api";
import styles from "./Continue.module.css";

/** One line of what a learner has done so far, from their own record: the
 * problems answered, and for the adult's own practice where they work now
 * and their strongest area. Null until there is something true to say. */
export function useRecap(
  session: AuthSession | null | undefined,
  learnerId?: string,
  withAnswered = true,
) {
  const me = useQuery({
    ...meOptions(session!),
    enabled: !!session && !!learnerId,
  });
  const learner =
    me.data?.signedIn && learnerId
      ? me.data.family.learners.find((entry) => entry.id === learnerId)
      : undefined;
  const own = !!learner?.adult && !learner.simulation;
  const record = useQuery({
    ...ownPracticeOptions(session!),
    enabled: !!session && own,
  });
  if (!learner || learner.simulation) return null;
  const answered = learner.freeAllowance?.problems.used ?? 0;
  const parts: string[] = [];
  if (answered && withAnswered)
    parts.push(
      `${answered.toLocaleString("en-US")} ${answered === 1 ? "problem" : "problems"} answered`,
    );
  const level = own ? record.data?.record.level : null;
  if (level) {
    parts.push(`working at ${gradeName(level.overall.level)}`);
    const strongest = Object.entries(level.strands).sort(
      ([, a], [, b]) => b.level - a.level,
    )[0];
    const label = record.data?.record.strands.find(
      (strand) => strand.id === strongest?.[0],
    )?.label;
    if (label && strongest && strongest[1].level - level.overall.level >= 0.3)
      parts.push(`strongest in ${label}`);
  }
  if (!parts.length) return null;
  const line = parts.join(" · ");
  return line[0]!.toUpperCase() + line.slice(1);
}

/** The recap as it reads on Continue and on the pause. */
export function RecapLine({
  learnerId,
  withAnswered = true,
}: {
  learnerId?: string;
  /** The pause has just said how many: the line says the rest. */
  withAnswered?: boolean;
}) {
  const session = useQuery(sessionOptions).data;
  const recap = useRecap(session, learnerId, withAnswered);
  return (
    <p className={styles.recap} aria-live="polite">
      {recap ?? " "}
    </p>
  );
}

/** What continuing includes, said plainly: the same for a child and an
 * adult, with the family's second parent for a child. */
export function Included({ forChild }: { forChild: boolean }) {
  const items = [
    "Unlimited practice that adapts with every answer, from counting to precalculus",
    `Printable workbooks made from ${forChild ? "their" : "your"} progress, with answer keys`,
    "A lesson and a worked explanation for every skill",
    forChild
      ? "Both parents practice free, each at their own level"
      : "Your levels and record, area by area",
  ];
  return (
    <ul className={styles.included} aria-label="What continuing includes">
      {items.map((item) => (
        <li key={item}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
