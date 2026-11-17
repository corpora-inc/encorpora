import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ReportCardsResponse } from "../../../../schools/teacher-contracts";
import { Button } from "../../../ui/Button";
import { Page } from "../../../ui/Page";
import { PageHeader } from "../../../ui/PageHeader";
import { PrintButton } from "../../../ui/PrintButton";
import { downloadPdf, paperFormat } from "../../../lib/pdf-download";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { useStaffSession } from "./api";
import { gradebookOptions, reportCardsOptions } from "./teacher-api";
import { keptPerson, useClassHost, wholeClass, type ClassHost } from "./host";
import { dayRange, number, useClassView, uuidOr } from "./teacher-shared";
import styles from "./ReportCard.module.css";

const gradeWords = (level: number) =>
  level < 1
    ? "Kindergarten"
    : level < 9
      ? `Grade ${level.toFixed(1)}`
      : `Level ${level.toFixed(1)}`;

function Card({
  data,
  student,
  host,
  print,
}: {
  data: ReportCardsResponse;
  student: ReportCardsResponse["students"][number];
  host: ClassHost;
  /** Its own Print, where the page's would include people this host
   * doesn't show. */
  print?: ReactNode;
}) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.school}>{data.school}</p>
          <p className={styles.kind}>Report card</p>
        </div>
        <div className={styles.term}>
          <p>{data.term.name}</p>
          <p>{dayRange(data.term.startsOn, data.term.endsOn)}</p>
        </div>
      </div>
      <h2 className={styles.name}>{student.name}</h2>
      <dl className={styles.people}>
        {/* A host that names its own place (a family) shows the course
            only when it is more than the class's name. */}
        {(!host.keep ||
          (!!data.class.course &&
            !data.class.course.includes(data.class.name) &&
            !data.class.name.includes(data.class.course))) && (
          <div>
            <dt>Course</dt>
            <dd>
              {host.keep
                ? data.class.course
                : data.class.name.includes(data.class.course)
                  ? data.class.name
                  : `${data.class.name}, ${data.class.course}`}
            </dd>
          </div>
        )}
        {data.teachers.length > 0 && (
          <div>
            <dt>
              {host.words.taughtBy ??
                (data.teachers.length === 1 ? "Teacher" : "Teachers")}
            </dt>
            <dd>{data.teachers.join(", ")}</dd>
          </div>
        )}
        {student.identifier && (
          <div>
            <dt>Student ID</dt>
            <dd>{student.identifier}</dd>
          </div>
        )}
      </dl>
      <div className={styles.grade}>
        <span className={styles.gradeLabel}>Final grade</span>
        {student.final ? (
          <span className={styles.gradeValue}>{student.final}</span>
        ) : (
          <span className={styles.gradeBlank}>Not entered yet</span>
        )}
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Active minutes</dt>
          <dd>{number(student.minutes)}</dd>
        </div>
        <div>
          <dt>Skills earned</dt>
          <dd>{number(student.objectivesGained)}</dd>
        </div>
        <div>
          <dt>Working level</dt>
          <dd>
            {student.levelFrom === null || student.levelTo === null
              ? "Not enough work yet"
              : `${gradeWords(student.levelFrom)} to ${student.levelTo.toFixed(1)}`}
          </dd>
        </div>
      </dl>
      <p className={styles.note}>
        Final grades are decided by {host.decider}. AMP measures growth and time
        on task, and its evidence is available from {host.decider} on request.
      </p>
      {print && <div className={styles.cardPrint}>{print}</div>}
    </article>
  );
}

/** Report cards for a term: one student's from a link, or the whole class as
 * one printable file, a page each. */
export function ReportCardScreen() {
  const host = useClassHost();
  return (
    <Page className={styles.page} data-dense>
      <ReportCards host={host} />
    </Page>
  );
}

/** A term's report cards, for the people a host shows: a header to print
 * them, then a card each. They sit under the class's Grades tab (or a
 * family's own frame), which is the way elsewhere: no in-page Back. */
