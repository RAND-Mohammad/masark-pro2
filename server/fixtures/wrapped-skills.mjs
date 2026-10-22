import { syntheticPdf } from './synthetic-pdf.mjs';
import { findSourceExcerpt } from '../evidence-match.mjs';
import { plainLayoutText } from '../layout-reader.mjs';

// Identity-free regression text supplied for local tests only; never send to a provider.
export const skillLines = [
  'TECHNICAL SKILLS',
  'Programming Languages — Python, Java, C++, SQL, Data Structures — Linked List, Stack, Queue, Priority Queue,',
  'Databases — SQLite, Tools — NetBeans, Visual Studio Code, Concepts — Algorithms, Object-Oriented',
  'Programming, Software Engineering, Databases',
];
export const expectedSkills = [
  'Python', 'Java', 'C++', 'SQL', 'Linked List', 'Stack', 'Queue', 'Priority Queue',
  'SQLite', 'NetBeans', 'Visual Studio Code', 'Algorithms', 'Object-Oriented Programming',
  'Software Engineering', 'Databases',
];
export const wrappedSkillsPdf = () => syntheticPdf(skillLines, { winAnsi: true, fontSize: 8 });

export function incompleteSkills(source) {
  const missing = new Set(['Linked List', 'SQLite', 'NetBeans', 'Algorithms', 'Object-Oriented Programming']);
  return [...expectedSkills.filter(name => !missing.has(name)), 'Programming Languages', 'Data Structures', 'Tools', 'Object-Oriented', 'Programming']
    .map(name => ({ name, mapped_skill_id: null, evidence: findSourceExcerpt(plainLayoutText(source), name) }));
}
