import { TimeScreen } from "../school/classes/TimeScreen";
import { Loading } from "../../ui/Loading";
import { childrenElsewhere, minutesIn } from "./redirects";
import { familyDisplayName } from "../spaces/resolve";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GradingKind } from "../../../schools/contracts";
import { AppError } from "../../lib/AppError";
import { Toast } from "../../ui/Toast";
import {
  classesOptions,
  orgOptions,
  refreshSchool,
  school,
} from "../school/api";
import { divisionLabels } from "../../../schools/calendar";
import { YearCalendar } from "../school/CalendarScreen";
import type { MapResponse } from "../../../schools/teacher-contracts";
import { downloadPdf, paperFormat } from "../../lib/pdf-download";
import { buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { PrintButton } from "../../ui/PrintButton";
import { RowLink, RowList } from "../../ui/RowList";
import { ScreenTitle } from "../../ui/ScreenTitle";
import { CardsScreen } from "../school/classes/CardsScreen";
import { ClassMap, MapKey } from "../school/classes/ClassMap";
import { GradebookScreen } from "../school/classes/GradebookScreen";
import type { ClassHost } from "../school/classes/host";
import { RecordWeeks } from "../school/classes/ProgressRecord";
import { ReportCards } from "../school/classes/ReportCardScreen";
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
import { Fact } from "./Today";
import styles from "./Family.module.css";

/*
 * A family's records (`/family/<family>/…`): the map, time, workbooks,
 * report cards and grades, and sign-in cards. Each shows the family's own
 * children only. Where a record lives in the family's own class (grades,
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
  "report-cards": "reports",
  today: "",
  settings: "settings",
  calendar: "settings",
  roster: "people",
  map: "map",
  time: "time",
  start: "",
};

/** The family's frame around a class screen: a component of its own, so the
 * page under it is never remounted. */
function FamilyClassFrame({
  loading,
  children,
}: Parameters<ClassHost["Frame"]>[0]) {
  const place = useFamilyPlace();
  return (
    <FamilyFrame place={place} loading={loading}>
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

/** No children yet: the one step that adds them, or who does. */
function NoChildren({ place }: { place: FamilyPlace }) {
  return place.holder ? (
    <EmptyState
      title="Add your kids"
      action={
        <Link
          to="/$"
          params={{ _splat: familyHref(place.family) }}
          search={{ add: 1 } as never}
          className={buttonClass("primary")}
        >
          Add your kids
        </Link>
      }
    >
      Each child’s map, time and records show here once they’re added.
    </EmptyState>
  ) : (
    <EmptyState title="No children here yet">
      The parent who invited you adds the children.
    </EmptyState>
  );
}

const childLink = (family: string, child: { id: string; name: string }) => (
  <Link
    to="/$"
    params={{ _splat: familyHref(family, `kids/${child.id}`) }}
    className={styles.recordName}
    data-map-child={child.id}
  >
    {child.name}
  </Link>
);

/**
 * The Map (`/family/<family>/map`): every child whole, on one scale from
 * kindergarten up, each over their own grade. A child's name opens their
 * page.
 */
export function FamilyMapScreen() {
  const place = useFamilyPlace();
  const { data, family } = place;
  const children = data?.children ?? [];
  const records = useRecords(place, children);
  const pending = records.some(
    (record) => record.isPending && record.isFetching,
  );
  const map: MapResponse | null = useMemo(() => {
    if (!data) return null;
    const strands = new Map<string, string>();
    for (const record of records)
      for (const strand of record.data?.strands ?? [])
        strands.set(strand.id, strand.label);
    return {
      class: {
        id: family,
        orgId: family,
        name: familyDisplayName(data),
        orgName: familyDisplayName(data),
        course: null,
      },
      strands: [...strands].map(([id, label]) => ({ id, label })),
      students: children.map((child, index) => {
        const record = records[index]?.data;
        return {
          id: child.id,
          name: child.name,
          first: child.name.split(" ")[0] ?? child.name,
          gradeLevel: child.gradeLevel,
          level: record?.level ?? null,
          provisional: false,
          reference: record?.reference ?? null,
        };
      }),
      teachers: [],
    };
    // Each record's answer is the dependency; the array is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, family, records.map((record) => record.dataUpdatedAt).join()]);
  return (
    <FamilyFrame place={place} loading={pending}>
      {data && map && (
        <div className={styles.page}>
          {children.length === 0 ? (
            <>
              <ScreenTitle>Map</ScreenTitle>
              <NoChildren place={place} />
            </>
          ) : (
            <div className={styles.mapPage}>
              <div className={styles.mapHead}>
                <ScreenTitle>Map</ScreenTitle>
                <MapKey data={map} words={place.words} />
              </div>
              <ClassMap
                data={map}
                words={place.words}
                grades={false}
                name={(student) => childLink(family, student)}
              />
            </div>
          )}
        </div>
      )}
    </FamilyFrame>
  );
}

/**
 * Time (`/family/<family>/time`): each child's active minutes, week by week,
 * this week's the same figure as Today's.
 */
export function FamilyTimeScreen() {
  const place = useFamilyPlace();
  const host = useFamilyHost(place);
  // A family with its own class: the class's Time for the family's own
  // children, with its range, measure, each child's days and (for a class
  // wholly the family's) its export.
  // Children of the family's own who practice in another family's group:
  // their own weeks, in the same view and the same totals.
  const elsewhere = childrenElsewhere(
    place.data?.children ?? [],
    place.own?.id ?? null,
  );
  const records = useRecords(place, host ? elsewhere : []);
  if (host)
    return (
      <TimeScreen
        host={host}
        extra={
          elsewhere.length
            ? (range) => {
                const minutes = elsewhere.map((child, index) =>
                  minutesIn(records[index]?.data?.weeks ?? [], range),
                );
                return {
                  minutes: minutes.reduce((sum, value) => sum + value, 0),
                  count: elsewhere.length,
                  working: minutes.filter((value) => value > 0).length,
                  node: (
                    <section
                      aria-labelledby="time-elsewhere"
                      className={styles.section}
                      data-time-elsewhere=""
                    >
                      <h2 id="time-elsewhere">In another group</h2>
                      {elsewhere.map((child, index) => {
                        const record = records[index];
                        return (
                          <div
                            key={child.id}
                            className={styles.section}
                            data-time-child={child.id}
                          >
                            <div className={styles.sectionHead}>
                              <h3>{childLink(place.family, child)}</h3>
                              <span className={styles.sub}>
                                {minutes[index]! > 0
                                  ? `${number(minutes[index]!)} active minutes in these dates`
                                  : "No time in these dates"}
                              </span>
                            </div>
                            {record?.data ? (
                              <RecordWeeks record={record.data} />
                            ) : record?.isError ? (
                              <p className={styles.footnote} role="alert">
                                {child.name}’s weeks didn’t load.{" "}
                                <button
                                  type="button"
                                  className={buttonClass("secondary")}
                                  onClick={() => void record.refetch()}
                                >
                                  Try again
                                </button>
                              </p>
                            ) : (
                              <Loading>Reading {child.name}’s weeks</Loading>
                            )}
                          </div>
                        );
                      })}
                    </section>
                  ),
                };
              }
            : undefined
        }
      />
    );
  return <ChildrenTime place={place} />;
}

/** Time for a family whose children are all hosted elsewhere: each child's
 * weeks, from their own record. */
function ChildrenTime({ place }: { place: FamilyPlace }) {
  const { data, family } = place;
  const children = data?.children ?? [];
  const records = useRecords(place, children);
  const pending = records.some(
    (record) => record.isPending && record.isFetching,
  );
  // The family's week, the same figure as Today's.
  const total = data?.today.week.minutes ?? 0;
  return (
    <FamilyFrame place={place} loading={pending}>
      {data && (
        <div className={styles.page}>
          <ScreenTitle>Time</ScreenTitle>
          {children.length === 0 ? (
            <NoChildren place={place} />
          ) : (
            <>
              <section aria-labelledby="time-week" className={styles.section}>
                <h2 id="time-week" className={styles.label}>
                  This week
                </h2>
                <div className={styles.weekRow}>
                  <Fact
                    value={`${number(total)} min`}
                    label={
                      children.length === 1 ? "active" : "active, all your kids"
                    }
                  />
                </div>
              </section>
              {children.map((child, index) => {
                const record = records[index]?.data;
                return (
                  <section
                    key={child.id}
                    aria-labelledby={`time-${child.id}`}
                    className={styles.section}
                    data-time-child={child.id}
                  >
                    <div className={styles.sectionHead}>
                      <h2 id={`time-${child.id}`}>
                        {childLink(family, child)}
                      </h2>
                      <span className={styles.sub}>
                        {child.week.minutes > 0
                          ? `${number(child.week.minutes)} active minutes this week`
                          : "No time yet this week"}
                      </span>
                    </div>
                    {record ? (
                      <RecordWeeks record={record} />
                    ) : (
                      <p className={styles.footnote}>
                        {child.capabilities.readProgress
                          ? `${child.name}’s weeks didn’t load. Reload to try again.`
                          : `${child.name}’s weeks aren’t shared with this account.`}
                      </p>
                    )}
                  </section>
                );
              })}
            </>
          )}
        </div>
      )}
    </FamilyFrame>
  );
}

/** What a child's workbooks row says: what's left to print free, or that
 * they print and record. */
function workbookMeta(child: FamilyChild) {
  if (child.access.hasAccess)
    return "Print a workbook, or record one done on paper";
  const left = child.access.freeAllowance.workbooks.available;
  return left > 0
    ? `${left} free ${left === 1 ? "workbook" : "workbooks"} to print`
    : "Record workbooks done on paper";
}

/**
 * Workbooks (`/family/<family>/workbooks`): each child's own workbooks, to
 * print or record, and, for a family with its own class, one print for
 * several (`?several=1`), a different workbook for each child.
 */
export function FamilyWorkbooksScreen() {
  const place = useFamilyPlace();
  const host = useFamilyHost(place);
  const { data, family } = place;
  const navigate = useNavigate();
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const children = (data?.children ?? []).filter(
    (child) => child.capabilities.readWorkbooks,
  );
  const several =
    !!host &&
    (data?.children ?? []).some((child) => child.capabilities.createWorkbook);
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
  if (several && (search.several === 1 || search.several === "1") && !kids)
    return <WorkbookStackScreen host={host!} />;
  return (
    <FamilyFrame place={place} loading={!!kids}>
      {data && (
        <div className={styles.page}>
          <ScreenTitle>Workbooks</ScreenTitle>
          {(data.children.length === 0 && <NoChildren place={place} />) || (
            <>
              {several && data.children.length > 1 && (
                <section
                  aria-labelledby="workbooks-several"
                  className={styles.section}
                >
                  <div className={styles.sectionHead}>
                    <div className={styles.settingText}>
                      <h2 id="workbooks-several">Print for several</h2>
                      <p className={styles.footnote}>
                        One print, a different workbook for each child, made
                        from their own work.
                      </p>
                    </div>
                    <Link
                      to="/$"
                      params={{ _splat: familyHref(family, "workbooks") }}
                      search={{ several: 1 } as never}
                      className={buttonClass("primary")}
                    >
                      Choose who
                    </Link>
                  </div>
                </section>
              )}
              <section
                aria-labelledby="workbooks-each"
                className={styles.section}
              >
                <h2 id="workbooks-each">
                  {data.children.length === 1
                    ? "Workbooks"
                    : "One child at a time"}
                </h2>
                {children.length ? (
                  <RowList label="Each child’s workbooks">
                    {children.map((child) => (
                      <RowLink
                        key={child.id}
                        title={child.name}
                        meta={workbookMeta(child)}
                        to={`learners/${child.id}/workbooks`}
                        data-workbooks-child={child.id}
                      />
                    ))}
                  </RowList>
                ) : (
                  <p className={styles.footnote}>
                    The parent who manages the children prints and records their
                    workbooks.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </FamilyFrame>
  );
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
            params={{ _splat: familyHref(place.family, "reports") }}
            className={buttonClass("primary")}
          >
            Open report cards
          </Link>
        }
      >
        Each child’s progress report is in Report cards, and their record is on
        their page.
      </EmptyState>
    </FamilyFrame>
  );
}

/** A child's progress report: a printed record of where they are, their
 * weeks and the skills they've earned. */
function ProgressReport({
  place,
  child,
}: {
  place: FamilyPlace;
  child: FamilyChild;
}): ReactNode {
  // The family's own progress report for one child (its PDF beside the
  // child's progress read): the family's name and the parent's words, for
  // a child in the family's class or hosted in someone else's.
  return (
    <PrintButton
      variant="secondary"
      download={() =>
        downloadPdf({
          path: `${child.paths.progress.replace(/^\/api\/v1/, "")}.pdf?format=${paperFormat()}`,
          token: place.session.token,
          name: `amp-progress-report-${child.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
        })
      }
    >
      Print
    </PrintButton>
  );
}

/**
 * Report cards (`/family/<family>/reports`): homeschool records for a
 * portfolio or an education savings program. Each term's report cards for
 * the children in the family's own class, the parent deciding every final
 * grade under Grades; and a progress report for every child, any day.
 */
export function FamilyReportsScreen() {
  const place = useFamilyPlace();
  const host = useFamilyHost(place);
  const { data, family } = place;
  const children = data?.children ?? [];
  const graded =
    !!host && children.some((child) => child.capabilities.readGrades);
  const edits = children.some((child) => child.capabilities.editGrades);
  return (
    <FamilyFrame place={place}>
      {data && (
        <div className={styles.page}>
          <ScreenTitle>Report cards</ScreenTitle>
          {children.length === 0 ? (
            <NoChildren place={place} />
          ) : (
            <>
              <section
                aria-labelledby="reports-progress"
                className={styles.section}
              >
                <div className={styles.settingText}>
                  <h2 id="reports-progress">Progress reports</h2>
                  <p className={styles.footnote}>
                    Where each child is, their weeks and the skills they’ve
                    earned, printed for a portfolio any day.
                  </p>
                </div>
                <dl className={styles.settings}>
                  {children.map((child) => (
                    <div key={child.id} className={styles.setting}>
                      <div className={styles.settingText}>
                        <dt>{child.name}</dt>
                        <dd>
                          {child.week.lastPracticed
                            ? `${number(child.week.minutes)} active minutes this week`
                            : "Not started yet"}
                        </dd>
                      </div>
                      <div className={styles.settingAction}>
                        <ProgressReport place={place} child={child} />
                      </div>
                    </div>
                  ))}
                </dl>
              </section>
              {graded && host && (
                <section
                  aria-labelledby="reports-terms"
                  className={styles.section}
                >
                  <div className={styles.sectionHead}>
                    <div className={styles.settingText}>
                      <h2 id="reports-terms">Report cards</h2>
                      <p className={styles.footnote}>
                        A card for each term, with the final grade you give.
                      </p>
                    </div>
                    {edits && (
                      <Link
                        to="/$"
                        params={{
                          _splat: familyHref(family, "reports/grades"),
                        }}
                        className={buttonClass("secondary")}
                        data-family-grades=""
                      >
                        Grades
                      </Link>
                    )}
                  </div>
                  <ReportCards host={host} framed />
                </section>
              )}
              {graded && host && place.own && (
                <GradingPeriods place={place} shared={!!host.shared} />
              )}
            </>
          )}
        </div>
      )}
    </FamilyFrame>
  );
}

/**
 * The family's grading periods: the school year, or the year in semesters,
 * trimesters or quarters, with their dates. A report card is one per period.
 * A class that also holds other families' children keeps its periods with
 * its tutoring group: the choice changes everyone's.
 */
function GradingPeriods({
  place,
  shared,
}: {
  place: FamilyPlace;
  shared: boolean;
}) {
  const own = place.own!;
  const { session } = place;
  const org = useQuery(orgOptions(session, own.org)).data;
  const classes = useQuery(classesOptions(session, own.org));
  const klass = classes.data?.find((entry) => entry.id === own.id);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  if (!org?.can?.includes("calendar.read") || !klass) return null;
  const canEdit =
    !shared &&
    (org.can.includes("classes.update") || !!org.teaches?.includes(own.id));
  const pick = (gradingKind: GradingKind) =>
    void school
      .updateClass(session, own.org, own.id, { gradingKind })
      .then(() => refreshSchool(session))
      .then(() =>
        setNotice(
          gradingKind === "year" || gradingKind === "custom"
            ? "Report cards cover the whole school year."
            : `A report card for each ${divisionLabels[gradingKind].one.toLowerCase()}.`,
        ),
      )
      .catch((failure) => {
        console.error("The grading periods didn’t save", failure);
        setError(
          failure instanceof AppError
            ? failure.message
            : "That change didn’t save. Try again.",
        );
      });
  return (
    <section aria-labelledby="reports-periods" className={styles.section}>
      <div className={styles.settingText}>
        <h2 id="reports-periods">Grading periods</h2>
        <p className={styles.footnote}>
          {shared
            ? "Your tutoring group shares one school year and its grading periods, so they’re set with the group."
            : "One report card for each period. Their dates are yours to change."}
        </p>
      </div>
      {shared ? (
        // The whole group's calendar: changed with the group, never here.
        <Link
          to="/$"
          params={{ _splat: `school/${own.org}/classes/${own.id}/settings` }}
          className={buttonClass("secondary")}
          style={{ justifySelf: "start" }}
        >
          Open the group’s calendar
        </Link>
      ) : (
        <YearCalendar
          orgId={own.org}
          compact
          grading={{
            value: klass.gradingKind,
            onChange: pick,
            disabled: !canEdit,
          }}
        />
      )}
      <Toast tone="status" message={notice} onDismiss={() => setNotice("")} />
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
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
