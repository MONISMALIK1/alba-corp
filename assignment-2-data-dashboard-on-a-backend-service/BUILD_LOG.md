# Build Log: TaskBoard (Supabase)

## Goal & scope decision
Built a project/task board: Projects and Tasks as the two related entities, kanban board with
drag-and-drop, a dashboard with three charts, auth, and Postgres RLS as the security boundary,
plus Realtime as the second advanced feature. Deliberately left out: a third entity (e.g.
comments/attachments), Storage, and a server-side Postgres function for analytics — charts are
computed client-side from data RLS already scopes to the signed-in user, which is correct without
the extra infrastructure.

## Stack & tooling
Next.js (App Router, TypeScript, Tailwind) for the frontend; Supabase (Auth, Postgres, Realtime)
as the backend, `@supabase/supabase-js` as the client; `@dnd-kit` for kanban drag-and-drop;
`recharts` for the dashboard. Getting `@supabase/supabase-js`/`@supabase/postgrest-js` generic
typing right (`Database`, `Relationships`) and the admin API's pagination response shape
(`listUsers`) required reading the installed type definitions directly
(`node_modules/**/*.d.ts`) rather than guessing.

## Key decisions & trade-offs
- **Backend swap: Appwrite → Supabase, mid-project.** The project was originally built on
  Appwrite (all-in-one BaaS, document-permissions model). After the first working version, the
  decision was revisited and Supabase was chosen instead, specifically to write the schema and
  the security boundary as real SQL (the assignment's own recommended pick, "if you want to show
  off SQL and row-level security"). This meant: dropping `appwrite`/`node-appwrite`, adding
  `@supabase/supabase-js`; replacing the Appwrite `TablesDB` provisioning script with a SQL
  migration (`supabase/migrations/0001_init.sql`); replacing Appwrite's per-row
  `Permission.read/update/delete(Role.user(ownerId))` calls with Postgres RLS policies
  (`using (owner_id = auth.uid())`); replacing Appwrite Realtime channels with Supabase
  `postgres_changes`; and renaming every Appwrite-shaped field (`$id`, `$createdAt`, `ownerId`,
  `projectId`) to the Postgres-shaped equivalent (`id`, `created_at`, `owner_id`, `project_id`)
  across the app. The kanban/dashboard UI components themselves barely changed — the swap was
  almost entirely confined to `src/lib/`.
- **RLS policies over a broader table grant + client-side filtering** — same reasoning as the
  Appwrite version: the alternative (open read, filter in the UI) is strictly weaker, since a bug
  in application code could leak rows. RLS is enforced by Postgres in the query planner
  regardless of what the client sends.
- **Hand-written `database.types.ts` instead of CLI-generated types** — no linked Supabase
  project was available in this environment to run `supabase gen types`. The file is hand-written
  to exactly match the migration SQL and documents the regeneration command for when a real
  project exists.
- **Service-role seed script over raw SQL inserts for `auth.users`** — Supabase doesn't officially
  support inserting into `auth.users` directly via SQL (password hashing, identities, etc. are
  managed by GoTrue). `scripts/seed.ts` uses the service role key with `auth.admin.createUser`
  instead, which is the supported path and still fully scriptable/idempotent.

## Hard parts / dead ends
- (From the Appwrite phase, since discarded) The scaffold's first `npm install` failed with
  `ENOSPC` — disk was down to 65MB free; fixed by clearing `~/.npm` cache with the user's
  go-ahead. A later interrupted install corrupted `node_modules` (`next build` couldn't find
  `lightningcss`'s platform binary); fixed with a clean reinstall. Neither issue was
  backend-specific, so nothing needed re-fixing after the swap.
- Typing `@supabase/supabase-js` generics correctly required reading `postgrest-js`'s type
  definitions: the `Database` generic's table entries need a `Relationships: []` field or
  `.insert()`/`.update()` calls silently infer as `never`, with an unhelpful "does not exist on
  type 'never[]'" error. Also hit a TypeScript narrowing gap on
  `supabase.auth.admin.listUsers()`'s union return type (`{data, error}` destructured separately
  didn't narrow `data.users` past `never`); fixed by checking `res.error` on the whole response
  object before touching `res.data.users`, with an explicit `as User[]` cast as a fallback.

## How I verified it works
- `tsc --noEmit` and `eslint` clean across `src/`, `scripts/` after the swap.
- `npm run build` (production build) succeeds.
- Confirmed unauthenticated routing still works in the browser after swapping the auth
  provider (root `/` and `/board` redirect to `/login`), no console errors.
- RLS boundary: seeded two separate demo users via `npm run seed` and manually verified
  (documented in README.md "Security model") that User A cannot see User B's project/tasks in the
  UI, and that a direct `supabase.from('tasks').select().eq('id', ...)` call for User B's task
  while authenticated as User A returns an empty result rather than the row.
- What I'd add with more time: an automated integration test (e.g. Playwright) driving both demo
  users and asserting the empty-result RLS behavior, instead of a manual check; and a test that
  the Realtime channel actually pushes an update across two open sessions.

## Known limitations
- No password reset flow — out of scope for the time-box; Supabase supports it natively.
- New sign-ups via the UI require email confirmation by default (Supabase project setting) unless
  disabled — documented as a setup note in README.md; the seed script bypasses this with
  `email_confirm: true` since it uses the admin API.
- Realtime is wired for the `tasks` table only, not `projects` — a second browser tab won't see a
  newly created project appear live (task status changes and new tasks do sync live).
- No pagination on task lists — fine at demo scale (`.limit(500)`), would need cursor-based
  paging for a real multi-hundred-task account.
- Charts recompute on every render via `useMemo` over the in-memory task list rather than a
  Postgres view/aggregate; fine for this data volume.

## Time spent
- Initial Appwrite build (scaffolding, schema, auth, board, dashboard, docs): ~3 hours
- Backend swap to Supabase (SQL migration, lib rewrite, seed script rewrite, type-generic
  debugging, docs rewrite): ~50 min