export function ReportCards({
  host,
  framed = false,
}: {
  host: ClassHost;
  framed?: boolean;
}) {
  const { place, words } = host;
  const session = useStaffSession();
  const [search] = useClassView();
  const asked = uuidOr(search.term);
  // A link with no term opens the one the gradebook opens on.
  const current = useQuery({
    ...gradebookOptions(session, place, undefined),
    enabled: !!session && !asked,
  });
  const term = asked ?? current.data?.term?.id ?? null;
  // One person's card from a link, only if this page shows them.
  const only = keptPerson(host, uuidOr(search.student));
  const cards = useQuery({
    ...reportCardsOptions(session, place, term ?? ""),
    enabled: !!session && !!term,
  });
  if ((!asked && current.isPending) || (term && cards.isPending))
    return framed ? (
      <div aria-busy="true" className={styles.wait} />
    ) : (
      <LoadingScreen />
    );
  const data = cards.data;
  const all = data
    ? data.students.filter((student) => !host.keep || host.keep(student.id))
    : [];
  const students = all.filter((student) => !only || student.id === only);
  // The class's file holds everyone in it: printed whole only when this
  // host shows all of them.
  const whole = !!data && wholeClass(host, all.length, data.students.length);
  const blank = students.filter((student) => !student.final).length;
  const pdf = (student?: string) =>
    downloadPdf({
      path: `/school/classes/${encodeURIComponent(place.class)}/report-cards.pdf?${new URLSearchParams(
        {
          term: term!,
          ...(student ? { student } : {}),
          format: paperFormat(),
        },
      )}`,
      token: session!.token,
      name: "amp-report-cards.pdf",
    });
  if (!term || !data)
    return (
      <div className={styles.lost}>
        <EmptyState
          title={
            framed && !term
              ? "No term to report on yet"
              : "These report cards didn’t load"
          }
          action={
            framed && !term ? undefined : (
              <Button
                variant="secondary"
                onClick={() =>
                  void (term ? cards.refetch() : current.refetch())
                }
              >
                Try again
              </Button>
            )
          }
        >
          {framed && !term
            ? "Set the school year and its terms in Settings."
            : "Check your connection, then try again."}
        </EmptyState>
      </div>
    );
  if (students.length === 0)
    return (
      <div className={styles.lost}>
        <EmptyState title={`No ${words.learners} in this term yet`} />
      </div>
    );
  const summary = (
    <>
      {only || framed ? "" : `${data.term.name}, `}
      {only
        ? data.term.name
        : `${students.length} ${students.length === 1 ? words.learner : words.learners}`}
      {blank === 0
        ? ""
        : only
          ? ". No final grade entered yet."
          : `. ${blank === 1 ? "1 card has" : `${blank} cards have`} no final grade yet.`}
    </>
  );
  const print = (whole || only) && (
    <PrintButton
      variant="primary"
      disabled={!session}
      download={() => pdf(only ?? undefined)}
    >
      {only || students.length === 1 ? "Print" : "Print all"}
    </PrintButton>
  );
  return (
    <div className={styles.set} data-framed={framed ? "" : undefined}>
      {framed ? (
        <div className={styles.toolbar}>
          <div className={styles.toolbarText}>
            <h2>{only ? students[0]!.name : data.term.name}</h2>
            <p>{summary}</p>
          </div>
          {print && <div className={styles.toolbarActions}>{print}</div>}
        </div>
      ) : (
        <PageHeader
          title={only ? students[0]!.name : `${data.class.name} report cards`}
          subtitle={summary}
          actions={print || undefined}
        />
      )}
      <div className={styles.cards}>
        {students.map((student) => (
          <Card
            key={student.id}
            data={data}
            student={student}
            host={host}
            print={
              !whole && !only ? (
                <PrintButton
                  variant="secondary"
                  disabled={!session}
                  download={() => pdf(student.id)}
                >
                  Print
                </PrintButton>
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
