import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { learnerSkillOptions, skillCatalogOptions } from "../lib/learning-view";
import { sessionOptions } from "../lib/query";
import { bandLabel, illumination } from "../features/pathways/model";
import {
  neighborLabel,
  skillNeighbors,
  type Neighbor,
} from "../features/pathways/neighbors";
import { useCurriculumDetails } from "../features/curriculum/CurriculumDetails";
import { Meter } from "../ui/Meter";
import { LayerWait } from "./LayerWait";
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
// The dense element resets a sheet's contents read in (`data-dense`): over
// own practice there is no school frame to have loaded them.
import "../features/school/SchoolFrame.module.css";

/** A skill of the curriculum, as a layer over any page: what it is, where
 * it sits, and its problem types, each opening its lesson over it. Over a
 * class or a student, their evidence on it; in own practice, the learner's
 * own, and the skills it builds on and leads to. */
export function SkillLayer({
  skill,
  student,
  place,
  learner,
  connections = false,
  children,
  open,
  onClose,
  back,
}: {
  skill: string;
  /** Opened from a student (a layer below it): their evidence on it. */
  student?: string;
  /** Opened inside a class: the class's spread on it. */
  place?: Place;
  /** Own practice (Pathways): whose map it is, for their own work on it. */
  learner?: string;
  /** Own practice: the skills it builds on, leads to and relates to, each
   * opening over this one. */
  connections?: boolean;
  /** What the page under it offers with this skill (Try a problem). */
  children?: ReactNode;
  open: boolean;
  onClose: () => void;
  /** The layer under this one, where X returns. */
  back?: string;
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
      back={back}
      description={found ? bandLabel(found.gradeBand) : undefined}
    >
      {!catalog.data ? (
        catalog.isError ? (
          <p role="alert">
            The skill didn’t load. Check your connection, then try again.
          </p>
        ) : (
          <LayerWait />
        )
      ) : !found ? (
        <p>This skill isn’t in the curriculum any more.</p>
      ) : (
        <div className={styles.layer} data-skill-layer={skill}>
          <p className={styles.lede}>{found.description}</p>
          {children}
          {student ? (
            <StudentOnSkill student={student} skill={skill} />
          ) : place ? (
            <ClassOnSkill place={place} skill={skill} />
          ) : learner ? (
            <LearnerOnSkill learner={learner} skill={skill} />
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
          {connections && (
            <Connections skills={catalog.data.skills} skill={skill} />
          )}
        </div>
      )}
    </Sheet>
  );
}

type CatalogSkill = { id: string; title: string; gradeBand: string };
const GROUPS = [
  ["buildsOn", "Builds on"],
  ["leadsTo", "Leads to"],
  ["related", "Related skills"],
] as const;
/** The skills around this one, a group each, nearest grade first; each opens
 * over this one, so X comes back here. */
function Connections({
  skills,
  skill,
}: {
  skills: readonly CatalogSkill[];
  skill: string;
}) {
  const neighbors = skillNeighbors(skills, skill, { shared: true });
  return GROUPS.map(([group, title]) =>
    neighbors[group].length ? (
      <ConnectionGroup
        key={`${skill}:${group}`}
        group={group}
        title={title}
        items={neighbors[group]}
      />
    ) : null,
  );
}
const SHOWN = 5;
function ConnectionGroup({
  group,
  title,
  items,
}: {
  group: string;
  title: string;
  items: Neighbor<CatalogSkill>[];
}) {
  const { shown: details } = useCurriculumDetails();
  const [all, setAll] = useState(false);
  return (
    <section data-skill-connections={group}>
      <h3 className={styles.heading}>{title}</h3>
      <ul className={styles.rows}>
        {(all ? items : items.slice(0, SHOWN)).map((item) => {
          // An editorial connection says why, and before this skill, that
          // it isn't required.
          const label = [
            details ? bandLabel(item.skill.gradeBand) : "",
            neighborLabel(item),
            group === "buildsOn" && item.connection ? "Not required" : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={item.skill.id} data-source={item.source}>
              <EntityLink
                entity={{ kind: "skill", id: item.skill.id }}
                className={styles.row}
              >
                <span className={styles.rowMain}>
                  <span>{item.skill.title}</span>
                  {item.connection && (
                    <small>{item.connection.explanation}</small>
                  )}
                </span>
                {label && <span className={styles.rowFact}>{label}</span>}
              </EntityLink>
            </li>
          );
        })}
      </ul>
      {items.length > SHOWN && (
        <button
          type="button"
          data-show-all
          className={styles.more}
          aria-expanded={all}
          onClick={() => setAll(!all)}
        >
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}

/** How a learner's own skill reads, in the map's words. */
const OWN_STATUS = (evidence: Counts) =>
  evidence.status === "review-ready"
    ? "Strong"
    : evidence.attempts > 0
      ? "Building"
      : "Not practiced yet";

/** A learner on this skill, in their own practice: how far it has lit on
 * the map, where it stands, then their latest answers on it. No replay: an
 * answer opens only for staff. */
function LearnerOnSkill({
  learner,
  skill,
}: {
  learner: string;
  skill: string;
}) {
  const session = useQuery(sessionOptions).data;
  const found = useQuery({
    ...learnerSkillOptions(
      session ?? { accountId: "", token: "" },
      learner,
      skill,
    ),
    enabled: !!session,
  });
  if (!found.data)
    return found.isError ? (
      <p role="alert">Your work on this skill didn’t load. Try again.</p>
    ) : (
      <LayerWait part />
    );
  const { evidence, work: answers } = found.data;
  return (
    <section data-skill-learner={learner}>
      <dl className={styles.facts}>
        {evidence.attempts > 0 && (
          <div>
            <dt>Skill progress</dt>
            <dd>
              <Meter
                label="Skill progress"
                value={Math.round(illumination(evidence) * 10) / 10}
                max={10}
              />
            </dd>
          </div>
        )}
        <div>
          <dt>Status</dt>
          <dd>{OWN_STATUS(evidence)}</dd>
        </div>
        {evidence.attempts > 0 && (
          <div>
            <dt>Answers</dt>
            <dd>{`${evidence.independentCorrect} of ${evidence.attempts} without help`}</dd>
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
          <WorkList work={answers} reader="self" />
        </>
      )}
    </section>
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
      <LayerWait part />
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
      <LayerWait part />
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
