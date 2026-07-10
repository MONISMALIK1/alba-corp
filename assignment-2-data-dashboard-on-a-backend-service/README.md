# Data Dashboard on a Backend Service — TaskBoard

Assignment 2 in [alba-corp](../README.md). A small project/task board (Trello/Linear-lite) built
on Supabase. Users create **Projects**, each Project holds **Tasks** on a kanban board (To Do /
In Progress / Done), and a Dashboard page charts the data.

Three docs cover different angles of this project:
- **This README** — what it is, how the schema/auth/security work, and setup from zero.
- [**CLAUDE.md**](./CLAUDE.md) — the design spec: backend choice and why, full schema, the
  security model, and the assignment checklist this project is scoped against.
- [**BUILD_LOG.md**](./BUILD_LOG.md) — the process journal: decisions and trade-offs made while
  building, hard parts, how correctness was verified, and known limitations.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Auth, Postgres, Realtime) — see "Backend choice" below
- `@dnd-kit` for the kanban drag-and-drop
- `recharts` for the dashboard charts

## Backend choice: Supabase

Chosen because it's Postgres underneath: the schema and the security boundary are both real SQL —
`supabase/migrations/0001_init.sql` has `create table` and `create policy` statements, no
proprietary permissions API to learn. Row Level Security (RLS) is Postgres's native
access-control mechanism and a natural fit for "a task belongs to a project belongs to a user."
Auth and Realtime (Postgres logical replication over websockets) live in the same project, so
this is still one BaaS, not several stitched together.

## Data model

```
auth.users (Supabase Auth)
  └── projects (1) ──── (many) tasks
```

Full SQL: [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).

**`public.projects`** — `id` (uuid, pk), `name` (text, required), `description` (text, optional),
`color` (text, hex), `owner_id` (uuid, FK → `auth.users.id`), `created_at`/`updated_at`

**`public.tasks`** — `id` (uuid, pk), `project_id` (uuid, FK → `projects.id`, cascade delete),
`title` (text, required), `description` (text, optional), `status` (`todo` / `in_progress` /
`done`), `priority` (`low` / `medium` / `high`), `due_date` (date, optional), `owner_id` (uuid,
FK → `auth.users.id`), `created_at`/`updated_at`

## Authentication

Auth is entirely delegated to Supabase's built-in Auth service (GoTrue) — no custom password
hashing, session, or token code anywhere in this app:

