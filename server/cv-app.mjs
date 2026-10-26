import express from 'express';
import multer from 'multer';
import { analyzeText, extractText, CvError } from './analysis.mjs';
import { createEmailHookRouter } from './auth-email-hook.mjs';
import { createCvSessionGuard } from './cv-session.mjs';
import { createInterviewRouter } from './interview.mjs';
import { createJobsRouter } from './jobs.mjs';
import { CV_PARSER_VERSION } from '../src/utils/cv-parser-version.mjs';

// Separating construction from listening lets tests use a loopback-only server.
export function createCvApp({
  authenticate = createCvSessionGuard(),
  extractCvText = extractText,
  analyzeCvText = analyzeText,
} = {}) {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2, parts: 3 } });
  let inProgress = false;
  const attempts = [];
  app.disable('x-powered-by');
  app.use('/api/auth/send-email', createEmailHookRouter());
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.get('/health', (_req, res) => res.json({
    status: 'ok', configured: Boolean(process.env.GROQ_API_KEY?.trim()), parserVersion: CV_PARSER_VERSION,
  }));
  app.use('/interview', createInterviewRouter({ authenticate }));
  app.use('/jobs', createJobsRouter({ authenticate }));
  app.post('/analyze-cv', authenticate, (req, res, next) => {
    while (attempts.length && Date.now() - attempts[0] > 60000) attempts.shift();
    if (inProgress || attempts.length >= 5) return res.status(429).json({ error: 'الخادم مشغول أو وصل لحد الطلبات. حاول بعد قليل.' });
    attempts.push(Date.now());
    inProgress = true;
    res.on('finish', () => { inProgress = false; });
    res.on('close', () => { inProgress = false; });
    next();
  }, upload.single('cv'), async (req, res, next) => {
    try {
      if (req.body.consent !== 'true') throw new CvError('أكد موافقتك على إرسال محتوى السيرة للتحليل.');
      const text = await extractCvText(req.file);
      const analysis = await analyzeCvText(text, {
        key: process.env.GROQ_API_KEY?.trim(),
        model: process.env.GROQ_CV_MODEL?.trim() || undefined,
      });
      res.json(analysis);
    } catch (error) { next(error); }
  });
  // Never log or persist request bodies, CV text, model output or credentials.
  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'حجم السيرة أكبر من 10 ميجابايت.' : 'أرسل ملف سيرة واحدًا.' });
    res.status(error instanceof CvError ? error.status : 500).json({ error: error instanceof CvError ? error.message : 'تعذر تحليل السيرة. حاول مجددًا.' });
  });
  return app;
}
