import { requirementsForCareerPath } from '../constants/job-path-requirements';

// The same set-based calculation feeds rankings and the gap report.
export function calculateCareerScore(careerId: string, ids: string[] | null) {
  const seen = new Set<string>();
  const requirements = requirementsForCareerPath(careerId).filter(row => {
    if (seen.has(row.skill_id)) return false;
    seen.add(row.skill_id);
    return true;
  });
  const owned = new Set(ids ?? []);
  const core = requirements.filter(row => row.priority === 'core');
  const additional = requirements.filter(row => row.priority === 'additional');
  const matchedCore = core.filter(row => owned.has(row.skill_id));
  return {
    core, additional, matchedCore,
    missingCore: core.filter(row => !owned.has(row.skill_id)),
    matchedAdditional: additional.filter(row => owned.has(row.skill_id)),
    missingAdditional: additional.filter(row => !owned.has(row.skill_id)),
    score: ids === null || core.length === 0 ? null : Math.round(100 * matchedCore.reduce((sum, row) => sum + ('weight' in row && typeof row.weight === 'number' ? row.weight : 1), 0) / core.reduce((sum, row) => sum + ('weight' in row && typeof row.weight === 'number' ? row.weight : 1), 0)),
  };
}
