import { z } from "zod";
import manifest from "./films/manifest.json";

/**
 * Current clients draw bills in film scenes (v5). v4 clients draw board
 * headers; v3 clients draw earlier scene components. v2 clients receive voice
 * editions of films without scenes or headers; v1 clients their default edition.
 */
export const FILM_CAPABILITY = "lesson-film-v5";
export const FILM_CAPABILITY_V4 = "lesson-film-v4";
export const FILM_CAPABILITY_V3 = "lesson-film-v3";
export const FILM_CAPABILITY_V2 = "lesson-film-v2";
export const FILM_CAPABILITY_V1 = "lesson-film-v1";
export const FILM_CDN = "https://d38iwc9748jekz.cloudfront.net";
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9-]+)?$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const speakerKey = z.string().regex(/^[a-z][a-z0-9-]{0,40}$/);
/** One binding of speaker keys to voice ids, and the bytes that were voiced with it. */
export const filmEditionSchema = z
  .object({
    voices: z.record(speakerKey, z.string().min(1)),
    dataUrl: z.string().url(),
    audioUrl: z.string().url(),
    version: hash,
    duration: z.number().positive().finite(),
  })
  .strict();
export const lessonFilmSchema = z
  .object({
    id,
    version: hash,
    title: z.string().min(1),
    dataUrl: z.string().url(),
    audioUrl: z.string().url(),
    duration: z.number().positive().finite(),
    teacher: z.enum(["Madeline Brousseaux", "Paul"]),
    /** The oldest player: a scene needs v3, a board header v4, a bill v5. */
    capability: z.enum([
      FILM_CAPABILITY_V2,
      FILM_CAPABILITY_V3,
      FILM_CAPABILITY_V4,
      FILM_CAPABILITY,
    ]),
    /** Every voice edition of this film. The first is the default the app plays. */
    editions: z.array(filmEditionSchema).min(1),
  })
  .strict()
  .superRefine((film, ctx) => {
    const editionUrl = (version: string, file: "data.json" | "audio.m4a") =>
      `${FILM_CDN}/amp/films/${film.id}/${version}/${file}`;
    if (
      film.dataUrl !== editionUrl(film.version, "data.json") ||
      film.audioUrl !== editionUrl(film.version, "audio.m4a")
    )
      ctx.addIssue({
        code: "custom",
        message: "Film URLs must name the immutable CDN version",
      });
    film.editions.forEach((edition, index) => {
      if (
        edition.dataUrl !== editionUrl(edition.version, "data.json") ||
        edition.audioUrl !== editionUrl(edition.version, "audio.m4a")
      )
        ctx.addIssue({
          code: "custom",
          message: "Edition URLs must name that edition's CDN version",
          path: ["editions", index],
        });
      if (!Object.keys(edition.voices).length)
        ctx.addIssue({
          code: "custom",
          message: "An edition records a voice for each speaker",
          path: ["editions", index, "voices"],
        });
    });
    const played = film.editions[0]!;
    if (
      played.dataUrl !== film.dataUrl ||
      played.audioUrl !== film.audioUrl ||
      played.version !== film.version ||
      played.duration !== film.duration
    )
      ctx.addIssue({
        code: "custom",
        message: "The default edition is the film the app plays",
      });
  });
export type LessonFilm = z.infer<typeof lessonFilmSchema>;
/** What a client that only knows the first film manifest can parse. */
export type LessonFilmV1 = Omit<LessonFilm, "editions" | "capability"> & {
  capability: typeof FILM_CAPABILITY_V1;
};
export const filmManifestSchema = z.record(id, lessonFilmSchema);
export const lessonFilms = filmManifestSchema.parse(manifest);

/** Opt in explicitly: clients predating the player receive written lessons only. */
export function lessonFilmFor(templateId: string, capability?: unknown) {
  return filmForClient(lessonFilms[templateId], capability);
}
/** A film only reaches a client whose player can draw it. */
export function filmForClient(
  film: LessonFilm | undefined,
  capability?: unknown,
): LessonFilm | LessonFilmV1 | undefined {
  if (!film) return undefined;
  if (capability === FILM_CAPABILITY) return film;
  if (capability === FILM_CAPABILITY_V4)
    return film.capability === FILM_CAPABILITY ? undefined : film;
  if (capability === FILM_CAPABILITY_V3)
    return film.capability === FILM_CAPABILITY_V2 ||
      film.capability === FILM_CAPABILITY_V3
      ? film
      : undefined;
  if (film.capability !== FILM_CAPABILITY_V2) return undefined;
  if (capability === FILM_CAPABILITY_V2) return film;
  if (capability === FILM_CAPABILITY_V1) {
    const { editions: _editions, ...rest } = film;
    return { ...rest, capability: FILM_CAPABILITY_V1 };
  }
  return undefined;
}
