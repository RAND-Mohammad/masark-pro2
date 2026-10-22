# Masarak on Replit

## Phase 1 implementation update
Current implementation and external acceptance gates are described in `docs/PHASE-2-STATUS_AR.md`.
Text interview practice uses authenticated Express routes, a bilingual curated question bank and explicit local/optional-AI feedback. History joins the existing account JSONB snapshot via opt-in Supabase sync; no new database, roles or permission changes. Practice scores are not hiring probabilities. Career evidence uses whole-term matching rather than substring matches, and a goal-derived gap plan can be added without deleting previous plan items.

## Run
- Keep the existing Expo SDK 57 / React Native app and separate Node CV service.
- Node.js 22 is required by the installed Supabase client.
- Use the Run button to start `Masarak preview`, or run `EXPO_PACKAGER_PROXY_URL="https://$REPLIT_DEV_DOMAIN" EXPO_UNSTABLE_HEADLESS=1 node scripts/start-dev.mjs`.
- This runs Expo on port 5000 and the protected CV service on a private Unix socket, with no backend TCP listener. `/api/cv` is a same-origin HTTPS development bridge; only health and CV analysis are forwarded, not email hooks.
- The browser preview uses port 5000. Watch mode is enabled so edits refresh during development.
- Headless mode avoids installing the native desktop debugger in this browser-only environment.
- Choose «متابعة دون حساب» to try the existing guest experience.

## Optional services not yet configured
- Accounts require the existing Supabase project's `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Configure these using the environment/secrets UI, not source code. Account flows have not been verified.
- When `GROQ_API_KEY` is absent, the protected service uses limited section/label rules for skills, projects, courses, independent credentials, education and work experience, retaining source evidence. Ambiguous layouts/qualification types require review; missing extraction is not proof of absence. Results and corrections use the existing JSON storage without a database migration. This is not full AI understanding. Keep any provider key server-only, never `EXPO_PUBLIC_`.
- The development launcher sets `EXPO_PUBLIC_CV_API_URL` to the current HTTPS development origin plus `/api/cv`; web uses a relative same-origin path and native uses the absolute HTTPS URL.
- Supabase verifies the access token before multipart processing. Do not bypass this guard or broaden CORS to make development work. See `docs/CV-HTTPS-DEVELOPMENT_AR.md` for evidence and remaining limits; this is not production publishing or readiness.

## Checks
- `npm run lint`
- `npx tsc --noEmit`
- CV service tests, once its dependencies are installed: `npm run test:cv-server`.
