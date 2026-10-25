import { certificationsByIds, certificationsForCareer } from '../constants/professional-certifications';
import { learningResources } from '../constants/learning-resources';
import { careerProfiles } from '../constants/career-profiles';
import { calculateCareerScore } from './career-score';
import type { PersonalProfile } from './personal-profile';
import type { SkillProfile } from './skill-profile';
import type { LearningProgress } from './learning-progress';
import { jobPaths, resolveBaseCareerId } from '../constants/job-paths';
import { jobPathRequirementProfile } from '../constants/job-path-requirements';
import { containsEvidenceTerm, isRelevantEvidence } from './evidence-keywords';

export type ReadinessWeights = { skills: number; practical: number; certifications: number; academic: number; learning: number };
export const readinessWeights: Record<string, ReadinessWeights> = {
  C01: { skills: 55, practical: 25, certifications: 5, academic: 10, learning: 5 },
  C02: { skills: 50, practical: 20, certifications: 15, academic: 10, learning: 5 },
  C03: { skills: 45, practical: 25, certifications: 10, academic: 15, learning: 5 },
  C04: { skills: 45, practical: 25, certifications: 15, academic: 10, learning: 5 },
  C05: { skills: 45, practical: 20, certifications: 20, academic: 10, learning: 5 },
  C06: { skills: 45, practical: 20, certifications: 25, academic: 5, learning: 5 },
  C07: { skills: 45, practical: 25, certifications: 15, academic: 10, learning: 5 },
  C08: { skills: 45, practical: 25, certifications: 15, academic: 10, learning: 5 },
  C09: { skills: 45, practical: 25, certifications: 10, academic: 15, learning: 5 },
};

export type ReadinessInputs = {
  skillProfile: SkillProfile | null;
  personal: PersonalProfile | null;
  learningProgress: LearningProgress;
  professionalCertifications: string[];
};

export function calculateCareerReadiness(careerId: string, input: ReadinessInputs) {
  const baseCareerId = resolveBaseCareerId(careerId);
  const pathProfile = jobPathRequirementProfile(careerId);
  const weights = pathProfile?.weights ?? readinessWeights[baseCareerId] ?? readinessWeights.C01;
  const skillReport = calculateCareerScore(careerId, input.skillProfile?.skill_ids ?? null);
  const skillRatio = (skillReport.score ?? 0) / 100;
  const profile = pathProfile ?? careerProfiles[baseCareerId];
  const path = jobPaths.find(item => item.id === careerId);
  const allProjects = input.skillProfile?.cv?.projects ?? [];
  const allExperiences = input.skillProfile?.cv?.experiences ?? [];
  const projects = profile ? allProjects.filter(item => isRelevantEvidence(item, profile.evidenceKeywords)).length : 0;
  const experiences = profile ? allExperiences.filter(item => isRelevantEvidence(item, profile.evidenceKeywords)).length : 0;
  const documentedPracticalRatio = (Math.min(projects, 2) / 2 + Math.min(experiences, 1)) / 2;
  // Only evidence whose text contains role signals earns practical points. Skill
  // coverage then scales those points so a generic project cannot inflate every role.
  const practicalRatio = documentedPracticalRatio * skillRatio;
  const roleCertifications = pathProfile ? certificationsByIds(pathProfile.certificationIds) : certificationsForCareer(baseCareerId);
  // Certifications listed for one role are alternatives, not a checklist the
  // user must purchase. One verified role certificate earns this component.
  const certificationRatio = roleCertifications.some(item => input.professionalCertifications.includes(item.id)) ? 1 : 0;
  const coreIds = new Set(skillReport.core.map(item => item.skill_id));
  const roleResources = learningResources.filter(resource => resource.skillIds.some(id => coreIds.has(id)));
  const learningRatio = roleResources.length
    ? roleResources.filter(resource => input.learningProgress[resource.id]).length / roleResources.length
    : 0;
  const approvedDegree = input.skillProfile?.cv?.education?.[0];
  const education = input.personal?.education.trim() || approvedDegree?.name || '';
  const major = input.personal?.major.trim() || approvedDegree?.major || '';
  const hasEducation = Boolean(education || major);
  const academicText = `${education} ${major}`.toLocaleLowerCase();
  const relevantMajor = path && Array.isArray(path.majors)
    ? Boolean(path.majors.some(major => {
        const normalized = major.toLocaleLowerCase();
        return academicText.includes(normalized) || normalized.split(/\s+/).some(word => word.length > 4 && academicText.includes(word));
      }))
    : Boolean('majorKeywords' in profile && profile.majorKeywords.some(keyword => academicText.includes(keyword.toLocaleLowerCase())));
  const gpaRatio = input.personal?.gpa !== null && input.personal?.gpaScale
    ? Math.max(0, Math.min(1, input.personal.gpa / input.personal.gpaScale))
    : 0;
  const academicRatio = (hasEducation ? 0.2 : 0) + (relevantMajor ? 0.3 : 0) + (gpaRatio * 0.5);
  const breakdown = {
    skills: Math.round(weights.skills * skillRatio),
    practical: Math.round(weights.practical * practicalRatio),
    certifications: Math.round(weights.certifications * certificationRatio),
    academic: Math.round(weights.academic * academicRatio),
    learning: Math.round(weights.learning * learningRatio),
  };
  const hasAnyEvidence = Boolean(input.skillProfile?.skill_ids.length || projects || experiences || hasEducation || input.personal?.gpa !== null && input.personal?.gpa !== undefined || Object.keys(input.learningProgress).length || input.professionalCertifications.length);
  return {
    score: hasAnyEvidence ? Object.values(breakdown).reduce((sum, value) => sum + value, 0) : null,
    breakdown, weights, skillReport,
    evidence: { projects, experiences, totalProjects: allProjects.length, totalExperiences: allExperiences.length, relevantMajor, completedResources: roleResources.filter(resource => input.learningProgress[resource.id]).length, totalResources: roleResources.length, achievedCertifications: roleCertifications.filter(item => input.professionalCertifications.includes(item.id)).length, totalCertifications: roleCertifications.length },
  };
}

// Normalize spelling and presentation only; matching uses the existing role vocabulary.
function normalizeInterest(value: string) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().split(/\s+/).map(word => word.startsWith('ال') ? word.slice(2) : word).join(' ');
}

export function getCareerReadinessMatches(input: ReadinessInputs) {
  return jobPaths.map(career => {
    const readiness = calculateCareerReadiness(career.id, input);
    const keywords = (jobPathRequirementProfile(career.id) ?? careerProfiles[resolveBaseCareerId(career.id)])?.evidenceKeywords ?? [];
    const terms = [career.title, ...keywords].map(normalizeInterest).filter(Boolean);
    const matchedInterests = (input.personal?.interests ?? []).filter(interest => {
      const normalized = normalizeInterest(interest);
      return normalized && terms.some(term => containsEvidenceTerm(normalized, term));
    });
    return {
      career_id: career.id, title: career.title, description: career.description,
      score: readiness.score,
      skillScore: readiness.skillReport.score,
      matched: readiness.skillReport.matchedCore.length,
      total: readiness.skillReport.core.length,
      missing: readiness.skillReport.missingCore,
      breakdown: readiness.breakdown,
      weights: readiness.weights,
      matchedInterests,
    };
  // Stable sort retains catalogue order within equally matched readiness ties.
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)
    || Number(b.matchedInterests.length > 0) - Number(a.matchedInterests.length > 0));
}
