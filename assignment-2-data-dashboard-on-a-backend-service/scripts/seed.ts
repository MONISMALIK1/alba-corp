/**
 * Seeds two demo users, each with their own project and tasks, so a reviewer
 * can log in immediately and — more importantly — so the RLS policies (see
 * CLAUDE.md "Security model") have two separate owners to test cross-user
 * access against.
 *
 * Uses the Supabase service role key, which bypasses RLS — that's expected
 * and correct for a trusted seed script, never for application code.
 *
 * Idempotent: safe to re-run — skips anything that already exists.
 *
 * Usage: npm run seed   (reads .env.local)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient, type User } from "@supabase/supabase-js";
import type { Database, TaskPriority, TaskStatus } from "../src/lib/database.types";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name} in .env.local. Copy .env.example to .env.local and fill it in ` +
        `(see README.md "Setup from zero").`
    );
  }
  return value;
}

const supabase = createClient<Database>(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const DEMO_USERS = [
  { email: "demo.a@taskboard.dev", password: "DemoPass123!", name: "Demo User A" },
  { email: "demo.b@taskboard.dev", password: "DemoPass123!", name: "Demo User B" },
] as const;

async function ensureUser(u: (typeof DEMO_USERS)[number]): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { name: u.name },
  });
  if (!error && data.user) {
    console.log(`  created user: ${u.email}`);
    return data.user.id;
  }

  // Already exists — look it up instead of failing.
  let page = 1;
  for (;;) {
    const res = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (res.error) throw res.error;
    const users = res.data.users as User[];
    const existing = users.find((user) => user.email === u.email);
    if (existing) {
      console.log(`  exists:  user ${u.email}`);
      return existing.id;
    }
    if (users.length < 200) break;
    page += 1;
  }
  throw new Error(`Could not create or find user ${u.email}: ${error?.message}`);
}

async function ensureProject(
  ownerId: string,
  data: { name: string; description: string; color: string }
): Promise<string> {
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("name", data.name)
    .maybeSingle();
  if (existing) {
    console.log(`  exists:  project ${data.name}`);
    return existing.id;
  }
  const { data: row, error } = await supabase
    .from("projects")
    .insert({ ...data, owner_id: ownerId })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`  created: project ${data.name}`);
  return row.id;
}

async function ensureTask(
  ownerId: string,
  projectId: string,
  data: { title: string; status: TaskStatus; priority: TaskPriority }
): Promise<void> {
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("project_id", projectId)
    .eq("title", data.title)
    .maybeSingle();
  if (existing) {
    console.log(`  exists:  task ${data.title}`);
    return;
  }
  const { error } = await supabase
    .from("tasks")
    .insert({ ...data, project_id: projectId, owner_id: ownerId });
  if (error) throw error;
  console.log(`  created: task ${data.title}`);
}

async function main() {
  console.log("Seeding demo users...");
  const [userAId, userBId] = await Promise.all(DEMO_USERS.map(ensureUser));

  console.log("Seeding demo project + tasks for User A...");
  const projectAId = await ensureProject(userAId, {
    name: "Website Relaunch",
    description: "Marketing site redesign",
    color: "#6366f1",
  });
  for (const t of [
    { title: "Audit current site content", status: "done", priority: "medium" },
    { title: "Design new homepage", status: "in_progress", priority: "high" },
    { title: "Write launch announcement", status: "todo", priority: "low" },
    { title: "Set up analytics", status: "todo", priority: "medium" },
  ] as const) {
    await ensureTask(userAId, projectAId, t);
  }

  console.log("Seeding demo project + tasks for User B...");
  const projectBId = await ensureProject(userBId, {
    name: "Mobile App v2",
    description: "Native app rewrite",
    color: "#f97316",
  });
  for (const t of [
    { title: "Migrate auth to new backend", status: "in_progress", priority: "high" },
    { title: "QA pass on iOS", status: "todo", priority: "medium" },
    { title: "Submit to App Store", status: "todo", priority: "high" },
  ] as const) {
    await ensureTask(userBId, projectBId, t);
  }

  console.log("\nDemo credentials (also documented in README.md):");
  for (const u of DEMO_USERS) console.log(`  ${u.email} / ${u.password}`);
  console.log(
    "\nTo verify RLS: log in as demo.a@taskboard.dev and confirm you cannot see or modify"
  );
  console.log("'Mobile App v2' or any of User B's tasks.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
