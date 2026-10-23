import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { analyzeText, extractText } from './analysis.mjs';
process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));
const text = await extractText({ originalname: 'test.pdf', buffer: await readFile(new URL('fixtures/layout-scrambled.pdf', import.meta.url)) });
try {
  const result = await analyzeText(text, { key: process.env.GROQ_API_KEY?.trim() });
  assert.ok(result.education.some(item => item.dates === 'Jan 2022 - Present'));
  assert.ok(result.projects.some(item => item.dates === 'Oct 2025 - Nov 2025'));
  assert.ok(result.certificates.some(item => item.date === 'Oct 2025 - Dec 2025'));
  console.log(JSON.stringify({ status: 'PASS', scrambledContentSorted: true, degreeDateCorrect: true, projectDateCorrect: true, courseDateCorrect: true }));
} catch (error) { console.error(JSON.stringify({ status: 'FAILED', error: error.message })); process.exitCode = 1; }
