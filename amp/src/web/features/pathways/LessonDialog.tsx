import { lazy, Suspense, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { lessonFilms } from "../../../content/lesson-films";
import { skillCatalogOptions } from "../../lib/learning-view";
import { Dialog } from "../../ui/Dialog";
import { FilmLink } from "../films/FilmLink";
import { LessonWait } from "./LessonWait";
import { LessonBoundary } from "./LessonRecovery";
import { pathwaysLessonOptions } from "./lesson-query";
import styles from "./LessonDialog.module.css";
const SkillLesson = lazy(() => import("./SkillLesson"));

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
 * Its head comes first and at once: the problem type's title, then one row
 * of what to do with it (the page's Try, then its film), the lesson under.
 */
export function LessonDialog({
  lesson,
  onClose,
  onCloseAutoFocus,
  backLabel,
  aboveLayers = false,
  back,
  children,
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
  /** The page's action with this problem type (try it), first in the row. */
  children?: ReactNode;
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
          <LessonHead lesson={lesson}>{children}</LessonHead>
          <LessonBoundary key={lesson} onBack={onClose} backLabel={backLabel}>
            <Suspense fallback={<LessonWait />}>
              <SkillLesson
                templateId={lesson}
                onBack={onClose}
                backLabel={backLabel}
              />
            </Suspense>
          </LessonBoundary>
        </div>
      )}
    </Dialog>
  );
}

/** The problem type's title and its one row of actions. Both are known
 * before the lesson lands (the catalog's title, the film catalogue), so the
 * row is drawn whole at once and nothing in it moves. */
function LessonHead({
  lesson,
  children,
}: {
  lesson: string;
  children?: ReactNode;
}) {
  const catalog = useQuery(skillCatalogOptions);
  const known = catalog.data?.templates.find((t) => t.id === lesson)?.title;
  // An older catalog without titles: the lesson's own, when it lands.
  const loaded = useQuery({
    ...pathwaysLessonOptions(lesson),
    enabled: !!catalog.data && !known,
  });
  const title = known ?? loaded.data?.lesson.title;
  const film = lessonFilms[lesson];
  return (
    <header className={styles.head}>
      <h2 className={styles.title} aria-busy={!title || undefined}>
        {title ?? "\u00a0"}
      </h2>
      {(children || film) && (
        <div className={styles.actions}>
          {children}
          {film && <FilmLink templateId={lesson} film={film} button />}
        </div>
      )}
    </header>
  );
}
