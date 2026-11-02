import { careerProfiles } from '../constants/career-profiles';
import { jobPaths, resolveBaseCareerId } from '../constants/job-paths';
import { calculateCareerScore } from './career-score';
import { containsEvidenceTerm } from './evidence-keywords';
import type { PersonalProfile } from './personal-profile';
import type { SkillProfile } from './skill-profile';

// These are the first-version product weights shown in the supplied design.
// Keep them visible in the UI; they describe recommendation fit, not hiring odds.
export const careerMatchWeights = { skills: 50, interests: 20, personality: 15, education: 15 } as const;
export type CareerMatchFactor = keyof typeof careerMatchWeights;
export type CareerMatchInput = { skillProfile: SkillProfile | null; personal: PersonalProfile | null };

const personalitySignals: Record<string, string[]> = {
  C01: ['حل المشكلات', 'تحليلي', 'تعاون', 'دقيق', 'problem solving', 'analytical', 'collaborative', 'detail oriented'],
  C02: ['تحليل', 'فضول', 'دقة', 'تواصل', 'analytical', 'curious', 'detail oriented', 'communication', 'business minded'],
  C03: ['بحث', 'تحليل', 'فضول', 'صبر', 'research', 'analytical', 'curious', 'patience'],
  C04: ['تجربة', 'بحث', 'حل المشكلات', 'تحليل', 'experimentation', 'research', 'problem solving', 'analytical'],
  C05: ['فضول', 'دقة', 'هدوء', 'حل المشكلات', 'curious', 'detail oriented', 'calm', 'problem solving'],
  C06: ['عملي', 'استكشاف الأخطاء', 'دقة', 'تواصل', 'hands on', 'troubleshooting', 'detail oriented', 'communication'],
  C07: ['منهجي', 'تحليلي', 'دقيق', 'حل المشكلات', 'systematic', 'analytical', 'detail oriented', 'problem solving'],
  C08: ['تعاون', 'أتمتة', 'حل المشكلات', 'مسؤولية', 'collaborative', 'automation', 'problem solving', 'reliable'],
  C09: ['تواصل', 'تحليل', 'فضول', 'فهم الأعمال', 'communication', 'analytical', 'curious', 'business minded'],
};

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function overlaps(text: string, term: string) {
  const source = normalize(text);
  const needle = normalize(term);
  return Boolean(source && needle && containsEvidenceTerm(source, needle));
}

export function getCareerMatches(input: CareerMatchInput) {
  return jobPaths.map(career => {
    const baseCareerId = resolveBaseCareerId(career.id);
    const role = careerProfiles[baseCareerId];
    const skillReport = calculateCareerScore(career.id, input.skillProfile?.skill_ids?.length ? input.skillProfile.skill_ids : null);
    const interests = input.personal?.interests ?? [];
    const traits = input.personal?.traits ?? [];
    const interestTerms = [career.title, career.description, ...(role?.evidenceKeywords ?? [])];
    const traitTerms = personalitySignals[baseCareerId] ?? [];
    const matchedInterests = interests.filter(value => interestTerms.some(term => overlaps(value, term)));
    const matchedTraits = traits.filter(value => traitTerms.some(term => overlaps(value, term)));
    const degree = input.skillProfile?.cv?.education ?? [];
    const educationText = [input.personal?.major, input.personal?.education,
      ...degree.flatMap(item => [item.name, item.major, item.college, item.organization])]
      .filter((value): value is string => Boolean(value?.trim())).join(' ');
    const educationTerms = [...career.majors, ...(role?.majorKeywords ?? [])];
    const educationMatched = Boolean(educationText && educationTerms.some(term => overlaps(educationText, term)));
    const factors = {
      skills: skillReport.core.length ? Math.round(10000 * skillReport.matchedCore.length / skillReport.core.length) / 100 : 0,
      interests: interests.length ? Math.round(10000 * matchedInterests.length / interests.length) / 100 : 0,
      personality: traits.length ? Math.round(10000 * matchedTraits.length / traits.length) / 100 : 0,
      education: educationMatched ? 100 : 0,
    };
    const hasProfileSignal = Boolean(input.skillProfile?.skill_ids.length || interests.length || traits.length || educationText);
    const score = hasProfileSignal
      ? Math.round((factors.skills * careerMatchWeights.skills
        + factors.interests * careerMatchWeights.interests
        + factors.personality * careerMatchWeights.personality
        + factors.education * careerMatchWeights.education) / 100)
      : null;
    const weightedPoints = Object.fromEntries(Object.entries(factors).map(([key, value]) => [
      key, Math.round(value * careerMatchWeights[key as CareerMatchFactor]) / 100,
    ])) as Record<CareerMatchFactor, number>;

    return {
      career_id: career.id,
      title: career.title,
      description: career.description,
      score,
      breakdown: factors,
      weights: careerMatchWeights,
      weightedPoints,
      skillScore: skillReport.score,
      matched: skillReport.matchedCore.length,
      total: skillReport.core.length,
      missing: skillReport.missingCore,
      matchedInterests,
      matchedTraits,
      educationMatched,
    };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
