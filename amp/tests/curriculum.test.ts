import assert from 'node:assert/strict';
import test from 'node:test';
import { skills, standards } from '../src/curriculum/catalog.js';
import { auditCurriculum } from '../src/curriculum/audit.js';

test('catalog has a valid prerequisite graph and distinguishes planned content from standards coverage', () => {
  const result = auditCurriculum();
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(result.counts.numberedStandards, 229);
  assert.equal(result.counts.verifiedSkills, 0);
  assert.equal(result.counts.plannedSkills, skills.length);
  assert.ok(result.unmappedStandardIds.length > 0);
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
