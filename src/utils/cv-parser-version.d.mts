export const CV_PARSER_VERSION: string;
export function needsCvReanalysis(analysis: { parser_version?: string; entry_method?: 'answers' } | null | undefined): boolean;
