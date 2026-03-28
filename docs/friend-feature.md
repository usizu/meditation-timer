# Meditation App — Technical Specification

## Overview

A progressive web app (PWA) for meditating with friends. When you start a meditation session, your friends receive a push notification on their devices. The app uses a simple email-based identity system (no passwords), per-friend notification controls, and a server-driven UI via Datastar. Real-time chat between friends is a future feature (low priority).

---

## Tech Stack

### Backend
- **AdonisJS** (Node.js) — full-stack framework with built-in auth, ORM (Lucid), migrations, and mailer
- **SQLite** for the database (sufficient for small user base; can swap to Postgres later)
- **`web-push`** npm library for sending Web Push notifications (VAPID protocol)
- **AdonisJS Mailer** for sending magic-link verification emails

### Frontend
- **PWA** (Progressive Web App) — installable on mobile home screens, service worker for push notifications
- **Datastar** for server-driven UI updates via SSE — the server pushes HTML fragments/signals and the client merges them reactively into the DOM
- **Vanilla JS / lightweight approach** — no heavy frontend framework; Datastar handles reactivity

### Future Addition
- **WebSockets** via `ws` or `socket.io` integrated alongside AdonisJS for real-time chat

---

## Identity & Auth

### Email-Only, Magic Link

1. User enters their email address on the login/register screen.
2. Server sends a magic link (or 6-digit code) to that email via AdonisJS Mailer.
3. User clicks the link / enters the code.
4. Server creates or retrieves the user record, creates a session, and sets a session cookie.
5. No passwords at any point. The email verification is the sole authentication mechanism.
6. Sessions persist via cookie. If the session expires, the user re-verifies via a new magic link.

### Upgrade Path
The system can be upgraded to email + password auth later using AdonisJS's built-in auth module without changing the data model significantly.

---

## User Profile

Each user has a minimal profile:

- **Email** (primary identifier, verified)
- **Timezone** (IANA format, e.g., `Asia/Tokyo`, `America/New_York`)
  - Auto-detected on first login via `Intl.DateTimeFormat().resolvedOptions().timeZone`
  - Editable in profile settings via a dropdown with a **text filter input** (typing "tok" filters to `Asia/Tokyo`, etc.)
  - Stored on the user record in the database

---

## Friends System

### Adding Friends

- You add a friend by entering their email address.
- This creates a **pending** friendship record.
- When the other person also adds your email, the friendship becomes **confirmed** (mutual opt-in).
- No explicit "accept/decline" UI — friendship is confirmed automatically when both sides have added each other.

### Friends List UI

For each confirmed friend, display:

- Their email (or display name if added later)
- Their timezone label and **live local time** (computed client-side using their stored IANA timezone with `Date.toLocaleTimeString({ timeZone: friend.timezone })` — no server push needed for the clock)
- Two notification toggles (see below)
- A visual indicator if they are currently meditating (updated via Datastar SSE)

Show a small **"Pending"** section for friends you've added who haven't added you back yet.

---

## Notification Controls

### Per-Friend Toggles

Each confirmed friendship has two independent toggles visible on your friends list:

1. **"Notify them when I meditate"** — When ON and you start meditating, this friend receives a push notification. When OFF, this friend is skipped.
2. **"Notify me when they meditate"** — When ON, you receive a push notification when this friend starts meditating. When OFF, their meditation events are silenced for you.

Both toggles **default to ON** when a friendship is confirmed.

A notification is only sent when **both sides agree**: your "notify them" toggle is ON for that friend, AND their "notify me" toggle is ON for you. The server checks both conditions before sending.

### Global Silent Mode

- A prominent toggle in the app UI (top of the meditation screen or in profile).
- **This is client-side only.** When silent mode is ON, the client simply does not send the "meditation started" event to the server. No server changes needed.
- The per-friend toggles remain unchanged — turning off silent mode restores the previous configuration immediately.
- Store the silent mode state in `localStorage`.

---

## Meditation Flow

### Starting a Meditation

1. User taps "Start Meditation" in the app.
2. **Client checks silent mode.** If silent mode is ON, skip step 3 — the meditation starts locally without notifying anyone.
3. If silent mode is OFF, the client sends a `POST /meditations/start` request to the server.
4. The server:
   a. Creates a meditation record (user_id, started_at).
   b. Queries confirmed friendships where:
      - The meditating user has "notify them" ON for that friend, AND
      - That friend has "notify me" ON for the meditating user.
   c. For each matching friend, sends a **Web Push notification** to all their registered push subscriptions.
   d. For any matching friend with an active SSE connection (Datastar), pushes a UI update showing the friend is meditating.
