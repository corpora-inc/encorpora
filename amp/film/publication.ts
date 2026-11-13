/** Publication planning has no IO: every approval and byte is checked before uploading. */
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { z } from "zod";
import { semanticFigureSchema, type SemanticFigure } from "../src/math/contracts";
import { scriptSchema, type Script } from "./schema";
import { APPROVED, requireVoices, resolveCast, templateOf, voiceBindings } from "./cast";
import {
  FILM_CAPABILITY,
  FILM_CAPABILITY_V2,
  FILM_CAPABILITY_V3,
  FILM_CAPABILITY_V4,
  FILM_CDN,
  type LessonFilm,
} from "../src/content/lesson-films";

/**
 * The oldest player that can draw the film: a bill needs v5, a board header
 * v4, a shot's own scene v3. Check example figures too when a shot uses one.
 */
export function filmCapability(script: Script, example?: SemanticFigure | null): LessonFilm["capability"] {
  if (script.shots.some((shot) => {
    const figure = shot.figure;
    const scene = figure && "scene" in figure ? figure.scene
      : figure && "example" in figure && example?.kind === "scene" ? example.scene : undefined;
    return scene?.elements.some((e) => e.type === "bill");
  })) return FILM_CAPABILITY;
  if (script.shots.some((shot) => shot.beats.some((b) => (b.do ?? []).some((a) => a.do === "header"))))
    return FILM_CAPABILITY_V4;
  return script.shots.some((shot) => shot.figure && "scene" in shot.figure)
    ? FILM_CAPABILITY_V3
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

/**
 * A director's approval of a new edition that carries out the notes of the
 * founder's approval of an earlier one (`answers` is that grade's `at`).
 * Kept beside the grades in the review data as `followups.json`.
 */
export const followUpSchema = z
  .object({
    added: z.string().min(1),
    at: z.string().min(1),
    answers: z.string().min(1),
    by: z.literal("director"),
    note: z.string().min(1),
  })
  .strict();
export type FollowUp = z.infer<typeof followUpSchema>;
export const followUpsSchema = z.record(z.string(), followUpSchema);
export type FollowUps = z.infer<typeof followUpsSchema>;
/** What lets a film's current export ship, and the approval its media is checked against. */
export type Release = { via: "founder" | "follow-up"; added: string; at?: string };

const stamp = (value?: string) => Date.parse(value ?? "");
/** Why a director cannot answer the founder's grade with the current export, if they cannot. */
function unanswerable(id: string, grade: Approval | undefined, current: string | undefined) {
  if (!current) return `${id} has no current review export`;
  if (grade?.added === current)
    return `The founder graded the current edition of ${id}; his grade decides. A changed export needs its own edition stamp before a follow-up can answer his grade`;
  if (grade?.grade === "rejected")
    return `The founder's grade of ${id} is a rejection; only a new founder grade can release it`;
  if (grade?.grade !== "approved")
    return `The founder has not approved an earlier edition of ${id}`;
  if (!(stamp(grade.added) < stamp(current)) || !Number.isFinite(stamp(grade.at)))
    return `The founder's approval of ${id} is not of an earlier edition`;
  return undefined;
}
/** A follow-up releases the current export, or says why it does not. */
export function followUpRelease(
  id: string,
  grade: Approval | undefined,
  current: string | undefined,
  followUp: FollowUp,
): { release: Release; reason?: undefined } | { release?: undefined; reason: string } {
  const reason = unanswerable(id, grade, current);
  if (reason) return { reason };
  if (followUp.added !== current)
    return { reason: `The follow-up for ${id} approves edition ${followUp.added}, not the current export ${current}` };
  if (followUp.answers !== grade!.at)
    return { reason: `The follow-up for ${id} answers a founder grade (${followUp.answers}) that is no longer his grade (${grade!.at})` };
  if (!(stamp(followUp.at) > stamp(grade!.at)))
    return { reason: `The follow-up for ${id} is not later than the founder's grade` };
  if (!(stamp(followUp.at) >= stamp(followUp.added)))
    return { reason: `The follow-up for ${id} predates the edition it approves` };
  return { release: { via: "follow-up", added: followUp.added, at: followUp.at } };
}
/**
 * Every film whose current export may ship. The founder's approval of that
 * exact edition releases it (`approvedIds`), and his grade of it alone
 * decides. Otherwise a director's follow-up may release it. `ignored` says
 * why each other follow-up does not apply.
 */
export function releases(
  grades: Record<string, Approval>,
  rows: ReviewRow[],
  followUps: FollowUps = {},
) {
  const released: Record<string, Release> = {};
  for (const id of approvedIds(grades, rows))
    released[id] = { via: "founder", added: grades[id]!.added!, at: grades[id]!.at };
  const ignored: string[] = [];
  for (const [id, followUp] of Object.entries(followUps)) {
    const { release, reason } = followUpRelease(id, grades[id], rows.find((row) => row.id === id)?.added, followUp);
    if (release) released[id] = release;
    else ignored.push(reason);
  }
  return {
    released: Object.fromEntries(
      Object.entries(released).sort(([a], [b]) => a.localeCompare(b)),
    ),
    ignored,
  };
}
/**
 * The follow-up file with a new entry for the film's current export, approved
 * `at` now. Refuses when no founder approval of an earlier edition is there to
 * answer, or when one for this edition is already recorded.
 */
export function recordFollowUp(
  followUps: FollowUps,
  id: string,
  grade: Approval | undefined,
  rows: ReviewRow[],
  note: string,
  at: string,
): FollowUps {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid film ID");
  if (!note.trim()) throw new Error('Say what changed: --note "<text>"');
  const current = rows.find((row) => row.id === id)?.added;
  const refusal = unanswerable(id, grade, current);
  if (refusal) throw new Error(refusal);
  const existing = followUps[id];
  if (existing?.added === current)
    throw new Error(
      `A follow-up for this edition of ${id} was recorded at ${existing.at}; export a new edition to approve further changes`,
    );
  const entry: FollowUp = { added: current!, at, answers: grade!.at!, by: "director", note: note.trim() };
  const { reason } = followUpRelease(id, grade, current, entry);
  if (reason) throw new Error(reason);
  return { ...followUps, [id]: entry };
}
/** `film:publish [--check]`, or `--follow-up <film-id> --note "<text>"` to record one. */
export function publishArgs(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      check: { type: "boolean", default: false },
      "follow-up": { type: "string" },
      note: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const followUp = values["follow-up"];
  if (followUp === undefined) {
    if (values.note !== undefined) throw new Error("--note goes with --follow-up <film-id>");
    return { check: values.check };
  }
  if (values.check) throw new Error("--follow-up records an approval and publishes nothing; run --check on its own");
  if (!values.note?.trim()) throw new Error('Say what changed: --follow-up <film-id> --note "<text>"');
  return { check: false, followUp, note: values.note };
}
/** Reviews can arrive while a committed release batch is being published. */
export function committedApprovalIds(
  grades: Record<string, Approval>,
  rows: ReviewRow[],
  committedPaths: ReadonlySet<string>,
  followUps: FollowUps = {},
) {
  const ids: string[] = [], pending: string[] = [];
  for (const id of Object.keys(releases(grades, rows, followUps).released)) {
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
      capability: filmCapability(script, source.figure),
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
