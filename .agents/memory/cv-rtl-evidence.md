---
name: RTL resume evidence
description: Preserve section and field provenance; handle Arabic PDF order and ambiguous columns conservatively.
---

Do not reverse date endpoints or join unrelated visual columns merely to obtain a plausible employment duration. Preserve the visible evidence and require review when dates or their association are uncertain.

**Why:** Real font-embedded Arabic PDF tests demonstrated bidi extraction moving field labels after Latin values and changing the apparent order of date ranges. A plausible-looking correction can silently invent employment facts.

The same bidi behavior can move a bilingual section separator to an edge of the heading. Recognizing two aliases of the same section is not permission to reorder field text or combine different section names.

**How to apply:** Accept only explicit labels within an unambiguous cell/record. Calculate employment duration only from sufficiently specified, valid ranges; expected graduation is never employment. Explain extraction limits instead of treating missing output as proof of absence.

Keep education facts scoped to education and distinguish a project's narrative description from its title. An action sentence is not a title merely because it occurs under a project heading. Preserve a field's original quote through user corrections; missing facts must remain blank and reviewable.

**Why:** The user reported a project description being promoted to a title while the actual education section was missed. A word appearing somewhere in a resume is not enough to establish either its field or its association with another record.

**How to apply:** Treat university-first and degree-first education as valid arrangements, but never repair ambiguous column associations or reconstruct titles from descriptions. Reset uncertain associations at boundaries and keep original per-field quotes distinct from user-supplied corrections.

Local parser repairs must not wait for live Supabase test accounts or dashboard access.

**Why:** The user explicitly reiterated that the parser bug is independent of the separate database and phone acceptance checks; fixing it must not involve production data or personal resume copies.

**How to apply:** Use synthetic text/PDFs and mocked sessions for parser and upload tests. Keep real-account/RLS checks separate, do not activate an external provider, and state plainly when the original PDF was unavailable.

Parser upgrades must not silently replace approved facts or hand corrections.

**Why:** The user explicitly requires outdated analyses to be marked for reanalysis while preserving manual work.

**How to apply:** Prompt for explicit reanalysis, retain prior review evidence and recovery, and require a separate approval before changing the profile. Do not assume that a legacy record without correction metadata was never edited; disclose that uncertainty and keep the old copy available.

Classify skill category labels by their occurrence and list structure, never by globally banning their words. Preserve full literal skill names and distinguish them from fragments, even when several names map to one canonical skill.

**Why:** The user identified a category word also used as a genuine concept, and a wrapped compound being counted as two skills. Global name bans or canonical-ID counts would erase real facts or misrepresent the number of named skills.

**How to apply:** Use separators, section boundaries and independent list entries as evidence; do not merge arbitrary lines or suppress a word that is separately listed as a skill. Exercise these cases with identity-free text/PDFs and provider mocks; sending a supplied excerpt externally requires separate permission.
