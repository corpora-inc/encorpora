import { startGradesFixture } from "./grades-fixture";
import { projectSkillEvidence } from "../src/server/evidence";
import { skills } from "../src/curriculum/catalog";
import { levelDetails } from "../src/learning/level-check";
const fx = await startGradesFixture();
const f = fx.simulated.frontier;
console.log("overall", f.overall, levelDetails(f.overall));
for (const [s, e] of Object.entries(f.strands)) console.log(s, (e as any).level.toFixed(2), (e as any).sd.toFixed(2), (e as any).answered);
for (const e of projectSkillEvidence(fx.attempts)) { const s = skills.find(k => k.id === e.skillId)!; console.log(e.skillId, s.strand, s.gradeBand, e.attempts, e.independentCorrect, e.status); }
await fx.close(); process.exit(0);
