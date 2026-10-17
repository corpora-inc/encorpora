import { auditCurriculum } from "../src/curriculum/audit";
import { skills } from "../src/curriculum/catalog";
import { auditFundingRegistry } from "../src/funding/audit";
import { fundingRegistry } from "../src/funding/registry";
import { templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
const curriculum = auditCurriculum(),
  funding = auditFundingRegistry(fundingRegistry);
const errors = [...curriculum.errors, ...funding.errors];
for (const template of templates) {
  if (!skills.some((s) => s.id === template.skillId))
    errors.push(`Template ${template.id} references unknown skill`);
  if (!lessons.some((l) => l.templateIds.includes(template.id)))
    errors.push(`Template ${template.id} has no lesson`);
}
console.log(
  JSON.stringify(
    {
      curriculum,
      funding,
      referenceContent: {
        templates: templates.length,
        lessons: lessons.length,
        fullyVerifiedSkills: skills.filter((s) => s.status === "verified")
          .length,
      },
      errors,
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
