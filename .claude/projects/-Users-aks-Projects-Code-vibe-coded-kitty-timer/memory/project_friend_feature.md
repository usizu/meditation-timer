---
name: friend-feature-decisions
description: Architecture and tech decisions for the meditation friend/social feature
type: project
---

Friend feature adds social layer to the kitty-timer meditation app. Key decisions from 2026-03-28:

- **Approach C (hybrid)**: Timer stays as existing Vite PWA. Social features (auth, friends list, profile) are server-rendered HTML fragments delivered via Datastar SSE into the existing app. Timer works offline; social section gracefully degrades.
- **Backend**: AdonisJS in `server/` subdirectory (same repo, monorepo style), SQLite, separate package.json
- **Auth**: Magic-link email only (no passwords), using Resend as email provider (free tier: 100/day, 3k/month)
- **Push notifications**: Two systems needed — Web Push (VAPID) for PWA users, native push (APNs/FCM) for Capacitor iOS/Android. Web Push first, native push deferred.
- **Android**: User plans to add Android build eventually via Capacitor — keep push notification architecture cross-platform ready.
- **Deployment**: Existing VPS with nginx reverse proxy + pm2
- **Frontend reactivity**: Datastar for SSE-driven UI updates (friend status, meditation indicators)
- **Phased rollout**: Auth → Friends → Meditation API → Datastar SSE → Web Push

**Why:** Personal project for meditating with friends. Small user base, keep it simple.
**How to apply:** All server code goes in `server/`. Never break the existing timer functionality. Work on feature branches/worktrees.
