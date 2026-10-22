import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { analyzeText } from './analysis.mjs';
import { syntheticPdf } from './fixtures/synthetic-pdf.mjs';
process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));
const text = `FICTIONAL CV
EDUCATION: Bachelor of Computer Science, Demo University. Currently studying.
EXPERIENCE
Software Intern, Demo Company. Tested software and wrote Python scripts.
Encrypted Notes Application (Python). Built a personal application to encrypt files and implemented login features.
Member -Demo Computing Club. Participated in workshops and collaborative technical exercises.
SKILLS: Python programming and software testing.`;
try {
  const result = await analyzeText(text, { key: process.env.Gemini_API_Key_masarak?.trim(), pdf: syntheticPdf(text.split('\n'), { fontSize: 8 }) });
  assert.ok(result.education.length);
  assert.ok(result.projects.some(item => /Encrypted Notes/i.test(item.name)));
  assert.ok(result.activities.some(item => /Club/i.test(item.name)));
  assert.ok(result.experiences.some(item => /Intern/i.test(item.role)));
  console.log(JSON.stringify({ status: 'PASS', projectsAndActivitiesRecoveredFromExperienceHeading: true, projects: result.projects.length, activities: result.activities.length }));
} catch (error) { console.error(JSON.stringify({ status: 'FAILED', error: error.message })); process.exitCode = 1; }
