# Splitzy

Splitzy helps friends, roommates, and travelers track shared costs, review item assignments, and understand suggested settlements. Group and expense calculations use integer cents. Receipt scanning uses the existing OpenAI provider and requires an authenticated account.

## What works

- **Sign-in:** Supabase email magic links. Guest mode remains available for local groups and expenses.
- **Groups:** Create groups and manage members. Signed-in groups are stored in Supabase; guest groups stay in this browser.
- **Expenses:** Add, edit, and delete itemized expenses. Item notes, per-item member assignments, tax, and tip are retained in cloud or guest storage.
- **Settlement:** Review balances and suggested transfers, copy a summary, compose editable payment reminders, and download a PDF report based on saved expenses.
- **Receipt scanning:** Upload an itemized receipt and optional payment/tip receipt, review and correct extracted details, then continue to the existing expense form to select a payer and assign each item. Scanning uses OpenAI Responses API with `OPENAI_API_KEY` on the server only. The sample receipt endpoint is development-only.

Splitzy suggests transfers; it does not send payments or claim they are complete. Cloud records are owner-scoped through Supabase RLS. Guest data stays on the current browser.

## Run locally

Requires Node.js 20.9 or newer and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project. For actual AI scanning, add `OPENAI_API_KEY` to `.env.local`; optionally override `OPENAI_RECEIPT_MODEL`. Never use a Supabase service-role key in the browser or a `NEXT_PUBLIC_` variable. `.env.local` is ignored by Git.
4. Apply the SQL migrations in `supabase/migrations/` in timestamp order to the intended Supabase environment. For receipt scanning, apply `20261115032804_receipt_scan_usage_limits.sql` before testing the paid scan endpoint. This migration has not been applied automatically. It reserves up to 5 scans per user per UTC day and 100 scans total per UTC day.
5. Start the app:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000), sign in, open a group, and choose **Scan Receipt**. Add images, review the extracted details, continue to the expense form, select a payer and item assignments, then save to settlement.

Press `Ctrl+C` in the terminal to stop the server.

## Scanner safety and limits

The scan route verifies the Supabase user server-side, checks request and image sizes/types, validates image signatures, and reserves durable per-user and global daily quota through a Supabase RPC before calling OpenAI. The OpenAI key is read only by the server route. Requests exceeding Vercel's 4.5 MB Function body cap are rejected; the client resizes and compresses supported images to stay under the app's lower request limit. Failed OpenAI calls still consume a reservation. Configure OpenAI billing limits and alerts separately; the database quota does not replace provider-side spend controls.

The usage migration is a deployment prerequisite. Until it has been reviewed and applied to the target Supabase project, the scanner endpoint fails closed and does not call OpenAI.

## Supabase setup

Review `supabase/migrations/` before applying them. Do not re-run migrations that have already been applied. Configure Supabase Auth Site URL and redirect allow-list entries for local and deployed domains. For public sign-up, configure a custom SMTP provider and appropriate abuse controls.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

## Deploying to Vercel

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only `OPENAI_API_KEY`. `OPENAI_RECEIPT_MODEL` is optional. Add values in Vercel's Environment Variables; do not prefix the OpenAI key with `NEXT_PUBLIC_`. Apply the scanner quota migration to the intended Supabase project before enabling the scan flow, and configure the Supabase Auth redirect allow-list for the public HTTPS domain. Set provider-side OpenAI spend limits and alerts.

## Git collaboration

Use separate feature branches and open pull requests to `main` for review. `feature/frontend` owns groups, expenses, assignments, calculations, settlements, and shared UX. `feature/ai-scanner` owns receipt recognition and the OpenAI integration. The integration branch connects scanned receipt review to the existing expense form. Coordinate any changes to `src/types/index.ts` before editing the shared receipt contract. See [AGENTS.md](./AGENTS.md).
