import assert from 'node:assert/strict';
import test from 'node:test';
import { expectedHighSchoolStandardIds, skills, standards } from '../src/curriculum/catalog.js';
import { auditCurriculum, buildProductionQueue, productionArtifacts } from '../src/curriculum/audit.js';

test('catalog has a valid prerequisite graph and distinguishes planned content from standards coverage', () => {
  const result = auditCurriculum();
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(result.counts.numberedStandards, 385);
  assert.equal(result.counts.verifiedSkills, 0);
  assert.equal(result.counts.plannedSkills, skills.length);
  assert.deepEqual(result.unmappedStandardIds.filter(id => standards.find(s => s.id === id)?.scope === 'standard'), []);
  assert.ok(result.unmappedSkillIds.includes('polar-coordinates'));
  assert.deepEqual(new Set(skills.map(s => s.gradeBand)), new Set(['K','1','2','3','4','5','6','7','8','algebra-1','geometry','algebra-2','precalculus']));
});

test('template integrations have stable targeted skill IDs', () => {
  for (const id of ['count-to-20','addition-within-20','subtraction-within-20','multiplication-facts','fraction-model','fraction-addition','rectangle-area','linear-equations','statistics-mean','pythagorean-theorem','quadratic-minimum','geometric-sequences','logarithms']) {
    assert.ok(skills.some(skill => skill.id === id), id);
  }
});

test('audit rejects cycles and missing prerequisite references', () => {
  const first = structuredClone(skills[0]!);
  const second = structuredClone(skills[1]!);
  first.prerequisites = [second.id]; second.prerequisites = [first.id, 'absent'];
  const result = auditCurriculum([first, second], standards);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('cycle')));
  assert.ok(result.errors.some(error => error.includes('Unknown prerequisite absent')));
});

test('audit rejects duplicated identities and unsupported source claims', () => {
  const skill = structuredClone(skills[0]!);
  skill.alignments.push({ standardId: 'fabricated', facet: 'example', basis: 'editorial' });
  const standard = { ...standards[0]!, sourceUrl: 'javascript:alert(1)' };
  const result = auditCurriculum([skill, skill], [standard, standard]);
  assert.equal(result.valid, false);
  for (const message of ['Duplicate skill', 'Duplicate standard', 'Duplicate facet', 'Unknown standard', 'Invalid source URL']) {
    assert.ok(result.errors.some(error => error.includes(message)), message);
  }
});

test('a skill cannot claim verification when its assessed facet is only planned', () => {
  const skill = { ...skills[0]!, status: 'verified' as const };
  const result = auditCurriculum([skill], standards);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('Unverified facet')));
});


test('high-school numbered inventory matches all official category cluster ranges', () => {
  const result = auditCurriculum();
  assert.equal(result.inventoryComplete, true);
  assert.equal(result.counts.highSchoolStandards, 156);
  assert.equal(new Set(expectedHighSchoolStandardIds).size, 156);
  assert.deepEqual(result.missingHighSchoolStandardIds, []);
  assert.deepEqual(result.unexpectedHighSchoolStandardIds, []);
  for (const [category, count] of Object.entries({ HSN: 27, HSA: 27, HSF: 28, HSG: 43, HSS: 31 })) {
    assert.equal(standards.filter(s => s.scope === 'standard' && s.id.startsWith(`${category}.`)).length, count);
  }
  assert.equal(standards.find(s => s.id === 'HSN.VM.C.12')?.advanced, true);
  assert.equal(standards.find(s => s.id === 'HSA.REI.B.3')?.advanced, false);
  const incomplete = auditCurriculum(skills, standards.filter(s => s.id !== 'HSF.TF.C.9'));
  assert.equal(incomplete.inventoryComplete, false);
  assert.deepEqual(incomplete.missingHighSchoolStandardIds, ['HSF.TF.C.9']);
});

test('HS alignments name numbered requirements and planned assessment facets', () => {
  for (const skill of skills) {
    assert.ok(!skill.alignments.some(a => ['HSN','HSA','HSF','HSG','HSS'].includes(a.standardId)));
    for (const alignment of skill.alignments.filter(a => /^HS[NASFG]\./.test(a.standardId))) {
      assert.ok(skill.facets.some(f => f.id === `${skill.id}.${alignment.standardId}` && f.status === 'planned'));
    }
  }
});

test('production queue provides stable identities dependencies and prerequisite-first priorities', () => {
  const queue = buildProductionQueue();
  assert.equal(queue.length, skills.length * productionArtifacts.length);
  const byId = new Map(queue.map(item => [item.id, item]));
  assert.equal(byId.size, queue.length);
  for (const item of queue) {
    assert.equal(item.status, 'planned');
    for (const required of item.dependsOn) {
      assert.ok(byId.has(required));
      assert.ok(byId.get(required)!.priority < item.priority);
    }
    if (item.artifact === 'template') for (const prerequisite of item.prerequisiteSkillIds) {
      assert.ok(byId.get(`production.${prerequisite}.template`)!.priority < item.priority);
    }
  }
  assert.deepEqual(buildProductionQueue([...skills].reverse()), queue);
});

test('production queue fails closed on dangling prerequisites and cycles', () => {
  const skill = structuredClone(skills[0]!);
  skill.prerequisites = ['missing'];
  assert.throws(() => buildProductionQueue([skill]), /unknown prerequisite/);
  skill.prerequisites = [skill.id];
  assert.throws(() => buildProductionQueue([skill]), /cycle/);
});
