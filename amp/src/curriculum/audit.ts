import { expectedHighSchoolStandardIds, skills, standards } from './catalog.js';
import type { Skill, Standard } from './types.js';

/** Structural validity never certifies pedagogical quality or complete standards coverage. */
export function auditCurriculum(skillList: readonly Skill[] = skills, standardList: readonly Standard[] = standards) {
  const errors: string[] = [];
  const skillById = new Map<string, Skill>();
  const standardById = new Map<string, Standard>();
  const mappedStandards = new Set<string>();
  const facetIds = new Set<string>();
  const gradeBands = new Set(['K','1','2','3','4','5','6','7','8','algebra-1','geometry','algebra-2','precalculus']);
  const statuses = new Set(['planned', 'implemented', 'verified']);
  for (const standard of standardList) {
    if (standardById.has(standard.id)) errors.push(`Duplicate standard: ${standard.id}`);
    standardById.set(standard.id, standard);
    if (!standard.id || !standard.description.trim()) errors.push(`Incomplete standard: ${standard.id}`);
    try { if (new URL(standard.sourceUrl).protocol !== 'https:') throw new Error(); }
    catch { errors.push(`Invalid source URL: ${standard.id}`); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(standard.sourceReviewedAt)) errors.push(`Missing source review date: ${standard.id}`);
  }
  for (const skill of skillList) {
    if (skillById.has(skill.id)) errors.push(`Duplicate skill: ${skill.id}`);
    skillById.set(skill.id, skill);
    if (!skill.id || !skill.title.trim() || !skill.description.trim() || !skill.strand || !skill.lessonId) errors.push(`Incomplete skill: ${skill.id}`);
    if (!gradeBands.has(skill.gradeBand)) errors.push(`Invalid grade band: ${skill.id}`);
    if (!statuses.has(skill.status)) errors.push(`Invalid status: ${skill.id}`);
    if (skill.prerequisiteBasis !== 'editorial') errors.push(`Unattributed prerequisite graph: ${skill.id}`);
    if (new Set(skill.prerequisites).size !== skill.prerequisites.length) errors.push(`Duplicate prerequisites: ${skill.id}`);
    if (skill.facets.length === 0) errors.push(`Missing assessment facets: ${skill.id}`);
    for (const facet of skill.facets) {
      if (facetIds.has(facet.id)) errors.push(`Duplicate facet: ${facet.id}`);
      facetIds.add(facet.id);
      if (!facet.id || !facet.description.trim() || !statuses.has(facet.status)) errors.push(`Invalid facet: ${skill.id}`);
      if (skill.status === 'verified' && facet.status !== 'verified') errors.push(`Unverified facet in verified skill: ${skill.id}`);
    }
    const aligned = new Set<string>();
    for (const alignment of skill.alignments) {
      if (!standardById.has(alignment.standardId)) errors.push(`Unknown standard ${alignment.standardId} in ${skill.id}`);
      else mappedStandards.add(alignment.standardId);
      if (aligned.has(alignment.standardId)) errors.push(`Duplicate alignment in ${skill.id}: ${alignment.standardId}`);
      aligned.add(alignment.standardId);
      if (!alignment.facet.trim() || alignment.basis !== 'editorial') errors.push(`Unqualified alignment: ${skill.id}`);
    }
  }
  for (const skill of skillList) for (const parent of skill.prerequisites) {
    if (!skillById.has(parent)) errors.push(`Unknown prerequisite ${parent} in ${skill.id}`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) { errors.push(`Prerequisite cycle at ${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const parent of skillById.get(id)?.prerequisites ?? []) if (skillById.has(parent)) visit(parent);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of skillById.keys()) visit(id);
  const unmappedStandardIds = standardList.filter(s => !mappedStandards.has(s.id)).map(s => s.id);
  const expectedHighSchoolIds = new Set(expectedHighSchoolStandardIds);
  const highSchoolStandards = standardList.filter(s => s.scope === 'standard' && /^HS[NASFG]\./.test(s.id));
  const missingHighSchoolStandardIds = expectedHighSchoolStandardIds.filter(id => !standardById.has(id));
  const unexpectedHighSchoolStandardIds = highSchoolStandards.filter(s => !expectedHighSchoolIds.has(s.id)).map(s => s.id);
  return {
    inventoryComplete: missingHighSchoolStandardIds.length === 0 && unexpectedHighSchoolStandardIds.length === 0,
    missingHighSchoolStandardIds, unexpectedHighSchoolStandardIds,
    valid: errors.length === 0, errors,
    counts: {
      skills: skillList.length, standards: standardList.length,
      numberedStandards: standardList.filter(s => s.scope === 'standard').length,
      highSchoolStandards: highSchoolStandards.length,
      advancedHighSchoolStandards: highSchoolStandards.filter(s => s.advanced).length,
      domainReferences: standardList.filter(s => s.scope === 'domain').length,
      mappedStandards: mappedStandards.size,
      plannedSkills: skillList.filter(s => s.status === 'planned').length,
      implementedSkills: skillList.filter(s => s.status === 'implemented').length,
      verifiedSkills: skillList.filter(s => s.status === 'verified').length,
      facets: facetIds.size,
    },
    unmappedSkillIds: skillList.filter(s => s.alignments.length === 0).map(s => s.id),
    unimplementedSkillIds: skillList.filter(s => s.status === 'planned').map(s => s.id),
    unmappedStandardIds,
    limitations: [
      'A crosswalk identifies an editorially selected facet, not full-standard coverage.',
      'Numbered high-school crosswalks are planned editorial facets; state crosswalks require separate review.',
      'The inventory omits lettered component records; full source requirements must be checked before coverage claims.',
      'Graph validity and catalog inclusion do not establish content availability, instructional efficacy or score outcomes.',
    ],
  };
}


export const productionArtifacts = ['template', 'explanation', 'lesson', 'workbook', 'answer-key', 'render-validation', 'instructional-review'] as const;
export type ProductionArtifact = typeof productionArtifacts[number];
export interface ProductionTask {
  id: string;
  skillId: string;
  artifact: ProductionArtifact;
  status: 'planned';
  /** Lower priorities are earlier in the default prerequisite-first production order. */
  priority: number;
  prerequisiteSkillIds: string[];
  facetIds: string[];
  dependsOn: string[];
}
/** A production backlog, not a list of published files or successful review results. */
export function buildProductionQueue(skillList: readonly Skill[] = skills): ProductionTask[] {
  const byId = new Map(skillList.map(skill => [skill.id, skill]));
  if (byId.size !== skillList.length) throw new Error('Production queue requires unique skill IDs.');
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  function depth(id: string): number {
    if (visiting.has(id)) throw new Error(`Production queue prerequisite cycle: ${id}`);
    const cached = depths.get(id); if (cached !== undefined) return cached;
    const skill = byId.get(id); if (!skill) throw new Error(`Production queue unknown prerequisite: ${id}`);
    visiting.add(id);
    const result = skill.prerequisites.length ? 1 + Math.max(...skill.prerequisites.map(depth)) : 0;
    visiting.delete(id); depths.set(id, result); return result;
  }
  const dependencies: Record<ProductionArtifact, ProductionArtifact[]> = {
    template: [], explanation: ['template'], lesson: ['explanation'], workbook: ['template'],
    'answer-key': ['workbook'], 'render-validation': ['template', 'lesson', 'workbook', 'answer-key'],
    'instructional-review': ['explanation', 'lesson', 'workbook', 'answer-key', 'render-validation'],
  };
  return skillList.flatMap(skill => productionArtifacts.map((artifact, index) => ({
    id: `production.${skill.id}.${artifact}`, skillId: skill.id, artifact, status: 'planned' as const,
    priority: depth(skill.id) * productionArtifacts.length + index,
    prerequisiteSkillIds: [...skill.prerequisites], facetIds: skill.facets.map(facet => facet.id),
    dependsOn: dependencies[artifact].map(required => `production.${skill.id}.${required}`),
  }))).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}
