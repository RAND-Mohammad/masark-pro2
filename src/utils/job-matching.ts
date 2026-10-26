import dataset from '../masarak_dataset.json';
import { normalizeSkillName, createSkillMatcher } from './skill-matching.mjs';
import { experienceInterval } from './cv-duration.mjs';
import type { MarketJob } from './jobs-api';
import type { SkillProfile } from './skill-profile';
import type { PersonalProfile } from './personal-profile';

export type JobRequirement = { key: string; name: string; skillId: string | null; evidence: string; priority: 'required' | 'preferred' | 'mentioned'; alternatives: string[] };
type ExperienceRequirement = { minYears: number; exclusiveMinimum?: boolean; tools?: string[]; anyTool?: boolean; evidence: string; priority: 'required' | 'preferred' };
type EducationRequirement = { level: number; label: string; evidence: string; priority: 'required' | 'preferred'; alternativeExperience: boolean; majors: string[] };
export type JobRequirements = { version: 1; skills: JobRequirement[]; experience: ExperienceRequirement | null; education: EducationRequirement | null; careerId: string | null; method: 'literal-evidence'; unparsed: string[] };
export type JobMatch = {
  job: MarketJob; requirements: JobRequirements; score: number | null; status: 'closer' | 'gaps' | 'review' | 'insufficient';
  matched: JobRequirement[]; missing: JobRequirement[]; preferredMatched: JobRequirement[]; preferredMissing: JobRequirement[];
  experience: { state: 'met' | 'gap' | 'unknown' | 'not_specified'; documentedMonths: number; message: string };
  education: { state: 'met' | 'gap' | 'unknown' | 'not_specified'; message: string };
  reasons: string[]; blockers: string[];
};
const normalized = (value: string) => normalizeSkillName(value).replace(/\s+/g, ' ');
const equivalents: Record<string, string> = { js: 'javascript', 'nodejs': 'node.js', 'node js': 'node.js', postgres: 'postgresql', 'python programming': 'python', بايثون: 'python', جافا: 'java', 'سي بلس بلس': 'c++', 'java programming': 'java', 'linux os': 'linux', لينكس: 'linux' };
const canonical = (value: string) => equivalents[normalized(value)] ?? normalized(value);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const literal = (value: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}_+#])(${escape(normalized(value))})(?=$|[^\\p{L}\\p{N}_+#])`, 'iu');
const mapSkill = createSkillMatcher(dataset);
const official = new Map(dataset.skills.map(item => [canonical(item.name), item.skill_id]));
const aliasNames = new Map<string, string>();
for (const skill of dataset.skills) if (skill.name.trim().length >= 4) aliasNames.set(skill.name, skill.skill_id);
for (const alias of dataset.skill_aliases) if (alias.alias.trim().length >= 3 || ['C++', 'C#'].includes(alias.alias)) aliasNames.set(alias.alias, alias.skill_id);
for (const name of ['JavaScript', 'TypeScript', 'React', 'React Native', 'Node.js', 'NodeJS', 'HTML', 'CSS', 'Docker', 'Kubernetes', 'Terraform', 'AWS', 'Azure', 'GCP', 'Git', 'SQL', 'MySQL', 'PostgreSQL', 'Postgres', 'MongoDB', 'Redis', 'Python', 'R', 'Java', 'C++', 'C#', '.NET', 'Power BI', 'Tableau', 'Excel', 'Pandas', 'NumPy', 'PyTorch', 'TensorFlow', 'Spark', 'Hadoop', 'Linux', 'Bash', 'PowerShell', 'CCNA', 'CISSP', 'Security+', 'Figma']) {
  if (!aliasNames.has(name)) aliasNames.set(name, mapSkill(name) ?? '');
}
const terms = [...aliasNames].map(([name, id]) => ({ name: name.trim(), plain: normalized(name), id: id || null, key: canonical(name), regex: literal(name) }));
const requiredHeading = /^(?:requirements?|key requirements|qualifications?(?:\s*(?:&|and)\s*experience)?|required skills|minimum qualifications|education|degree level|experience|years\s*&\s*nature of experience|technical (?:skills|competencies)|soft skills|behavioral competencies|about you|what (?:you(?:'ll| will) bring|we(?:'re| are) looking for)|المتطلبات|الشروط|المؤهلات|المهارات المطلوبة|الخبرة|المؤهل)(?:\s*:|\s*$)/iu;
const preferredHeading = /^(?:preferred(?:\s+\w+){0,3}|nice.to.have|desirable|المهارات المفضلة|يفضل)(?:\s*:|\s*$)/iu;
const otherHeading = /^(?:responsibilities|key responsibilities|what you will (?:do|learn)|about (?:us|the role|the company)|benefits|rewards|job info|worker type|المسؤوليات|المهام|المزايا)/iu;
const preference = /\b(?:preferred|preferably|recommended|nice.to.have|a plus|bonus|desirable|beneficial|not mandatory)\b|يفضل|ميزة إضافية|ليست إلزامية/iu;
const mandatory = /\b(?:required|must|essential|minimum|proficien(?:cy|t)|strong (?:knowledge|skills)|hands.on experience)\b|يشترط|مطلوب|إجادة|معرفة جيدة/iu;
const degrees = [{ level: 4, label: 'دكتوراه', regex: /\b(?:ph\.?d\.?|doctorate)\b|دكتوراه/iu }, { level: 3, label: 'ماجستير', regex: /\bmaster(?:'s|s)?\b|ماجستير/iu }, { level: 2, label: 'بكالوريوس', regex: /\bbachelor(?:'s|s)?\b|بكالوريوس/iu }, { level: 1, label: 'دبلوم', regex: /\b(?:diploma|associate(?:'s)? degree)\b|دبلوم/iu }];
const majorGroups = [['computer science', 'علوم الحاسب', 'علوم حاسب'], ['software engineering', 'هندسة البرمجيات'], ['information technology', 'تقنية المعلومات'], ['information systems', 'نظم المعلومات'], ['computer engineering', 'هندسة الحاسب'], ['data science', 'علم البيانات', 'علوم البيانات'], ['cybersecurity', 'الأمن السيبراني', 'امن سيبراني'], ['electrical engineering', 'هندسة كهربائية'], ['business administration', 'إدارة الأعمال'], ['mathematics', 'رياضيات'], ['statistics', 'إحصاء']];
export function classifyJobCareer(title: string): string | null {
  if (/sales|account manager|business development|مبيعات/iu.test(title)) return null;
  const rules: [RegExp, string][] = [
    [/machine learning|\bAI\b|artificial intelligence|\bNLP\b|computer vision|ذكاء اصطناعي/iu, 'C04'],
    [/data scientist|علم البيانات/iu, 'C03'], [/data engineer|database|قواعد البيانات/iu, 'C07'],
    [/data analyst|business intelligence|\bBI analyst\b|تحليل البيانات/iu, 'C02'],
    [/cyber|security|\bSOC\b|penetration|أمن|امن/iu, 'C05'], [/network|شبكات/iu, 'C06'],
    [/software|developer|programmer|\bQA\b|برمج/iu, 'C01'], [/cloud|devops|infrastructure|system administrator|\bIT support\b|سحاب/iu, 'C08'],
    [/system analyst|systems analyst|business analyst|project|\bPMO\b|استشاري|محلل نظم|IT fresh graduate/iu, 'C09'],
  ];
  return rules.find(([rule]) => rule.test(title))?.[1] ?? null;
}
export function extractJobRequirements(job: Pick<MarketJob, 'title' | 'description'>): JobRequirements {
  const found = new Map<string, JobRequirement>();
  const experienceRows: ExperienceRequirement[] = []; const educationRows: EducationRequirement[] = []; const unparsed: string[] = [];
  let section: JobRequirement['priority'] = 'mentioned';
  const lines = job.description.split(/\n|(?<=[.;])\s+(?=[A-Z])/u).map(line => line.trim()).filter(Boolean);
  for (const raw of lines) {
    const line = raw.replace(/^[\s*#•\-]+|[\s*#]+$/gu, '').trim();
    if (preferredHeading.test(line)) { section = 'preferred'; if (line.length < 80) continue; }
    else if (requiredHeading.test(line)) { section = 'required'; if (line.length < 80) continue; }
    else if (otherHeading.test(line)) { section = 'mentioned'; continue; }
    const priority = preference.test(line) ? 'preferred' : mandatory.test(line) ? 'required' : section;
    const clean = normalized(line);
    const lineTerms = terms.flatMap(term => { if (!clean.includes(term.plain) || (term.plain === 'r' && !/python|programming|language|statisti|data|برمج|إحصاء/iu.test(clean))) return []; const match = term.regex.exec(clean); return match ? [{ ...term, at: match.index + match[0].indexOf(match[1]), end: match.index + match[0].indexOf(match[1]) + match[1].length }] : []; })
      .filter((term, _, all) => !all.some(other => other.key !== term.key && other.at <= term.at && other.end >= term.end && other.end - other.at > term.end - term.at));
    for (const term of lineTerms) {
      const negative = new RegExp(`(?:no|without|not require[ds]?|لا يشترط|غير مطلوب)[^.;]{0,25}${escape(normalized(term.name))}|${escape(normalized(term.name))}[^.;]{0,15}(?:not required|غير مطلوب)`, 'iu');
      if (negative.test(clean)) continue;
      const current = found.get(term.key);
      if (current && (current.priority === 'required' || current.priority === priority)) continue;
      if (current?.priority === 'preferred' && priority === 'mentioned') continue;
      const alternatives = lineTerms.filter(other => other.key !== term.key && /^(?:\s*(?:or|او|أو)\s*)$/iu.test(clean.slice(Math.min(term.end, other.end), Math.max(term.at, other.at)))).map(other => other.name);
      found.set(term.key, { key: term.key, name: term.name, skillId: term.id, evidence: raw, priority, alternatives });
    }
    if (priority !== 'mentioned') {
      const numericLine = line.replace(/[٠-٩]/gu, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
      const years = numericLine.match(/(?:(?:minimum(?: of)?|at least|more than|over)\s+)?(\d{1,2})(?:\s*(?:[-–]|to)\s*\d{1,2})?\s*\+?\s*(?:years?|سنوات|سنة)\s*(?:of\s+)?(?:(?:relevant|professional|work|equivalent|practical)\s+){0,3}(?:experience|خبرة)/iu)
        ?? numericLine.match(/خبرة[^.\n\d]{0,25}(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s*(?:سنوات|سنة)/iu);
      if (years) experienceRows.push({ minYears: Number(years[1]), exclusiveMinimum: /more than|over|أكثر من/iu.test(years[0]), tools: lineTerms.filter(term => !official.has(term.key)).map(term => term.name), anyTool: /\bor\b|أو|او/iu.test(line), evidence: raw, priority });
      else if (/no (?:previous |prior |work )?experience|fresh graduate|بدون خبرة|حديث[وي] التخرج/iu.test(line)) experienceRows.push({ minYears: 0, evidence: raw, priority });
      const degree = degrees.find(item => item.regex.test(line));
      if (degree && !/not required|لا يشترط/iu.test(line)) educationRows.push({ level: degree.level, label: degree.label, evidence: raw, priority,
        alternativeExperience: /or equivalent|or.*experience|أو خبرة|او خبرة/iu.test(line), majors: majorGroups.filter(group => group.some(term => literal(term).test(normalized(line)))).map(group => group[0]) });
      if (!years && !degree && lineTerms.length === 0 && priority === 'required' && line.length > 20) unparsed.push(raw);
    }
  }
  const requiredYears = experienceRows.filter(row => row.priority === 'required');
  const requiredDegrees = educationRows.filter(row => row.priority === 'required');
  const groups = new Set<string>();
  const skills = [...found.values()].filter(row => {
    const key = `${row.priority}:${[row.key, ...row.alternatives.map(canonical)].sort().join('|')}`;
    if (groups.has(key)) return false; groups.add(key); return true;
  });
  return { version: 1, method: 'literal-evidence', skills,
    experience: (requiredYears.length ? requiredYears : experienceRows).sort((a, b) => b.minYears - a.minYears)[0] ?? null,
    education: (requiredDegrees.length ? requiredDegrees : educationRows).sort((a, b) => a.level - b.level)[0] ?? null,
    careerId: classifyJobCareer(job.title), unparsed: unparsed.slice(0, 12) };
}
const familySignals: Record<string, RegExp> = {
  C01: /software|developer|programmer|\bQA\b|برمج/iu, C02: /data analy|business intelligence|تحليل بيانات/iu,
  C03: /data scien|علم بيانات/iu, C04: /machine learning|artificial intelligence|\bAI\b|\bNLP\b|ذكاء/iu,
  C05: /cyber|security|\bSOC\b|أمن|امن/iu, C06: /network|شبكات/iu,
  C07: /data engineer|database|قواعد بيانات/iu, C08: /cloud|devops|system|\bIT\b|دعم تقني|سحاب/iu,
  C09: /analyst|consultant|project|\bPMO\b|تحليل نظم|استشاري/iu,
};
function documentedExperience(profile: SkillProfile | null, family: string | null, requirement: ExperienceRequirement | null) {
  let uncertain = false;
  const intervals = (profile?.cv?.experiences ?? []).flatMap(item => {
    if (!family || !familySignals[family]?.test(`${item.role} ${item.description}`)) return [];
    if (requirement?.tools?.length) {
      const matches = requirement.tools.map(tool => literal(tool).test(normalized(`${item.role} ${item.description}`)));
      if (!(requirement.anyTool ? matches.some(Boolean) : matches.every(Boolean))) { uncertain = true; return []; }
    }
    if (/present|current|now|الآن|حاليا|حاليًا/iu.test(item.dates) && !profile?.cv?.analyzed_at) { uncertain = true; return []; }
    const interval = experienceInterval(item.dates, profile?.cv?.analyzed_at ?? profile?.cv?.reviewed_at);
    if (!interval || interval.approximate) { uncertain = true; return []; }
    return [interval];
  }).sort((a, b) => a.startMonth - b.startMonth);
  const merged: { startMonth: number; endMonth: number }[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval.startMonth <= last.endMonth) last.endMonth = Math.max(last.endMonth, interval.endMonth);
    else merged.push({ startMonth: interval.startMonth, endMonth: interval.endMonth });
  }
  return { months: merged.reduce((sum, item) => sum + item.endMonth - item.startMonth, 0), uncertain };
}
function hasRequirement(row: JobRequirement, profile: SkillProfile | null): boolean {
  const owned = new Set(profile?.skill_ids ?? []);
  const names = new Set((profile?.cv?.skills ?? []).filter(item => !item.mapped_skill_id || owned.has(item.mapped_skill_id)).map(item => canonical(item.name)));
  // الأداة نفسها لازم تكون موجودة؛ Java ما تثبت Python.
  const explicit = (name: string) => names.has(canonical(name));
  return explicit(row.name) || row.alternatives.some(explicit)
    || Boolean(official.get(row.key) === row.skillId && row.skillId && owned.has(row.skillId));
}
const extracted = new Map<string, { title: string; description: string; result: JobRequirements }>();
export function matchMarketJob(job: MarketJob, profile: SkillProfile | null, personal: PersonalProfile | null): JobMatch {
  const cached = extracted.get(job.id);
  const requirements = cached?.title === job.title && cached.description === job.description ? cached.result : extractJobRequirements(job);
  if (requirements !== cached?.result) {
    extracted.set(job.id, { title: job.title, description: job.description, result: requirements });
    if (extracted.size > 250) extracted.delete(extracted.keys().next().value!);
  }
  const required = requirements.skills.filter(item => item.priority === 'required');
  const preferred = requirements.skills.filter(item => item.priority === 'preferred');
  const matched = required.filter(item => hasRequirement(item, profile)); const missing = required.filter(item => !hasRequirement(item, profile));
  const preferredMatched = preferred.filter(item => hasRequirement(item, profile)); const preferredMissing = preferred.filter(item => !hasRequirement(item, profile));
  const documented = documentedExperience(profile, requirements.careerId, requirements.experience);
  const experience: JobMatch['experience'] = { state: 'not_specified', documentedMonths: documented.months, message: 'لم نستخرج شرط خبرة محددًا من الإعلان.' };
  const exp = requirements.experience;
  if (exp) {
    const monthsRequired = exp.minYears * 12 + (exp.exclusiveMinimum ? 1 : 0);
    experience.state = exp.minYears === 0 || documented.months >= monthsRequired ? 'met' : documented.months > 0 && !documented.uncertain ? 'gap' : 'unknown';
    experience.message = exp.minYears === 0 ? 'الإعلان يقبل حديثي التخرج أو لا يشترط خبرة سابقة.' : `المطلوب ${exp.exclusiveMinimum ? 'أكثر من ' : ''}${exp.minYears} سنة؛ الموثق بتواريخ شهرية ${documented.months} شهر في المجال${documented.uncertain ? '، وتوجد مدد تحتاج مراجعة' : ''}.`;
  }
  const education: JobMatch['education'] = { state: 'not_specified', message: 'لم نستخرج مؤهلًا محددًا من الإعلان.' };
  if (requirements.education) {
    const ed = requirements.education;
    const entries = [...(profile?.cv?.education ?? []).map(item => `${item.name} ${item.study_status ?? ''} ${item.dates} ${item.description}`), `${personal?.education ?? ''} ${personal?.studyStatus ?? ''}`].filter(Boolean);
    const completed = entries.filter(item => !/in progress|ongoing|expected|student|متوقع|طالب|يدرس|قيد الدراسة/iu.test(item));
    const level = Math.max(0, ...completed.map(item => degrees.find(degree => degree.regex.test(item))?.level ?? 0));
    const majorsText = normalized(`${personal?.major ?? ''} ${(profile?.cv?.education ?? []).map(item => `${item.name} ${item.major ?? ''}`).join(' ')}`);
    const majorMatches = !ed.majors.length || ed.majors.some(name => majorGroups.find(group => group[0] === name)?.some(term => literal(term).test(majorsText)));
    const majorUnknown = ed.majors.length > 0 && !personal?.major && !(profile?.cv?.education ?? []).some(item => item.major);
    education.state = ed.alternativeExperience ? 'unknown' : level >= ed.level && majorMatches ? 'met' : majorUnknown && level >= ed.level ? 'unknown' : entries.some(item => item.trim()) ? 'gap' : 'unknown';
    education.message = `${ed.label} ${ed.priority === 'preferred' ? 'مفضّل' : 'مطلوب'}؛ ${education.state === 'met' ? 'مذكور في ملفك' : ed.alternativeExperience ? 'الإعلان يسمح ببديل؛ راجع شرط المؤهل والخبرة' : education.state === 'gap' ? 'المؤهل المكتمل أو التخصص المطلوب غير موثق في ملفك' : 'أضف تفاصيل مؤهلك وتخصصك للتحقق'}.`;
  }
  const hasProfile = Boolean(profile?.cv || profile?.skill_ids.length || personal?.education.trim());
  const components: { points: number; weight: number }[] = [];
  if (required.length) components.push({ points: matched.length / required.length, weight: 60 });
  if (exp?.priority === 'required') components.push({ points: experience.state === 'met' ? 1 : exp.minYears ? Math.min(1, documented.months / (exp.minYears * 12)) : 1, weight: 25 });
  if (requirements.education?.priority === 'required') components.push({ points: education.state === 'met' ? 1 : 0, weight: 15 });
  const weight = components.reduce((sum, item) => sum + item.weight, 0);
  let score = hasProfile && required.length && weight ? Math.round(100 * components.reduce((sum, item) => sum + item.points * item.weight, 0) / weight) : null;
  const blockers: string[] = [];
  if (exp?.priority === 'required' && experience.state !== 'met') blockers.push(experience.message);
  if (requirements.education?.priority === 'required' && education.state !== 'met') blockers.push(education.message);
  if (/\b(?:senior|lead|principal|head|manager)\b|أول|مدير/iu.test(job.title) && (!exp || exp.priority !== 'required') && documented.months === 0) blockers.push('المسمى يدل على مستوى متقدم؛ لم نوثق خبرة مرتبطة كافية، وشرط المدة يحتاج مراجعة الإعلان.');
  const requiredGap = (exp?.priority === 'required' && experience.state === 'gap') || (requirements.education?.priority === 'required' && education.state === 'gap');
  if (score !== null && blockers.length) score = Math.min(score, requiredGap ? 49 : 69);
  const reasons = matched.slice(0, 5).map(item => `موثق لديك: ${item.name}`);
  if (experience.state === 'met' && exp) reasons.push(experience.message);
  if (education.state === 'met') reasons.push(education.message);
  const status = score === null ? 'insufficient' : blockers.length || requirements.unparsed.length ? 'review' : score >= 70 && missing.length === 0 ? 'closer' : 'gaps';
  return { job, requirements, score, status, matched, missing, preferredMatched, preferredMissing, experience, education, reasons, blockers };
}
export function rankMarketJobs(jobs: MarketJob[], profile: SkillProfile | null, personal: PersonalProfile | null) {
  const bucket = (match: JobMatch) => match.score === null ? -1 : match.score === 0 ? 0 : match.status === 'review' ? 1 : 2;
  return jobs.map(job => matchMarketJob(job, profile, personal)).sort((a, b) =>
    bucket(b) - bucket(a)
    || (b.score ?? -1) - (a.score ?? -1) || b.preferredMatched.length - a.preferredMatched.length
    || (b.job.postedAt ?? '').localeCompare(a.job.postedAt ?? '') || a.job.id.localeCompare(b.job.id));
}
export function marketCareerMatches(matches: JobMatch[]) {
  const groups = new Map<string, JobMatch[]>();
  for (const match of matches) if (match.requirements.careerId && match.score !== null) {
    const group = groups.get(match.requirements.careerId) ?? []; group.push(match); groups.set(match.requirements.careerId, group);
  }
  return [...groups].map(([careerId, jobs]) => ({ careerId, jobs: jobs.length, score: Math.round(jobs.reduce((sum, item) => sum + item.score!, 0) / jobs.length),
    closerJobs: jobs.filter(item => item.status === 'closer').length,
    missing: [...new Set(jobs.flatMap(item => item.missing.map(skill => skill.name)))] })).sort((a, b) => b.closerJobs - a.closerJobs || b.score - a.score || b.jobs - a.jobs);
}
