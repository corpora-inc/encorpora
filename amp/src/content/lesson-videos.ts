import fractionAddition from "./videos/fraction-addition.v2.json";

export type LessonVideo = {
  id: string;
  version: number;
  title: string;
  templateIds: string[];
  durationSeconds: number;
  language: string;
  voiceId: string;
  transcript: string;
  workedAnswers: string[];
  assets: Record<string, { url: string; sha256: string }>;
};

/** Each binding is reviewed for the method taught, not inferred from a title. */
export const lessonVideos: readonly LessonVideo[] = [fractionAddition];

export function lessonVideoFor(templateId: string): LessonVideo | undefined {
  return lessonVideos.find((video) => video.templateIds.includes(templateId));
}
