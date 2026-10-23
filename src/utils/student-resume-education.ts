import type { CvEducation } from './skill-profile';
import type { PersonalProfile } from './personal-profile';

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function sameValue(left: string, right: string) {
  const a = normalize(left), b = normalize(right);
  return Boolean(a && b && (a === b || a.includes(` ${b} `) || b.includes(` ${a} `) || a.startsWith(`${b} `) || b.startsWith(`${a} `)));
}

function matchesProfile(profile: PersonalProfile, education: CvEducation) {
  const sameDegree = sameValue(profile.education, education.name);
  const sameContext = [
    [profile.institution, education.organization],
    [profile.major, education.major ?? ''],
    [profile.studyDates, education.dates],
    [profile.college ?? '', education.college ?? ''],
  ].some(([left, right]) => sameValue(left, right));
  return sameDegree && sameContext;
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.map(value => value.trim()).filter(value => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function gpaText(value: number | null | undefined, scale: 4 | 5 | null | undefined, fallback = '') {
  return value !== null && value !== undefined && scale !== null && scale !== undefined
    ? `GPA: ${value} / ${scale}`
    : fallback ? `GPA: ${fallback}` : '';
}

/** Combines the profile's primary education with its matching CV record once. */
export function studentResumeEducationLines(profile: PersonalProfile, education: CvEducation[] = []) {
  const duplicateIndex = education.findIndex(row => matchesProfile(profile, row));
  const duplicate = duplicateIndex >= 0 ? education[duplicateIndex] : undefined;
  const primary = unique([
    profile.education || duplicate?.name || '',
    profile.college || duplicate?.college || '',
    profile.major || duplicate?.major || '',
    profile.institution || duplicate?.organization || '',
    profile.studyStatus || duplicate?.study_status || '',
    profile.studyDates || duplicate?.dates || '',
    gpaText(profile.gpa, profile.gpaScale, duplicate?.gpa),
  ]).join(' · ');
  const other = education.filter((_, index) => index !== duplicateIndex).map(row => unique([
    row.name, row.college ?? '', row.major ?? '', row.organization, row.study_status ?? '', row.dates, gpaText(null, null, row.gpa),
  ]).join(' · ')).filter(Boolean);
  return [...(primary ? [primary] : []), ...other];
}
