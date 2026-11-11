/** Publication planning has no IO: every approval and byte is checked before uploading. */
import { createHash } from "node:crypto";
import { z } from "zod";
import { semanticFigureSchema } from "../src/math/contracts";
import { scriptSchema, type Script } from "./schema";
import { APPROVED, requireVoices, resolveCast, templateOf, voiceBindings } from "./cast";
import {
  FILM_CAPABILITY,
  FILM_CAPABILITY_V2,
  FILM_CDN,
  type LessonFilm,
} from "../src/content/lesson-films";

/** The oldest player that can draw the film: a shot with its own app figure ({scene}) needs v3. */
export function filmCapability(script: Script): LessonFilm["capability"] {
  return script.shots.some((shot) => shot.figure && "scene" in shot.figure)
    ? FILM_CAPABILITY
    : FILM_CAPABILITY_V2;
}

export const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export type Approval = { grade?: string; added?: string; at?: string };
export type ReviewRow = { id: string; added?: string };
export function assertReviewedFiles(
  approval: Approval,
  modified: readonly number[],
) {
  const added = Date.parse(approval.added ?? ""),
    at = Date.parse(approval.at ?? "");
  if (!Number.isFinite(added) || !Number.isFinite(at))
    throw new Error("Approval edition timestamps are missing");
  // Archived approvals can predate catalog import. Those imports timestamped
  // the JSON before a short AAC transcode; ordinary reviews have no grace period.
  const cutoff = at >= added ? at : added + 5000;
  if (modified.some((time) => !Number.isFinite(time) || time > cutoff))
    throw new Error(
      "Media changed after its reviewed edition; review the new export before publishing",
    );
}
export function approvedIds(
  grades: Record<string, Approval>,
  rows: ReviewRow[],
) {
  // An approval is for the edition shown on the review page, not every future export.
  return Object.entries(grades)
    .filter(
      ([id, grade]) =>
        grade.grade === "approved" &&
        !!grade.added &&
        rows.some((row) => row.id === id && row.added === grade.added),
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id]) => id);
}
/** Reviews can arrive while a committed release batch is being published. */
export function committedApprovalIds(
  grades: Record<string, Approval>,
  rows: ReviewRow[],
  committedPaths: ReadonlySet<string>,
) {
  const ids: string[] = [], pending: string[] = [];
  for (const id of approvedIds(grades, rows)) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid film ID");
    (committedPaths.has(`amp/film/lessons/${id}.json`) ? ids : pending).push(id);
  }
  return { ids, pending };
}
const time = z.number().finite().nonnegative();
const timingSchema = z
  .object({
    duration: time.positive(),
    shots: z
      .array(
        z
          .array(
            z
              .object({
                start: time,
                end: time,
                words: z.array(
                  z
                    .object({ text: z.string(), start: time, end: time })
                    .strict(),
                ),
              })
              .strict(),
          )
          .min(1),
      )
      .min(1),
    voices: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export type Publication = {
  templateId: string;
  /** Further problem types the film is linked from: the screenplay's `teaches`. */
  teaches: string[];
  film: LessonFilm;
  data: Buffer;
  audio: Buffer;
};
/** `teaches` only routes the film. It is not part of what was reviewed or what is published. */
const filmContent = ({ teaches: _teaches, ...content }: Script) => content;
/** Older review exports embedded voice labels in role declarations. Timing owns those bindings. */
export function screenplayFromExport(value: unknown) {
  const source = z
    .object({ script: z.record(z.string(), z.unknown()), timing: timingSchema })
    .parse(value);
  const cast = source.script.cast;
  if (!cast) return scriptSchema.parse(source.script);
  const roles = z
    .record(
      z.string(),
      z
        .object({
          voice: z.string().optional(),
          name: z.string().optional(),
          tag: z.string().optional(),
          kind: z.string().optional(),
        })
        .strict(),
    )
    .parse(cast);
  for (const [role, binding] of Object.entries(roles)) {
    if (binding.voice && source.timing.voices?.[role] !== binding.voice)
      throw new Error("Export cast disagrees with recorded voices");
  }
  return scriptSchema.parse({
    ...source.script,
    cast: Object.fromEntries(
      Object.entries(roles).map(([key, binding]) => [key, binding.kind ? { kind: binding.kind } : {}]),
    ),
  });
}
export function planFilm(
  id: string,
  exported: unknown,
  committedScript: unknown,
  audio: Buffer,
  knownTypes: ReadonlySet<string>,
): Publication {
  const raw = z
    .object({
      id: z.string(),
      title: z.string(),
      problemType: z.string(),
      timing: timingSchema,
      figure: semanticFigureSchema.nullable().optional(),
    })
    .parse(exported);
  const source = { ...raw, script: screenplayFromExport(exported) };
  const committed = scriptSchema.parse(committedScript);
  const script = filmContent(committed);
  const teaches = committed.teaches ?? [];
  const templateId = templateOf(id).template;
  if (
    source.id !== id ||
    source.script.id !== id ||
    source.problemType !== templateId ||
    !knownTypes.has(templateId)
  )
    throw new Error(`Invalid problem type binding: ${id}`);
  teaches.forEach((type, i) => {
    if (type === templateId)
      throw new Error(`Own problem type listed in teaches: ${id}`);
    if (!knownTypes.has(type))
      throw new Error(`Unknown problem type ${type} in teaches: ${id}`);
    if (teaches.indexOf(type) !== i)
      throw new Error(`Problem type ${type} listed twice in teaches: ${id}`);
  });
  if (canonical(filmContent(source.script)) !== canonical(script))
    throw new Error(`Export differs from committed screenplay: ${id}`);
  if (source.title !== script.title)
    throw new Error(`Export title differs: ${id}`);
  if (audio.length < 16 || audio.toString("ascii", 4, 8) !== "ftyp")
    throw new Error(`Invalid AAC container: ${id}`);
  const timing = source.timing;
  if (timing.shots.length !== script.shots.length)
    throw new Error(`Timing shots differ: ${id}`);
  let end = 0;
  timing.shots.forEach((shot, si) => {
    if (shot.length !== script.shots[si]!.beats.length)
      throw new Error(`Timing beats differ: ${id}`);
    for (const beat of shot) {
      if (
        beat.start < end - 0.001 ||
        beat.end < beat.start ||
        beat.end > timing.duration + 0.001
      )
        throw new Error(`Invalid timing: ${id}`);
      for (const word of beat.words)
        if (
          word.start < beat.start - 0.01 ||
          word.end > beat.end + 0.01 ||
          word.end < word.start
        )
          throw new Error(`Invalid word timing: ${id}`);
      end = beat.end;
    }
  });
  // Legacy solo exports used the kit's fixed Madeline narrator. Named casts must record their bindings.
  if (script.cast && !timing.voices)
    throw new Error(`Missing recorded cast: ${id}`);
  const cast = resolveCast(script, timing.voices);
  requireVoices(cast);
  const teacher = cast.roles.find(
    (r) => r.kind === "teacher" || r.kind === "narrator",
  );
  if (!teacher || !["Madeline Brousseaux", "Paul"].includes(teacher.name))
    throw new Error(`Missing approved teacher: ${id}`);
  if (
    timing.voices &&
    Object.values(timing.voices).some((voice) => !APPROVED[voice])
  )
    throw new Error(`Unapproved voice: ${id}`);
  // Deliberate allowlist: never publish review notes, grades, paths or production metadata.
  const data = Buffer.from(
    JSON.stringify({
      id,
      title: script.title,
      script,
      timing,
      figure: source.figure ?? null,
    }),
  );
  const version = sha256(`${sha256(data)}:${sha256(audio)}`);
  const base = `${FILM_CDN}/amp/films/${id}/${version}`;
  const dataUrl = `${base}/data.json`;
  const audioUrl = `${base}/audio.m4a`;
  // The published film is one voice edition. The app plays this edition;
  // further editions can be listed beside it without changing the default.
  const edition = {
    voices: voiceBindings(cast),
    dataUrl,
    audioUrl,
    version,
    duration: timing.duration,
  };
  return {
    templateId,
    teaches,
    data,
    audio,
    film: {
      id,
      version,
      title: script.title,
      dataUrl,
      audioUrl,
      duration: timing.duration,
      teacher: teacher.name as LessonFilm["teacher"],
      capability: filmCapability(script),
      editions: [edition],
    },
  };
}

/**
 * Problem type → film. A film is listed under its own problem type and under
 * each one it teaches. A film made for a problem type wins over one that only
 * teaches it. A problem type that several films only teach is reported in
 * `conflicts` and gets no film until one screenplay drops it.
 */
export function filmManifest(plans: readonly Publication[]) {
  const manifest: Record<string, LessonFilm> = {};
  for (const plan of plans) {
    if (manifest[plan.templateId])
      throw new Error(
        `Multiple approved editions for ${plan.templateId}; choose one on the review page`,
      );
    manifest[plan.templateId] = plan.film;
  }
  const taught = new Map<string, LessonFilm[]>();
  for (const plan of plans)
    for (const type of plan.teaches)
      if (!manifest[type]) taught.set(type, [...(taught.get(type) ?? []), plan.film]);
  const conflicts: string[] = [];
  for (const [type, films] of taught) {
    if (films.length === 1) manifest[type] = films[0]!;
    else
      conflicts.push(
        `Multiple approved films teach ${type} (${films.map((film) => film.id).join(", ")}); none is linked there until one screenplay drops it from teaches`,
      );
  }
  return {
    manifest: Object.fromEntries(
      Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
    ),
    conflicts,
  };
}

/** Manifest publication is last; failed uploads/readbacks leave the old catalog intact. */
export async function publishFilms(
  plans: Publication[],
  upload: (url: string, bytes: Buffer, type: string) => Promise<void>,
  verify: (url: string, bytes: Buffer) => Promise<void>,
  commitManifest: (manifest: Record<string, LessonFilm>) => Promise<void>,
) {
  const { manifest } = filmManifest(plans);
  for (const { film, data, audio } of plans) {
    await upload(film.dataUrl, data, "application/json");
    await upload(film.audioUrl, audio, "audio/mp4");
    await verify(film.dataUrl, data);
    await verify(film.audioUrl, audio);
  }
  await commitManifest(manifest);
}
