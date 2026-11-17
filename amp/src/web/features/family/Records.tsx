import { childrenElsewhere } from "./redirects";
import { childTimeCsvPath, childTimeOptions } from "./api";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { downloadPdf, paperFormat } from "../../lib/pdf-download";
import { Button, buttonClass } from "../../ui/Button";
import { AddChildrenSheet } from "./AddChildren";
import { EmptyState } from "../../ui/EmptyState";
import { PrintButton } from "../../ui/PrintButton";
import { ActionRow } from "../../ui/ActionRow";
import { ColumnList, ColumnRow } from "../../ui/ColumnList";
import { CardsScreen } from "../school/classes/CardsScreen";
import { GradebookScreen } from "../school/classes/GradebookScreen";
import type { ClassHost } from "../school/classes/host";
import { gradebookOptions } from "../school/classes/teacher-api";
import { number } from "../school/classes/teacher-shared";
import { MarkingScreen } from "../school/classroom/MarkingScreen";
import { WorkbookStackScreen } from "../school/classroom/WorkbookStackScreen";
import { childProgressOptions, type FamilyChild } from "./api";
import {
  FamilyFrame,
  familyHref,
  useFamilyPlace,
  type FamilyPlace,
} from "./FamilyFrame";
import { peopleOf } from "./redirects";
import { Fact, LastPracticedFact, WeekFact } from "./Today";
import styles from "./Family.module.css";

/*
 * A family's records (`/family/<family>/…`): Progress (several children's
 * overview), grades, the workbook print for several, marking, and sign-in
 * cards. Each child's time, workbooks and reports are on their own page
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
  "report-cards": "map",
  today: "",
  settings: "settings",
  calendar: "settings",
  roster: "people",
  map: "map",
  time: "map",
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

/** Every child's record, from their own progress read: the screen waits for
 * all of them, so it paints once, whole. */
function useRecords(place: FamilyPlace, children: readonly FamilyChild[]) {
  return useQueries({
    queries: children.map((child) => ({
      ...childProgressOptions(place.session, place.family, child.id),
      enabled: child.capabilities.readProgress,
    })),
  });
}

/** No children yet: the one step that adds them, over this screen, or who
 * does. */
function NoChildren({ place }: { place: FamilyPlace }) {
  const [adding, setAdding] = useState(false);
  return place.holder ? (
    <>
      <EmptyState
        title="Add your kids"
        action={
          <Button
            variant="primary"
            data-add-child=""
            onClick={() => setAdding(true)}
          >
            Add your kids
          </Button>
        }
      />
      <AddChildrenSheet open={adding} onOpenChange={setAdding} />
    </>
  ) : (
    <EmptyState title="No children here yet">
      The parent who invited you adds the children.
    </EmptyState>
  );
}

/** The skills a child has earned this year, as the overview counts them. */
function SkillsFact({ count }: { count: number | null }) {
  return count === null ? null : (
    <Fact
      value={number(count)}
      label={count === 1 ? "skill earned" : "skills earned"}
    />
  );
}

/**
 * Progress (`/family/<family>/map`) for a family of several: one row a
 * child (this week's time, skills earned this year, last practiced), each
 * opening the child's own page, where their time, workbooks and reports
 * are. The family's report cards download whole. A one-child family's
 * Progress is that child's page (the route's one hop).
 */
export function FamilyMapScreen() {
  const place = useFamilyPlace();
  const host = useFamilyHost(place);
  const { data, family } = place;
  const children = data?.children ?? [];
  const records = useRecords(place, children);
  const pending = records.some(
    (record) => record.isPending && record.isFetching,
  );
  const several =
    !!host &&
    children.length > 1 &&
    children.some((child) => child.capabilities.createWorkbook);
  return (
    <FamilyFrame place={place} loading={pending} title="Progress">
      {data && (
        <div className={styles.page} data-family-progress="">
          {children.length === 0 ? (
            <NoChildren place={place} />
          ) : (
            <>
              <ColumnList
                label="Your kids"
                columns={PROGRESS_COLUMNS}
                data-progress-kids=""
              >
                {children.map((child, index) => (
                  <ColumnRow
                    key={child.id}
                    data-progress-child={child.id}
                    cells={{
                      name: (
                        <Link
                          to="/$"
                          params={{
                            _splat: familyHref(family, `kids/${child.id}`),
                          }}
                          className={styles.kidName}
                          data-map-child={child.id}
                        >
                          {child.name}
                          <svg viewBox="0 0 12 12" aria-hidden="true">
                            <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
                          </svg>
                        </Link>
                      ),
                      week: <WeekFact child={child} />,
                      skills: (
                        <SkillsFact
                          count={
                            records[index]?.data?.objectives.length ?? null
                          }
                        />
                      ),
                      last: (
                        <LastPracticedFact
                          child={child}
                          today={data.today.date}
                        />
                      ),
                    }}
                  />
                ))}
              </ColumnList>
              {(host || several) && (
                <ActionRow label="For all your kids">
                  {host && <FamilyReportCards host={host} place={place} />}
                  {several && (
                    <Link
                      to="/$"
                      params={{ _splat: familyHref(family, "workbooks") }}
                      search={{ several: 1 } as never}
                      className={buttonClass("secondary")}
                    >
                      Workbooks for several
                    </Link>
                  )}
                </ActionRow>
              )}
            </>
          )}
        </div>
      )}
    </FamilyFrame>
  );
}

const PROGRESS_COLUMNS = [
  { key: "name", track: "minmax(0, 1.4fr)", part: "title" },
  { key: "week", track: "minmax(0, 1fr)" },
  { key: "skills", track: "minmax(0, 1fr)" },
  { key: "last", track: "minmax(0, 1fr)" },
] as const;

/** The family's report cards for the current term, every child in one PDF:
 * only where the family's class holds its own children alone, and once
 * there is a term to report on. */
function FamilyReportCards({
  host,
  place,
}: {
  host: ClassHost;
  place: FamilyPlace;
}) {
  const children = place.data?.children ?? [];
  const graded =
    !host.shared && children.some((child) => child.capabilities.readGrades);
  const term = useQuery({
    ...gradebookOptions(place.session, host.place, undefined),
    enabled: graded,
  }).data?.term?.id;
  if (!graded || !term) return null;
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
            params={{ _splat: familyHref(place.family, "map") }}
            className={buttonClass("primary")}
          >
            Open Progress
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

/** Sign-in cards for the family's own children
 * (`/family/<family>/cards`). */
export function FamilyCardsScreen() {
  const place = useFamilyPlace();
  const host = useFamilyHost(place);
  if (!place.data) return <FamilyFrame place={place}>{null}</FamilyFrame>;
  if (host) return <CardsScreen host={host} />;
  return <NoClass place={place} what="Sign-in cards" />;
}
