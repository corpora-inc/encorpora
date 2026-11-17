import { childrenElsewhere } from "./redirects";
import { childTimeCsvPath, childTimeOptions } from "./api";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { downloadPdf, paperFormat } from "../../lib/pdf-download";
import { buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { PrintButton } from "../../ui/PrintButton";
import { GradebookScreen } from "../school/classes/GradebookScreen";
import type { ClassHost } from "../school/classes/host";
import { gradebookOptions } from "../school/classes/teacher-api";
import { MarkingScreen } from "../school/classroom/MarkingScreen";
import { WorkbookStackScreen } from "../school/classroom/WorkbookStackScreen";
import {
  FamilyFrame,
  familyHref,
  useFamilyPlace,
  type FamilyPlace,
} from "./FamilyFrame";
import { peopleOf } from "./redirects";
import styles from "./Family.module.css";

/*
 * A family's records (`/family/<family>/…`): grades, the workbook print for
 * several, marking, and the family's report cards (on Today). Each child's time, workbooks and reports are on their own page
 * (Child.tsx). Each shows the family's own children only. Where a record lives in the family's own class (grades,
 * report cards, the workbook stack, cards), the class's screen is composed
 * here through a host: the family's frame, its addresses and its words, and
 * only its own children by the person each is in that class.
 */

const WORDS: ClassHost["words"] = {
  learner: "child",
  learners: "children",
  Learner: "Child",
  group: "your kids",
  taughtBy: "Taught by",
};

/** A class screen's sibling, at the family's own address. */
const FAMILY_LEAF: Record<string, string> = {
  gradebook: "reports/grades",
  "report-cards": "",
  today: "",
  settings: "settings",
  calendar: "settings",
  roster: "settings",
  map: "",
  time: "",
  start: "",
};

/** The family's frame around a class screen: a component of its own, so the
 * page under it is never remounted. */
function FamilyClassFrame({
  loading,
  title,
  children,
}: Parameters<ClassHost["Frame"]>[0]) {
  const place = useFamilyPlace();
  return (
    <FamilyFrame place={place} loading={loading} title={title}>
      {children}
    </FamilyFrame>
  );
}

/** The family's own class, hosted under the family's address. */
function useFamilyHost(place: FamilyPlace): ClassHost | null {
  const { family, own, data } = place;
  const people = useMemo(
    () => (own ? peopleOf(data?.children ?? [], own.id) : new Map()),
    [own, data],
  );
  if (!own) return null;
  return {
    place: { org: own.org, class: own.id },
    Frame: FamilyClassFrame,
    frameHeading: true,
    href: (leaf) => {
      const mapped = FAMILY_LEAF[leaf];
      return familyHref(
        family,
        mapped ?? (leaf.startsWith("workbooks") ? leaf : ""),
      );
    },
    keep: (person) => people.has(person),
    words: WORDS,
    decider: "the parent",
    // Other families' children in the same class: whatever acts on the
    // whole class is the tutoring group's, never the family's.
    shared: !!data?.teachingPlace,
    record: (person) => {
      const learner = people.get(person);
      return learner ? familyHref(family, `kids/${learner}`) : null;
    },
    // The family's own children in another family's group: Time reads
    // them for the class's dates and counts them with it.
    others: childrenElsewhere(data?.children ?? [], own.id)
      .filter((child) => child.capabilities.readProgress)
      .map((child) => ({
        id: child.id,
        name: child.name,
        page: familyHref(family, `kids/${child.id}`),
        time: (period, from) =>
          childTimeOptions(place.session, family, child.id, period, from),
        csv: (period, from) => childTimeCsvPath(family, child.id, period, from),
      })),
  };
}

/** The family's report cards for the current term, every child in one PDF:
 * only where the family's class holds its own children alone, and only once
 * the term holds work to report on (a child's suggested grade or a final),
 * never before practice has started. */
export function FamilyReportCards({ place }: { place: FamilyPlace }) {
  const host = useFamilyHost(place);
  const children = place.data?.children ?? [];
  const graded =
    !!host &&
    !host.shared &&
    children.some((child) => child.capabilities.readGrades);
  const book = useQuery({
    ...gradebookOptions(
      place.session,
      host?.place ?? { org: "", class: "" },
      undefined,
    ),
    enabled: graded,
  }).data;
  const term = book?.term?.id;
  const reported = book?.students.some(
    (row) => row.final !== null || row.suggestion.status !== "not-enough-work",
  );
  if (!host || !graded || !term || !reported) return null;
  return (
    <PrintButton
      variant="secondary"
      label="Download report cards for all your kids, PDF"
      download={() =>
        downloadPdf({
          path: `/school/classes/${encodeURIComponent(host.place.class)}/report-cards.pdf?${new URLSearchParams(
            { term, format: paperFormat() },
          )}`,
          token: place.session.token,
          name: "amp-report-cards.pdf",
        })
      }
    >
      Download report cards
    </PrintButton>
  );
}

/**
 * Workbooks for several (`/family/<family>/workbooks?several=1`): one
 * print, a different workbook for each child, in the family's own class.
 * Each child's own workbooks are on their page; the bare address opens
 * there (the route's one hop).
 */
export function FamilyWorkbooksScreen() {
  const place = useFamilyPlace();
  const host = useFamilyHost(place);
  const { data } = place;
  const navigate = useNavigate();
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  // A group sheet linked by learner (`kids=`): the stack names them by the
  // person each is in the family's class.
  const kids = typeof search.kids === "string" ? search.kids : null;
  useEffect(() => {
    if (!kids || !data || !place.own) return;
    const people = new Map(
      [...peopleOf(data.children, place.own.id)].map(([person, learner]) => [
        learner,
        person,
      ]),
    );
    const students = kids
      .split(",")
      .map((learner) => people.get(learner))
      .filter(Boolean)
      .join(",");
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => {
        const { kids: _kids, ...rest } = previous;
        return { ...rest, several: 1, ...(students ? { students } : {}) };
      }) as never,
      replace: true,
    });
  }, [kids, data, place.own, navigate]);
  if (!data || kids)
    return (
      <FamilyFrame place={place} loading>
        {null}
      </FamilyFrame>
    );
  if (host) return <WorkbookStackScreen host={host} />;
  return <NoClass place={place} what="Workbooks for several" />;
}

