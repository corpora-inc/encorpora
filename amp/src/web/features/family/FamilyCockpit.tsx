import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { buttonClass } from "../../ui/Button";
import type { StudentLink } from "../live/RosterRow";
import {
  ClassCockpit,
  type CockpitPermissions,
  type CockpitWords,
} from "../school/classes/today/ClassCockpit";
import { familyHref } from "./FamilyFrame";

/** A family's live session, in a family's words. */
export const FAMILY_COCKPIT_WORDS: CockpitWords = {
  start: "Start practice",
  nameHeader: "Child",
  roster: "Your kids in this session",
  kept: "Your kids keep their work, and the session’s report is kept.",
  // Children on a parent's device have no session of their own until
  // their first answer or heartbeat: they haven't started, nothing more.
  statusWords: { not_signed_in: "Not started" },
};

export type FamilyCockpitProps = {
  family: string;
  place: { org: string; class: string };
  can: CockpitPermissions;
  /** The family's own children in its class: person → learner. */
  people: ReadonlyMap<string, string>;
  /** Each child's "Show grade level" setting, by learner. */
  levelShown: ReadonlyMap<string, boolean>;
};

/**
 * The class's live cockpit (ClassCockpit) for a family's own class: the
 * same bar, totals, requests and rows, a child's row opening the child's
 * page, Stop opening the family's report. The only code a family needs for
 * a running session; loaded by `cockpit-chunk.ts`.
 */
export function FamilyCockpit({
  family,
  place,
  can,
  people,
  levelShown,
}: FamilyCockpitProps) {
  const navigate = useNavigate();
  const link: StudentLink = useMemo(
    () =>
      ({ personId, className, children }) => {
        const learner = people.get(personId);
        return learner ? (
          <Link
            to="/$"
            params={{ _splat: familyHref(family, `kids/${learner}`) }}
            className={className}
            data-child-link={learner}
          >
            {children}
          </Link>
        ) : (
          <span className={className}>{children}</span>
        );
      },
    [family, people],
  );
  const reportAddress = (id: string) => familyHref(family, `sessions/${id}`);
  return (
    <ClassCockpit
      place={place}
      available
      words={FAMILY_COCKPIT_WORDS}
      can={can}
      showGradeNumbers={false}
      link={link}
      reportLink={(id: string, children: ReactNode) => (
        <Link
          to="/$"
          params={{ _splat: reportAddress(id) }}
          className={buttonClass("primary")}
          data-session-report-link={id}
        >
          {children}
        </Link>
      )}
      onStopped={(id) =>
        navigate({ to: "/$", params: { _splat: reportAddress(id) } })
      }
      short={{
        levelShown: (personId) =>
          levelShown.get(people.get(personId) ?? "") ?? false,
      }}
    />
  );
}
