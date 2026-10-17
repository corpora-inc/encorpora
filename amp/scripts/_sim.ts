import { planMixedPractice, templateGrade } from "../src/server/mixed-practice";
import { estimateFrontier, initialLevel, strandLevel } from "../src/learning/frontier";
import { projectSkillEvidence } from "../src/server/evidence";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
const nodes = new Map(skills.map((s) => [s.id, s]));
const byId = new Map(templates.map((t) => [t.id, t]));
const gradeOf = (id: string) => templateGrade(byId.get(id)!, nodes);
const strandOf = (id: string) => nodes.get(byId.get(id)!.skillId)!.strand;
let rnd = 7; const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
function run(birth: number, ability: (s: string) => number, n = 30, label = "") {
  const now0 = Date.parse("2026-10-17T12:00:00Z"); const attempts: any[] = []; const log: string[] = [];
  let inBand = 0;
  for (let i = 0; i < n; i += 3) {
    const t = now0 + i * 20000;
    const frontier = estimateFrontier({ start: initialLevel({ birthYear: birth, now: t }), observations: attempts, gradeOf, strandOf });
    const batch = planMixedPractice({ templates, skills, attempts, evidence: projectSkillEvidence(attempts), frontier, count: 3, seed: `${label}${i}`, now: t });
    for (const [k, c] of batch.entries()) {
      const g = gradeOf(c.template.id); const a = ability(c.strand);
      const p = 1 / (1 + Math.exp(-3 * (a + 0.3 - g)));
      const correct = r() < p; if (Math.abs(g - a) <= 1) inBand++;
      attempts.push({ id: String(attempts.length).padStart(6, "0"), problemId: "p" + attempts.length, requestId: "q" + attempts.length, templateId: c.template.id, skillId: c.template.skillId, correct, assisted: false, response: "", answer: "", explanation: [], createdAt: new Date(t + k * 5000).toISOString() });
      log.push(`${g}${correct ? "+" : "-"}${c.strand.slice(0, 3)}`);
    }
  }
  const f = estimateFrontier({ start: initialLevel({ birthYear: birth }), observations: attempts, gradeOf, strandOf });
  console.log(label, "inBand", inBand + "/" + n, "overall", f.overall.level.toFixed(2), Object.entries(f.strands).map(([s, v]) => `${s}:${v.level.toFixed(1)}`).join(" "));
  console.log("  ", log.join(" "));
}
run(2012, (s) => (s === "fractions" ? 3 : 7), 30, "gap7");
run(2016, () => 7, 30, "ahead-7");
run(2016, () => 0.5, 30, "behind-K");
run(2012, (s) => (s === "fractions" ? 3 : 7), 30, "fraction-gap");
run(2008, () => 12, 30, "hs-strong");
