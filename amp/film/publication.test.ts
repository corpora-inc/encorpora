import { expect, test } from "vitest";
import { templates } from "../src/math/engine";
import { filmManifestSchema } from "../src/content/lesson-films";
import { filmManifest, planFilm, publishFilms } from "./publication";
import { scriptSchema } from "./schema";

const skill = "linear-equations";
const own = "linear-equation";
const sibling = "grouped-linear-equation";
const third = "negative-coefficient-equation";
const skillTypes = templates.filter((type) => type.skillId === skill).map((type) => type.id);
const knownTypes = new Set(templates.map((type) => type.id));
const audio = Buffer.from("0000ftyp0000000000000000");
type Routing = { skill?: string; teaches?: string[] };
function plan(type = own, routing: Routing = {}, exportedRouting: Routing = {}) {
  const id = `${type}--lesson`;
  const script = {
    id,
    title: "Solve an equation",
    shots: [{ beats: [{ say: "Find the missing number." }] }],
  };
  return planFilm(id, {
    id,
    title: script.title,
    problemType: type,
    script: { ...script, ...exportedRouting },
    timing: { duration: 3, shots: [[{ start: 0, end: 2, words: [] }]] },
  }, { ...script, ...routing }, audio, knownTypes);
}

test("own-type, unique teaches, then skill fallback, independent of plan order", () => {
  const general = plan(own, { skill });
  const teaching = plan("count-objects", { teaches: [sibling] });
  const specific = plan(sibling);
  expect(filmManifest([general]).manifest[sibling]?.id).toBe(general.film.id);
  for (const plans of [[general, teaching], [teaching, general]]) {
    const { manifest, skillFilms, skillProblemTypes } = filmManifest(plans);
    expect(manifest[sibling]).toEqual(teaching.film);
    expect(JSON.stringify(manifest["count-objects"])).toBe(JSON.stringify(teaching.film));
    expect(manifest[third]?.id).toBe(general.film.id);
    expect(skillFilms).toBe(1);
    expect(skillProblemTypes).toBe(skillTypes.length - 2);
  }
  for (const plans of [[general, teaching, specific], [specific, teaching, general]]) {
    const { manifest, conflicts } = filmManifest(plans);
    expect(manifest[sibling]).toEqual(specific.film);
    expect(JSON.stringify(manifest[sibling])).toBe(JSON.stringify(specific.film));
    expect(manifest[own]?.id).toBe(general.film.id);
    expect(conflicts).toEqual([]);
  }
});

test("every link to a skill film carries skill, including own-type and teaches outside the skill", async () => {
  const general = plan(own, { skill, teaches: ["count-objects"] });
  const { manifest, skillFilms, skillProblemTypes } = filmManifest([general]);
  expect(Object.keys(manifest).sort()).toEqual([...skillTypes, "count-objects"].sort());
  for (const entry of Object.values(manifest)) {
    expect(entry).toEqual({ ...general.film, skill });
    expect(entry.skill).toBe(skill);
  }
  expect(skillFilms).toBe(1);
  expect(skillProblemTypes).toBe(skillTypes.length - 1);
  expect(filmManifestSchema.parse(manifest)).toEqual(manifest);
  // Exercise the publication path with in-memory upload/readback callbacks only.
  let written: unknown;
  await publishFilms([general], async () => {}, async () => {}, async (value) => { written = value; });
  expect(written).toEqual(manifest);
  expect(filmManifest([])).toMatchObject({ skillFilms: 0, skillProblemTypes: 0 });
});

test("conflicting skill claims report both films, preserve specific links, and resolve when a claim drops", () => {
  const first = plan(own, { skill, teaches: ["count-objects"] });
  const second = plan(sibling, { skill, teaches: [third] });
  const { manifest, conflicts, skillFilms, skillProblemTypes } = filmManifest([first, second]);
  expect(conflicts).toEqual([
    `Multiple approved films claim skill ${skill} (${first.film.id}, ${second.film.id}); none is linked as its skill film until one screenplay drops the skill claim`,
  ]);
  expect(manifest).toEqual({
    [own]: first.film,
    [sibling]: second.film,
    "count-objects": first.film,
    [third]: second.film,
  });
  expect(Object.values(manifest).every((entry) => entry.skill === undefined)).toBe(true);
  expect(skillFilms).toBe(0);
  expect(skillProblemTypes).toBe(0);
  const settled = filmManifest([first, plan(sibling, { teaches: [third] })]);
  expect(settled.conflicts).toEqual([]);
  expect(settled.manifest[own]?.skill).toBe(skill);
  expect(settled.manifest[sibling]?.skill).toBeUndefined();
  expect(settled.manifest[third]?.skill).toBeUndefined();
  expect(settled.skillProblemTypes).toBe(skillTypes.length - 3);
  expect(filmManifest([first, second]).manifest).toEqual(manifest); // no plan mutation
});

test("ambiguous teaches has no teaching winner and can fall back to the skill film", () => {
  const teachers = [
    plan("count-objects", { teaches: [sibling] }),
    plan("compare-groups", { teaches: [sibling] }),
  ];
  const withoutSkill = filmManifest(teachers);
  expect(withoutSkill.manifest[sibling]).toBeUndefined();
  expect(withoutSkill.conflicts).toEqual([
    `Multiple approved films teach ${sibling} (count-objects--lesson, compare-groups--lesson); none is linked there until one screenplay drops it from teaches`,
  ]);
  const withSkill = filmManifest([...teachers, plan(own, { skill })]);
  expect(withSkill.conflicts).toEqual(withoutSkill.conflicts);
  expect(withSkill.manifest[sibling]?.skill).toBe(skill);
  expect(withSkill.skillProblemTypes).toBe(skillTypes.length - 1);
  expect(filmManifest([...teachers, plan(sibling)]).conflicts).toEqual([]);
});

test("skill must exist and contain the film's own problem type", () => {
  expect(() => plan(own, { skill: "no-such-skill" })).toThrow(
    "Unknown skill no-such-skill in skill: linear-equation--lesson",
  );
  expect(() => plan(own, { skill: "count-to-20" })).toThrow(
    "Problem type linear-equation does not belong to skill count-to-20: linear-equation--lesson",
  );
  expect(() => plan(own, { skill, teaches: ["no-such-type"] })).toThrow(/Unknown problem type .* in teaches/);
  expect(() => plan(own, { skill, teaches: [own] })).toThrow(/Own problem type listed in teaches/);
  expect(() => plan(own, { skill, teaches: [sibling, sibling] })).toThrow(/listed twice in teaches/);
  for (const invalid of ["", "Linear Equations", null, [skill]])
    expect(() => scriptSchema.parse({ ...JSON.parse(plan().data.toString()).script, skill: invalid })).toThrow();
});

test("adding, changing, or removing routing needs no new export and preserves media and version bytes", () => {
  const plain = plan();
  for (const routed of [
    plan(own, { skill }),
    plan(own, { skill, teaches: [sibling] }, { skill: "count-to-20", teaches: [third] }),
    plan(own, {}, { skill }),
  ]) {
    expect(routed.data.equals(plain.data)).toBe(true);
    expect(routed.audio.equals(plain.audio)).toBe(true);
    expect(JSON.stringify(routed.film)).toBe(JSON.stringify(plain.film));
    const published = JSON.parse(routed.data.toString()).script;
    expect(published).not.toHaveProperty("skill");
    expect(published).not.toHaveProperty("teaches");
  }
});
