import { professionalCertifications } from '../constants/professional-certifications';
import { learningResources } from '../constants/learning-resources';
import type { CvAnalysis } from './skill-profile';
const normalized = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// Deliberately exact names: no fuzzy grant of a different qualification.
export function qualificationMatches(cv: CvAnalysis | null | undefined) {
  const certificates = professionalCertifications.filter(item => cv?.certificates.some(candidate =>
    normalized(candidate.name) === normalized(item.title)
      && (!candidate.issuer || normalized(candidate.issuer) === normalized(item.provider))));
  const courses = learningResources.filter(item => cv?.courses?.some(candidate =>
    normalized(candidate.name) === normalized(item.title)));
  return { certificates, courses };
}
