# Splitzy

Splitzy helps friends, roommates, and travelers track shared costs, review item assignments, and understand suggested settlements. Group and expense calculations use integer cents. AI receipt scanning is disabled in the MVP release.

## What works

- **Sign-in:** Supabase email magic links. Guest mode remains available for local groups and expenses.
- **Groups:** Create groups and manage members. Signed-in groups are stored in Supabase; guest groups stay in this browser.
- **Expenses:** Add, edit, and delete itemized expenses. Item notes, per-item member assignments, tax, and tip are retained in cloud or guest storage.
- **Settlement:** Review balances and suggested transfers, copy a summary, compose editable payment reminders, and download a PDF report based on saved expenses.
- **Receipt scanning:** Unavailable in the MVP release. The production UI points users to manual expenses and the paid API returns `503 SCANNER_DISABLED` before reading uploads or contacting OpenAI.

Splitzy suggests transfers; it does not send payments or claim they are complete. Cloud records are owner-scoped through Supabase RLS. Guest data stays on the current browser.

## Run locally

Requires Node.js 20.9 or newer and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project. Keep `ENABLE_RECEIPT_SCANNING=false`. No OpenAI key is needed for this release. `.env.local` is ignored by Git.
4. Review and apply the five group and expense SQL migrations in `supabase/migrations/` in timestamp order to the intended Supabase project before deployment. Do not apply the separate `20261115032804_receipt_scan_usage_limits.sql` for this MVP; it is needed only when scanner activation is approved. No migration is applied automatically.
5. Start the app:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000), sign in, create a group, add members, and add an expense manually. Assign each item and save, then open Settlement.

Press `Ctrl+C` in the terminal to stop the server.

## Scanner safety and limits

The paid scan route requires the server-only `ENABLE_RECEIPT_SCANNING=true` flag. With the release value `false` or an unset value, it returns `503 SCANNER_DISABLED` before reading a request body, verifying a user, reserving quota, or calling OpenAI. The release UI does not expose scanning. Do not enable the flag until a real authenticated scan, quota migration, OpenAI configuration, and spend limits are verified in a later release.

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

For the MVP, set these Vercel Production environment variables: `NEXT_PUBLIC_SUPABASE_URL` to the intended Supabase project URL, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to its publishable key, and `ENABLE_RECEIPT_SCANNING=false`. Do not set `OPENAI_API_KEY` or `OPENAI_RECEIPT_MODEL` for this release. Apply only the reviewed group and expense migrations to that same Supabase project. Configure Supabase Auth Site URL and redirect allow-list for the Vercel HTTPS domain. After both developers review and merge the release PR, import this repository in Vercel (Next.js framework, repository root), confirm the production branch is `main`, enter the variables, and deploy. No production deployment or migration is performed by this preparation.

## Git collaboration

Use separate feature branches and open pull requests to `main` for review. `feature/frontend` owns groups, expenses, assignments, calculations, settlements, and shared UX. `feature/ai-scanner` owns receipt recognition and the OpenAI integration. The integration branch connects scanned receipt review to the existing expense form. Coordinate any changes to `src/types/index.ts` before editing the shared receipt contract. See [AGENTS.md](./AGENTS.md).
