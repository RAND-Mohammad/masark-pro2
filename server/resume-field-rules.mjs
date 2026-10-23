// Conservative literal rules. Never reconstruct a title from a description.
const action = /^(?:i|we|my|our|designed|developed|built|created|implemented|integrated|configured|programmed|launched|optimized|improved|managed|analyzed|analysed|performed|conducted|worked|used|utilized|responsible|assisted|supported|led|collaborated|researched|tested|deployed|studied|graduated|participated|contributed|قمت|قمنا|صممت|صممنا|تصميم|طورت|طورنا|تطوير|أنشأت|انشأت|أنشأنا|نفذت|نفذنا|عملت|عملنا|استخدمت|استخدمنا|ساهمت|شاركت|حللت|أجريت|أدرت|قدت|درست|تخرجت)(?=$|\s)/iu;
const narrative = /\b(?:project|internship|experience)\b|مشروع|خبرة|خبرات|تدريب/iu;
export function isDescription(value) {
  return value.length > 150 || value.trim().split(/\s+/u).length > 18
    || /[.!?؟]$/u.test(value)
    || action.test(value.trim())
    || value.split(/\s+[—–-]\s+|[:：]\s*/u).slice(1).some(part => action.test(part.trim()));
}
const degree = /^(?:associate(?:['’]s)?\s+degree|bachelor(?:['’]s)?|master(?:['’]s)?|doctorate|ph\.?d\.?|diploma|b\.?\s?sc\.?|m\.?\s?sc\.?|b\.?\s?s\.?|m\.?\s?s\.?|b\.?\s?eng\.?|بكالوريوس|بكالوريس|ماجستير|دكتوراه|دبلوم)(?=$|[\s,،.(])/iu;
const institution = /\b(?:university|college|faculty|institute|school)\b|جامعة|كلية|معهد/iu;
export function academicFact(value) {
  if (!value || isDescription(value.replace(/[.]$/u, ''))) return null;
  const parts = value.split(/\s*[,،;؛]\s*/u);
  if (parts.length > 1 && parts.some(part => degree.test(part))
    && parts.some(part => institution.test(part) && !degree.test(part))) return null;
  if (degree.test(value)) return 'name';
  if (narrative.test(value)) return null;
  if (/\b(?:university|institute|school)\b|جامعة|معهد/iu.test(value) && !/\b(?:college|faculty)\b|كلية/iu.test(value)) return 'organization';
  if (/\b(?:community|technical)\s+college\b/iu.test(value)) return 'organization';
  if (/\b(?:college|faculty)\b|كلية/iu.test(value) && !/\b(?:university|institute|school)\b|جامعة|معهد/iu.test(value)) return 'college';
  return null;
}
export function combinedEducationFacts(value) {
  // Split explicit degree/institution pairs in one unambiguous PDF cell.
  // A trailing pipe-delimited year range is part of the same education record.
  const cells = value.split(/\s*\|\s*/u);
  if (cells.length > 2 || cells.some(part => !part)) return null;
  const date = cells.length === 2 ? cells[1].trim() : '';
  if (date && !/^[0-9٠-٩]{4}\s*[-–]\s*[0-9٠-٩]{4}$/u.test(date)) return null;
  const education = cells[0];
  const dashParts = education.split(/\s+[—–]\s+/u);
  let parts = dashParts.length === 2 ? dashParts : null;
  if (!parts) {
    const commaParts = education.split(/\s*[,،;؛]\s*/u);
    if (commaParts.length >= 2) {
      const degreeIndex = commaParts.findIndex(part => academicFact(part) === 'name');
      const institutionIndex = commaParts.findIndex((part, index) => index !== degreeIndex
        && ['organization', 'college'].includes(academicFact(part)));
      if (degreeIndex >= 0 && institutionIndex >= 0) {
        const nameEnd = Math.max(degreeIndex, institutionIndex);
        const nameStart = Math.min(degreeIndex, institutionIndex);
        if (nameStart === degreeIndex && nameEnd > degreeIndex) parts = [
          commaParts.slice(degreeIndex, institutionIndex).join(', ').trim(),
          commaParts[institutionIndex],
        ];
        else parts = [commaParts[degreeIndex], commaParts[institutionIndex]];
      }
    }
  }
  if (!parts || parts.length !== 2 || parts.some(part => !part)) return null;
  const facts = parts.map(part => ({ field: academicFact(part), value: part }));
  if (!facts.some(fact => fact.field === 'name')
    || !facts.some(fact => ['organization', 'college'].includes(fact.field))) return null;
  if (date) facts.push({ field: 'dates', value: date });
  return facts;
}
export function literalMajor(value) {
  const match = value.match(/\s+(?:in|في|تخصص)\s+(.+)$/iu);
  const commaMajor = value.match(/^(?:associate(?:['’]s)?\s+degree|bachelor(?:['’]s)?|master(?:['’]s)?|بكالوريوس|ماجستير)\s*[,،]\s*(.+)$/iu)?.[1];
  const major = (match?.[1] ?? commaMajor)?.trim();
  return major && !institution.test(major) && !/[0-9٠-٩]{4}/u.test(major) && !isDescription(major) ? major : '';
}
export function plausibleEducationField(field, value) {
  if (!value || isDescription(value) || /^(?:[0-9٠-٩]{4})(?:\s*[-–]\s*[0-9٠-٩]{4})?$/u.test(value)) return false;
  if (field === 'name') return academicFact(value) === 'name';
  if (field === 'major') return !institution.test(value) && !degree.test(value);
  return ['organization', 'college'].includes(field) && !narrative.test(value) && !degree.test(value);
}

export function inferStudyStatus(evidence, dates = '', now = new Date()) {
  if (typeof evidence !== 'string') return '';
  if (/expected|anticipated|expected\s+to\s+graduate|تخرج متوقع|التخرج المتوقع|على وشك التخرج/iu.test(evidence)) return 'تخرج متوقع';
  if (/\b(?:graduated|completed|degree awarded)\b|متخرج(?:ة)?|تخرج(?:ت)?/iu.test(evidence)) return 'متخرج';
  if (/\b(?:currently enrolled|currently studying|in progress|ongoing|present student)\b|قيد الدراسة|ما زلت أدرس|ما زال يدرس|ما زالت تدرس/iu.test(evidence)) return 'قيد الدراسة';
  const digits = String(dates || evidence).replace(/[٠-٩]/gu, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const years = [...digits.matchAll(/(?:19|20)\d{2}/gu)].map(match => Number(match[0]));
  if (years.length < 2) return '';
  const start = years[0], end = years.at(-1), currentYear = now.getUTCFullYear();
  if (end < currentYear) return 'متخرج';
  if (start <= currentYear && currentYear <= end) return 'قيد الدراسة';
  return '';
}

export function isStudyStatusSupported(status, evidence, dates = '', now = new Date()) {
  return typeof status === 'string' && Boolean(status) && inferStudyStatus(evidence, dates, now) === status;
}

// Kept as an alias for callers or saved code that specifically needs a
// completed-state check.
export function isCompletedStudyStatusSupported(status, evidence, dates = '', now = new Date()) {
  return status === 'متخرج' && isStudyStatusSupported(status, evidence, dates, now);
}
