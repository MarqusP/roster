# The Roster — Alumni Outreach

A shared alumni directory and outreach tool for fraternity/sorority chapters.
Members browse the roster, draft a personalized outreach email with AI
assistance, and keep private notes on who they've reached out to.

This README covers installing, configuring, and deploying the app. For how it's
actually built — the Firestore data model, every API endpoint, the auth/admin
security model, and the full environment variable reference — see
**[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

- **Shared roster** — one alumni directory, synced live across every member via Firebase.
- **Google sign-in required** — members sign in with Google before using the app.
- **Import from your Google Sheet** — upload a CSV export (or paste it in). Your sheet's header row must use the fixed column names (Name, Email, Company, Title, Industry, Location, Grad Year, LinkedIn) — see [`src/utils/csv.js`](./src/utils/csv.js).
- **AI-drafted emails** — pick a purpose (informational interview, referral, etc.), optionally add what you'd like to learn or connect on, and get a personalized draft. If you've uploaded a resume, the AI can reference specific details from it.
- **Resume upload** — each member can attach a PDF resume (under 600KB) in My Info, stored alongside their profile in Firestore. It's used as context for AI drafts and can be attached as a real file when sending.
- **Real email sending with attachments** — "Send email" delivers the message (and resume, if attached) directly via the server, since a `mailto:` link can't carry attachments. "Open in email app" remains as a no-setup fallback.
- **Schedule send for professional hours** — instead of sending immediately, schedule an email for a weekday between 9am–5pm Pacific. A "Scheduled" panel lists your own pending sends with a cancel option.
- **Personal outreach tracking** — each member's own "contacted / replied / meeting scheduled" notes and profile info are tied to their Google account and synced via Firestore, so they follow that member across devices (not shared with other members).

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- [Firebase Firestore](https://firebase.google.com/docs/firestore) — the shared roster database (resumes are stored inline here too, as base64 — no Firebase Storage / billing plan needed)
- [Vercel Serverless Functions](https://vercel.com/docs/functions) — `api/draft-email.js` (Anthropic API), `api/send-email.js` (Resend API), and `api/schedule-email.js` / `api/send-scheduled-email.js` / `api/cancel-scheduled-email.js` (scheduled sending via Upstash QStash) — keeping all API keys private
- [Upstash QStash](https://upstash.com/docs/qstash) — delivers a scheduled email's payload to `api/send-scheduled-email.js` at the exact target time. Chosen over Vercel Cron because Vercel's free Hobby plan only runs cron once a day; QStash's free tier (500 msgs/day) gives exact-time delivery at no cost

Nothing else is required — no separate backend server to run.

## 1. Local setup

```bash
npm install
cp .env.example .env
```

### Create a Firebase project (free)

1. Go to the [Firebase console](https://console.firebase.google.com/) → **Add project** → name it anything (e.g. "chapter-roster").
2. In the project, go to **Build → Firestore Database → Create database**. Start in **production mode** (we'll set our own rules below) and pick a nearby region.
3. Go to **Project settings → General → Your apps**, click the **</>** (web) icon, register an app (no need for Firebase Hosting), and copy the `firebaseConfig` values into your `.env` file as the matching `VITE_FIREBASE_*` variables.
4. In **Firestore Database → Rules**, replace the contents with what's in [`firestore.rules`](./firestore.rules) in this repo, then **Publish**.
   - These rules require a signed-in user for every read/write, and restrict each member's personal `users/{uid}` doc to that member only.
   - The `scheduledEmails` collection has one intentionally narrow exception: its `status`/`sentAt`/`error` fields can be updated without auth, since `api/send-scheduled-email.js` is invoked by QStash (no Firebase session) — see the comment in `firestore.rules` for why this is low-risk.
5. Go to **Build → Authentication → Get started**, then **Sign-in method → Add new provider → Google**, and enable it. Set a support email if prompted, then **Save**.
   - Also add your local/deployed domain (e.g. `localhost`, your Vercel domain) under **Authentication → Settings → Authorized domains** if it's not already listed.

### Run it

```bash
npm run dev
```

Open the printed local URL. Click **+ Add Alumni** to import your chapter's sheet (File → Download → CSV from Google Sheets, then upload it here).

## 2. AI email drafting (optional)

This feature calls the Anthropic API from a server function so your API key is never exposed to the browser. To enable it:

1. Get an API key from the [Anthropic Console](https://console.anthropic.com/).
2. When you deploy to Vercel (below), add it as an environment variable named `ANTHROPIC_API_KEY` — **do not** put it in `.env` / commit it, and don't prefix it with `VITE_`.
3. Locally, `vercel dev` will pick up a `.env` value for it too if you want to test it before deploying; without it, the "Draft with AI" button just shows a friendly error and you can write the email yourself in the same box.

## 3. Sending email with attachments (optional)

"Send email" delivers the message server-side via [Resend](https://resend.com) so a resume can be attached — a `mailto:` link has no way to carry a file. Without this set up, members can still use "Open in email app" (opens their own mail client, no attachment).

1. Create a free [Resend](https://resend.com) account and grab an API key.
2. Add it as a Vercel environment variable named `RESEND_API_KEY` (server-only — never `VITE_`-prefixed).
3. By default, emails send from `onboarding@resend.dev` (Resend's shared test domain — works immediately, no setup, sends to any recipient). For your chapter's own sending address, [verify a domain in Resend](https://resend.com/docs/dashboard/domains/introduction) and set `RESEND_FROM_EMAIL` to an address on that domain (e.g. `roster@yourchapterdomain.org`).
4. Replies go to the sending member's own email automatically (set as `Reply-To` on each send), regardless of which `from` address is used.

## 4. Scheduled sending (optional, set up after deploying)

Scheduling needs your site's real public URL, so do this step after the first deploy (below).

1. Create a free [Upstash](https://upstash.com) account → **QStash** → copy your **QSTASH_TOKEN** and, from the **Signing Keys** section, both the **current** and **next** signing keys.
2. Add three Vercel environment variables: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
3. Add a fourth: `PUBLIC_APP_URL` set to your deployed site's URL (e.g. `https://your-project.vercel.app`, no trailing slash). QStash needs this exact URL both to know where to deliver the scheduled email and to verify the delivery really came from QStash.
4. Redeploy after adding these (Vercel only picks up new env vars on a fresh deployment).
5. The first time the "Scheduled" list runs its query, Firestore may show a console error with a link to create a required composite index — click it once to create the index, then it works from then on.

Without this set up, "Schedule for later" will show a friendly error; "Send email" (immediate) and "Open in email app" are unaffected.

## 5. Publish it

### Push to your own GitHub repo

This project is already a local git repo with an initial commit. To publish it:

```bash
# On github.com, create a new empty repository (no README/license), then:
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git branch -M main
git push -u origin main
```

### Deploy to Vercel (recommended)

1. Go to [vercel.com](https://vercel.com), sign in with GitHub, and **Import** the repo you just pushed.
2. Vercel auto-detects Vite — no build config needed.
3. Before deploying, add **Environment Variables** in the Vercel project settings:
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` (same values as your `.env`)
   - `ANTHROPIC_API_KEY` (only if you want AI drafting live)
   - `RESEND_API_KEY` and, optionally, `RESEND_FROM_EMAIL` (only if you want "Send email" with attachments live)
   - `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `PUBLIC_APP_URL` (only if you want scheduled sending live — see step 4 above; `PUBLIC_APP_URL` can only be filled in once you know your `.vercel.app` URL, so add it after this first deploy and redeploy)
4. Deploy. Share the resulting `.vercel.app` link with your chapter.
5. Add the deployed domain under Firebase **Authentication → Settings → Authorized domains** (Google sign-in won't work there otherwise).

## Notes & limitations

- The roster is shared and live for everyone; each member's own "My Info" and outreach status/notes are tied to their Google account via Firestore (not shared with other members, and not lost by clearing browser data).
- Firestore's free tier comfortably covers a chapter-sized roster and normal usage.
- Resumes are capped at 600KB and stored as base64 text inside each member's Firestore doc (no Firebase Storage / billing plan required) — covers typical simple resume PDFs, but a heavily designed or image-based resume may not fit.
- Reading, adding, and editing alumni records requires being signed in; permanently clearing the whole roster additionally requires being listed in the `admins` Firestore collection (see [`firestore.rules`](./firestore.rules) — admins are added manually via the Firebase console, there's no in-app way to grant it).
