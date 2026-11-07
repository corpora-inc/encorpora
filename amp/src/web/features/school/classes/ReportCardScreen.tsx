import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { ReportCardsResponse } from "../../../../schools/teacher-contracts";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { useStaffSession } from "./api";
import { reportCardsOptions } from "./teacher-api";
import {
  classUrl,
  dayRange,
  number,
  useClassSearch,
  uuidOr,
} from "./teacher-shared";
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
}: {
  data: ReportCardsResponse;
  student: ReportCardsResponse["students"][number];
}) {
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <div>
          <p className={styles.school}>{data.school}</p>
          <p className={styles.kind}>Report card</p>
        </div>
        <div className={styles.term}>
          <p>{data.term.name}</p>
          <p>{dayRange(data.term.startsOn, data.term.endsOn)}</p>
        </div>
      </header>
      <h2 className={styles.name}>{student.name}</h2>
      <dl className={styles.people}>
        <div>
          <dt>Course</dt>
          <dd>
            {data.class.name.includes(data.class.course)
              ? data.class.name
              : `${data.class.name}, ${data.class.course}`}
          </dd>
        </div>
        {data.teachers.length > 0 && (
          <div>
            <dt>{data.teachers.length === 1 ? "Teacher" : "Teachers"}</dt>
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
          <dt>Objectives gained</dt>
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
        Final grades are decided by the teacher. AMP measures growth and time on
        task, and its evidence is available from the teacher on request.
      </p>
    </article>
  );
}

/** Report cards for a term: one student's from a link, or the whole class as
 * one printable file, a page each. */
export function ReportCardScreen() {
  const place = useParams({ from: "/school/$org/classes/$class/report-cards" });
  const session = useStaffSession();
  const [search] = useClassSearch();
  const term = uuidOr(search.term);
  const only = uuidOr(search.student);
  const cards = useQuery({
    ...reportCardsOptions(session, place, term ?? ""),
    enabled: !!session && !!term,
  });
  const back = (
    <Link
      to="/$"
      params={{ _splat: classUrl(place.org, place.class, "gradebook") }}
      search={(term ? { term } : {}) as never}
      className={buttonClass("secondary")}
    >
      Back to the gradebook
    </Link>
  );
  if (term && cards.isPending) return <LoadingScreen />;
  const data = cards.data;
  const students = data
    ? data.students.filter((student) => !only || student.id === only)
    : [];
  const blank = students.filter((student) => !student.final).length;
  return (
    <div className={styles.page} data-dense>
      {!term || !data ? (
        <div className={styles.lost}>
          <EmptyState title="These report cards didn’t load" action={back}>
            Open them again from the gradebook.
          </EmptyState>
        </div>
      ) : students.length === 0 ? (
        <div className={styles.lost}>
          <EmptyState title="No students in this term yet" action={back} />
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarText}>
              <h1>
                {only ? students[0]!.name : `${data.class.name} report cards`}
              </h1>
              <p>
                {data.term.name}
                {only ? "" : `, ${students.length} students, one page each`}
                {blank === 0
                  ? ""
                  : only
                    ? ". No final grade entered yet."
                    : `. ${blank === 1 ? "1 card has" : `${blank} cards have`} no final grade yet.`}
              </p>
            </div>
            <div className={styles.toolbarActions}>
              {back}
              <Button variant="primary" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          </div>
          <div className={styles.cards}>
            {students.map((student) => (
              <Card key={student.id} data={data} student={student} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
