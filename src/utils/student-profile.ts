import { captureDataScope, readScopedRaw, replaceScopedItems, reportDataChange } from './scoped-storage';
import { emptyPersonalProfile, parsePersonalProfile, PERSONAL_PROFILE_KEY, type PersonalProfile } from './personal-profile';
import { parseSkillProfile, SKILL_PROFILE_KEY, type SkillProfile, type CvAnalysis } from './skill-profile';
import { createSkillMatcher } from './skill-matching.mjs';
import dataset from '../masarak_dataset.json';

export type StudentAnswers = {
  name: string; institution: string; degree: string; major: string; graduation: string;
  skills: string; interests: string;
  projects: { name: string; description: string; technologies: string }[];
  courses: { name: string; issuer: string }[];
  experiences: { role: string; organization: string; description: string }[];
};
export type StudentBase = {
  personal: PersonalProfile | null; skills: SkillProfile | null;
  rawPersonal: string | null; rawSkills: string | null;
  scope: ReturnType<typeof captureDataScope>;
};
export const emptyStudentAnswers = (): StudentAnswers => ({
  name: '', institution: '', degree: '', major: '', graduation: '', skills: '', interests: '',
  projects: [], courses: [], experiences: [],
});
const match = createSkillMatcher(dataset);
const list = (value: string) => [...new Set(value.split(/[,،;؛\n]/u).map(s => s.trim()).filter(Boolean))];
const year = (value: string) => value.trim().replace(/[٠-٩]/gu, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
const norm = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/gu, ' ');
const evidence = (values: string[]) => values.map(s => s.trim()).filter(Boolean).join('\n');

export function validateStudentAnswers(a: StudentAnswers): string {
  if (![a.institution, a.degree, a.major, a.graduation].every(s => s.trim())) return 'أكمل جهة التعليم والمؤهل والتخصص وسنة التخرج المتوقعة.';
  if (!/^(19|20|21)\d{2}$/u.test(year(a.graduation))) return 'أدخل سنة التخرج المتوقعة بأربعة أرقام، مثل 2027.';
  if ([a.name, a.institution, a.degree, a.major].some(s => s.length > 300)) return 'الحد الأقصى للحقل 300 حرف.';
  if (!list(a.skills).length) return 'اذكر مهارة واحدة على الأقل؛ لا تحتاج إلى خبرة عمل.';
  if (list(a.skills).length > 80 || list(a.skills).some(s => s.length > 100)) return 'اكتب حتى 80 مهارة، وبحد أقصى 100 حرف للمهارة.';
  if (list(a.interests).length > 30 || list(a.interests).some(s => s.length > 100)) return 'اكتب حتى 30 اهتمامًا، وبحد أقصى 100 حرف للاهتمام.';
  for (const rows of [a.projects, a.courses, a.experiences]) {
    if (rows.length > 20) return 'يمكن إضافة حتى 20 بندًا في كل قسم.';
    if (rows.some(row => Object.values(row).some(v => v.length > 2000))) return 'الحد الأقصى للنص في البند 2000 حرف.';
  }
  if (a.projects.some(p => !p.name.trim())) return 'أضف اسم المشروع أو احذف البند الفارغ.';
  if (a.courses.some(c => !c.name.trim())) return 'أضف اسم الدورة أو احذف البند الفارغ.';
  if (a.experiences.some(e => !e.role.trim())) return 'أضف مسمى الخبرة أو احذف البند؛ الخبرة اختيارية.';
  return '';
}

export async function loadStudentBase(): Promise<StudentBase> {
  const scope = captureDataScope();
  const [rawPersonal, rawSkills] = await Promise.all([
    readScopedRaw(PERSONAL_PROFILE_KEY, scope), readScopedRaw(SKILL_PROFILE_KEY, scope),
  ]);
  scope.assertCurrent();
  return { scope, rawPersonal, rawSkills,
    personal: rawPersonal === null ? null : parsePersonalProfile(JSON.parse(rawPersonal)),
    skills: rawSkills === null ? null : parseSkillProfile(JSON.parse(rawSkills)) };
}

export function answersFromPersonal(p: PersonalProfile | null): StudentAnswers {
  return { ...emptyStudentAnswers(), name: p?.name ?? '', institution: p?.institution ?? '',
    degree: p?.education ?? '', major: p?.major ?? '', interests: p?.interests.join('، ') ?? '',
    graduation: p?.studyDates.match(/^\d{4}$/u)?.[0] ?? '' };
}

