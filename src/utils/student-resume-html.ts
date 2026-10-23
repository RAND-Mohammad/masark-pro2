import type { PersonalProfile } from './personal-profile';
import type { SkillProfile } from './skill-profile';
import { studentResumeEducationLines } from './student-resume-education';

const escape = (value: string) => value.replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function studentResumeHtml(p: PersonalProfile, s: SkillProfile): string {
  const cv = s.cv;
  const text = (value: string) => `<p dir="auto">${escape(value)}</p>`;
  const heading = (value: string) => `<h2>${escape(value)}</h2>`;
  const join = (items: (string | undefined)[]) => items.filter(Boolean).join(' · ');
  const education = studentResumeEducationLines(p, cv?.education ?? []);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>مسارك — سيرة أولية</title><style>
  body{font-family:Arial,sans-serif;max-width:760px;margin:36px auto;padding:20px;color:#12243b;line-height:1.7}
  h1{border-bottom:2px solid #13bd87;padding-bottom:12px}h2{font-size:18px;margin-top:26px}
  p{white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}.entry{break-inside:avoid;margin-bottom:14px}
  @page{size:A4;margin:18mm}@media print{body{padding:0;margin:0;max-width:none}}
  </style></head><body><h1>${escape(p.name || 'ملفي المهني')}</h1>
  ${heading('التعليم')}${education.map(text).join('')}
  ${heading('المهارات')}${text((cv?.skills ?? []).map(row => row.name).join('، '))}
  ${heading('المشاريع')}${(cv?.projects ?? []).map(row => `<div class="entry">${text(row.name)}${text(row.description)}${text(row.technologies?.join('، ') ?? '')}</div>`).join('')}
  ${heading('الدورات')}${(cv?.courses ?? []).map(row => text(join([row.name, row.issuer, row.date]))).join('')}
  ${(cv?.certificates.length ?? 0) ? heading('الشهادات') + cv!.certificates.map(row => text(join([row.name, row.issuer, row.date]))).join('') : ''}
  ${cv?.experiences.length ? heading('الخبرة') + cv.experiences.map(row => text(join([row.role, row.organization, row.dates])) + text(row.description)).join('') : ''}
  ${p.interests.length ? heading('الاهتمامات') + text(p.interests.join('، ')) : ''}
  ${text('أُعدّ من بيانات المستخدم؛ ليس تحققًا من المؤهلات أو توليدًا بالذكاء الاصطناعي.')}</body></html>`;
}
