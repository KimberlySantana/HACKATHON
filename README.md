# Splitzy

Splitzy helps friends, roommates, and travelers keep shared group costs clear. Create groups, add itemized expenses, assign items to people, and review settlement balances. Money calculations use integer cents.

## What works today

- **Sign-in:** Supabase email magic links. Sign-in is optional for trying guest mode.
- **Groups:** Create groups and manage members. Signed-in groups are stored in Supabase; guest groups stay in this browser.
- **Expenses:** Add, edit, and delete itemized expenses. Signed-in expenses are saved to Supabase; guest or offline expenses stay in browser storage and are kept separate from cloud records.
- **Splitting and settlement:** Assign each item to one or more members. Tax and tip are allocated proportionally with deterministic cent rounding. Settlement shows balances and suggested transfers.
- **Sample receipt:** In local development only, `GET /api/receipt` returns a sample receipt without credentials. Production receipt scanning is unavailable until the scanner is integrated.

Receipt photo upload and AI extraction are not connected to the main branch yet. The `ANTHROPIC_API_KEY` placeholder is reserved for the planned Claude scanner and is not used by the current app. There are no real payment transfers or group sharing across separate user accounts; only the account that owns a cloud group can access it.

## Run locally

You need Node.js 20.9 or newer and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`.

3. In `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` using the values from your Supabase project's API settings. The publishable key is designed for browser use. Never use a service-role or secret key in a `NEXT_PUBLIC_` variable. Keep `.env.local` private; Git ignores it.

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

To stop the server, press `Ctrl+C` in the terminal.

## Supabase setup

The SQL migrations are in `supabase/migrations/`. For a new Supabase project, review and apply them in timestamp order using the Supabase SQL Editor. They create groups, members, expenses, item splits, owner-scoped Row Level Security policies, and atomic save/delete functions. Do not re-run a migration that has already been applied. Cloud group deletion requires `20261114222848_delete_group_atomic.sql`; applying it only creates the owner-checked function, and data is deleted only after an owner confirms in the app.

For email sign-in, configure the Supabase Auth Site URL and redirect allow list for local and deployed app URLs. Supabase's default email service is for development; configure a custom SMTP provider before allowing general public sign-ups.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

## Deploying to Vercel

Vercel can detect the Next.js app and use `npm run build`. Add these variables in the Vercel project settings for each environment that needs cloud access:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Configure the production domain and any required preview URLs in Supabase Auth redirect settings. Do not add service-role keys to the frontend. Add `ANTHROPIC_API_KEY` only when the Claude scanner is implemented and its server route is ready.

## Git collaboration

Use separate feature branches and open pull requests to `main` for review. Coordinate changes to the shared receipt contract in `src/types/index.ts` before editing it. See [AGENTS.md](./AGENTS.md) for the collaboration rules.
