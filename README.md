# Rohit Parashar: portfolio

A Spider-Man runner game as the landing page, a portfolio underneath, and an admin page that rebuilds the site from an uploaded resume.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` (not committed) holds the admin email, Google sign-in keys and session secret; `.env.example` lists every setting.

## Admin sign-in (Google)

Only the Google account set in `ADMIN_EMAIL` can open `/admin`. One-time setup:

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. "rohit-portfolio").
2. Search for **Google Auth Platform** → **Get started**. App name: anything; support email: your Gmail; Audience: **External**; finish the wizard.
3. **Audience** → **Test users** → add the same Google address as `ADMIN_EMAIL`. While the app stays in "Testing", only listed test users can sign in.
4. **Clients** → **Create client** → type **Web application** → under **Authorized redirect URIs** add
   `http://localhost:3000/api/auth/google/callback` (later also `https://<your-domain>/api/auth/google/callback`).
5. Copy the **Client ID** and **Client secret** right away; Google shows the secret only once.
6. Put them in `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, restart `npm run dev`, then open `/admin` → **Sign in with Google**.

Sessions last 7 days. Removing an address from `ADMIN_EMAIL` ends its sessions immediately.

## How the site works

- **Landing (`/`)**: a full-screen comic-style runner. Spider-Man web-swings over Doc Ock, Lizard and Venom, and ducks under Electro and Green Goblin. The menu has **Know about Rohit** (left, goes to the portfolio) and **Play game** (right; Space also starts it). In the game: Space/↑ to jump, S to duck (phones: tap right to jump, tap left to duck).
- **Getting to the portfolio** works at any time: scroll, swipe, press ↓ / Page Down, or click the **Portfolio ↓** button. Near the top, one scroll glides straight down. Leaving mid-run pauses the game (Resume or Space continues it).
- **Narration**: the browser's own text-to-speech reads the intro, one caption per sentence. It plays over the first run of a visit; the game-over card's "hear who's behind the mask" link replays it with Spider-Man on autopilot until Space or a tap hands over control. It stops when the visitor leaves the game; Resume or Play again continues it. A *Sound on/off* button mutes the voice and keeps the captions.
- **Portfolio**: current role, experience, projects (three highlighted, then every public GitHub repo with a language filter), skills and wins, over an interactive web background (click empty space to throw a web).

## Admin (`/admin`, linked in the footer)

| Tab | What it does |
| --- | --- |
| Resume | Upload a PDF; it is read into role, experience, education, projects, skills, wins and links. You review and edit everything, then **Publish to site**. The PDF is served at `/resume`. |
| Content | Edit any of those fields later without a new upload. |
| Narration | Edit the script, pick a preferred voice, speed and pitch, and preview it. |
| Projects | Sync repos from GitHub, choose the three highlighted projects and hide any repo. |

Notes:
- The resume reader is tuned to the LaTeX layout your resumes use (small-caps section headings, bold titles with right-aligned dates). Other layouts are read on a best-effort basis; the review step is there to fix anything misread.
- Highlighted projects default to the GitHub repos linked in the resume. A resume project whose link points to a repo supplies that card's title, bullets and stack.
- Your phone number is read from the resume but never shown on the site.
- Narration voices come from each visitor's browser (Edge's "Natural" and Chrome's "Google" voices sound best). If a visitor lacks the chosen voice, their most natural one is used.

## Where data lives

- **Live site (Vercel):** a private Vercel Blob store (`site/content.json`, `site/resume.pdf`). Content is cached and refreshed only when you publish from `/admin`, so Blob usage stays far inside the free Hobby limits.
- **Local (`npm run dev`):** `data/content.json` and `data/resume.pdf`, git-ignored because they contain personal details. Local edits do not change the live site.

## Deploying (Vercel, free Hobby plan)

Live at **https://rohit-parashar.vercel.app** (project `rohit-parashar`, functions and Blob in Mumbai, `bom1`).

- Redeploy after code changes: `npx vercel deploy --prod` in this folder.
- Production settings (Vercel → Project → Settings → Environment Variables): `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN` (added by the Blob store), optional `GITHUB_TOKEN`.
- The Google client must list `https://rohit-parashar.vercel.app/api/auth/google/callback` as an authorized redirect URI. Sign in to the admin from that address, not from a deployment-specific `*-*.vercel.app` URL.
- `.vercelignore` keeps `.env*` and `data/` out of uploads.
- Uploaded resumes are limited to 4 MB (Vercel accepts request bodies up to 4.5 MB).

## Code map

- `components/game/`: canvas runner (`engine.ts`), comic sprites (`draw.ts`), city backdrop (`scene.ts`)
- `components/landing/`: game overlays, narration, scroll lock and slide-down
- `components/portfolio/`: portfolio sections and the interactive background
- `components/admin/`: admin UI
- `lib/resume/parse.ts`: PDF to structured resume data
- `lib/github.ts`: repo list, README summaries, project cards
- `lib/auth.ts`, `lib/google.ts`, `app/api/auth/google/`: Google sign-in (PKCE, state, nonce) and the signed session cookie
- `app/dev/sprites`: dev-only sprite sheet for tweaking the art (`/dev/sprites?boxes` shows hitboxes)
