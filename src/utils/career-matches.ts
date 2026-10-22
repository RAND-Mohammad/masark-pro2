import { calculateCareerScore } from './career-score';
import { jobPaths } from '../constants/job-paths';

export const careerTitles: Record<string, string> = {
  C01: 'مهندس برمجيات',
  C02: 'محلل بيانات',
  C03: 'عالم بيانات',
  C04: 'مهندس ذكاء اصطناعي وتعلّم آلي',
  C05: 'محلل أمن سيبراني',
  C06: 'مهندس شبكات',
  C07: 'مهندس بيانات',
  C08: 'مهندس سحابة وDevOps',
  C09: 'محلل نظم أعمال',
};
for (const path of jobPaths) careerTitles[path.id] = path.title;
export function getCareerMatches(ids: string[] | null) {
  return jobPaths.map(path => {
    const report = calculateCareerScore(path.id, ids);
    return { career_id: path.id, title: path.title, description: path.description, matched: report.matchedCore.length, total: report.core.length, missing: report.missingCore, score: report.score };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
