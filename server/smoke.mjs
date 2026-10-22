import { fileURLToPath } from 'node:url';
import { analyzeText } from './analysis.mjs';
import { syntheticPdf } from './fixtures/synthetic-pdf.mjs';
try { process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url))); } catch { /* Missing key is reported safely below. */ }
const cv = 'DEMONSTRATION CV, fictional candidate. Skills: Python programming, software testing. Certification: Example Certificate, Demo Institute, 2024. Experience: Developer Intern at Demo Company in 2023, wrote Python scripts and tested software.';
try {
  const result = await analyzeText(cv, { key: process.env.Gemini_API_Key_masarak?.trim(), pdf: syntheticPdf(cv.split('\n'), { fontSize: 8 }) });
  console.log(JSON.stringify({ status: 'ok', skills: result.skills.length, certificates: result.certificates.length, experiences: result.experiences.length }));
} catch (error) { console.error(JSON.stringify({ status: 'failed', error: error.message })); process.exitCode = 1; }
