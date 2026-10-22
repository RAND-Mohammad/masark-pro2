import type { PersonalProfile } from './personal-profile';
import type { CvEducation } from './skill-profile';
export function mergeCvEducation(profile: PersonalProfile, degree: CvEducation): PersonalProfile {
  return {
    ...profile, education: degree.name.slice(0, 300), institution: degree.organization.slice(0, 300),
    college: (degree.college ?? profile.college ?? '').slice(0, 300),
    major: (degree.major || profile.major).slice(0, 300),
    studyStatus: (degree.study_status ?? profile.studyStatus).slice(0, 300),
    studyDates: degree.dates.slice(0, 300),
  };
}
