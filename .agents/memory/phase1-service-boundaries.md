---
name: Phase 1 service boundaries
description: Preserve the existing Supabase model and distinguish practice scores from verified credentials or live markets.
---

Extend the existing Supabase account storage rather than replacing the database or changing external permissions without approval. Keep cloud saving an explicit opt-in and make pending/failed writes visible.

**Why:** The user requested completion inside the current project while preserving its stack and forbidding sharing/permission changes or publishing. Existing PostgreSQL account snapshots can carry new practice data without a security migration.

**How to apply:** Preserve older data and account isolation. Do not call mocked database tests live persistence evidence; external RLS, storage and multi-device acceptance still require authorized sessions.

Local interview scores are practice rubric signals, not competency certification, hiring probabilities or AI analysis. External AI requires its own explicit consent, and missing credentials must remain visible.

**Why:** The user explicitly prohibits claiming unavailable AI, live market, Nafath or audio/video services are active.

**How to apply:** Label curated questions and career/course catalogs honestly. Keep provider activation separate from UI availability and from release readiness.

Keep the report's NLP, external LLM extraction and recommendation-ML roles distinct. The report is the reference, not a document to rewrite to fit missing implementation.

**Why:** The user explicitly requires structured NLP extraction, external LLM skill extraction, and honest disclosure of whether recommendations have an independently trained ML model. A weighted ranking or an AI label is not proof of model training. They subsequently required clear failure rather than automatically replacing unavailable Groq analysis with local rules.

**How to apply:** Preserve the configured, consented LLM path as the primary analysis route. Treat rules as formatting, evidence validation and literal supplementation. The user subsequently required an explicit CV-analysis failure when the key/model is unavailable, not an automatic local substitute; keep local helpers for verification/tests. State any trained-recommendation gap separately; do not start a new ML system or invent training data inside a CV parser repair.
