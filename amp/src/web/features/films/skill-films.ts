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
 * order its sheet offers them: the skill's own film first (a film that
 * claims the whole skill, `skill`), then each problem type's, in the
 * catalog's order of its types. One film teaches several problem types at
 * times: it is offered once, under its own title, and plays from the first
 * of them.
 */
export function skillFilms(
  types: readonly { id: string; title?: string }[],
  films: Readonly<
    Record<string, Pick<LessonFilm, "id" | "title" | "duration" | "skill">>
  > = lessonFilms,
  skill?: string,
): SkillFilm[] {
  type Film = (typeof films)[string];
  const byFilm = new Map<
    string,
    { film: Film; types: (typeof types)[number][]; whole?: true }
  >();
  // The skill's own film: under its own title, from the type it was made for.
  const whole = skill
    ? Object.values(films).find((film) => film.skill === skill)
    : undefined;
  if (whole) byFilm.set(whole.id, { film: whole, types: [], whole: true });
  for (const type of types) {
    const film = films[type.id];
    if (!film) continue;
    const entry = byFilm.get(film.id) ?? { film, types: [] };
    entry.types.push(type);
    byFilm.set(film.id, entry);
  }
  return [...byFilm.values()].flatMap(({ film, types: taught, whole }) => {
    const from = taught[0]?.id ?? film.id.split("--")[0]!;
    if (whole && films[from]?.id !== film.id) return [];
    return [
      {
        templateId: from,
        title:
          !whole && taught.length === 1
            ? (taught[0]!.title ?? film.title)
            : film.title,
        duration: film.duration,
      },
    ];
  });
}
