import type { DocumentPickerAsset } from 'expo-document-picker';
import { isCvAnalysis, type CvAnalysis } from './skill-profile';

export type CvReview = { analysis: CvAnalysis; skills: number[]; certificates: number[]; experiences: number[]; courses?: number[]; education?: number[]; projects?: number[]; activities?: number[]; unclassified?: number[];
  previous_review?: CvReview; previous_approved?: CvAnalysis };
export type SavedCv = { file_id?: string; asset: DocumentPickerAsset; review: CvReview | null };
export function validReview(value: unknown, allowHistory = true): value is CvReview {
  if (!value || typeof value !== 'object') return false;
  const review = value as CvReview;
  return isCvAnalysis(review.analysis) && (['skills', 'certificates', 'experiences'] as const).every(section => Array.isArray(review[section]) && review[section].every(index => Number.isInteger(index) && index >= 0 && index < review.analysis[section].length)) && (['courses', 'education', 'projects', 'activities', 'unclassified'] as const).every(section => review[section] === undefined || (Array.isArray(review[section]) && review[section]!.every(index => Number.isInteger(index) && index >= 0 && index < (review.analysis[section]?.length ?? 0))))
    && (review.previous_review === undefined || (allowHistory && validReview(review.previous_review, false)))
    && (review.previous_approved === undefined || (allowHistory && isCvAnalysis(review.previous_approved)));
}
