---
name: Expo proxy environment timing
description: Replit's public Expo URL must be supplied before the CLI loads dotenv.
---

Supply the public proxy origin to the Expo process at launch, using the runtime development domain rather than a hardcoded hostname. Do not move this override into a dotenv file.

**Why:** This SDK's Expo CLI deliberately reads EXPO_PACKAGER_PROXY_URL from its original, pre-dotenv environment. A late override is ignored for security. Without the public origin, generated device URLs can advertise the container's private address or internal port even while the browser preview works.

**How to apply:** Preserve the process-level workflow override. Validate the actual generated device links and download the unmodified manifest asset URLs for both platforms; browser success alone is insufficient. Recheck CLI behavior if the SDK changes because this compatibility mechanism is marked deprecated upstream. This does not authorize native builds, auth redirect changes, or publishing.
