import { useQuery } from "@tanstack/react-query";
import { useSessionOrNull } from "../lib/session";
import { useParams } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
// A lesson is its own chunk, with every problem type's title: it opens with
// its head laid out (features/pathways/LessonDialog.tsx).
/** The lesson layer's code, asked for once: the warm-up and the layer
 * share one answer (a failed load fails the layer, never loads twice). */
const lessonCode: { load?: ReturnType<typeof loadLessonCode> } = {};
const loadLessonCode = () => import("../features/pathways/LessonDialog");
const lessonChunk = () => (lessonCode.load ??= loadLessonCode());
const LessonDialog = lazy(lessonChunk);
import {
  LessonFailure,
  LessonLayerBoundary,
} from "../features/pathways/LessonRecovery";
import { Dialog } from "../ui/Dialog";
import { StudentLayer } from "../features/school/classes/StudentLayer";
import { studentRecordOptions } from "../features/school/classes/teacher-api";
import { WorkReplaySlot } from "../features/school/classes/WorkReplaySlot";
import { skillCatalogOptions } from "../lib/learning-view";
import { ENTITIES, staffOnly, workParts, type Entity } from "./entities";
import { useLayers } from "./links";
import { MOTION_MS, useLayerStore, type Layer as Opened } from "./layer-store";
import { LayerFrame, type Moving } from "../ui/LayerFrame";
import { LayerBackProvider } from "../ui/LayerControls";
import { SkillLayer } from "./SkillLayer";
import { SkillWorkbook } from "../features/workbooks/SkillWorkbook";
import { AreaLayer, areaSourceOf, OVERALL, type AreaSource } from "./AreaLayer";
import { strandNames } from "../BirthYearPrompt";
import {
  CurriculumPractice,
  type OpenedFor,
} from "../features/practice/CurriculumPractice";

/**
 * The layers open over a page (nav/layer-store.ts), the page under them
 * still mounted: ONE overlay with ONE scrim (ui/LayerFrame.tsx), its panel
 * the top layer, its trail the way back up. ✕ and the scrim put the whole
 * overlay away; Escape and the trail go up a level. Layers are no steps in
 * history: Back and Forward go between screens, and a screen shows again
 * with its layers as they were, settled, never replaying their motion.
 *
 * A school or class frame passes its `org`: every kind opens. Own practice
 * (Pathways) passes none: a skill and a lesson open, never a student, and a
 * skill shows the `learner`'s own work on it and the skills around it.
 */
