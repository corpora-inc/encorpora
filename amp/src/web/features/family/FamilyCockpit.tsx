import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import type { LiveRow } from "../../../schools/live/contracts";
import { buttonClass } from "../../ui/Button";
import { Changed } from "../live/Changed";
import { counted } from "../live/format";
import { HELP_KINDS, HelpGlyph } from "../live/HelpCounts";
import type { StudentLink } from "../live/RosterRow";
import {
  ClassCockpit,
  type CockpitPermissions,
  type CockpitWords,
} from "../school/classes/today/ClassCockpit";
import { familyHref } from "./FamilyFrame";
import styles from "./FamilyCockpit.module.css";

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

type Help = Pick<LiveRow, "hints" | "lessons" | "examples" | "videos">;

/** The places from the row's end inward: a hint, the help opened most,
 * sits beside the row's figures, and each other kind before it. */
const PLACES = [...HELP_KINDS].reverse();

/**
 * Help a child opened, at the end of their name's line on a phone, where
 * the row has no Help column: four fixed places, one for each of that
 * column's kinds in its drawings (hint, lesson, explanation, video). A kind
 * they opened shows its mark, with its count where the screen has room; one
 * they didn't leaves its place empty. The places are always held, so a mark
 * arrives, and its count changes, without moving the name, the row or
 * anything in it.
 */
export function HelpMarks({ help }: { help: Help }) {
  const opened = HELP_KINDS.filter((kind) => help[kind.key] > 0);
  return (
    <span
      className={styles.helpMarks}
      data-help-marks=""
      {...(opened.length > 0
        ? {
            role: "img",
            "aria-label": `Help opened: ${opened
              .map((kind) => counted(help[kind.key], kind.one))
              .join(", ")}`,
          }
        : { "aria-hidden": true })}
    >
      {PLACES.map((kind) => (
        <span
          key={kind.key}
          className={styles.helpMark}
          data-help={kind.key}
          data-opened={help[kind.key] > 0 || undefined}
        >
          {help[kind.key] > 0 && (
            <Changed value={help[kind.key]}>
              <span className={styles.helpInk}>
                <HelpGlyph kind={kind.key} />
                <span className={styles.helpCount}>{help[kind.key]}</span>
              </span>
            </Changed>
          )}
        </span>
      ))}
    </span>
  );
}

export type FamilyCockpitProps = {
  family: string;
  place: { org: string; class: string };
  can: CockpitPermissions;
  /** The family's own children in its class: person → learner. */
  people: ReadonlyMap<string, string>;
  /** Each child's "Show grade level" setting, by learner. */
  levelShown: ReadonlyMap<string, boolean>;
};

const helpMarks = (row: LiveRow) => <HelpMarks help={row} />;

/**
 * The class's live cockpit (ClassCockpit) for a family's own class: the
 * same bar, totals, requests and rows, a child's row opening the child's
 * page, Stop opening the family's report. On a phone, where a row has no
 * Help column, the help each child opened shows beside their name
 * (`HelpMarks`). The only code a family needs for a running session;
 * loaded by `cockpit-chunk.ts`.
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
        phoneAside: helpMarks,
      }}
    />
  );
}
