import type { CvAnalysis } from './skill-profile';
import type { CvReview } from './saved-cv.types';
import dataset from '../masarak_dataset.json';
import { createSkillMatcher } from './skill-matching.mjs';

export const CV_SECTIONS = ['skills', 'projects', 'courses', 'certificates', 'education', 'experiences'] as const;
export type CvSection = typeof CV_SECTIONS[number];
export type ReviewSection = CvSection | 'activities' | 'unclassified';
const allSections: ReviewSection[] = [...CV_SECTIONS, 'activities', 'unclassified'];
const matcher = createSkillMatcher(dataset);
const norm = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/gu, ' ');

export function createCvReview(analysis: CvAnalysis): CvReview {
  return { analysis, skills: [], certificates: [], experiences: [],
    ...Object.fromEntries(allSections.map(section => [section, section === 'unclassified' ? [] : (analysis[section] ?? []).map((_, i) => i)])) };
}

// Older saved records keep their selections exactly; absent sections stay empty.
export function normalizeCvReview(review: CvReview): CvReview {
  return { ...review, courses: review.courses ?? [], education: review.education ?? [], projects: review.projects ?? [], activities: review.activities ?? [], unclassified: review.unclassified ?? [] };
}

export function approvedCvAnalysis(review: CvReview): CvAnalysis {
  const result = { ...review.analysis };
  const qualifications = new Set<string>();
  for (const section of allSections) {
    if (section === 'unclassified') continue; // Retain unresolved facts, never count them as qualifications.
    const seen = new Set<string>();
    const rows = (review.analysis[section] ?? []).filter((row, index) => {
      if (!(review[section] ?? []).includes(index)) return false;
      const item = row as unknown as Record<string, string>;
      const name = section === 'experiences' ? item.role : item.name ?? '';
      if (!name.trim()) return false;
      const identity = section === 'skills' ? norm(name) : norm([name, item.organization ?? item.issuer ?? '', item.dates ?? item.date ?? ''].join('|'));
      if (seen.has(identity)) return false;
      seen.add(identity);
      if (section === 'courses' || section === 'certificates') {
        const qualification = norm([name, item.issuer].join('|'));
        if (qualifications.has(qualification)) return false;
        qualifications.add(qualification);
      }
      return true;
    });
    Object.assign(result, { [section]: rows });
  }
  return result;
}

export function cvReviewCounts(review: CvReview): Record<CvSection, number> {
  const approved = approvedCvAnalysis(review);
  return Object.fromEntries(CV_SECTIONS.map(section => [section, (approved[section] ?? []).length])) as Record<CvSection, number>;
}

export function updateCvReviewItem(review: CvReview, section: ReviewSection, index: number, field: string, value: string): CvReview {
  const rows = (review.analysis[section] ?? []).map((row, i) => i === index ? {
    ...row, [field]: field === 'technologies' ? value.split(/[,،]/u).map(s => s.trim()).filter(Boolean) : value,
    source: (row as unknown as { source?: string }).source === 'user_supplied' ? 'user_supplied' : 'user_corrected',
    ...(section === 'skills' && field === 'name' ? { mapped_skill_id: matcher(value) } : {}),
    ...(section === 'projects' && field === 'category' ? { category_basis: 'user', category_evidence: 'تصنيف صححه المستخدم' } : {}),
  } : row);
  return { ...review, analysis: { ...review.analysis, [section]: rows } };
}

export function addCvReviewItem(review: CvReview, section: ReviewSection): CvReview {
  const rows = review.analysis[section] ?? [];
  const item = section === 'skills' ? { name: '', evidence: '', mapped_skill_id: null }
    : section === 'courses' || section === 'certificates' ? { name: '', issuer: '', date: '', evidence: '' }
      : section === 'experiences' ? { role: '', organization: '', location: '', dates: '', description: '', evidence: '' }
        : { name: '', organization: '', dates: '', description: '', evidence: '' };
  if (rows.length >= 80) return review;
  return { ...review, [section]: [...(review[section] ?? []), rows.length], analysis: { ...review.analysis, [section]: [...rows, { ...item, source: 'user_supplied' }] } };
}

export function moveCvReviewItem(review: CvReview, from: ReviewSection, index: number, to: ReviewSection): CvReview {
  if (from === to) return review;
  const source = (review.analysis[from] ?? [])[index];
  if (!source) return review;
  const original = source as unknown as Record<string, unknown>;
  const name = String(from === 'experiences' ? original.role : original.name ?? '');
  const qualification = from === 'courses' || from === 'certificates';
  const organization = String((qualification ? original.issuer : original.organization) ?? '');
  const dates = String((qualification ? original.date : original.dates) ?? '');
  // Keep every original property, including evidence and project/education details,
  // when correcting classification. Moving never discards the source information.
  const converted = { ...original, name, organization, dates, description: String(original.description ?? ''), evidence: String(original.evidence ?? ''),
    source: original.source === 'user_supplied' ? 'user_supplied' : 'user_corrected',
    ...(to === 'skills' ? { mapped_skill_id: matcher(name) } : {}),
    ...(to === 'courses' || to === 'certificates' ? { issuer: organization, date: dates } : {}),
    ...(to === 'experiences' ? { role: name } : {}) };
  const targetRows = review.analysis[to] ?? [];
  return { ...review,
    [from]: (review[from] ?? []).filter(i => i !== index).map(i => i > index ? i - 1 : i),
    [to]: [...(review[to] ?? []), targetRows.length],
    analysis: { ...review.analysis, [from]: (review.analysis[from] ?? []).filter((_, i) => i !== index), [to]: [...targetRows, converted] },
  };
}
