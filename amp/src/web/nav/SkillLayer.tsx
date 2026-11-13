import { useQuery } from "@tanstack/react-query";
import { skillCatalogOptions } from "../lib/learning-view";
import { bandLabel } from "../features/pathways/model";
import { Loading } from "../ui/Loading";
import { Sheet } from "../ui/Sheet";
import { EntityLink } from "./links";
import { work } from "./entities";
import { useStaffSession } from "../features/school/classes/api";
import {
  classSkillOptions,
  studentSkillOptions,
  type Place,
} from "../features/school/classes/teacher-api";
import { shortDay, WorkList } from "../features/school/classes/teacher-shared";
import type { StudentSkillResponse } from "../../schools/teacher-contracts";
import styles from "./layers.module.css";

/** A skill of the curriculum, as a layer over any page: what it is, where
 * it sits, and its problem types, each opening its lesson over it. */
export function SkillLayer({
  skill,
  student,
  place,
  open,
  onClose,
}: {
  skill: string;
  /** Opened from a student (a layer below it): their evidence on it. */
  student?: string;
  /** Opened inside a class: the class's spread on it. */
  place?: Place;
  open: boolean;
  onClose: () => void;
}) {
  const catalog = useQuery(skillCatalogOptions);
  const found = catalog.data?.skills.find((entry) => entry.id === skill);
  const types =
    catalog.data?.templates.filter((template) => template.skillId === skill) ??
    [];
  return (
    <Sheet
      open={open}
      tall
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={found?.title ?? "Skill"}
      description={found ? bandLabel(found.gradeBand) : undefined}
    >
      {!catalog.data ? (
        catalog.isError ? (
          <p role="alert">
            The skill didn’t load. Check your connection, then try again.
          </p>
        ) : (
          <Loading />
        )
      ) : !found ? (
        <p>This skill isn’t in the curriculum any more.</p>
      ) : (
        <div className={styles.layer} data-skill-layer={skill}>
          <p className={styles.lede}>{found.description}</p>
          {student ? (
            <StudentOnSkill student={student} skill={skill} />
          ) : place ? (
            <ClassOnSkill place={place} skill={skill} />
          ) : null}
          {types.length > 0 && (
            <section>
              <h3 className={styles.heading}>
                {types.length === 1 ? "Problem type" : "Problem types"}
              </h3>
              <ul className={styles.rows}>
                {types.map((type) => (
                  <li key={type.id}>
                    <EntityLink
                      entity={{ kind: "lesson", id: type.id }}
                      className={styles.row}
                    >
                      <span>{type.title ?? "Its lesson"}</span>
                      <span className={styles.rowAction}>Lesson</span>
                    </EntityLink>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

const STATUS: Record<string, string> = {
  new: "Not started",
  practicing: "Practicing",
  "review-ready": "Ready for review",
};
type Counts = StudentSkillResponse["evidence"];
const onTheirOwn = (counts: Counts) =>
  `${counts.independentCorrect} of ${counts.attempts} on their own`;

/** One student on this skill: where they stand, then their latest answers
 * on it, each opening over the skill. */
function StudentOnSkill({
  student,
  skill,
}: {
  student: string;
  skill: string;
}) {
  const session = useStaffSession();
  const found = useQuery(studentSkillOptions(session, student, skill));
  if (!found.data)
    return found.isError ? (
      <p role="alert">Their work on this skill didn’t load. Try again.</p>
    ) : (
      <Loading />
    );
  const { evidence, work: answers } = found.data;
  return (
    <section data-skill-student={student}>
      <dl className={styles.facts}>
        <div>
          <dt>Status</dt>
          <dd>{STATUS[evidence.status] ?? evidence.status}</dd>
        </div>
        {evidence.attempts > 0 && (
          <div>
            <dt>Answers</dt>
            <dd>{onTheirOwn(evidence)}</dd>
          </div>
        )}
        {evidence.lastPracticedAt && (
          <div>
            <dt>Last practiced</dt>
            <dd>{shortDay(evidence.lastPracticedAt.slice(0, 10))}</dd>
          </div>
        )}
      </dl>
      {answers.length > 0 && (
        <>
          <h3 className={styles.heading}>Recent work</h3>
          <WorkList
            work={answers}
            href={(item) => ({ entity: work(student, item.id) })}
          />
        </>
      )}
    </section>
  );
}

/** The class on this skill: who has practiced it and how it went, each
 * student opening over the skill. */
function ClassOnSkill({ place, skill }: { place: Place; skill: string }) {
  const session = useStaffSession();
  const found = useQuery(classSkillOptions(session, place, skill));
  if (!found.data)
    return found.isError ? (
      <p role="alert">The class’s work on this skill didn’t load. Try again.</p>
    ) : (
      <Loading />
    );
  const practiced = found.data.students
    .filter((row) => row.evidence.attempts > 0)
    .sort(
      (a, b) =>
        a.evidence.independentCorrect / a.evidence.attempts -
        b.evidence.independentCorrect / b.evidence.attempts,
    );
  const total = found.data.students.length;
  return (
    <section data-skill-class={place.class}>
      <h3 className={styles.heading}>
        {`Practiced by ${practiced.length} of ${total}`}
      </h3>
      {practiced.length > 0 && (
        <ul className={styles.rows}>
          {practiced.map((row) => (
            <li key={row.id}>
              <EntityLink
                entity={{ kind: "student", id: row.id }}
                className={styles.row}
              >
                <span>{row.name}</span>
                <span className={styles.rowFact}>
                  {onTheirOwn(row.evidence)}
                </span>
              </EntityLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
