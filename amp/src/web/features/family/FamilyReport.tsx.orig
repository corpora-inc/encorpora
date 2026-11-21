import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppError } from "../../lib/AppError";
import { buttonClass } from "../../ui/Button";
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
import { familyDashboardOptions } from "./api";

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
    };
  }, [data, own?.id, dashboard, family]);
  const today = (
    <Link
      to="/$"
      params={{ _splat: familyHref(family) }}
      className={buttonClass("primary")}
    >
      Back to Today
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
