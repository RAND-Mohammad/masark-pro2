import { normalizeSkillName } from '../src/utils/skill-matching.mjs';
import { findSourceExcerpt } from './evidence-match.mjs';
import { isLiteralSkillName, localSectionHeading } from './local-resume.mjs';

// These recognize standalone labels, not forbidden skill names. Inline labels
// inside a skills section are identified structurally by their separator.
const categoryName = /^(?:programming languages?|languages?\s*\(programming\)|technical skills?|core technical competencies|technical competencies|core competencies|key skills|skills and abilities|skills|tools(?:\s*(?:and|&)\s*technologies)?|technologies|frameworks|databases|data structures|concepts|لغات البرمجة|المهارات(?: التقنية| والقدرات)?|الأدوات|التقنيات|قواعد البيانات)$/iu;
const boundary = /^(?:summary|profile|objective|contact|awards|references|الملخص|الجوائز|معلومات الاتصال)\s*[:：]?$/iu;
const categoryMarkers = () => /(^|[,،;؛]\s*)([\p{L}][\p{L}\p{N} /&()_-]{0,60}?)(?:\s*[:：]\s*|\s+[—–-]\s+)/gmu;
const cleanBullet = value => value.replace(/^(?:[-*•▪]\s+|\d+[.)]\s+)/u, '').trim();
const cellsOf = row => row.replace(/^\[[PD]\d+L\d+(?: y=\d+)?\]\s*/u, '')
  .split(/\s+\|\s+(?=\(x=\d+\))/u)
  .map(cell => cell.replace(/^\(x=\d+\)\s*/u, '').trim()).filter(Boolean);

function labelled(value) {
  const first = [...value.matchAll(categoryMarkers())][0];
  return first?.index === 0 && categoryName.test(first[2].trim());
}

function wrappedContinuation(previous, next) {
  // Only continue an unfinished item in a labelled comma-list, never arbitrary
  // one-per-line skills. No skill-name dictionary or resume-specific join.
  const tail = previous.split(/[,،;؛]/u).at(-1).trim();
  return /[,،;؛]/u.test(previous) && [...previous.matchAll(categoryMarkers())].length > 0
    && /^[\p{L}\p{N}]+[-‐‑–][\p{L}\p{N}-]+$/u.test(tail)
    && /^[\p{L}\p{N}]+(?=\s*(?:[,،;؛]|$))/u.test(next)
    && !/^(?:[-*•▪]\s+|\d+[.)]\s+)/u.test(next);
}

function splitSkillNames(value) {
  const chunks = [];
  let current = '', depth = 0;
  for (const character of value.replace(/\s+/gu, ' ')) {
    if (character === '(') depth++;
    if (/[,،;؛•▪|]/u.test(character) && depth === 0) {
      if (current.trim()) chunks.push(current.trim());
      current = '';
      continue;
    }
    current += character;
    if (character === ')' && depth > 0) depth--;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.flatMap(chunk => {
    const list = chunk.match(/^(.+?)\s*\(([^()]*)\)$/u);
    if (!list || !/[,،;؛]/u.test(list[2])) return [chunk];
    return [list[1].trim(), ...list[2].split(/[,،;؛]/u).map(name => name.trim())].filter(Boolean);
  });
}

function readLists(source, { sectionOnly }) {
  const entries = [], labels = [];
  const rows = source.split('\n');
  let active = false, pending = '';
  function parse(block, minimum = 1) {
    const value = block.replace(categoryMarkers(), (_match, separator, label) => {
      labels.push(label.trim());
      return separator;
    });
    const names = splitSkillNames(value);
    // Reject a sentence/instruction-bearing list as a unit, not selected words.
    if (names.length < minimum || names.some(name =>
      /\b(?:developed|implemented|obtained|ignore|instructions)\b|^(?:use|used|using|built|designed|created)\s/iu.test(name))) return;
    for (const name of names) {
      if (!isLiteralSkillName(name) || name.length > 60 || name.split(/\s+/u).length > 6) continue;
      entries.push({ name, mapped_skill_id: null, evidence: findSourceExcerpt(block, name) ?? block });
    }
  }
  function flush() { if (pending) parse(pending); pending = ''; }
  for (let index = 0; index < rows.length; index++) {
    const cells = cellsOf(rows[index]);
    if (!cells.length) { flush(); continue; }
    const heading = cells.map(cell => localSectionHeading(cell)).find(Boolean);
    if (heading || cells.some(cell => boundary.test(cell))) {
      flush();
      active = heading?.section === 'skills';
      if (active && heading.inline) parse(heading.inline);
      continue;
    }
    if (cells.length !== 1) {
      flush(); // Never attach a wrapped item to another visual column.
      if (!active && !sectionOnly) for (const cell of cells) if (labelled(cell)) parse(cell, 2);
      continue;
    }
    const line = cleanBullet(cells[0]);
    if (!active) {
      flush();
      if (!sectionOnly && labelled(line)) parse(line, 2);
      continue;
    }
    const following = cellsOf(rows[index + 1] ?? '');
    if (categoryName.test(line) && following.length === 1
      && !localSectionHeading(following[0]) && !boundary.test(following[0])) {
      flush();
      labels.push(line);
      continue;
    }
    if (pending && wrappedContinuation(pending, cells[0])) pending += '\n' + line;
    else { flush(); pending = line; }
  }
  flush();
  return { entries, labels };
}

export function recoverListedSkills(source, skills, { sectionOnly = false } = {}) {
  const { entries, labels } = readLists(source, { sectionOnly });
  const declared = new Map(entries.map(item => [normalizeSkillName(item.name), item]));
  const result = [], seen = new Set();
  for (const skill of [...skills, ...entries]) {
    const identity = normalizeSkillName(skill.name);
    if (seen.has(identity) || result.length >= 80) continue;
    const literal = declared.get(identity);
    // Contextual suppression: only a category occurrence or a proper fragment
    // of an actual item is rejected. A separately listed Programming/Databases
    // remains a skill, even when the same word is also a label.
    if (!literal && [...labels, ...entries.map(item => item.name)].some(text => findSourceExcerpt(text, skill.name))) continue;
    seen.add(identity);
    result.push(literal ? {
      ...skill, name: literal.name, evidence: literal.evidence,
      ...(skill.field_evidence ? { field_evidence: { ...skill.field_evidence, name: literal.evidence } } : {}),
    } : skill);
  }
  return result;
}