- **Provider**: email/password, via `@supabase/supabase-js`'s `auth` module.
- **Sign up**: `supabase.auth.signUp({ email, password, options: { data: { name } } })` —
  [`src/lib/auth-context.tsx`](./src/lib/auth-context.tsx). By default a new Supabase project
  requires email confirmation before the account can log in (see the note under "Setup from
  zero").
- **Log in**: `supabase.auth.signInWithPassword({ email, password })`, same file.
- **Session**: `supabase-js` stores the session (a JWT access token + refresh token) in the
  browser's `localStorage` and refreshes it automatically in the background — the app never
  touches tokens directly. On load, `supabase.auth.getSession()` restores any existing session,
  and `supabase.auth.onAuthStateChange(...)` keeps a React context (`AuthProvider`/`useAuth` in
  the same file) in sync with login/logout events.
- **Route protection**: [`src/components/AuthGuard.tsx`](./src/components/AuthGuard.tsx) reads
  that context and redirects to `/login` if there's no session; `/board` and `/dashboard` are
  wrapped in it.
- **Log out**: `supabase.auth.signOut()`, wired to the "Log out" button in
  [`src/components/Nav.tsx`](./src/components/Nav.tsx).
- **Identifying the user for data ownership**: every row's `owner_id` is set from the
  authenticated user's `auth.uid()` — either by the client passing the current session's
  `user.id` on insert ([`src/lib/api.ts`](./src/lib/api.ts)), or by Postgres's own
  `default auth.uid()` on the column (see the migration). RLS policies then check
  `owner_id = auth.uid()` against the same verified JWT Supabase already validated — see
  "Security model" below.
- **Demo users**: created via the Auth **Admin API**
  (`supabase.auth.admin.createUser({ email, password, email_confirm: true })`) in
  [`scripts/seed.ts`](./scripts/seed.ts), using the service-role key so they're pre-confirmed and
  can log in immediately without the email-confirmation step.

## Security model — Row Level Security is the boundary

- Both tables have RLS enabled with four policies each (`select`/`insert`/`update`/`delete`), all
  `using (owner_id = auth.uid())` / `with check (owner_id = auth.uid())`. There is no broader
  grant anywhere — a user can only ever see or mutate rows they own. This is enforced by Postgres
  itself in the query planner, not by application code in [`src/lib/api.ts`](./src/lib/api.ts) —
  even a bug in the UI can't leak another user's row.

**How this was verified:** ran `npm run seed` to create two separate demo users
(`demo.a@taskboard.dev`, `demo.b@taskboard.dev`), each owning their own project and tasks. Logged
in as User A in the browser and confirmed:
1. The Board and Dashboard only ever show User A's project (`Website Relaunch`) — User B's
   project (`Mobile App v2`) never appears in any query result.
2. Calling `supabase.from('tasks').select().eq('id', <userBsTaskId>)` from the browser console
   while authenticated as User A returns an empty array, not User B's row — Postgres RLS filters
   it out at the row level regardless of how the query is shaped.

## Advanced features (beyond baseline auth)

1. **Row Level Security** — see above.
2. **Real-time updates** — the Board subscribes to `postgres_changes` on the `tasks` table
   (filtered to the signed-in user's `owner_id`) via Supabase Realtime
   ([`src/lib/use-board-data.ts`](./src/lib/use-board-data.ts)); moving a card or adding a task
   updates every open tab/session live, no manual refresh. RLS still gates what a realtime
   subscription can receive.

## Setup from zero

1. Create a free [Supabase](https://supabase.com) project.
2. Apply the schema — either:
   - Supabase CLI: `npx supabase link --project-ref <your-project-ref>` then
     `npx supabase db push`, or
   - paste the contents of `supabase/migrations/0001_init.sql` into the Supabase Dashboard's
     SQL Editor and run it.
3. Clone this repo, then:
   ```bash
   cd taskboard-supabase
   npm install
   cp .env.example .env.local
   ```
4. Fill in `.env.local` (Project Settings → API in the Supabase dashboard):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only, used by `scripts/seed.ts` only, never sent to
     the browser
5. Seed two demo users + sample projects/tasks (idempotent, safe to re-run):
   ```bash
   npm run seed
   ```
6. Run the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, sign up for a new account or log in with a demo account below.

Note: by default a new Supabase project requires email confirmation for `auth.signUp`. The seed
script creates demo users with `email_confirm: true` so they can log in immediately; if you sign
up your own account through the UI, either confirm via the email Supabase sends, or turn off
"Confirm email" under Authentication → Providers → Email in the Supabase dashboard for local
testing.

## A way in — demo credentials

After running `npm run seed`:

| Email | Password |
|---|---|
| `demo.a@taskboard.dev` | `DemoPass123!` |
| `demo.b@taskboard.dev` | `DemoPass123!` |

Each has their own project and tasks — log in as both (e.g. in separate browser profiles) to see
the RLS boundary hold: neither can see the other's data.

## Deploying (Railway)

This app lives in a subfolder of the `alba-corp` monorepo, so Railway needs to be told where to
build from:

1. In the Railway dashboard: **New Project → Deploy from GitHub repo** → select `alba-corp`.
2. Under the new service's **Settings → Source**, set **Root Directory** to
   `assignment-2-data-dashboard-on-a-backend-service`.
3. Under **Settings → Build**, Railway's Nixpacks builder auto-detects Next.js and runs
   `npm install` then `npm run build`; the start command is `npm start` (`next start`, which
   respects Railway's injected `PORT` automatically).
4. Under **Variables**, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   `SUPABASE_SERVICE_ROLE_KEY` and `npm run seed` are only needed locally against your Supabase
   project to seed demo data — not part of the deployed app, don't set it on Railway.
5. Deploy. Railway assigns a public URL under **Settings → Networking → Generate Domain**.

## Services used

- **Auth** — Supabase email/password auth
- **Database** — Postgres, `projects` and `tasks` tables, Row Level Security
- **Realtime** — live task updates on the Board via `postgres_changes`
