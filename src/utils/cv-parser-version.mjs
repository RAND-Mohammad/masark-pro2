// Bump when extraction/validation rules change saved field meaning or coverage.
export const CV_PARSER_VERSION = 'sections-2026-10-22-gemini-3.8-flash';
export function needsCvReanalysis(analysis) {
  return Boolean(analysis && analysis.entry_method !== 'answers' && analysis.parser_version !== CV_PARSER_VERSION);
}
