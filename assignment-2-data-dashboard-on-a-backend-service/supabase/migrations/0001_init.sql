-- TaskBoard schema: two entities (projects, tasks), owner-scoped RLS, realtime on tasks.
-- Run via `supabase db push` (Supabase CLI) or paste into the Supabase Dashboard SQL Editor.
-- Idempotent-ish: uses IF NOT EXISTS / OR REPLACE where practical, but designed to run once
-- on a fresh project. Re-running after tables already exist will error on `create table`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 128),
  description text,
  color       text not null default '#6366f1',
  owner_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_projects_owner on public.projects (owner_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 256),
  description text,
  status      text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority    text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date    date,
  owner_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_tasks_owner on public.tasks (owner_id);
create index idx_tasks_project on public.tasks (project_id);

-- ---------------------------------------------------------------------------
-- keep updated_at current on every row update
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: the actual security boundary. No table-level grants
-- beyond RLS — every read/write is scoped to owner_id = auth.uid(). This is
-- enforced by Postgres itself, not application code, so it holds even if a
-- client sends a malformed or malicious query.
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.tasks enable row level security;

create policy "projects_select_own" on public.projects
  for select using (owner_id = auth.uid());
create policy "projects_insert_own" on public.projects
  for insert with check (owner_id = auth.uid());
create policy "projects_update_own" on public.projects
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "projects_delete_own" on public.projects
  for delete using (owner_id = auth.uid());

create policy "tasks_select_own" on public.tasks
  for select using (owner_id = auth.uid());
create policy "tasks_insert_own" on public.tasks
  for insert with check (owner_id = auth.uid());
create policy "tasks_update_own" on public.tasks
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "tasks_delete_own" on public.tasks
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime: broadcast row changes on tasks so the kanban board updates live.
-- RLS still applies to realtime — a client only receives change events for
-- rows it's allowed to select.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.tasks;
