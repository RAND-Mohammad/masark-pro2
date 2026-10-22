---
name: Protected Replit configuration
description: Safely changing structural Replit settings when ordinary patches are blocked.
---

Structural edits to `.replit` are protected in this environment.

**Why:** A direct patch to remove an unwanted publishing configuration was rejected; the schema-validated replacement succeeded.

**How to apply:** Prefer the relevant configuration callback. If removing a section needs a structural edit, read the current file, preserve unrelated sections, write the full candidate to a temporary workspace file, then call `verifyAndReplaceDotReplit({ tempFilePath })`. Never change or remove environment settings incidentally.

The validator requires an absolute `tempFilePath`; a workspace-relative path is rejected before replacement.
