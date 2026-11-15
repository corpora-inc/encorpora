import { skills, standards } from "../../../amp/src/curriculum/catalog.js";
import { templates, generateProblem } from "../../../amp/src/math/engine.js";
import { lessons } from "../../../amp/src/content/lessons.js";
import { levels, type Level } from "./levels.js";
import comparisons from "./comparisons.json";
import workbookManifest from "./workbooks.json";
import videos from "./videos.json";

export { levels, comparisons, workbookManifest, videos };
export type Video = (typeof videos)[number];
export type Comparison = (typeof comparisons)[number];
export type Workbook = (typeof workbookManifest.editions)[number];
export type ResourceMeta = {
  path: string;
  label: string;
  title: string;
  description: string;
};
export type Resource = ResourceMeta &
  (
    | {
        kind: "hub";
        hub: "grades" | "resources" | "workbooks" | "lessons" | "compare";
      }
    | { kind: "grade"; level: Level; schoolGrade?: number; course?: boolean }
    | { kind: "workbook"; level: Level; workbook: Workbook }
    | { kind: "lesson"; lesson: (typeof lessons)[number]; level: Level }
    | { kind: "comparison"; comparison: Comparison }
    | { kind: "video"; video: Video; level: Level }
  );
export const gradePath = (level: Level) =>
  Number.isNaN(Number(level.grade)) && level.grade !== "K"
    ? `/courses/${level.slug}/`
    : `/grades/${level.grade === "K" ? "kindergarten" : level.grade}/`;
export const workbookPath = (level: Level) => `/workbooks/${level.slug}/`;
export const lessonPath = (id: string) => `/learn/${id}/`;
export const comparisonPath = (slug: string) => `/compare/amp-vs-${slug}/`;
export const videoPath = (video: Video) => `/videos/${video.id.replace(/(?:\.v\d+|--sa)$/, "")}/`;
export const videoFor = (level: Level) => {
  const video = videos.find((v) => v.grade === level.grade);
  if (!video) throw new Error(`Missing featured video for ${level.grade}`);
  return video;
};
const skillById = new Map(skills.map((s) => [s.id, s]));
export const skillsFor = (level: Level) =>
  skills.filter(
    (s) =>
      s.gradeBand === level.grade && templates.some((t) => t.skillId === s.id),
  );
export const standardsFor = (level: Level) =>
  standards.filter((s) =>
    (/^(K|[1-8])$/.test(level.grade) ? s.id.startsWith(`${level.grade}.`) : s.id.startsWith("HS")) &&
    skillsFor(level).some((skill) =>
      skill.alignments.some((a) => a.standardId === s.id),
    ),
  );