/** Additive merge only: old facts, exclusions, parser provenance and every unrelated field survive. */
export function buildStudentProfile(a: StudentAnswers, base: Pick<StudentBase, 'personal' | 'skills'>) {
  const failure = validateStudentAnswers(a);
  if (failure) throw new Error(failure);
  const old = base.personal ?? emptyPersonalProfile();
  const proposed = { name: a.name.trim(), institution: a.institution.trim(), education: a.degree.trim(),
    major: a.major.trim(), studyDates: year(a.graduation), studyStatus: 'تخرج متوقع' };
  const keptFields = (Object.keys(proposed) as (keyof typeof proposed)[])
    .filter(k => old[k].trim() && norm(old[k]) !== norm(proposed[k]) && proposed[k]);
  const personal = parsePersonalProfile({ ...old,
    ...Object.fromEntries(Object.entries(proposed).map(([key, value]) => [key, old[key as keyof typeof proposed].trim() || value])),
    interests: [...new Set([...old.interests, ...list(a.interests)])] });
  const supplied = { source: 'user_supplied' };
  const quote = 'من إجابات المستخدم، وليس استخراجًا من ملف أو تحققًا من جهة خارجية.';
  const fresh: CvAnalysis = {
    entry_method: 'answers', warnings: [quote],
    skills: list(a.skills).map(name => ({ name, mapped_skill_id: match(name), evidence: name, ...supplied })),
    education: [{ name: a.degree.trim(), organization: a.institution.trim(), dates: year(a.graduation),
      description: '', major: a.major.trim(), study_status: 'تخرج متوقع',
      evidence: evidence([a.institution, a.degree, a.major, a.graduation]),
      field_evidence: { name: a.degree.trim(), organization: a.institution.trim(), major: a.major.trim(), dates: a.graduation.trim() }, ...supplied }],
    projects: a.projects.map(p => ({ name: p.name.trim(), organization: '', dates: '', description: p.description.trim(),
      technologies: list(p.technologies), evidence: evidence([p.name, p.description, p.technologies]), ...supplied })),
    courses: a.courses.map(c => ({ name: c.name.trim(), issuer: c.issuer.trim(), date: '', evidence: evidence([c.name, c.issuer]), ...supplied })),
    experiences: a.experiences.map(e => ({ role: e.role.trim(), organization: e.organization.trim(), dates: '',
      description: e.description.trim(), evidence: evidence([e.role, e.organization, e.description]), ...supplied })),
    certificates: [], activities: [], unclassified: [],
  };
  const current = base.skills ?? parseSkillProfile({ version: 3, skill_ids: [], manual_skill_ids: [], excluded_cv_skill_ids: [], cv: null });
  const previous = current.cv;
  const combined: CvAnalysis = { ...(previous ?? fresh), warnings: [...new Set([...(previous?.warnings ?? []), quote])] };
  for (const section of ['skills', 'education', 'projects', 'courses', 'experiences'] as const) {
    const rows = [...(previous?.[section] ?? [])];
    // Exact name/context matches preserve the original record, never replace it with a shorter answer.
    const identity = (row: unknown) => {
      const r = row as Record<string, unknown>;
      return section === 'skills' ? norm(r.name)
        : [r.name ?? r.role, r.organization ?? r.issuer, r.dates ?? r.date].map(norm).join('|');
    };
    const seen = new Set(rows.map(identity));
    for (const row of fresh[section] ?? []) {
      if (!seen.has(identity(row))) { rows.push(row as never); seen.add(identity(row)); }
    }
    if (rows.length > 80) throw new Error('تجاوز مجموع البنود الحد المتاح. لم تُحذف أو تُستبدل بياناتك؛ راجع البنود قبل الحفظ.');
    Object.assign(combined, { [section]: rows });
  }
  const skills = parseSkillProfile({ ...current, cv: { ...combined, reviewed_at: new Date().toISOString() } });
  return { personal, skills, keptFields,
    unmappedSkills: fresh.skills.filter(s => !s.mapped_skill_id).map(s => s.name) };
}

let pending: Promise<unknown> = Promise.resolve();
export function saveStudentProfile(a: StudentAnswers, base: StudentBase) {
  const result = buildStudentProfile(a, base);
  const task = pending.then(async () => {
    base.scope.assertCurrent();
    const [personal, skills] = await Promise.all([
      readScopedRaw(PERSONAL_PROFILE_KEY, base.scope), readScopedRaw(SKILL_PROFILE_KEY, base.scope),
    ]);
    if (personal !== base.rawPersonal || skills !== base.rawSkills) throw new Error('تغيّر ملفك أثناء الإجابة. لم نحفظ فوقه؛ أعد فتح المسار لمراجعة أحدث بياناتك.');
    base.scope.assertCurrent();
    // Same rollback-capable, account-scoped batch primitive used by existing cloud restore.
    await replaceScopedItems([[PERSONAL_PROFILE_KEY, JSON.stringify(result.personal)], [SKILL_PROFILE_KEY, JSON.stringify(result.skills)]], base.scope);
    await reportDataChange(PERSONAL_PROFILE_KEY, base.scope);
    return result;
  });
  pending = task.catch(() => undefined);
  return task;
}
