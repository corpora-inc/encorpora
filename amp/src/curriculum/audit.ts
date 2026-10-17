import { skills, standards } from './catalog.js';
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
  return {
    valid: errors.length === 0, errors,
    counts: {
      skills: skillList.length, standards: standardList.length,
      numberedStandards: standardList.filter(s => s.scope === 'standard').length,
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
      'High-school and SAT references are domains; numbered high-school and state crosswalks require review.',
      'The inventory omits lettered component records; full source requirements must be checked before coverage claims.',
      'Graph validity and catalog inclusion do not establish content availability, instructional efficacy or score outcomes.',
    ],
  };
}
