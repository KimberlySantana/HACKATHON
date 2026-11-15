# Splitzy

Splitzy helps friends, roommates, and travelers track shared costs, review item assignments, and understand suggested settlements. Group and expense calculations use integer cents. AI receipt scanning is disabled in the MVP release.

## What works

- **Guest mode:** No sign-in or cloud credentials are needed. Groups and expenses save in the current browser with localStorage. Supabase email sign-in is optional when the project is configured.
- **Groups:** Create groups and manage members. Signed-in groups are stored in Supabase; guest groups stay in this browser.
- **Expenses:** Add, edit, and delete itemized expenses. Item notes, per-item member assignments, tax, and tip are retained in cloud or guest storage.
- **Settlement:** Review balances and suggested transfers, copy a summary, compose editable payment reminders, and download a PDF report based on saved expenses.
- **Receipt demo:** `/scan` previews an image locally and can show a clearly labeled sample receipt. It does not extract text or send the image anywhere. Paid AI scanning remains disabled; the API returns `503 SCANNER_DISABLED` before reading uploads or contacting OpenAI.

Splitzy suggests transfers; it does not send payments or claim they are complete. Cloud records are owner-scoped through Supabase RLS. Guest data stays on the current browser.

## Run locally

Requires Node.js 20.9 or newer and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. For the guest demo, skip environment setup. To enable optional cloud sign-in and sync, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your Supabase project. Keep `ENABLE_RECEIPT_SCANNING=false`. No OpenAI key is needed. `.env.local` is ignored by Git.
3. Start the app:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), create a group without signing in, add members, and add an expense manually. Assign each item and save, then open Settlement to copy payment requests or download a PDF. Use Receipt demo for a local photo preview and sample data.

Press `Ctrl+C` in the terminal to stop the server.

## Scanner safety and limits

The paid scan route requires the server-only `ENABLE_RECEIPT_SCANNING=true` flag. With the release value `false` or an unset value, it returns `503 SCANNER_DISABLED` before reading a request body, verifying a user, reserving quota, or calling OpenAI. The `/scan` demo page only previews an image in the browser and displays static sample data. Do not enable the paid route until its authenticated flow, quota migration, OpenAI configuration, and spend limits are verified.

The quota migration remains a prerequisite for any future scanner release. The existing auth, group ownership, RLS, and quota code remains in place behind the flag.

## Supabase setup

Review `supabase/migrations/` before applying them. Do not re-run migrations that have already been applied. Configure Supabase Auth Site URL and redirect allow-list entries for local and deployed domains. For public sign-up, configure a custom SMTP provider and appropriate abuse controls.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

## Deploying to Vercel

Guest mode works on a Vercel Preview without environment variables. Optional cloud sync needs Supabase Preview variables and the reviewed group/expense schema; it is not required for the demo. Keep the Production branch set to `main` and do not deploy this demo branch to Production. A pull request to `main` lets Vercel create a Preview when the repository is connected.

## Git collaboration

Use separate feature branches and open pull requests to `main` for review. `feature/frontend` owns groups, expenses, assignments, calculations, settlements, and shared UX. `feature/ai-scanner` owns receipt recognition and the OpenAI integration. The integration branch connects scanned receipt review to the existing expense form. Coordinate any changes to `src/types/index.ts` before editing the shared receipt contract. See [AGENTS.md](./AGENTS.md).
