import { findSourceExcerpt } from './evidence-match.mjs';
import { plainLayoutText } from './layout-reader.mjs';

// Page locations come from the PDF reader, never from model assertions.
function pagesForQuote(source, quote, record) {
  const rows = source.split('\n').map(raw => ({
    page: Number(raw.match(/^\[P(\d+)L/)?.[1]) || null,
    text: plainLayoutText(raw),
  }));
  const visible = rows.map(row => row.text).join('\n');
  const recordStart = record ? visible.indexOf(record) : -1;
  const uniqueRecord = recordStart >= 0 && visible.indexOf(record, recordStart + 1) < 0;
  let within = uniqueRecord ? record.indexOf(quote) : -1;
  if (within >= 0 && record.indexOf(quote, within + 1) >= 0) within = -1;
  const start = within >= 0 ? recordStart + within : visible.indexOf(quote);
  if (start < 0 || (within < 0 && visible.indexOf(quote, start + 1) >= 0)) return [];
  let offset = 0;
  const pages = new Set();
  for (const row of rows) {
    if (offset < start + quote.length && offset + row.text.length > start && row.page) pages.add(row.page);
    offset += row.text.length + 1;
  }
  return [...pages];
}

export function verifyFieldProvenance(analysis, source) {
  const visible = plainLayoutText(source);
  const fields = {
    skills: ['name'],
    education: ['name', 'organization', 'college', 'major', 'study_status', 'dates', 'description'],
    projects: ['name', 'organization', 'role', 'technologies', 'dates', 'description'],
    experiences: ['role', 'organization', 'location', 'dates', 'description'],
    courses: ['name', 'issuer', 'date'],
    certificates: ['name', 'issuer', 'date'],
    activities: ['name', 'organization', 'dates', 'description'],
    unclassified: ['name', 'organization', 'dates', 'description'],
  };
  for (const [section, keys] of Object.entries(fields)) {
    for (const item of analysis[section] ?? []) {
      const record = findSourceExcerpt(visible, item.evidence);
      item.field_evidence ??= {};
      const pages = {};
      for (const field of keys) {
        const values = Array.isArray(item[field]) ? item[field] : [item[field]];
        if (!values.some(value => typeof value === 'string' && value.trim())) continue;
        const proposed = item.field_evidence[field] ?? record;
        const literal = findSourceExcerpt(visible, proposed);
        if (!literal || !values.every(value => findSourceExcerpt(literal, value))) {
          item[field] = Array.isArray(item[field]) ? [] : '';
          if (section === 'skills' && field === 'name') item.mapped_skill_id = null;
          delete item.field_evidence[field];
          item.needs_review = [...new Set([...(item.needs_review ?? []), field])];
          continue;
        }
        // Retain a literal field quote; arrays use their associated source passage.
        const quote = values.length === 1 ? findSourceExcerpt(literal, values[0]) : literal;
        item.field_evidence[field] = quote;
        const located = pagesForQuote(source, quote, record);
        if (located.length) pages[field] = located;
      }
      if (Object.keys(pages).length) item.field_pages = pages;
      if (item.needs_review?.length && analysis.section_status?.[section]) analysis.section_status[section] = 'uncertain';
    }
  }
  return analysis;
}

// Only a uniquely identified local record may supplement a narrow model quote.
// This recovers a university on its own line, not any university in the section.
export function associatedRecordQuote(section, item, scopedSource, localRecords) {
  const visible = plainLayoutText(scopedSource);
  const label = section === 'experiences' ? item.role : item.name;
  let quote = findSourceExcerpt(visible, item.evidence);
  const records = localRecords[section] ?? [];
  const matches = records.filter(row => (section === 'experiences' ? row.role : row.name) === label);
  if (section === 'education' && matches.length === 1) {
    const localQuote = findSourceExcerpt(visible, matches[0].evidence);
    if (localQuote && findSourceExcerpt(localQuote, label)) quote = localQuote;
  }
  if (quote && matches.length > 1) {
    const literalLabel = findSourceExcerpt(quote, label);
    if (literalLabel && quote.indexOf(literalLabel, quote.indexOf(literalLabel) + literalLabel.length) >= 0)
      return findSourceExcerpt(visible, label);
  }
  // A combined passage cannot authorize borrowing facts from another record.
  if (quote && records.some(row => {
    const other = section === 'experiences' ? row.role : row.name;
    return other && other !== label && findSourceExcerpt(quote, other);
  })) return findSourceExcerpt(visible, label);
  return quote;
}
