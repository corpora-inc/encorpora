import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import type { ReportRow } from "../../../schools/live/contracts";
import { AppError } from "../../lib/AppError";
import { EntityLink } from "../../nav/links";
import { buttonClass } from "../../ui/Button";
import type { DataGridColumn } from "../../ui/DataGrid";
import { EmptyState } from "../../ui/EmptyState";
import { sessionReportOptions } from "../live/api";
import {
  Report,
  type ReportKit,
  type ReportWords,
} from "../school/classes/SessionReportScreen";
import { LoadFailed } from "../school/classes/teacher-shared";
import { FamilyFrame, familyHref, useFamilyPlace } from "./FamilyFrame";
import { peopleOf } from "./redirects";
import { familyDashboardOptions } from "./dashboard-api";
import styles from "./FamilyLive.module.css";

/** A stored session's report, in a family's words. */
export const FAMILY_REPORT_WORDS: ReportWords = {
  nameHeader: "Child",
  every: "Every child",
  everyLabel: "Every child in the session",
  notSignedIn: "Didn’t start",
  noAnswers: "Started, no answers",
  firstSeen: (at) => `Started ${at}`,
  people: (count) => `${count} ${count === 1 ? "child" : "children"}`,
  oneEach: (shared) => (shared ? "One child each" : "Each by one child"),
  statusWords: { not_signed_in: "Not started" },
};

/** The figures short enough to sit two to a line on a phone. */
const PAIRED = new Set(["problems", "correct", "independent", "helped"]);

/**
 * One child in the report on a phone, from the table's own columns (their
 * names and cells, so a phone and a desktop never say different things):
 * the name and how they ended; the short figures two to a line; what needs
 * a line of its own (help opened, level, when they answered); then every
 * skill's whole name, wrapping. Nothing is cut, nothing runs past the row.
 */
export function ChildReportRow({
  row,
  columns,
}: {
  row: ReportRow;
  columns: readonly DataGridColumn<ReportRow>[];
}) {
  const column = (id: string) => columns.find((entry) => entry.id === id);
  const status = column("status");
  const facts = columns.filter(
    (entry) => !["student", "status", "skills"].includes(entry.id),
  );
  return (
    <div className={styles.reportChild} data-report-child={row.personId}>
      <div className={styles.reportWho}>
        {column("student")?.cell(row)}
        {status && (
          <span className={styles.reportEnd}>
            <span className={styles.reportLabel}>{status.header}</span>
            {status.cell(row)}
          </span>
        )}
      </div>
      <dl className={styles.reportFacts}>
        {facts.map((entry) => {
          const value = entry.cell(row);
          // A level this child's setting keeps off.
          if (value === null) return null;
          return (
            <div
              key={entry.id}
              className={styles.reportFact}
              data-wide={!PAIRED.has(entry.id) || undefined}
            >
              <dt>{entry.header}</dt>
              <dd aria-label={entry.cellLabel?.(row)}>{value}</dd>
            </div>
          );
        })}
      </dl>
      {row.skills.length > 0 && (
        <p className={styles.reportSkills} data-report-child-skills="">
          <span className={styles.reportLabel}>
            {column("skills")?.header ?? "Skills"}
          </span>{" "}
          {row.skills.map((skill, index) => (
            <span key={skill.id}>
              {index > 0 && ", "}
              <EntityLink
                entity={{ kind: "skill", id: skill.id }}
                className={styles.reportSkill}
              >
                {skill.title}
              </EntityLink>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/**
 * A family's session report at `/family/<family>/sessions/<session>`: the
 * class's report screen's own component, in a family's words, each child
 * opening their page. Today stays the current tab (a family has no Time).
 * Its read arrives with the route; a session still running answers 409,
 * which shows as the way back to the live view.
 */
export function FamilyReportScreen() {
  const place = useFamilyPlace();
  const { family, session, own, data } = place;
  const params = useParams({ strict: false }) as { session?: string };
  const classPlace = own ? { org: own.org, class: own.id } : null;
  const report = useQuery({
    ...sessionReportOptions(
      session,
      classPlace ?? { org: "", class: "" },
      params.session ?? "",
    ),
    enabled: !!classPlace && !!params.session,
    retry: (count, error) =>
      !(error instanceof AppError && (error.status ?? 500) < 500) && count < 2,
  });
  // Each child's "Show grade level" setting, as on their dashboard.
  const dashboard = useQuery({
    ...familyDashboardOptions(session, family),
    refetchOnMount: false,
  }).data;
  const kit: ReportKit = useMemo(() => {
    const people = peopleOf(data?.children ?? [], own?.id ?? "");
    const shown = new Map(
      dashboard?.children.map((kid) => [kid.id, kid.gradeLevelShown]),
    );
    return {
      words: FAMILY_REPORT_WORDS,
      link: ({ personId, className, children }) => {
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
      levelShown: (personId) => shown.get(people.get(personId) ?? "") ?? false,
      card: (row, columns) => <ChildReportRow row={row} columns={columns} />,
    };
  }, [data, own?.id, dashboard, family]);
  const today = (
    <Link
      to="/$"
      params={{ _splat: familyHref(family) }}
      className={buttonClass("primary")}
    >
      Open Today
    </Link>
  );
  const open =
    report.error instanceof AppError && report.error.code === "session_open";
  const missing =
    report.error instanceof AppError && report.error.status === 404;
  return (
    <FamilyFrame
      place={place}
      width="wide"
      loading={report.isPending && !!classPlace}
    >
      {report.data ? (
        <Report
          report={report.data}
          className={data?.displayName ?? undefined}
          kit={kit}
        />
      ) : open ? (
        <EmptyState title="This session is still running" action={today}>
          Its report is ready when it stops.
        </EmptyState>
      ) : missing || !classPlace ? (
        <EmptyState title="This session isn’t here" action={today} />
      ) : (
        <LoadFailed
          what="The session’s report"
          onRetry={() => void report.refetch()}
        />
      )}
    </FamilyFrame>
  );
}
