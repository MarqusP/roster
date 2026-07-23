# The Roster — Technical Reference

This is the deep-dive doc: how the system is put together, the data model, every
API endpoint, the security model, and the full environment variable list. For
"how do I install and deploy this," see the [README](../README.md) instead —
this doc assumes that's already done and explains *why* things are built the
way they are.

## Contents

- [System overview](#system-overview)
- [Data model (Firestore)](#data-model-firestore)
- [Auth & authorization model](#auth--authorization-model)
- [API endpoints](#api-endpoints)
- [Scheduled sending flow](#scheduled-sending-flow)
- [Frontend structure](#frontend-structure)
- [Environment variables (full reference)](#environment-variables-full-reference)
- [Local development](#local-development)
- [Known limitations & deliberate tradeoffs](#known-limitations--deliberate-tradeoffs)

---

## System overview

This is a static Vite + React single-page app, backed directly by Firebase from
the browser (no app-owned database server), plus a handful of Vercel
serverless functions for the three things a browser can't safely do itself:
call a paid AI API, send email through a provider, and schedule a future
delivery.

```
┌─────────────────────────┐
│  Browser (Vite + React) │
│  src/                   │
└───────────┬─────────────┘
            │  Firebase SDK (Auth + Firestore), direct from the browser
            ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│  Firebase                │        │  Vercel Serverless Fns   │
│  - Auth (Google sign-in) │◄──────►│  api/*.js                │
│  - Firestore (all data)  │  ID    │  - draft-email.js         │
└─────────────────────────┘  token  │  - send-email.js          │
                              verify│  - schedule-email.js      │
                                    │  - send-scheduled-email.js│
                                    │  - cancel-scheduled-email.js│
                                    └──────┬──────┬──────┬──────┘
                                           │      │      │
                                    Anthropic  Resend  Upstash QStash
                                     API        API      API
```

There is no app-owned backend database or server process — Firestore *is* the
database, reached directly from the browser via the client SDK, governed by
[`firestore.rules`](../firestore.rules). The Vercel functions are stateless
and exist only to hold secrets (API keys) that must never reach the browser,
or to do things a static site can't (accept a signed webhook from QStash).

---

## Data model (Firestore)

One database, five top-level collections. There are no subcollections.

| Collection | Doc ID | Written by | Purpose |
|---|---|---|---|
| `alumni` | auto-ID | any signed-in member (create/update); admins only (delete) | The shared roster. One doc per alum. |
| `settings` | fixed: `main` | any signed-in member (gated to admins in the UI, not the rules) | Chapter-wide settings — currently just `chapterName`. |
| `admins` | the member's Firebase `uid` | nobody via the client — added manually in the Firebase console | Existence-only marker: if a doc exists at `admins/{uid}`, that uid is an admin. Content doesn't matter. |
| `users` | the member's `uid` | that member only | Each member's own private profile + progress (see shape below). |
| `scheduledEmails` | random UUID (generated server-side) | `api/schedule-email.js` (create); `api/send-scheduled-email.js` and `api/cancel-scheduled-email.js` (status update only) | Metadata for pending "send later" emails, for the in-app list/cancel UI only — **not** the source of truth for whether the email actually sends (QStash is). |

### `alumni/{id}`

Populated by CSV import ([`src/utils/csv.js`](../src/utils/csv.js) `FIXED_COLUMNS`) or the manual-add form in [`ImportModal.jsx`](../src/components/ImportModal.jsx).

```
name, email, company, title, industry, location, gradYear, linkedin: string
createdAt: server timestamp
```
`seq` (the "No. 001" roll number shown in the UI) is **not stored** — it's computed client-side in [`useAlumni.js`](../src/hooks/useAlumni.js) as the index of each doc in `orderBy("createdAt")`, so it's really "order imported," not a stable ID.

### `users/{uid}`

Written via [`useUserData.js`](../src/hooks/useUserData.js). Two top-level fields, merged independently so updating one never clobbers the other:

```
myInfo: {
  name, gradYear, major: string
  resume?: { filename: string, data: string (base64 PDF), size: number, uploadedAt: ISO string }
}
outreachLog: {
  [alumniDocId]: {
    status: "not-contacted" | "contacted" | "replied" | "meeting"
    notes: string
    lastContactedDate: string (YYYY-MM-DD)
    history: [{ date, status, by }]
  }
}
```
The resume is stored **inline as base64**, not in Firebase Storage — see [Known limitations](#known-limitations--deliberate-tradeoffs) for why, and the 600KB cap this implies.

### `scheduledEmails/{id}`

```
uid: string                  -- owner, for the "my pending sends" query
to, subject, alumName: string
scheduledFor: timestamp
status: "pending" | "sent" | "failed" | "canceled"
qstashMessageId: string      -- lets cancel actually stop delivery, not just hide the row
hasResumeAttached: boolean
createdAt: timestamp
sentAt?: timestamp           -- added on successful delivery
error?: string                -- added on failed delivery
```
Notably, **the email body, subject text, and resume data are not stored here** — only enough metadata to render the "Scheduled" list. The actual payload lives inside the QStash message until delivery (see below).

---

## Auth & authorization model

- **Sign-in**: Google via Firebase Auth ([`useAuth.js`](../src/hooks/useAuth.js)). The whole app is gated behind sign-in — see the `!user` branch in [`App.jsx`](../src/App.jsx), which renders [`Landing.jsx`](../src/components/Landing.jsx) instead.
- **Client → Firestore**: governed entirely by [`firestore.rules`](../firestore.rules), enforced by Firebase itself. The client SDK calls are only as trustworthy as those rules — there is no additional server-side check for normal reads/writes.
- **Client → Vercel functions**: each function that needs to know *who* is calling verifies the Firebase ID token itself, using [`api/_lib/verify.js`](../api/_lib/verify.js)'s `verifyFirebaseToken()`. This checks the JWT against Google's public JWKS (`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`) — **no Firebase Admin SDK or service account is used anywhere in the request-serving path** (the one exception is the one-time local seed script, see below). This was a deliberate choice throughout this project to avoid a service-account secret in production.
- **Admin role**: a signed-in member is an admin if `admins/{their uid}` exists ([`useAdmin.js`](../src/hooks/useAdmin.js)). There's no in-app way to grant this — it's added manually in the Firebase console, by design (it gates the destructive "clear entire roster" action in [`ChapterSettingsModal.jsx`](../src/components/ChapterSettingsModal.jsx), plus editing the chapter name).
- **Rate limiting**: `api/_lib/verify.js`'s `makeRateLimiter(max, windowMs)` is an in-memory sliding-window limiter per uid, used independently by `draft-email.js` (20/hr), `send-email.js` (30/hr), and `schedule-email.js` (30/hr). It resets on cold start and isn't shared across concurrent Vercel instances — intentionally simple, sized to blunt casual abuse of paid APIs rather than provide hard guarantees.

---

## API endpoints

All are Vercel Serverless Functions under `api/`. Unless noted, they use the classic `(req, res)` handler style; `send-scheduled-email.js` uses the Web Standard `fetch(request)` style specifically because it needs the *exact* raw request body for signature verification (see below).

| Endpoint | Auth | Calls out to | Purpose |
|---|---|---|---|
| `POST /api/draft-email` | Firebase ID token | Anthropic API | Drafts a personalized outreach email. If the sender has a resume on file, it's attached as a PDF `document` content block (with prompt-cache `ephemeral` control, since the same resume is reused across many drafts). |
| `POST /api/send-email` | Firebase ID token | Resend API | Sends an email immediately, optionally with the resume as a real attachment. `Reply-To` is set to the sender's own Google account email. |
| `POST /api/schedule-email` | Firebase ID token | Upstash QStash + Firestore REST | Validates the target time is within professional hours, publishes the full email payload to QStash for future delivery, and writes a `scheduledEmails` metadata doc. |
| *(delivery target, not called by the client)* `POST /api/send-scheduled-email` | QStash signature (`Upstash-Signature` header) | Resend API + Firestore REST | Invoked directly by QStash at the scheduled time. Verifies the signature, sends via the same Resend logic as `send-email.js`, and marks the `scheduledEmails` doc `sent` or `failed`. |
| `POST /api/cancel-scheduled-email` | Firebase ID token | Upstash QStash + Firestore REST | Verifies the caller owns the scheduled email, cancels the QStash message so it never delivers, marks the doc `canceled`. |

Shared logic lives in `api/_lib/`:
- `verify.js` — `verifyFirebaseToken()`, `makeRateLimiter()`
- `resend.js` — `validateEmailFields()`, `buildAttachments()`, `sendViaResend()` (used by both the immediate and scheduled send paths)
- `qstash.js` — `publishToQstash()`, `cancelQstashMessage()`, `verifyQstashSignature()`
- `businessHours.js` — `isWithinProfessionalHours()`, `nextProfessionalHoursSlot()` (Mon–Fri, 9am–5pm Pacific, DST-aware via `Intl.DateTimeFormat`)

### Why some Firestore writes go through raw REST calls instead of the SDK

`schedule-email.js`, `send-scheduled-email.js`, and `cancel-scheduled-email.js` write to Firestore via plain `fetch()` to the [Firestore REST API](https://firebase.google.com/docs/firestore/reference/rest), not the `firebase-admin` SDK. Two different reasons, same underlying goal (no service account secret in production):
- `schedule-email.js` / `cancel-scheduled-email.js` already have the caller's own Firebase ID token (verified moments earlier) — they just forward that same token as the REST call's `Authorization` header, so the write is evaluated under the caller's own identity, exactly as if the browser had made it.
- `send-scheduled-email.js` has no user token at all (it's called by QStash). Its status-update write relies on the narrow, auth-agnostic Firestore rule described in [`firestore.rules`](../firestore.rules) — see the comment there for the accepted risk.

---

## Scheduled sending flow

The key architectural idea: **QStash holds the entire email, not just a wake-up timer.** The app never polls "what's due now" — it hands QStash the full `{to, subject, body, resumeData, ...}` payload once, and QStash POSTs that exact payload back to `send-scheduled-email.js` at the target time.

```
ProfilePanel "Schedule send"
  → api/schedule-email.js
      1. validates professional hours (Mon-Fri, 9am-5pm Pacific)
      2. publishToQstash({ url: .../api/send-scheduled-email, body: <full email>, notBeforeSeconds })
      3. writes scheduledEmails/{id} (status: pending) -- for the UI only

  ... time passes ...

QStash → api/send-scheduled-email.js  (at the scheduled instant)
      1. verifyQstashSignature() -- HS256 JWT in Upstash-Signature header,
         checked against QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY,
         including a SHA-256 hash of the exact raw body (tamper-proofing)
      2. sendViaResend()
      3. marks scheduledEmails/{id}.status = "sent" | "failed"

"Scheduled" button → ScheduledEmailsModal.jsx
      - live Firestore query: scheduledEmails where uid == me, status == "pending"
      - Cancel → api/cancel-scheduled-email.js → QStash message delete + Firestore status update
```

This was chosen over Vercel Cron because Vercel's free Hobby plan only runs
cron jobs once a day (Pro, at $20/mo, allows minute-level cron) — QStash's
free tier (500 msgs/day) gives exact-time delivery with no plan upgrade.

The `send-scheduled-email.js` signature verification was implemented by reading
the actual `@upstash/qstash` SDK source (not guessed from docs alone) and
round-trip tested — see this feature's design discussion for the test cases
(valid signature, tampered body, wrong destination URL, key-rotation
fallback all confirmed to behave correctly).

---

## Frontend structure

| Path | Purpose |
|---|---|
| `src/App.jsx` | Top-level layout, all modal open/close state, wires hooks to components. |
| `src/firebase.js` | Firebase app/Auth/Firestore initialization from `VITE_FIREBASE_*` env vars. |
| `src/hooks/useAuth.js` | Google sign-in/out, current user. |
| `src/hooks/useAdmin.js` | Whether the current user has an `admins/{uid}` doc. |
| `src/hooks/useAlumni.js` | Live roster query + add/import/clear-all. Gated on `uid` so it never subscribes before auth resolves (a race condition that caused a real "permission denied" bug earlier in this project — see the fix's `setError(null)` on success and the `uid` dependency). |
| `src/hooks/useSettings.js` | Chapter name (`settings/main`). |
| `src/hooks/useUserData.js` | The current member's `myInfo` + `outreachLog`. |
| `src/hooks/useScheduledEmails.js` | Live query of the current member's pending scheduled emails. |
| `src/components/Landing.jsx` | Pre-sign-in marketing/landing page. |
| `src/components/Letterhead.jsx` | Header: chapter name (admin-editable), My Info / Export / Add Alumni / Chapter Settings / Scheduled buttons, sign-out. |
| `src/components/Toolbar.jsx` | Search + filters, collapses behind a "Filters" toggle below 720px, shows an "industry data incomplete" note below a configurable coverage threshold. |
| `src/components/RosterTable.jsx` | The roster itself. |
| `src/components/ProfilePanel.jsx` | Per-alum slide-out: AI draft, resume attach, send now / schedule send, outreach status (autosaves) + notes (debounced autosave). |
| `src/components/ImportModal.jsx` | CSV import (fixed columns, no manual mapping) + manual single-add. |
| `src/components/MyInfoModal.jsx` | Name/grad year/major + resume upload (base64-encoded client-side). |
| `src/components/ChapterSettingsModal.jsx` | Admin-only: chapter roster "clear all" with typed confirmation. |
| `src/components/ScheduledEmailsModal.jsx` | List + cancel for the current member's pending scheduled sends. |
| `src/utils/csv.js` | Fixed-column CSV parsing/export. |
| `src/utils/businessHours.js` | Client-side mirror of `api/_lib/businessHours.js`, plus Pacific-time ⇄ `datetime-local` conversion helpers (see the code comments for why naive `new Date(string)` parsing would silently misinterpret the picker's value in a non-Pacific browser timezone). |
| `scripts/seed-alumni.mjs` | One-time local script (not deployed) to bulk-import a real alumni CSV using `firebase-admin` + a service account key — the only place in this repo that uses Admin SDK, and only ever run manually from a developer's machine. |

Visual design: a warm ivory/black "Serif" editorial system (Playfair Display
+ Source Sans 3 + IBM Plex Mono), with gold (`--accent`) and navy
(`--navy`) as the two AKPsi brand accents — all tokens defined in
[`src/styles.css`](../src/styles.css)'s `:root`.

---

## Environment variables (full reference)

| Variable | Where | Required for | Notes |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | `.env` + Vercel | Everything | Public client identifier, not a secret — safe in the browser bundle. |
| `VITE_FIREBASE_AUTH_DOMAIN` | `.env` + Vercel | Everything | |
| `VITE_FIREBASE_PROJECT_ID` | `.env` + Vercel | Everything | Also read server-side (no `VITE_`-only restriction) by every `api/*.js` that builds a Firestore REST URL. |
| `VITE_FIREBASE_STORAGE_BUCKET` | `.env` + Vercel | Firebase SDK init | Not actually used for file storage (resumes are inline base64) — kept because `initializeApp` expects it. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `.env` + Vercel | Everything | |
| `VITE_FIREBASE_APP_ID` | `.env` + Vercel | Everything | |
| `ANTHROPIC_API_KEY` | Vercel only (never `.env` with `VITE_`) | AI drafting | Used by `api/draft-email.js`. |
| `RESEND_API_KEY` | Vercel (and optionally local `.env` for `vercel dev`) | Sending email | Used by `api/_lib/resend.js`. |
| `RESEND_FROM_EMAIL` | same | Sending email (optional) | Defaults to Resend's shared `onboarding@resend.dev` test address if unset. |
| `QSTASH_TOKEN` | same | Scheduled sending | Auth for QStash's publish/cancel API. |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | same | Scheduled sending | Used only to *verify* inbound QStash requests (never sent anywhere) — see `api/_lib/qstash.js`. |
| `PUBLIC_APP_URL` | Vercel only (needs the real deployed URL) | Scheduled sending | Must exactly match the URL QStash is told to deliver to *and* the URL used to verify the signature's `sub` claim — a mismatch here silently breaks scheduled delivery. |

None of the server-only variables should ever be prefixed `VITE_` — that
prefix tells Vite to inline the value into the public browser bundle.

---

## Local development

```bash
npm install
npm run dev      # Vite only -- frontend works, but /api/* routes 404
npm run lint      # oxlint
npm run build     # production build
```

To exercise the `/api/*` functions locally (AI drafting, sending, scheduling),
use `npx vercel dev` instead of `npm run dev` — see the README's setup
sections for the one-time login/link prompts. Scheduled sending's actual
delivery callback still requires a public URL, so QStash can't reach a purely
local `vercel dev` instance — only the "schedule" half (the publish call) is
meaningfully testable locally.

`scripts/seed-alumni.mjs` is a standalone one-time script (not part of the
deployed app) for bulk-loading a real alumni roster from a CSV directly into
Firestore, using `firebase-admin` and a locally-downloaded service account
key. Run it manually (`node scripts/seed-alumni.mjs`) with the key present
locally, then delete the key file — it should never be committed or deployed.

---

## Known limitations & deliberate tradeoffs

These were explicit decisions made along the way, not oversights:

- **Resumes are capped at 600KB and stored as base64 inside Firestore**, not Firebase Storage. Firebase Storage now requires the paid Blaze plan even for a brand-new bucket; Firestore's 1MB document limit was judged an acceptable tradeoff given typical resume PDFs run 50–500KB. A heavily designed or image-heavy resume may not fit.
- **`scheduledEmails`'s status field is updatable without authentication** (see the rule comment in `firestore.rules`). This avoids needing a Firebase service account in the production request path. The blast radius is limited to cosmetically flipping a status field on a doc whose ID is an unguessable random UUID — no read access, no way to redirect or read the email content.
- **Rate limiting is in-memory per Vercel function instance**, not backed by Firestore or Redis. It resets on cold start and isn't shared across concurrent instances. This is sized to blunt casual abuse of paid APIs (Anthropic, Resend, QStash), not to provide hard multi-instance guarantees.
- **No `firebase-admin` / service account in the deployed app** — every server-side Firestore interaction either forwards the caller's own ID token or is restricted by a narrow field-level rule. The one exception (`scripts/seed-alumni.mjs`) is a manually-run local script, never deployed.
- **Admin role has no in-app management UI.** Granting admin means manually creating a doc at `admins/{uid}` in the Firebase console. This is intentional — it's a rare, high-trust operation for a small chapter, not worth building a UI for.
