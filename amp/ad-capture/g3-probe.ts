import { readFileSync } from "node:fs";
import { generateProblem, templates } from "../src/math/engine";
const beats = JSON.parse(readFileSync("/Users/skyl/corpora-media/AMP-media/2026-11-03/grade3-speedrun/beats.json","utf8")).beats;
const ids = beats.flatMap((b: any) => b.problemTypes.map((p: any) => [b.skillId, b.strand, p.id, p.responseKind]));
console.log(ids.length);
for (const [s, strand, id, rk] of ids) {
  const t = templates.find((t) => t.id === id);
  if (!t) { console.log("MISSING", id); continue; }
  const p = generateProblem(id, "1");
  console.log(strand.padEnd(12), id.padEnd(40), p.public.id, p.public.response.kind, !!(p.public as any).figure, JSON.stringify(p.answer).slice(0,40));
}
