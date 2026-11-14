import type { ReactNode } from "react";
import { lessonFilms } from "../../../content/lesson-films";
import type { LessonIndex } from "../../../content/lesson-index-build";
import { Dialog } from "../../ui/Dialog";
import { FilmLink } from "../films/FilmLink";
import { LessonBoundary } from "./LessonRecovery";
// In this chunk, not one of its own: the lesson's wait is drawn in the same
// frame as the head, never a moment later.
import SkillLesson from "./SkillLesson";
import index from "./lesson-index.json";
import styles from "./LessonDialog.module.css";
/** Every problem type's title and skill, built from the engine
 * (`npm run build:lesson-index`): in this layer's own chunk, so a cold link
 * knows its title before any request. */
const lessonIndex = index as unknown as LessonIndex;

/** A problem type's id, as `?lesson=` carries it. */
const LESSON_ID = /^[a-z0-9][a-z0-9-]{0,119}$/;
/** The short lesson an address names (`?lesson=`), or null. */
export const lessonParam = (raw: unknown) =>
  typeof raw === "string" && LESSON_ID.test(raw) ? raw : null;

/**
 * A problem type's short lesson, over the screen that opened it. Its address
 * is that screen's with `?lesson=`, so a link, a refresh or Back opens it
 * again, and closing returns to that screen (lib/return-to.ts).
 *
 * Everything is in its final place on the first frame: the problem type's
 * title (this chunk's index), then one row of what to do with it (the page's
 * Try, then its film, from the film catalogue), then the lesson, or its wait
 * where the lesson will be.
 */
export default function LessonDialog({
  lesson,
  onClose,
  onCloseAutoFocus,
  backLabel,
  aboveLayers = false,
  back,
  actions,
}: {
  lesson: string | null;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  /** The recovery's way back, named for where closing goes. */
  backLabel?: string;
  /** Over a full-screen layer (an answer's replay), not just the page. */
  aboveLayers?: boolean;
  /** The layer under this one, where X returns. */
  back?: string;
  /** The page's action with this problem type (try it), first in the row,
   * given the type's skill. */
  actions?: (skill: string | undefined) => ReactNode;
}) {
  return (
    <Dialog
      open={!!lesson}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Explore a problem type"
      fullOnPhone
      tall
      wide
      aboveNavigation={aboveLayers}
      onCloseAutoFocus={onCloseAutoFocus}
      back={back}
    >
      {lesson && (
        <div className={styles.lesson}>
          <LessonHead lesson={lesson} actions={actions} />
          <div className={styles.body}>
            <LessonBoundary key={lesson} onBack={onClose} backLabel={backLabel}>
              <SkillLesson
                templateId={lesson}
                onBack={onClose}
                backLabel={backLabel}
              />
            </LessonBoundary>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** The problem type's title and its one row of actions, known at once. */
function LessonHead({
  lesson,
  actions,
}: {
  lesson: string;
  actions?: (skill: string | undefined) => ReactNode;
}) {
  const [title, skill] = lessonIndex[lesson] ?? [];
  const action = actions?.(skill);
  const film = lessonFilms[lesson];
  // A problem type this build doesn't know: its lesson says why under it.
  if (!title) return null;
  return (
    <div className={styles.head}>
      <h2 className={styles.title}>{title}</h2>
      {(action || film) && (
        <div className={styles.actions}>
          {action}
          {film && <FilmLink templateId={lesson} film={film} button />}
        </div>
      )}
    </div>
  );
}
