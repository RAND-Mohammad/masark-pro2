import { learningResources } from '../constants/learning-resources';
import dataset from '../masarak_dataset.json';
import { normalizeSkillName } from './skill-matching.mjs';
import type { JobMatch, JobRequirement } from './job-matching';
import type { SkillProfile } from './skill-profile';

export function resourcesForJobRequirement(requirement: JobRequirement) {
  const names = [requirement.name, ...requirement.alternatives].map(normalizeSkillName);
  const generic = dataset.skills.some(skill => skill.skill_id === requirement.skillId && normalizeSkillName(skill.name) === requirement.key);
  return learningResources.filter(resource => requirement.skillId && resource.skillIds.includes(requirement.skillId)
    && (generic || names.some(name => normalizeSkillName(`${resource.title} ${resource.url}`).includes(name))));
}
export function jobPlanSkillIds(match: JobMatch, profile: SkillProfile | null) {
  return [...new Set(match.missing.flatMap(item => item.skillId && !profile?.skill_ids.includes(item.skillId) ? [item.skillId] : []))];
}
