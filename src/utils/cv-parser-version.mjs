// Bump when extraction/validation rules change saved field meaning or coverage.
export const CV_PARSER_VERSION = 'sections-2026-10-21-gemini-pdf';
export function needsCvReanalysis(analysis) {
  return Boolean(analysis && analysis.entry_method !== 'answers' && analysis.parser_version !== CV_PARSER_VERSION);
}
