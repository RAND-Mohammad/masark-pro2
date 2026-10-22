// Conservative literal rules. Never reconstruct a title from a description.
const action = /^(?:i|we|my|our|designed|developed|built|created|implemented|optimized|improved|managed|analyzed|analysed|performed|conducted|worked|used|utilized|responsible|assisted|supported|led|collaborated|researched|tested|deployed|studied|graduated|participated|contributed|قمت|قمنا|صممت|صممنا|تصميم|طورت|طورنا|تطوير|أنشأت|انشأت|أنشأنا|نفذت|نفذنا|عملت|عملنا|استخدمت|استخدمنا|ساهمت|شاركت|حللت|أجريت|أدرت|قدت|درست|تخرجت)(?=$|\s)/iu;
const narrative = /\b(?:project|internship|experience)\b|مشروع|خبرة|خبرات|تدريب/iu;
export function isDescription(value) {
  return value.length > 150 || value.trim().split(/\s+/u).length > 18
    || /[.!?؟]$/u.test(value)
    || action.test(value.trim())
    || value.split(/\s+[—–-]\s+|[:：]\s*/u).slice(1).some(part => action.test(part.trim()));
}
const degree = /^(?:bachelor(?:['’]s)?|master(?:['’]s)?|doctorate|ph\.?d\.?|diploma|b\.?\s?sc\.?|m\.?\s?sc\.?|b\.?\s?s\.?|m\.?\s?s\.?|b\.?\s?eng\.?|بكالوريوس|بكالوريس|ماجستير|دكتوراه|دبلوم)(?=$|[\s,،.(])/iu;
const institution = /\b(?:university|college|faculty|institute|school)\b|جامعة|كلية|معهد/iu;
export function academicFact(value) {
  if (!value || isDescription(value.replace(/[.]$/u, ''))) return null;
  const parts = value.split(/\s*[,،;؛]\s*/u);
  if (parts.length > 1 && parts.some(part => degree.test(part))
    && parts.some(part => institution.test(part) && !degree.test(part))) return null;
  if (degree.test(value)) return 'name';
  if (narrative.test(value)) return null;
  if (/\b(?:university)\b|جامعة/iu.test(value) && !/\b(?:college|faculty)\b|كلية/iu.test(value)) return 'organization';
  if (/\b(?:college|faculty)\b|كلية/iu.test(value) && !/\buniversity\b|جامعة/iu.test(value)) return 'college';
  return null;
}
export function combinedEducationFacts(value) {
  // Split only two explicit facts in one unambiguous cell, never PDF columns.
  const parts = value.split(/\s*[,،;؛]\s*/u);
  if (parts.length !== 2 || parts.some(part => !part)) return null;
  const facts = parts.map(part => ({ field: academicFact(part), value: part }));
  return facts.some(fact => fact.field === 'name')
    && facts.some(fact => ['organization', 'college'].includes(fact.field)) ? facts : null;
}
export function literalMajor(value) {
  const match = value.match(/\s+(?:in|في|تخصص)\s+(.+)$/iu);
  const major = match?.[1].trim();
  return major && !institution.test(major) && !/[0-9٠-٩]{4}/u.test(major) && !isDescription(major) ? major : '';
}
export function plausibleEducationField(field, value) {
  if (!value || isDescription(value) || /^(?:[0-9٠-٩]{4})(?:\s*[-–]\s*[0-9٠-٩]{4})?$/u.test(value)) return false;
  if (field === 'name') return academicFact(value) === 'name';
  if (field === 'major') return !institution.test(value) && !degree.test(value);
  return ['organization', 'college'].includes(field) && !narrative.test(value) && !degree.test(value);
}
