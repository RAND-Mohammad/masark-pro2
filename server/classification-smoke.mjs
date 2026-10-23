import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { analyzeText } from './analysis.mjs';
process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));
const cv = `FICTIONAL TEST CV
EDUCATION: Bachelor of Computer Science, Demo University, 2022 - Present. Currently studying; not graduated.
CERTIFICATIONS: Example Professional Certificate, Demo Training Center, awarded 2024.
EMPLOYMENT: Software Intern, Demo Company, June 2024 - August 2024. Tested software and wrote Python scripts.
PROJECTS: Secure File Storage, Personal project, November 2024 - Present. Built a Python application to encrypt files.
ACTIVITIES: Member, Demo University Cybersecurity Club, 2022 - Present. Participated in workshops.
SKILLS: Python programming, software testing.`;
try {
  const result = await analyzeText(cv, { key: process.env.GROQ_API_KEY?.trim() });
  assert.ok(result.education.some(item => /Bachelor/i.test(item.name)));
  assert.ok(result.projects.some(item => /Secure File Storage/i.test(item.name)));
  assert.ok(result.activities.length);
  assert.ok(result.experiences.some(item => /Intern/i.test(item.role)));
  assert.ok(result.certificates.some(item => /Certificate/i.test(item.name)));
  assert.equal(result.experiences.some(item => /Bachelor|Member|Club|Personal project|Secure File Storage/i.test(item.role + ' ' + item.organization)), false);
  assert.equal(result.skills.some(item => /Bachelor|Certificate|Club/i.test(item.name)), false);
  console.log(JSON.stringify({ status: 'PASS', academicDegreeInEducation: true, projectsAndClubsSeparatedFromEmployment: true, counts: Object.fromEntries(['skills', 'education', 'certificates', 'experiences', 'projects', 'activities'].map(section => [section, result[section].length])) }));
} catch (error) { console.error(JSON.stringify({ status: 'FAILED', error: error.message })); process.exitCode = 1; }