5. The app shows a meditation timer/screen.

### Ending a Meditation

1. User taps "End Meditation" or the timer completes.
2. Client sends `POST /meditations/end` to the server.
3. Server updates the meditation record with `ended_at`.
4. Server pushes a Datastar SSE update to connected friends, removing the "currently meditating" indicator.
5. (Optional) No push notification on end — only on start.

---

## Web Push Notifications

### Subscription Flow

1. On first login (or first visit after login), the PWA's service worker checks if push notifications are supported and if permission has been granted.
2. If not yet granted, the app prompts the user to allow notifications.
3. On approval, the service worker calls `pushManager.subscribe()` with the server's VAPID public key.
4. The resulting subscription object (endpoint URL, keys) is sent to the server via `POST /push-subscriptions`.
5. The server stores the subscription tied to the user's ID.
6. A single user can have **multiple subscriptions** (e.g., phone + laptop). All are stored and all receive notifications.

### VAPID Keys

- Generate a VAPID key pair once and store in environment variables.
- Use the `web-push` npm library: `webpush.generateVAPIDKeys()`.
- Configure the library with `webpush.setVapidDetails(subject, publicKey, privateKey)`.

### Sending Notifications

- Use `webpush.sendNotification(subscription, payload)` for each target subscription.
- Payload should be a JSON string with at minimum: `{ title, body, url }`.
- The service worker's `push` event handler displays the notification.
- The service worker's `notificationclick` event handler opens or focuses the app.
- Handle expired/invalid subscriptions: if `sendNotification` returns a 410 status, delete that subscription from the database.

### Service Worker

The PWA service worker needs to handle:

- `push` event: parse the payload, display a notification via `self.registration.showNotification()`.
- `notificationclick` event: focus the app window or open it if closed.
- Basic caching strategy for offline support (app shell caching).

---

## Datastar — Server-Driven UI via SSE

### How It Works

- Datastar is included in the frontend as a script tag.
- The client establishes an SSE connection to the server (e.g., `GET /sse/updates`).
- The server can push signals (reactive data) and HTML fragments to the client over this connection.
- Datastar merges these updates into the DOM reactively.

### What to Push via Datastar

- **Friend started meditating**: update the friend's row in the friends list to show a "meditating" indicator.
- **Friend stopped meditating**: remove the indicator.
- **Friendship confirmed**: a pending friend moves to the confirmed list.
- **New pending friend**: someone added you, show in pending section.

### Server Implementation

- Each authenticated user with an open SSE connection is tracked on the server (e.g., a Map of userId → response object).
- When an event occurs (meditation start, friendship change), the server looks up which users should receive the update and pushes to their SSE connections.
- If a user is not connected (app closed), they don't get the SSE update — they'll see the current state when they next open the app. Push notifications handle the offline case.

---

## Data Model

### users
| Column      | Type     | Notes                          |
|-------------|----------|--------------------------------|
| id          | integer  | Primary key, auto-increment    |
| email       | string   | Unique, verified               |
| timezone    | string   | IANA timezone, e.g. `Asia/Tokyo`. Default: `UTC` |
| created_at  | datetime |                                |
| updated_at  | datetime |                                |

### sessions
| Column      | Type     | Notes                          |
|-------------|----------|--------------------------------|
| id          | integer  | Primary key                    |
| user_id     | integer  | FK → users                     |
| token       | string   | Unique session token           |
| expires_at  | datetime |                                |
| created_at  | datetime |                                |

### push_subscriptions
| Column         | Type     | Notes                          |
|----------------|----------|--------------------------------|
| id             | integer  | Primary key                    |
| user_id        | integer  | FK → users                     |
| subscription   | text     | JSON string (endpoint, keys)   |
| device_label   | string   | Optional, e.g. "phone", "laptop" |
| created_at     | datetime |                                |

### friendships
| Column         | Type     | Notes                          |
|----------------|----------|--------------------------------|
| id             | integer  | Primary key                    |
| user_a_id      | integer  | FK → users (the user who added first) |
| user_b_id      | integer  | FK → users (the user who was added)   |
| confirmed      | boolean  | True when both sides have added each other |
| a_notifies_b   | boolean  | User A's "notify them" toggle for User B. Default: true |
| b_notifies_a   | boolean  | User B's "notify them" toggle for User A. Default: true |
| a_receives_b   | boolean  | User A's "notify me" toggle for User B. Default: true |
| b_receives_a   | boolean  | User B's "notify me" toggle for User A. Default: true |
| created_at     | datetime |                                |
| updated_at     | datetime |                                |

