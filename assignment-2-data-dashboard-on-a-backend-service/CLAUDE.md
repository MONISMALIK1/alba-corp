# CLAUDE.md — TaskBoard (Supabase)

Guidance for Claude Code when working in this repo. This project is a submission for the
"structured multi-entity dashboard" assignment — see [Assignment brief](#assignment-brief) below.

## What this is

A small project/task board (Trello/Linear-lite): users create **Projects**, each Project
contains **Tasks** on a kanban board (To Do / In Progress / Done), with a dashboard of charts
(status breakdown, tasks per project, completion trend). Two related entities, real CRUD,
real-time board updates, and a genuine security boundary between users' data.

## Backend choice: Supabase

Chosen (over Appwrite/Convex) because it's Postgres underneath, so the schema and the security
boundary are both expressed as real SQL: a migration file with `create table` and `create policy`
statements — no separate proprietary permissions API. Row Level Security (RLS) is Postgres's
native access-control mechanism, and it's a first-class fit here: "a task belongs to a project
belongs to a user" is exactly the shape RLS policies scoped to `auth.uid()` are built for.
Supabase also bundles Auth and Realtime (Postgres logical replication over websockets) in the
same project, so this is still a single BaaS, not multiple stitched-together services.

Do not swap backends mid-project. If a limitation forces a rethink, stop and raise it rather than
quietly reaching for something else.

## Data model

Two entities, one-to-many:

```
auth.users (Supabase Auth)
  └── projects (1) ──── (many) tasks
```

Full SQL in [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).

**`public.projects`**
| column | type | notes |
|---|---|---|
| `id` | uuid, pk | `default gen_random_uuid()` |
| `name` | text, required | |
| `description` | text | optional |
| `color` | text | hex, for board UI |
| `owner_id` | uuid, required | FK → `auth.users.id`, `default auth.uid()` |
| `created_at` / `updated_at` | timestamptz | `updated_at` kept current by trigger |

**`public.tasks`**
| column | type | notes |
|---|---|---|
| `id` | uuid, pk | `default gen_random_uuid()` |
| `project_id` | uuid, required | FK → `projects.id`, `on delete cascade` |
| `title` | text, required | |
| `description` | text | optional |
| `status` | text, check | `todo` \| `in_progress` \| `done` |
| `priority` | text, check | `low` \| `medium` \| `high` |
| `due_date` | date | optional |
| `owner_id` | uuid, required | FK → `auth.users.id`, `default auth.uid()` |
| `created_at` / `updated_at` | timestamptz | `updated_at` kept current by trigger |

Charts are computed client-side (`useMemo` over data RLS already scoped to the signed-in user):
status breakdown (pie), tasks per project (bar), tasks completed per day (line/burndown).

## Security model — RLS is the boundary

- Auth: Supabase email/password.
- Both tables have `alter table ... enable row level security;` plus four policies each
  (`select`/`insert`/`update`/`delete`, all `using (owner_id = auth.uid())`). There is no
  broader grant anywhere — a user can only ever see or mutate rows where `owner_id` is their own
  `auth.uid()`. This is enforced by Postgres itself inside the query planner, not by application
  code, so a bug in the UI or a hand-crafted request can't leak another user's row.
- **Verify the boundary, don't just assume it**: seed two demo users, log in as User A, confirm
  User A cannot see or modify User B's projects or tasks in the UI, and confirm that a direct
  `supabase.from('tasks').select().eq('id', <userBsTaskId>)` call while authenticated as User A
  returns an empty result (RLS silently filters, per Postgres RLS semantics — Supabase doesn't
  throw an authorization error for a filtered-out row, it just isn't in the result set). Record
  exactly how this was tested in `BUILD_LOG.md`.

## Advanced features (beyond baseline auth)

Baseline = Auth. This project also does:
1. **Row Level Security** — see above.
2. **Real-time updates** — the Board subscribes to `postgres_changes` on the `tasks` table
   (filtered to `owner_id=eq.<uid>`) via Supabase Realtime, so drag/drop status changes and new
   tasks appear live across open sessions without a manual refresh. RLS still gates what a
   client's realtime subscription can receive.

Stretch if time allows: Supabase Storage (task attachments) or a Postgres function / view for
server-computed analytics instead of client-side aggregation.

## Tech stack

- Next.js (React) + TypeScript
- `@supabase/supabase-js` for Auth/Database/Realtime
- Tailwind for styling
- `@dnd-kit` for the kanban drag-and-drop
- `recharts` for the dashboard
- Deploy target: Vercel

## Project structure

```
taskboard-supabase/
  README.md                    # setup from zero, local + Supabase provisioning
  BUILD_LOG.md                 # process journal
  supabase/
    migrations/0001_init.sql   # schema + RLS policies + realtime publication, schema-as-code
  src/
    app/                       # Next.js routes: /login, /signup, /board, /dashboard
    components/
    lib/
      supabase.ts              # browser client init
      database.types.ts        # hand-written types matching the migration (regenerate via CLI if linked)
      types.ts                 # app-facing Project/Task aliases
      api.ts                   # typed CRUD wrappers
      auth-context.tsx         # React auth context (Supabase session)
      use-board-data.ts        # data loading + postgres_changes realtime subscription
  scripts/
    seed.ts                    # seeds 2 demo users + sample projects/tasks (service role)
```

## Setup from zero (fill in as built)

1. Create a free [Supabase](https://supabase.com) project.
2. Run the SQL in `supabase/migrations/0001_init.sql` — via `npx supabase db push` (if you have
   the CLI linked) or by pasting it into the Supabase Dashboard's SQL Editor.
3. Copy `.env.example` → `.env.local`, fill in `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
4. `npm install && npm run dev`.
5. `npm run seed` — creates 2 demo users + sample projects/tasks (used for the RLS boundary
   check above). Demo login credentials are documented in `README.md` so a reviewer can log in
   without any setup.

## Deliverables checklist (map to assignment)

- [ ] Live URL (Vercel)
- [ ] Source repo with README.md (setup from zero + demo credentials)
- [ ] `BUILD_LOG.md` (goal/scope, stack, decisions & trade-offs, hard parts, how verified,
      known limitations, time spent)
- [ ] Backend choice + why (this file)
- [ ] Full schema (this file + `supabase/migrations/0001_init.sql`)
- [ ] Services used (Auth, Database/Postgres, Realtime)
- [ ] Advanced feature verification, especially the RLS boundary test
- [ ] Seed script / demo credentials for a reviewer to log in without setup

## Conventions

- No emojis in README/BUILD_LOG/UI copy.
- Keep the schema to these two entities — don't add a third (e.g. "Comments") unless there's
  time left after the checklist above is fully done.
- Don't hand-roll auth or permission checks in application code as a substitute for RLS — the
  boundary must be enforced by Postgres policies, not just hidden in the UI. `scripts/seed.ts` is
  the one legitimate exception (it uses the service role key, which intentionally bypasses RLS).

---

## Assignment brief

Pick a topic with naturally structured, multi-entity data and build a dashboard to manage and
visualise it (resolved above: project/task board). Backend: Supabase (resolved above, Postgres +
RLS). Auth is the baseline for the advanced part; strongest submissions do auth + RLS + one more
(real-time, chosen here), and explain how the security boundary was checked.

### BUILD_LOG.md template (copy into that file)

```markdown
# Build Log: TaskBoard (Supabase)

## Goal & scope decision
- What I chose to build and why. What I deliberately left out to fit the time-box.

## Stack & tooling
- Frameworks, libraries, BaaS, AI tools I used and why.

## Key decisions & trade-offs
- Decision: ... because ... (alternative considered: ...)

## Hard parts / dead ends
- What fought back, and how I got past it (or worked around it).

## How I verified it works
- What I tested, edge cases checked, anything automated, what I'd add with more time.

## Known limitations
- Honest list of bugs, shortcuts, or things I'd do differently.

## Time spent
- Rough breakdown by phase.
```
