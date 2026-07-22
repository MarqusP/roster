# The Roster — Alumni Outreach

A shared alumni directory and outreach tool for fraternity/sorority chapters.
Members browse the roster, draft a personalized outreach email with AI
assistance, and keep private notes on who they've reached out to.

- **Shared roster** — one alumni directory, synced live across every member via Firebase.
- **Google sign-in required** — members sign in with Google before using the app.
- **Import from your Google Sheet** — upload a CSV export (or paste it in). Your sheet's header row must use the fixed column names (Name, Email, Company, Title, Industry, Location, Grad Year, LinkedIn) — see [`src/utils/csv.js`](./src/utils/csv.js).
- **AI-drafted emails** — pick a purpose (informational interview, referral, etc.) and get a personalized draft to edit and send from your own email client.
- **Personal outreach tracking** — each member's own "contacted / replied / meeting scheduled" notes and profile info are tied to their Google account and synced via Firestore, so they follow that member across devices (not shared with other members).

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- [Firebase Firestore](https://firebase.google.com/docs/firestore) — the shared roster database
- A single [Vercel Serverless Function](https://vercel.com/docs/functions) (`api/draft-email.js`) that calls the Anthropic API to draft emails, keeping your API key private

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

## 3. Publish it

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
4. Deploy. Share the resulting `.vercel.app` link with your chapter.

## Notes & limitations

- The roster is shared and live for everyone; each member's own "My Info" and outreach status/notes stay local to their browser (clearing browser data clears that member's tracking, not the shared roster).
- Firestore's free tier comfortably covers a chapter-sized roster and normal usage.
- The Firestore rules ship open/no-auth for simplicity — anyone with your deployed link and Firebase project can read and write the roster. Add Firebase Auth later if you need to restrict who can edit it.
