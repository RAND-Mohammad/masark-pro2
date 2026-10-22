---
name: CV development exposure boundary
description: Why the CV development API must stay behind the existing origin without broadening CORS.
---

Keep the CV development service on a private Unix socket and expose only the needed protected analysis path through the existing development HTTPS origin.

**Why:** The owner authorized development connectivity only, explicitly prohibited broadening CORS or disabling Supabase authentication, and did not authorize production publication or extra public service exposure. Replit automatically added `exposeLocalhost = true` and restored it on the old port mapping after switching to Unix transport. Binding to 127.0.0.1 alone did not preserve the intended boundary; the unused external mapping was removed.

**How to apply:** Preserve the private Unix transport and absence of an external backend port mapping when maintaining startup or mobile connectivity; check final port configuration. Do not make the internal listener public, proxy email hooks, or bypass authentication to fix a connection issue. Enabling connectivity does not authorize transmitting a CV or adding a provider key; obtain the separate authorization for that step.