export function LayerHost({
  org,
  learner,
  lessonActions,
  skillActions,
  allow,
  area,
}: {
  org?: string;
  /** The level the page shows, for an area opened over it
   * (`area:<strand>`); over a student's record, theirs instead. */
  area?: AreaSource;
  /** Which of the stack's layers this page may open (a family's own
   * children's records, never another family's): others are not drawn. */
  allow?: (entity: Entity) => boolean;
  /** Own practice: whose map this is (none for a visitor). */
  learner?: string;
  /** Above a lesson: what this page offers with it (try this problem type),
   * given the type's skill. */
  lessonActions?: (lesson: string, skill?: string) => ReactNode;
  /** In a skill: what this page offers with it (try a problem). */
  skillActions?: (skill: string) => ReactNode;
}) {
  const layers = useLayers();
  const { stack, scope } = layers;
  const shown = (
    org ? stack : stack.filter((entity) => !staffOnly(entity.kind))
  ).filter((entity) => !allow || allow(entity));
  // An answer's replay fills the screen, a base of its own: the layers
  // under it wait (closing it shows them again), and those over it (its
  // lesson) are the overlay's.
  let replayAt = -1;
  shown.forEach((entity, index) => {
    if (replays(entity)) replayAt = index;
  });
  const replay = replayAt >= 0 ? shown[replayAt]! : null;
  const framed = shown.slice(replayAt + 1);
  const depthOf = (entity: Entity) => stack.indexOf(entity) + 1;
  const moving = (): Moving => {
    const motion = useLayerStore.getState().motion;
    return motion?.scope === scope && performance.now() - motion.at < MOTION_MS
      ? { direction: motion.direction, closed: motion.closed }
      : { direction: 0 };
  };
  const top = framed.at(-1);
  // Any layer can open a lesson over it: its chunk is fetched while the
  // overlay is up, so going deeper never waits on it.
  const open = !!top;
  useEffect(() => {
    if (open)
      void lessonChunk().catch((error: unknown) =>
        console.warn("The lesson layer's code did not preload", error),
      );
  }, [open]);
  return (
    // Each layer's own way back (a lesson's recovery) steps up one level.
    <LayerBackProvider value={layers.close}>
      {replay && (
        <WorkReplaySlot
          own={replay.kind === "own-work"}
          student={replay.kind === "work" ? workParts(replay.id).student : ""}
          attempt={
            replay.kind === "work" ? workParts(replay.id).attempt : replay.id
          }
          skill={replay.skill}
          layer={{
            // An answer closes back to the page it was opened over (its
            // student's sheet with it), as its address always did.
            close: () => layers.closeLayer(depthOf(replay) - 1),
            up: layers.close,
            covered: framed.length > 0,
            step: (entity) => layers.replaceTop(entity),
          }}
        />
      )}
      {top && (
        // One overlay, one scrim, however deep: the top layer is its panel,
        // the trail the way back up (ui/LayerFrame.tsx). A lesson's chunk
        // arrives before the overlay shows, so it opens whole, its head,
        // film and wait in place on its first frame.
        <Suspense fallback={null}>
          <LayerFrame
            // A new frame for each base: over a replay, or over the page.
            key={replay ? `over:${replay.id}` : "page"}
            crumbs={framed.map((entity, index) => ({
              key: `${index}:${entity.kind}:${entity.id}`,
              title: <LayerTitle entity={entity} />,
            }))}
            layers={framed
              .map((entity) => `${entity.kind}:${entity.id}`)
              .join()}
            onCrumb={(depth) => layers.closeToDepth(replayAt + 1 + depth)}
            onClose={layers.closeAll}
            onStepBack={layers.close}
            moving={moving}
            wide={top.kind === "lesson"}
            above={!!replay}
          >
            <Layer
              entity={top}
              below={shown.slice(0, shown.indexOf(top))}
              org={org}
              learner={learner}
              close={layers.closeAll}
              lessonActions={lessonActions}
              skillActions={skillActions}
              area={area}
            />
          </LayerFrame>
        </Suspense>
      )}
    </LayerBackProvider>
  );
}

const replays = (entity: Entity) =>
  entity.kind === "work" || entity.kind === "own-work";

/**
 * Whose a layer is, for the practice it offers, from the stack itself: the
 * learner it was opened for (a child's block on a family's Today; what
 * opens over that layer carries them too), else the roster person whose
 * record or answer it sits over. Nothing: the page's own subject, if it
 * names one
 * (features/practice/CurriculumPractice.tsx). Never the learner last
 * selected on this device.
 */
export function openedFor(
  entity: Opened,
  below: readonly Opened[],
): OpenedFor | undefined {
  if (entity.for) return { learner: entity.for };
  // The nearest record or answer under it.
  const under = below
    .filter((layer) => layer.kind === "work" || layer.kind === "student")
    .at(-1);
  if (!under) return undefined;
  return {
    person: under.kind === "work" ? workParts(under.id).student : under.id,
  };
}

/** A layer's name in the trail: its title, or its kind while that loads. */
function LayerTitle({ entity }: { entity: Entity }) {
  const title = useLayerTitle(entity);
  return <>{title ?? capitalized(ENTITIES[entity.kind].noun)}</>;
}
const capitalized = (word: string) => word[0]!.toUpperCase() + word.slice(1);

