import { requirementsForCareerPath, jobPathRequirementProfile } from '../constants/job-path-requirements';
import { certificationPlanId, experiencePlanId, projectPlanId } from './learning-plan';
import { isRelevantEvidence } from './evidence-keywords';
import type { SkillProfile } from './skill-profile';
export function personalLearningPlan(careerId: string, profile: SkillProfile | null, achieved: string[]): string[] {
  const role = jobPathRequirementProfile(careerId);
  if (!role) throw new Error('Unknown career');
  const owned = new Set(profile?.skill_ids ?? []);
  const missing = requirementsForCareerPath(careerId).filter(row => row.priority === 'core' && !owned.has(row.skill_id)).map(row => row.skill_id);
  const certificate = role.certificationIds.some(id => achieved.includes(id)) ? [] : role.certificationIds.slice(0, 1).map(certificationPlanId);
  const experience = profile?.cv?.experiences.some(item => isRelevantEvidence(item, role.evidenceKeywords)) ? [] : [experiencePlanId(careerId)];
  const projectsCount = profile?.cv?.projects?.filter(item => isRelevantEvidence(item, role.evidenceKeywords)).length ?? 0;
  const projects = role.projects.flatMap((_, index) => index >= projectsCount ? [projectPlanId(careerId, index)] : []);
  return [...new Set([...missing, ...certificate, ...experience, ...projects])];
}
