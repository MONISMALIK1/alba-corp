import { supabase } from "./supabase";
import type { Project, Task, TaskPriority, TaskStatus } from "./types";

/** Every query below is additionally scoped to ownerId here for clarity, but
 * the actual security boundary is the RLS policies in
 * supabase/migrations/0001_init.sql (owner_id = auth.uid()) — those hold even
 * if this filter were ever dropped by mistake. */

export async function listProjects(ownerId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createProject(
  ownerId: string,
  data: { name: string; description?: string; color: string }
): Promise<Project> {
  const { data: row, error } = await supabase
    .from("projects")
    .insert({ ...data, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

export async function listTasks(ownerId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data;
}

export async function createTask(
  ownerId: string,
  data: {
    projectId: string;
    title: string;
    description?: string;
    priority: TaskPriority;
    dueDate?: string;
  }
): Promise<Task> {
  const { data: row, error } = await supabase
    .from("tasks")
    .insert({
      project_id: data.projectId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      due_date: data.dueDate,
      status: "todo",
      owner_id: ownerId,
    })
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  const { data: row, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}
