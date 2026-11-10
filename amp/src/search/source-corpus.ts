/** The corpus from the source modules, as the API and the build read it. */
import { skills } from "../curriculum/catalog";
import { templates } from "../math/engine";
import { lessons } from "../content/lessons";
import { glossary } from "../glossary";
import { lessonFilms } from "../content/lesson-films";
import { buildCorpus } from "./corpus";
import { bands as bandOrder } from "../web/features/pathways/model";

export function sourceCorpus() {
  return buildCorpus({
    lessons,
    templates,
    skills,
    terms: glossary,
    films: Object.values(lessonFilms),
    bandOrder,
  });
}