export const sampleFor = (level: Level) => {
  const template = templates.find((t) => t.id === level.sample);
  if (!template || skillById.get(template.skillId)?.gradeBand !== level.grade)
    throw new Error(`Invalid ${level.label} sample: ${level.sample}`);
  return {
    ...generateProblem(level.sample, `public-grade-example-${level.grade}`),
    title: template.title,
  };
};
export const sampleForLesson = (
  lesson: (typeof lessons)[number],
  level: Level,
) => {
  const template = templates.find(
    (t) =>
      lesson.templateIds.includes(t.id) &&
      skillById.get(t.skillId)?.gradeBand === level.grade,
  );
  if (!template) throw new Error(`No suitable example for ${lesson.id}`);
  return {
    ...generateProblem(template.id, `public-lesson-example-${lesson.id}`),
    title: template.title,
  };
};
const secondLessons: Record<string, string> = {
  K: "sort-and-count",
  "1": "open-number-line-to-120",
  "2": "coin-name-and-cent-value",
  "3": "area-tiling-distributive",
  "4": "grade4-place-value",
  "5": "decimal-area-models",
  "6": "prime-factorization-powers",
  "7": "median-data",
  "8": "negative-integer-power",
  "algebra-1": "exponential-time-scale",
  geometry: "similar-solid-volume",
  "algebra-2": "degree-radian-conversion",
  precalculus: "parametric-to-rectangular",
};
export const lessonsFor = (level: Level) => {
  const primary = lessons.find((l) => l.templateIds.includes(level.sample));
  const secondary = lessons.find((l) => l.id === secondLessons[level.grade]);
  if (!primary || !secondary)
    throw new Error(`Missing public lessons for ${level.grade}`);
  for (const lesson of [primary, secondary])
    if (
      !lesson.templateIds.some((id) =>
        templates.some(
          (t) =>
            t.id === id && skillById.get(t.skillId)?.gradeBand === level.grade,
        ),
      )
    )
      throw new Error(`Lesson ${lesson.id} does not map to ${level.grade}`);
  return [primary, secondary];
};
export const workbookFor = (level: Level) => {
  const workbook = workbookManifest.editions.find(
    (e) => e.grade === level.grade,
  );
  if (!workbook) throw new Error(`Missing public workbook: ${level.grade}`);
  return workbook;
};
const hubs: Resource[] = [
  {
    kind: "hub",
    hub: "grades",
    path: "/grades/",
    label: "Math by grade",
    title: "A connected path through mathematics.",
    description:
      "Explore AMP mathematics for kindergarten through Grade 12 and named high-school courses, with real problems, free workbooks and lessons.",
  },
  {
    kind: "hub",
    hub: "resources",
    path: "/resources/",
    label: "Free math resources",
    title: "Good mathematics. Yours to explore.",
    description:
      "Free AMP math workbooks, written lessons and video lessons by grade, with worked explanations and printable answer keys. No account needed.",
  },
  {
    kind: "hub",
    hub: "workbooks",
    path: "/workbooks/",
    label: "Free printable math workbooks",
    title: "Fresh mathematics. Ready for paper.",
    description:
      "Download free AMP math workbooks for kindergarten through precalculus, with worked answer keys in US Letter and A4.",
  },
  {
    kind: "hub",
    hub: "lessons",
    path: "/lessons/",
    label: "Free math lessons",
    title: "See the idea. Understand the method.",
    description:
      "Watch and read AMP mathematics lessons by grade, from counting through precalculus, with diagrams, worked examples and related practice.",
  },
  {
    kind: "hub",
    hub: "compare",
    path: "/compare/",
    label: "Compare math programs",
    title: "Choose the daily math experience.",
    description:
      "Compare AMP with CTCMath, IXL, Math Academy and other math programs. Explore learning approaches, practice, curriculum and printable resources.",
  },
];
export const resources: Resource[] = [
  ...hubs,
  ...levels.map((level) => ({
    kind: "grade" as const,
    level,
    path: gradePath(level),
    course: !/^K$|^\d$/.test(level.grade),
    label: `${level.label} math`,
    title: level.headline,
    description: `${level.label} mathematics with AMP: ${level.themes.join(", ").toLowerCase()}. Explore real examples, lessons and a free printable workbook.`,
  })),
  ...[9, 10, 11, 12].map((schoolGrade, i) => ({
    kind: "grade" as const,
    level: levels[9 + i]!,
    schoolGrade,
    path: `/grades/${schoolGrade}/`,
    label: `Grade ${schoolGrade} math`,
    title: [
      "Choose a strong high-school starting point.",
      "Build connections across high-school mathematics.",
      "Deepen algebra and prepare the next step.",
      "Finish school with mathematics you can use.",
    ][i]!,
    description: `Explore Grade ${schoolGrade} mathematics with AMP. Choose a suitable algebra, geometry or precalculus pathway, with free lessons and printable workbooks.`,
  })),
  {
    kind: "grade",
    level: levels[7]!,
    course: true,
    path: "/courses/pre-algebra/",
    label: "Pre-algebra",
    title: "Give algebra a strong foundation.",
    description:
      "AMP pre-algebra connects rational numbers, ratios, percentages, expressions and equations, with mixed review, visual lessons and printable workbooks.",
  },
  ...levels.map((level) => ({
    kind: "workbook" as const,
    level,
    workbook: workbookFor(level),
    path: workbookPath(level),
    label: `${level.label} math workbook`,
    title: `A free ${level.label.toLowerCase()} math workbook.`,
    description: `Print a free ${level.label.toLowerCase()} AMP math workbook with mixed practice and worked answers. Download US Letter or A4, then create personalized practice in AMP.`,
  })),
  ...levels.flatMap((level) =>
    lessonsFor(level).map((lesson) => ({
      kind: "lesson" as const,
      lesson,
      level,
      path: lessonPath(lesson.id),
      label: lesson.title,
      title: lesson.title,
      description: lesson.summary,
    })),
  ),
  ...comparisons.map((comparison) => ({
    kind: "comparison" as const,
    comparison,
    path: comparisonPath(comparison.slug),
    label: `AMP vs ${comparison.name}`,
    title: `AMP vs ${comparison.name}`,
    description: `Compare AMP and ${comparison.name}: teaching approach, daily practice and curriculum. ${comparison.ampAngle}`,
  })),
  ...levels.map((level) => {
    const video = videoFor(level);
    return {
      kind: "video" as const,
      video,
      level,
      path: videoPath(video),
      label: `${level.label} video lesson`,
      title: video.title,
      description: `Watch ${video.title.toLowerCase()} with AMP: a ${level.label.toLowerCase()} math video with captions, transcript and related practice.`,
    };
  }),
];
export const resourceByPath = new Map(resources.map((r) => [r.path, r]));
if (resourceByPath.size !== resources.length)
  throw new Error("Duplicate public resource URL");
