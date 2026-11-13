import { useQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LessonDialog } from "../features/pathways/LessonDialog";
import { StudentLayer } from "../features/school/classes/StudentLayer";
import { studentRecordOptions } from "../features/school/classes/teacher-api";
import {
  WorkReplaySlot,
  workSkill,
} from "../features/school/classes/WorkReplaySlot";
import { skillCatalogOptions } from "../lib/learning-view";
import { sessionOptions } from "../lib/query";
import { staffOnly, workParts, type Entity } from "./entities";
import { useLayers } from "./links";
import { SkillLayer } from "./SkillLayer";

/**
 * The layers open over a page (`?open=`, nav/entities.ts), drawn in order:
 * each over the one before, the page under them all still mounted. Only
 * the top one takes keys and X; closing it is Back to where it was opened
 * (lib/return-to.ts), and its header names the layer it returns to.
 *
 * A school or class frame passes its `org`: every kind opens. Own practice
 * (Pathways) passes none: a skill and a lesson open, never a student.
 */
export function LayerHost({
  org,
  lessonActions,
}: {
  org?: string;
  /** Above a lesson: what this page offers with it (try this problem type). */
  lessonActions?: (lesson: string) => ReactNode;
}) {
  const { stack, close } = useLayers();
  const shown = org ? stack : stack.filter((entity) => !staffOnly(entity.kind));
  return shown.map((entity, index) => (
    <Layer
      key={
        entity.kind === "work"
          ? `${index}:work`
          : `${index}:${entity.kind}:${entity.id}`
      }
      entity={entity}
      below={shown.slice(0, index)}
      above={shown.slice(index + 1)}
      org={org}
      close={close}
      lessonActions={lessonActions}
    />
  ));
}

function Layer({
  entity,
  below,
  above,
  org,
  close,
  lessonActions,
}: {
  entity: Entity;
  below: Entity[];
  above: Entity[];
  org?: string;
  close: () => void;
  lessonActions?: (lesson: string) => ReactNode;
}) {
  const classId = (useParams({ strict: false }) as { class?: string }).class;
  const search = useSearch({ strict: false }) as { skill?: unknown };
  // Where X returns: the layer under this one, named quietly in its header.
  const back = useLayerTitle(below.at(-1));
  // A replayed answer fills the screen: a sheet under it waits closed
  // (Back reopens it), so only one thing ever holds focus.
  const underAnswer = above.some((layer) => layer.kind === "work");
  switch (entity.kind) {
    case "student":
      return (
        <StudentLayer
          org={org!}
          student={entity.id}
          open={!underAnswer}
          onClose={close}
          back={back}
          school={!classId}
        />
      );
    case "skill": {
      // Opened from a student: theirs; else, in a class, the class's.
      const from = below.filter((layer) => layer.kind === "student").at(-1);
      return (
        <SkillLayer
          skill={entity.id}
          student={from?.id}
          place={org && classId ? { org, class: classId } : undefined}
          open={!underAnswer}
          onClose={close}
          back={back}
        />
      );
    }
    case "lesson":
      return (
        <LessonDialog
          lesson={entity.id}
          onClose={close}
          backLabel="Back"
          back={back}
          aboveLayers
        >
          {lessonActions?.(entity.id)}
        </LessonDialog>
      );
    case "work": {
      const { student, attempt } = workParts(entity.id);
      return (
        <WorkReplaySlot
          student={student}
          attempt={attempt}
          skill={workSkill(search.skill)}
          layer={{ close, covered: above.length > 0 }}
        />
      );
    }
  }
}

/** A layer's name, as the one over it shows where X returns: a student's
 * name, a skill's or a lesson's title. Nothing while it loads, or for a
 * replayed answer (the X over it is plain). */
export function useLayerTitle(entity: Entity | undefined) {
  const session = useQuery(sessionOptions).data ?? null;
  const student = useQuery({
    ...studentRecordOptions(session, entity?.id ?? ""),
    enabled: !!session && entity?.kind === "student",
  });
  const catalog = useQuery({
    ...skillCatalogOptions,
    enabled: entity?.kind === "skill" || entity?.kind === "lesson",
  });
  switch (entity?.kind) {
    case "student":
      return student.data?.student.name;
    case "skill":
      return catalog.data?.skills.find((skill) => skill.id === entity.id)
        ?.title;
    case "lesson":
      return catalog.data?.templates.find((type) => type.id === entity.id)
        ?.title;
    default:
      return undefined;
  }
}
