import dataset from '../masarak_dataset.json';
import { calculateCareerScore } from './career-score';

export type ReadinessLevel = 'early' | 'developing' | 'ready';
export const READINESS_THRESHOLDS = dataset.scoring.thresholds;
export type GapSkill = { skill_id: string; name: string; description: string };
export type SkillGapReport = {
  career_id: string; score: number | null; level: ReadinessLevel | null;
  matchedCore: GapSkill[]; missingCore: GapSkill[];
  matchedAdditional: GapSkill[]; missingAdditional: GapSkill[];
};
export function readinessLevel(score: number | null): ReadinessLevel | null {
  if (score === null) return null;
  if (score >= READINESS_THRESHOLDS.ready) return 'ready';
  if (score >= READINESS_THRESHOLDS.developing) return 'developing';
  return 'early';
}
export const readinessLabels: Record<ReadinessLevel, string> = {
  early: 'بداية الطريق', developing: 'في طور التطور', ready: 'قريب من الجاهزية',
};
export function getSkillGapReport(careerId: string, userSkillIds: string[] | null): SkillGapReport {
  const report = calculateCareerScore(careerId, userSkillIds);
  const descriptions = new Map(dataset.skills.map(skill => [skill.skill_id, skill.description]));
  const describe = (rows: { skill_id: string; name: string }[]) => rows.map(row => ({ skill_id: row.skill_id, name: row.name, description: descriptions.get(row.skill_id) ?? '' }));
  return {
    career_id: careerId, score: report.score, level: readinessLevel(report.score),
    matchedCore: describe(report.matchedCore), missingCore: describe(report.missingCore),
    matchedAdditional: describe(report.matchedAdditional), missingAdditional: describe(report.missingAdditional),
  };
}
