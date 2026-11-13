import { useParams, useSearch } from "@tanstack/react-router";
import { LessonDialog } from "../features/pathways/LessonDialog";
import { StudentLayer } from "../features/school/classes/StudentLayer";
import {
  WorkReplaySlot,
  workSkill,
} from "../features/school/classes/WorkReplaySlot";
import { workParts } from "./entities";
import { useLayers } from "./links";
import { SkillLayer } from "./SkillLayer";

/**
 * The layers open over a place's page (`?open=`, nav/entities.ts), drawn
 * in order: each over the one before, the page under them all still
 * mounted. Only the top one takes keys and X; closing it is Back to where
 * it was opened (lib/return-to.ts).
 */
export function LayerHost({ org }: { org: string }) {
  const { stack, close } = useLayers();
  const classId = (useParams({ strict: false }) as { class?: string }).class;
  const search = useSearch({ strict: false }) as { skill?: unknown };
  return stack.map((entity, index) => {
    const top = index === stack.length - 1;
    // A replayed answer fills the screen: a sheet under it waits closed
    // (Back reopens it), so only one thing ever holds focus.
    const underAnswer = stack
      .slice(index + 1)
      .some((above) => above.kind === "work");
    const key = `${index}:${entity.kind}:${entity.id}`;
    switch (entity.kind) {
      case "student":
        return (
          <StudentLayer
            key={key}
            org={org}
            student={entity.id}
            open={!underAnswer}
            onClose={close}
          />
        );
      case "skill": {
        // Opened from a student: theirs; else, in a class, the class's.
        const from = stack
          .slice(0, index)
          .filter((below) => below.kind === "student")
          .at(-1);
        return (
          <SkillLayer
            key={key}
            skill={entity.id}
            student={from?.id}
            place={classId ? { org, class: classId } : undefined}
            open={!underAnswer}
            onClose={close}
          />
        );
      }
      case "lesson":
        return (
          <LessonDialog
            key={key}
            lesson={entity.id}
            onClose={close}
            backLabel="Back"
            aboveLayers
          />
        );
      case "work": {
        const { student, attempt } = workParts(entity.id);
        return (
          <WorkReplaySlot
            key={`${index}:work`}
            student={student}
            attempt={attempt}
            skill={workSkill(search.skill)}
            layer={{ close, covered: !top }}
          />
        );
      }
    }
  });
}