function Layer({
  entity,
  below,
  org,
  learner,
  close,
  lessonActions,
  skillActions,
  area,
}: {
  entity: Opened;
  below: Opened[];
  org?: string;
  learner?: string;
  /** The whole overlay away (a lesson's failure, closed). */
  close: () => void;
  lessonActions?: (lesson: string, skill?: string) => ReactNode;
  skillActions?: (skill: string) => ReactNode;
  area?: AreaSource;
}) {
  const classId = (useParams({ strict: false }) as { class?: string }).class;
  // The layer under this one: where a lesson's recovery goes back to.
  const back = useLayerTitle(below.at(-1));
  const title = useLayerTitle(entity);
  // Every layer here is the frame's panel (its Sheet or Dialog draws into
  // it): open while it is the top.
  const underAnswer = false;
  // Whose practice this layer offers, where the stack says.
  const opened = openedFor(entity, below);
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
          learner={org ? undefined : learner}
          connections={!org}
          open={!underAnswer}
          onClose={close}
          back={back}
        >
          {skillActions?.(entity.id) ?? (
            // Practice on the skill, and a workbook held to it, for whoever
            // the layer is about.
            <>
              <CurriculumPractice
                filter={{ skill: entity.id }}
                opened={opened}
              />
              <SkillWorkbook skill={entity.id} opened={opened} />
            </>
          )}
        </SkillLayer>
      );
    }
    case "lesson": {
      // The recovery's way back names where closing goes: the layer under
      // it, else the page (in own practice, the map).
      const backLabel = back ? `Back to ${back}` : org ? "Back" : undefined;
      return (
        // The lesson's chunk failing to load is the lesson's failure, in
        // its own sheet: the page and the layers under it stay.
        <LessonLayerBoundary
          key={entity.id}
          fallback={
            <Dialog
              open
              onOpenChange={(open) => {
                if (!open) close();
              }}
              title={title ?? "Lesson"}
              compactHeader
              fullOnPhone
              tall
              wide
              aboveNavigation
              back={back}
            >
              <LessonFailure onBack={close} backLabel={backLabel} />
            </Dialog>
          }
        >
          <>
            <LessonDialog
              lesson={entity.id}
              onClose={close}
              backLabel={backLabel}
              back={back}
              aboveLayers
              actions={(skill) =>
                lessonActions?.(entity.id, skill) ?? (
                  <CurriculumPractice
                    filter={{ skill, template: entity.id }}
                    opened={opened}
                  />
                )
              }
            />
          </>
        </LessonLayerBoundary>
      );
    }
    case "area": {
      // Opened from a student's record: their level; else the page's.
      const from = below.filter((layer) => layer.kind === "student").at(-1);
      if (from && org)
        return (
          <StudentArea
            student={from.id}
            area={entity.id}
            open={!underAnswer}
            onClose={close}
            back={back}
          />
        );
      return area ? (
        <AreaLayer
          area={entity.id}
          source={area}
          opened={opened}
          open={!underAnswer}
          onClose={close}
          back={back}
        />
      ) : null;
    }
    // An answer's replay is a base of its own, drawn beside the frame.
    case "own-work":
    case "work":
      return null;
  }
}

/** An area of a student's level, from their record (already read by the
 * student's layer under it). */
function StudentArea({
  student,
  area,
  open,
  onClose,
  back,
}: {
  student: string;
  area: string;
  open: boolean;
  onClose: () => void;
  back?: string;
}) {
  const session = useSessionOrNull();
  const record = useQuery({
    ...studentRecordOptions(session, student),
    enabled: !!session,
  });
  if (!record.data) return null;
  return (
    <AreaLayer
      area={area}
      source={areaSourceOf(record.data)}
      open={open}
      onClose={onClose}
      back={back}
    />
  );
}

/** A layer's name, as the one over it shows where X returns: a student's
 * name, a skill's or a lesson's title. Nothing while it loads, or for a
 * replayed answer (the X over it is plain). */
export function useLayerTitle(entity: Entity | undefined) {
  const session = useSessionOrNull();
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
    case "area":
      return entity.id === OVERALL
        ? "Overall"
        : (strandNames[entity.id] ?? undefined);
    default:
      return undefined;
  }
}
