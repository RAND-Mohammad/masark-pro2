const variants: Record<string, string[]> = {
  'برمج': ['برمج', 'برمجة', 'برمجيات', 'برمجي', 'برمجية', 'البرمجة', 'البرمجيات'],
  'تطبيق': ['تطبيق', 'تطبيقات', 'التطبيق', 'التطبيقات'],
};
export function containsEvidenceTerm(text: string, term: string): boolean {
  if (!term.trim()) return false;
  return (variants[term] ?? [term]).some(word => {
    const pattern = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${pattern}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(text);
  });
}
export function isRelevantEvidence(value: unknown, keywords: string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  const text = Object.entries(value).filter(([key]) => !['category', 'category_basis', 'category_evidence', 'source', 'mapped_skill_id'].includes(key))
    .flatMap(([, item]) => typeof item === 'string' ? [item] : Array.isArray(item) ? item.filter(v => typeof v === 'string') : []).join(' ');
  return keywords.some(keyword => containsEvidenceTerm(text, keyword));
}
