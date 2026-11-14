import { lessonFilms, type LessonFilm } from "../../../content/lesson-films";

/** A film a skill's sheet offers: what it plays and how it is named. */
export type SkillFilm = {
  /** The problem type it teaches; its film plays at /lessons/<id>/watch. */
  templateId: string;
  /** The problem type's title (the film's own when the catalog has none). */
  title: string;
  duration: number;
};

/**
 * Every film a skill has, from the film catalogue (content/films), in the
 * order its sheet offers them: by its problem types, in the catalog's order.
 * One film teaches several problem types at times: it is offered once, under
 * its own title, and plays from the first of them. Films are made per
 * problem type; a film of a whole skill would come first, once the
 * catalogue can name one.
 */
export function skillFilms(
  types: readonly { id: string; title?: string }[],
  films: Readonly<
    Record<string, Pick<LessonFilm, "id" | "title" | "duration">>
  > = lessonFilms,
): SkillFilm[] {
  const byFilm = new Map<
    string,
    { film: (typeof films)[string]; types: (typeof types)[number][] }
  >();
  for (const type of types) {
    const film = films[type.id];
    if (!film) continue;
    const entry = byFilm.get(film.id) ?? { film, types: [] };
    entry.types.push(type);
    byFilm.set(film.id, entry);
  }
  return [...byFilm.values()].map(({ film, types: taught }) => ({
    templateId: taught[0]!.id,
    title: taught.length === 1 ? (taught[0]!.title ?? film.title) : film.title,
    duration: film.duration,
  }));
}
