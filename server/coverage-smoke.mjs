import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { analyzeText, extractText } from './analysis.mjs';
import { syntheticPdf } from './fixtures/synthetic-pdf.mjs';
process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));
const sample = `FICTIONAL CV
EDUCATION
Degree: Bachelor of Science in Computer Science
University: Demo University
Major: Computer Science
Status: Currently studying
Expected Graduation: 2027
PROJECTS
Project: Encrypted Notes Application
Description: Built a personal application to encrypt files and implemented login features.
Technologies: Python, SQL
EXPERIENCE
Role: Software Intern
Company: Demo Company
Dates: 2024
Description: Tested software and wrote Python scripts.
SKILLS
Python, SQL, software testing
COURSES
Course: Python Basics
Provider: Demo Academy
Date: 2025
CERTIFICATIONS
Certificate: Example Credential
Issuer: Demo Board
Date: 2025`;
try {
  const pdf = syntheticPdf(sample.split('\n'), { fontSize: 8 });
  const text = await extractText({ originalname: 'synthetic.pdf', mimetype: 'application/pdf', buffer: pdf });
  const result = await analyzeText(text, { key: process.env.Gemini_API_Key_masarak?.trim(), pdf });
  assert.ok(result.education.length);
  assert.ok(result.education.some(item => /Demo University/i.test(item.organization) && /Computer Science/i.test(item.major)));
  assert.ok(result.projects.some(item => /Encrypted Notes/i.test(item.name) && /encrypt files/i.test(item.description)));
  assert.ok(result.experiences.some(item => /Intern/i.test(item.role)));
  assert.ok(result.skills.some(item => item.name === 'Python'));
  assert.ok(result.courses.some(item => /Python Basics/i.test(item.name)));
  assert.ok(result.certificates.some(item => /Example Credential/i.test(item.name)));
  console.log(JSON.stringify({ status: 'PASS', education: result.education.length, projects: result.projects.length,
    experiences: result.experiences.length, skills: result.skills.length, courses: result.courses.length, certificates: result.certificates.length }));
} catch (error) { console.error(JSON.stringify({ status: 'FAILED', error: error.message })); process.exitCode = 1; }