**Notification logic**: When User A starts meditating, notify User B only if:
- `a_notifies_b` is `true` (A wants to notify B), AND
- `b_receives_a` is `true` (B wants to receive from A)

### meditations
| Column      | Type     | Notes                          |
|-------------|----------|--------------------------------|
| id          | integer  | Primary key                    |
| user_id     | integer  | FK → users                     |
| started_at  | datetime |                                |
| ended_at    | datetime | Null while active              |

### messages (future — low priority)
| Column       | Type     | Notes                          |
|--------------|----------|--------------------------------|
| id           | integer  | Primary key                    |
| sender_id    | integer  | FK → users                     |
| recipient_id | integer  | FK → users                     |
| body         | text     |                                |
| created_at   | datetime |                                |

---

## API Endpoints

### Auth
- `POST /auth/register` — Accept email, send magic link/code
- `POST /auth/verify` — Accept token/code, create session
- `POST /auth/logout` — Destroy session

### Profile
- `GET /profile` — Return current user profile
- `PATCH /profile` — Update timezone

### Friends
- `POST /friends` — Add a friend by email (creates pending friendship or confirms if reciprocal)
- `GET /friends` — List confirmed friends (with their timezone, online/meditating status) and pending friends
- `DELETE /friends/:id` — Remove a friendship
- `PATCH /friends/:id/toggles` — Update notification toggles for a specific friendship

### Meditations
- `POST /meditations/start` — Start a meditation; triggers notification logic
- `POST /meditations/end` — End the current meditation

### Push Subscriptions
- `POST /push-subscriptions` — Register a new push subscription
- `DELETE /push-subscriptions/:id` — Remove a subscription (e.g., on logout)

### SSE
- `GET /sse/updates` — Authenticated SSE stream for Datastar; pushes friend status updates, friendship changes

---

## Frontend Structure (PWA)

### Pages / Views
- **Login/Register** — Email input, magic link flow
- **Home / Meditation** — Start/stop meditation button, silent mode toggle, current meditation timer
- **Friends List** — Confirmed friends with timezone clocks and toggles, pending section, add-friend input
- **Profile / Settings** — Timezone selector (filterable dropdown), push notification permission status

### Service Worker (`sw.js`)
- Cache app shell for offline access
- Handle `push` events to display notifications
- Handle `notificationclick` to open/focus the app

### Datastar Integration
- SSE connection established on app load (authenticated)
- Friend list items update reactively when SSE events arrive
- Meditation status indicators update in real time

### Silent Mode
- Toggle stored in `localStorage`
- When ON, the "Start Meditation" button still works locally (shows timer, tracks session) but does NOT call `POST /meditations/start`
- Visual indicator in UI showing silent mode is active (e.g., a muted icon)

---

## Chat Feature (Future — Low Priority)

When implemented:

- **Transport**: WebSockets via `ws` or `socket.io`, integrated alongside the AdonisJS HTTP server.
- **Data**: Messages persisted in the `messages` table for scroll-back history.
- **Live delivery**: Messages sent over WebSocket to connected friends.
- **Offline**: If the recipient is not connected, send a Web Push notification that they have a new message.
- **UI**: Chat view accessible from the friends list, per-friend conversation threads.
- **Note**: This feature uses WebSockets, NOT Datastar/SSE, because chat requires bidirectional real-time communication.

---

## Deployment

- Deploy backend on a VPS (e.g., your existing VPS).
- AdonisJS serves both the API and the frontend (server-rendered pages with Datastar).
- Set up HTTPS (required for service workers and Web Push).
- Generate VAPID keys once and store in `.env`.
- Run SQLite on the same VPS (single-file database, no separate DB server needed).
- Use PM2 or systemd to keep the AdonisJS process running.

---

## Key Dependencies

| Package        | Purpose                                    |
|----------------|--------------------------------------------|
| `@adonisjs/core` | Framework                                |
| `@adonisjs/lucid` | ORM + migrations                        |
| `@adonisjs/mail` | Magic link emails                        |
| `@adonisjs/session` | Session management                    |
| `web-push`     | VAPID-based Web Push notifications         |
| `datastar`     | Frontend SSE-driven reactivity (CDN script tag) |
| `better-sqlite3` or `sqlite3` | SQLite driver for Lucid       |