/** One printed day's workbooks, marked by hand
 * (`/family/<family>/workbooks/<date>`). */
export function FamilyMarkingScreen() {
  const place = useFamilyPlace();
  const host = useFamilyHost(place);
  if (!place.data) return <FamilyFrame place={place}>{null}</FamilyFrame>;
  if (host) return <MarkingScreen host={host} />;
  return <NoClass place={place} what="Marking printed workbooks" />;
}

/** A record that lives in the family's own class, for a family without one
 * (every child is in someone else's group). */
function NoClass({ place, what }: { place: FamilyPlace; what: string }) {
  return (
    <FamilyFrame place={place}>
      <EmptyState
        title={`${what} isn’t here for this family`}
        action={
          <Link
            to="/$"
            params={{ _splat: familyHref(place.family) }}
            className={buttonClass("primary")}
          >
            Open Today
          </Link>
        }
      ></EmptyState>
    </FamilyFrame>
  );
}

/** Grades (`/family/<family>/reports/grades`): each term's suggested range
 * and its evidence for the family's own children, and the final grade the
 * parent decides. */
export function FamilyGradesScreen() {
  const place = useFamilyPlace();
  const host = useFamilyHost(place);
  if (!place.data) return <FamilyFrame place={place}>{null}</FamilyFrame>;
  if (host) return <GradebookScreen host={host} />;
  return <NoClass place={place} what="Term grades" />;
}
