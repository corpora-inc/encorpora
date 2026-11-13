import { useEffect } from "react";
import { LessonFailure } from "./LessonRecovery";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { ProblemLessonView } from "../../../content/problem-lessons";
import { FILM_CAPABILITY } from "../../../content/lesson-films";
import { request } from "../../lib/api";
import { ProblemLesson } from "../../ProblemLesson";
import "../../practice.css";
import "../../scene/scene-player.css";
import "katex/dist/katex.min.css";
import { LessonWait } from "./LessonWait";
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
  const lesson = useQuery({
    queryKey: ["pathways-lesson", templateId],
    queryFn: ({ signal }) =>
      request(
        `/problem-lessons/${encodeURIComponent(templateId)}?film=${FILM_CAPABILITY}`,
        z.object({
          lesson: z.custom<ProblemLessonView>(
            (v) =>
              !!v &&
              typeof v === "object" &&
              "templateId" in v &&
              v.templateId === templateId,
          ),
        }),
        { signal },
      ),
    staleTime: 300000,
  });
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
  return (
    <>
      <h2>{lesson.data.lesson.title}</h2>
      <ProblemLesson lesson={lesson.data.lesson} help={PATHWAYS_HELP} />
    </>
  );
}
