import { useEffect } from "react";
import { LessonFailure } from "./LessonRecovery";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { ProblemLessonView } from "../../../content/problem-lessons";
import { request } from "../../lib/api";
import { ProblemLesson } from "../../ProblemLesson";
import "../../practice.css";
import "../../scene/scene-player.css";
import "katex/dist/katex.min.css";
export default function SkillLesson({
  templateId,
  onBack,
}: {
  templateId: string;
  onBack: () => void;
}) {
  const lesson = useQuery({
    queryKey: ["pathways-lesson", templateId],
    queryFn: ({ signal }) =>
      request(
        `/problem-lessons/${encodeURIComponent(templateId)}`,
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
      <LessonFailure onBack={onBack} retry={() => void lesson.refetch()} />
    );
  if (!lesson.data) return <p role="status">Loading lesson…</p>;
  return (
    <>
      <h2>{lesson.data.lesson.title}</h2>
      <ProblemLesson lesson={lesson.data.lesson} />
    </>
  );
}
