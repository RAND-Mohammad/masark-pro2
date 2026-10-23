import type { PersonalProfile } from './personal-profile';
import type { CvEducation } from './skill-profile';

function parseGpa(value?: string) {
  if (!value) return null;
  const normalized = value.replace(/[٠-٩]/gu, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/,/gu, '.');
  const match = normalized.match(/(?:^|\D)(\d(?:\.\d{1,2})?)\s*(?:\/|من|out of|of)\s*([45])(?:\.0+)?(?:\D|$)/iu);
  if (!match) return null;
  const gpa = Number(match[1]), gpaScale = Number(match[2]) as 4 | 5;
  return Number.isFinite(gpa) && gpa >= 0 && gpa <= gpaScale ? { gpa, gpaScale } : null;
}

export function mergeCvEducation(profile: PersonalProfile, degree: CvEducation): PersonalProfile {
  const extractedGpa = parseGpa(degree.gpa);
  return {
    ...profile, education: degree.name.slice(0, 300), institution: degree.organization.slice(0, 300),
    college: (degree.college ?? profile.college ?? '').slice(0, 300),
    major: (degree.major || profile.major).slice(0, 300),
    studyStatus: (degree.study_status ?? profile.studyStatus).slice(0, 300),
    studyDates: degree.dates.slice(0, 300),
    ...(extractedGpa ?? {}),
  };
}
