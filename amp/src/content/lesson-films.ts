import { z } from "zod";
import manifest from "./films/manifest.json";

export const FILM_CAPABILITY = "lesson-film-v1";
export const FILM_CDN = "https://d38iwc9748jekz.cloudfront.net";
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9-]+)?$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const lessonFilmSchema = z
  .object({
    id,
    version: hash,
    title: z.string().min(1),
    dataUrl: z.string().url(),
    audioUrl: z.string().url(),
    duration: z.number().positive().finite(),
    teacher: z.enum(["Madeline Brousseaux", "Paul"]),
    capability: z.literal(FILM_CAPABILITY),
  })
  .strict()
  .superRefine((film, ctx) => {
    const base = `${FILM_CDN}/amp/films/${film.id}/${film.version}/`;
    if (
      film.dataUrl !== `${base}data.json` ||
      film.audioUrl !== `${base}audio.m4a`
    )
      ctx.addIssue({
        code: "custom",
        message: "Film URLs must name the immutable CDN version",
      });
  });
export type LessonFilm = z.infer<typeof lessonFilmSchema>;
export const filmManifestSchema = z.record(id, lessonFilmSchema);
export const lessonFilms = filmManifestSchema.parse(manifest);

/** Opt in explicitly: clients predating the player receive written lessons only. */
export function lessonFilmFor(
  templateId: string,
  capability?: unknown,
): LessonFilm | undefined {
  return capability === FILM_CAPABILITY ? lessonFilms[templateId] : undefined;
}
