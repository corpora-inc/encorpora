/**
 * The files a live player needs for each finished lesson: the screenplay with
 * its word timing and figure, and the narration as AAC.
 *   npx tsx film/export-live.ts <out-dir> <template-id> [...]
 *   npx tsx film/export-live.ts --kit crane <out-dir> <film-id> [...]   another product's films (kits.ts)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { problemLesson } from "../src/content/problem-lessons";
import { scriptSchema } from "./schema";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { resolveCast, templateOf, voiceBindings } from "./cast";
import { FILM_OUT } from "./paths";
import { displayScript } from "./letters";
import { kitOf } from "./kits";

const args = process.argv.slice(2);
const k = args.indexOf("--kit");
const kit = kitOf(k >= 0 ? args.splice(k, 2)[1] : "amp");
const [out, ...ids] = args;
if (!out || !ids.length) throw new Error("Usage: npx tsx film/export-live.ts <out-dir> <template-id>...");
const films = FILM_OUT;
mkdirSync(out, { recursive: true });
const indexPath = join(out, "index.json");
type Row = { id: string; title: string; seconds: number; grade?: string; strand?: string; skill?: string; added?: string };
const index: Row[] = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : [];
for (const id of ids) {
  // `<template>--<variant>` has its own screenplay, narration and files; its figure and metadata are the template's
  const { template } = templateOf(id);
  const script = displayScript(scriptSchema.parse(JSON.parse(readFileSync(join(kit.lessons, `${id}.json`), "utf8"))));
  const timing = JSON.parse(readFileSync(join(films, id, "timing.json"), "utf8"));
  // Speaker key → voice id, the same shape timing.json recorded. Two-speaker films stay {teacher, learner}.
  timing.voices = voiceBindings(resolveCast(script, timing.voices));
  // the template's example, drawn by {example: true} shots; a shot's own {scene} travels in the script
  const figure = kit.facts ? problemLesson(template, script.seed ?? "film").example.figure ?? null : null;
  // the lesson knows the problem type it teaches, its skill and the standards that skill meets;
  // another kit's film names its own skill in the screenplay
  const skill = kit.facts ? skills.find((s) => s.id === templates.find((t) => t.id === template)?.skillId) : undefined;
  const meta = kit.facts
    ? { problemType: template, skill: skill?.id, skillTitle: skill?.title, grade: skill?.gradeBand, strand: skill?.strand, standards: (skill as any)?.alignments ?? [] }
    : { kit: kit.name, skill: script.skill };
  writeFileSync(join(out, `${id}.json`), JSON.stringify({ id, title: script.title, ...meta, script, timing, figure }));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(films, id, "narration.wav"), "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", join(out, `${id}.m4a`)]);
  const i = index.findIndex((x) => x.id === id);
  const row: Row = { id, title: script.title, seconds: Math.round(timing.duration), grade: "grade" in meta ? meta.grade : undefined, strand: "strand" in meta ? meta.strand : undefined, skill: meta.skill, added: new Date().toISOString() };
  if (i >= 0) index[i] = row; else index.push(row);
  console.log(`${id}: ${Math.round(timing.duration)} s`);
}
writeFileSync(indexPath, JSON.stringify(index, null, 1));
