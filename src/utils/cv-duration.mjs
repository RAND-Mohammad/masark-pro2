// Calendar-month precision only. Annual dates are explicitly approximate.
const months = [
  ['jan', 'january', 'يناير'], ['feb', 'february', 'فبراير'], ['mar', 'march', 'مارس'],
  ['apr', 'april', 'أبريل', 'ابريل'], ['may', 'مايو'], ['jun', 'june', 'يونيو'],
  ['jul', 'july', 'يوليو'], ['aug', 'august', 'أغسطس', 'اغسطس'],
  ['sep', 'sept', 'september', 'سبتمبر'], ['oct', 'october', 'أكتوبر', 'اكتوبر'],
  ['nov', 'november', 'نوفمبر'], ['dec', 'december', 'ديسمبر'],
];
const digits = text => text.replace(/[٠-٩]/gu, char => String('٠١٢٣٤٥٦٧٨٩'.indexOf(char)));
function point(text) {
  const value = digits(text).trim().toLowerCase();
  if (/^(?:19|20)\d{2}$/u.test(value)) return { value: Number(value) * 12, approximate: true };
  const numeric = value.match(/^((?:19|20)\d{2})[-/](\d{1,2})$/u) ?? value.match(/^(\d{1,2})\/((?:19|20)\d{2})$/u)?.map((x, i, all) => i === 1 ? all[2] : i === 2 ? all[1] : x);
  if (numeric) {
    const month = Number(numeric[2]);
    return month >= 1 && month <= 12 ? { value: Number(numeric[1]) * 12 + month - 1, approximate: false } : null;
  }
  const named = value.match(/^(\p{L}+)\s+((?:19|20)\d{2})$/u);
  if (!named) return null;
  const month = months.findIndex(names => names.includes(named[1]));
  return month < 0 ? null : { value: Number(named[2]) * 12 + month, approximate: false };
}

export function experienceDuration(dates, analyzedAt) {
  if (typeof dates !== 'string' || /expected|graduat|متوقع|تخرج/iu.test(dates)) return null;
  const asOf = analyzedAt ? new Date(analyzedAt) : new Date();
  if (!Number.isFinite(asOf.getTime())) return null;
  const value = digits(dates).trim();
  // A hyphen inside YYYY-MM is not a range separator.
  const match = value.match(/^(.+?)\s*(?:\s[–—-]\s|[–—]|\bto\b|\buntil\b|حتى|إلى|الى)\s*(.+)$/iu)
    ?? value.match(/^((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2})$/u);
  if (!match) return null;
  const start = point(match[1]);
  const ongoing = /^(?:present|current|now|حتى الآن|الآن|حاليا|حاليًا)$/iu.test(match[2].trim());
  if (ongoing && !analyzedAt) return null; // Legacy records have no known analysis date.
  const currentMonth = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  const end = ongoing ? { value: currentMonth, approximate: false } : point(match[2]);
  if (!start || !end || start.value > end.value || end.value > currentMonth) return null;
  const duration = end.value - start.value;
  return { months: duration, years: Math.floor(duration / 12), remainderMonths: duration % 12,
    approximate: start.approximate || end.approximate, ongoing, asOf: asOf.toISOString().slice(0, 10) };
}

export function describeExperienceDuration(dates, analyzedAt) {
  const duration = experienceDuration(dates, analyzedAt);
  if (!duration) return 'لا تتوفر تواريخ كافية وموثوقة لحساب المدة.';
  return `${duration.years} سنة و${duration.remainderMonths} شهر${duration.approximate ? ' تقريبًا؛ التواريخ السنوية لا تحدد الأشهر' : '؛ بدقة الأشهر المذكورة'}${duration.ongoing ? `، حتى تاريخ التحليل ${duration.asOf}` : ''}.`;
}
