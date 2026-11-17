import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { ProblemLessonView } from "../../../content/problem-lessons";
import { FILM_CAPABILITY } from "../../../content/lesson-films";
import { request } from "../../lib/api";
import { qk } from "../../lib/keys";

/** A problem type's short lesson, as Pathways' lesson layer reads it: its
 * head (the title) and its body (SkillLesson) share the one request. */
export const pathwaysLessonOptions = (templateId: string) =>
  queryOptions({
    queryKey: qk.pathwaysLesson(templateId),
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
