import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSkill } from '../../learning/curriculum';
import { FORM_GRADES, gradeNum, inRange } from './registry';
import { REPRESENTATIONS } from './representations';
import { STRUCTURES, type StructureKind } from './structures';

describe('representation sets', () => {
  it('name real skills, and only intents, views and forms the skill\'s grade allows', () => {
    for (const [skillId, rep] of Object.entries(REPRESENTATIONS)) {
      const skill = getSkill(skillId);
      assert.ok(skill, `${skillId} is a curriculum skill`);
      const grade = gradeNum(skill!.grade);
      for (const [kind, views] of Object.entries(rep.structures)) {
        const def = STRUCTURES[kind as StructureKind];
        assert.ok(def, `${skillId}: ${kind} is an intent`);
        assert.ok(inRange(grade, def.grades), `${skillId}: ${kind} covers grade ${grade}`);
        for (const view of views ?? []) {
          if (view === 'none') continue;
          const v = def.views[view as never] as { grades: readonly [number, number] } | undefined;
          assert.ok(v, `${skillId}: ${kind}.${view} is a view`);
          assert.ok(inRange(grade, v!.grades), `${skillId}: ${kind}.${view} covers grade ${grade}`);
        }
      }
      for (const form of rep.forms) assert.ok(inRange(grade, FORM_GRADES[form]), `${skillId}: ${form} covers grade ${grade}`);
    }
  });
});
