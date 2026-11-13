import { lazy, Suspense, type ReactNode } from "react";
import { Dialog } from "../../ui/Dialog";
import { Loading } from "../../ui/Loading";
import { LessonBoundary } from "./LessonRecovery";
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
  /** Actions above the lesson (try this problem type). */
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
      aboveNavigation={aboveLayers}
      onCloseAutoFocus={onCloseAutoFocus}
      back={back}
    >
      {lesson && children}
      {lesson && (
        <LessonBoundary key={lesson} onBack={onClose} backLabel={backLabel}>
          <Suspense fallback={<Loading>Loading lesson…</Loading>}>
            <SkillLesson
              templateId={lesson}
              onBack={onClose}
              backLabel={backLabel}
            />
          </Suspense>
        </LessonBoundary>
      )}
    </Dialog>
  );
}
