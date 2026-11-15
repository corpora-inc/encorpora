import { useEffect } from "react";
import { LessonFailure } from "./LessonRecovery";
import { useQuery } from "@tanstack/react-query";
import { ProblemLesson } from "../../ProblemLesson";
import "../../practice.css";
import "../../scene/scene-player.css";
import "katex/dist/katex.min.css";
import { LessonWait } from "./LessonWait";
import { pathwaysLessonOptions } from "./lesson-query";
/** A lesson opened from Pathways, recorded as such. */
const PATHWAYS_HELP = { source: "pathways" } as const;
export default function SkillLesson({
  templateId,
  onBack,
  backLabel,
}: {
  templateId: string;
  onBack: () => void;
  backLabel?: string;
}) {
  const lesson = useQuery(pathwaysLessonOptions(templateId));
  useEffect(() => {
    if (lesson.isError) console.error("Pathways lesson request failed.");
  }, [lesson.isError]);
  if (lesson.isError)
    return (
      <LessonFailure
        onBack={onBack}
        backLabel={backLabel}
        retry={() => void lesson.refetch()}
      />
    );
  if (!lesson.data) return <LessonWait />;
  // Its title and its film are the layer's head (LessonDialog), over it.
  return (
    <ProblemLesson
      lesson={lesson.data.lesson}
      help={PATHWAYS_HELP}
      film={false}
    />
  );
}
