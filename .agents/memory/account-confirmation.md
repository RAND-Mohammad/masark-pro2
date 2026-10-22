---
name: Account confirmation scope
description: User's chosen scope for six-digit email confirmation.
---

Confirm email when creating an account using a six-digit code instead of a confirmation link. Ordinary login remains email and password; the request is not passwordless login or an extra verification step on every login.

**Why:** The user explicitly selected confirmation when creating an account rather than either every-login alternative.

**How to apply:** Preserve this distinction in account flows and hosted email templates. A template in the repository is not evidence that the hosted provider sends codes; verify the hosted configuration and actual delivery separately.

Treat the hosted dashboard's configuration restrictions as authoritative rather than assuming that general provider documentation lists all prerequisites.

**Why:** The user's Supabase dashboard blocked editing the confirmation template until Custom SMTP was configured, although the general template documentation described editing without emphasizing that prerequisite.

**How to apply:** Check prerequisites before asking the user to edit hosted templates. Do not mistake this restriction for a required paid Supabase upgrade or work around it by disabling email confirmation.

The project team has an email account but no owned domain.

**Why:** The user explicitly stated this when choosing how to send verification emails.

**How to apply:** Do not assume access to domain verification or DNS settings when recommending a mail service. Distinguish a limited testing setup from a release-ready sender.

The user selected Send Email Hook instead of the previously suggested Gmail SMTP setup.

**Why:** The user explicitly chose to implement the hook shown in their Supabase dashboard.

**How to apply:** Implement and verify the hook path without silently reverting to SMTP. Since a hook replaces normal email delivery, preserve password recovery alongside signup OTP delivery, and keep the hook disabled until its sender is configured and tested.

Run the email hook as a Supabase Edge Function. The user explicitly chose this path without publishing Masarak or a Replit backend.

**Why:** The user rejected Replit publishing while the app is incomplete, then approved preparing and running a small email function inside Supabase. Replit's managed Brevo connection depends on the Replit runtime and cannot authenticate this function.

**How to apply:** Keep Brevo's API key and the hook signing secret in Supabase function secrets, never in the mobile app or chat. Do not extract the managed Replit connector's credentials. Distinguish deploying this explicitly approved email function from publishing the application. Keep the auth hook disabled until its deployed endpoint, sender, and signature configuration have been verified.

Brevo event lookups may require the recipient's canonical casing, even when delivery succeeded.

**Why:** Filtering a Gmail recipient with mixed casing returned no matching events; the lowercase lookup found the matching request and delivery events. An empty first lookup was not evidence of failed delivery.

**How to apply:** For Gmail, try the lowercase address in read-only event queries and correlate recipient, subject, time, and message ID. Do not automatically resend because an event lookup is empty. Do not assume all providers' mailbox local parts can safely be lowercased.

Authentication emails should use the sender display name **مسارك | Masarak**.

**Why:** The user confirmed receipt of the test message but explicitly wanted the application brand instead of the account's previous display name.

**How to apply:** Preserve the existing sender email address and verification. Adjust the existing sender's display name rather than creating another sender or changing authentication.
