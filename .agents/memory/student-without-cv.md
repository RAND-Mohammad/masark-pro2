---
name: Student without an existing CV
description: Product boundary for new graduates and additive profile creation.
---

Students must be able to complete their career profile without an uploaded CV or any work experience; projects and courses can also be absent.

**Why:** The user specifically asked: «لو مثلا طالب حديث تخرج وش راح يرفع ما عندة سيرة». An existing document or job history is not a prerequisite for using Masarak.

**How to apply:** Keep the short-answer alternative visible alongside optional English PDF upload. Reuse the existing profile data in scoring and planning, preserve existing user facts, and distinguish local saving from confirmed cloud sync. Do not add AI generation or extend the resume parser to implement this alternative.

Never treat completion of a native sharing call as proof that a PDF was sent or saved, and do not immediately delete a successfully shared cache URI.

**Why:** Expo Sharing resolves after cancellation as well as completion; on Android the recipient may still be reading the granted URI after the chooser returns.

**How to apply:** Report only PDF preparation and opening sharing options. Leave successful output in OS-managed private cache, clean up failed/stale output when possible, and require real-device file-opening checks before claiming verified native export.
