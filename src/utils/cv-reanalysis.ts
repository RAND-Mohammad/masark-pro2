import type { CvAnalysis } from './skill-profile';
import type { CvReview } from './saved-cv.types';
import { createCvReview, normalizeCvReview, type ReviewSection } from './cv-review';

const sections: ReviewSection[] = ['skills', 'projects', 'courses', 'certificates', 'education', 'experiences', 'activities', 'unclassified'];
type Item = Record<string, unknown>;
const norm = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
function withoutHistory(review: CvReview): CvReview {
  const { previous_review: _review, previous_approved: _approved, ...current } = review;
  return current;
}
function sameEvidence(a: Item, b: Item) {
  const left = norm(a.evidence), right = norm(b.evidence);
  return Boolean(left && right && (left === right || (Math.min(left.length, right.length) >= 32 && (left.includes(right) || right.includes(left)))));
}
export function createReanalysisReview(next: CvAnalysis, previous: CvReview | null, approved: CvAnalysis | null): CvReview {
  const result = createCvReview({ ...next });
  const protectedRows: { section: ReviewSection; item: Item; selected: boolean }[] = [];
  // Draft takes precedence over an older approval, including explicit exclusions.
  for (const baseline of [previous, approved ? createCvReview(approved) : null]) {
    if (!baseline) continue;
    const review = normalizeCvReview(baseline);
    const candidates: typeof protectedRows = [];
    for (const section of sections) for (const [index, row] of (review.analysis[section] ?? []).entries()) {
      const item = row as unknown as Item;
      const selected = (review[section] ?? []).includes(index);
      if (section === 'unclassified' && !['user_corrected', 'user_supplied'].includes(String(item.source))) continue;
      if (selected && !['user_corrected', 'user_supplied'].includes(String(item.source))) continue;
      candidates.push({ section, item, selected });
    }
    const earlier = [...protectedRows];
    const sameRecord = (a: typeof candidates[number], b: typeof candidates[number]) =>
      sameEvidence(a.item, b.item) || (a.section === b.section && JSON.stringify(a.item) === JSON.stringify(b.item));
    for (const candidate of candidates) {
      const matches = earlier.filter(old => sameRecord(old, candidate));
      // Deduplicate only a one-to-one association across draft/approval, never
      // two different manual records within the same review sharing a quote.
      if (matches.length === 1 && candidates.filter(row => sameRecord(matches[0], row)).length === 1) continue;
      protectedRows.push(candidate);
    }
  }
  const fresh = sections.flatMap(section => (next[section] ?? []).map((row, index) => ({ section, index, item: row as unknown as Item })));
  const suppressed = new Set<string>();
  for (const old of protectedRows) {
    const matches = fresh.filter(row => sameEvidence(old.item, row.item));
    // Ambiguous associations are not guessed; keep both for explicit review.
    if (matches.length === 1 && protectedRows.filter(row => sameEvidence(row.item, matches[0].item)).length === 1) {
      suppressed.add(`${matches[0].section}:${matches[0].index}`);
    }
  }
  for (const section of sections) {
    const kept = fresh.filter(row => row.section === section && !suppressed.has(`${section}:${row.index}`));
    const retained = protectedRows.filter(row => row.section === section);
    if (kept.length + retained.length > 80) throw new Error('تجاوز الدمج حد البنود؛ لم تُستبدل مراجعتك السابقة. قلّل البنود اليدوية ثم حاول مجددًا.');
    const rows = [...kept.map(row => row.item), ...retained.map(row => ({ ...row.item, retained_from_previous: true }))];
    const selections = [...kept.flatMap((row, index) => (result[section] ?? []).includes(row.index) ? [index] : []),
      ...retained.flatMap((row, index) => row.selected ? [kept.length + index] : [])];
    Object.assign(result.analysis, { [section]: rows });
    Object.assign(result, { [section]: selections });
  }
  if (protectedRows.length) {
    result.analysis.warnings = [...next.warnings, 'احتُفظ بالبنود المصححة أو المضافة يدويًا كاملةً وباستبعاداتك السابقة. البنود ذات الربط الملتبس قد تظهر مع الاستخراج الجديد؛ راجع التكرار والحقول قبل الاعتماد.'];
  }
  if (previous) result.previous_review = withoutHistory(previous);
  if (approved) result.previous_approved = approved;
  return result;
}
export function restoreCvReview(review: CvReview, kind: 'draft' | 'approved'): CvReview {
  const restored = kind === 'draft' ? review.previous_review
    : review.previous_approved ? createCvReview(review.previous_approved) : null;
  return restored ? { ...withoutHistory(restored), previous_review: withoutHistory(review),
    ...(review.previous_approved ? { previous_approved: review.previous_approved } : {}) } : review;
}
