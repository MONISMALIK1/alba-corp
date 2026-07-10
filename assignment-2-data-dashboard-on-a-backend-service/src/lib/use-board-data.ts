"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import * as api from "./api";
import type { Project, Task, TaskPriority, TaskStatus } from "./types";

export function useBoardData(userId: string | undefined) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const load = useCallback(async (uid: string, cancelledRef: { cancelled: boolean }) => {
    setLoading(true);
    const [projectRows, taskRows] = await Promise.all([api.listProjects(uid), api.listTasks(uid)]);
    if (cancelledRef.cancelled) return;
    setProjects(projectRows);
    setTasks(taskRows);
    setSelectedProjectId((current) => current ?? projectRows[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const cancelledRef = { cancelled: false };
    // Fetching projects/tasks for the signed-in user on mount/user-change is
    // exactly what this effect is for; setState happens inside `load`'s
    // async body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(userId, cancelledRef);
    return () => {
      cancelledRef.cancelled = true;
    };
  }, [userId, load]);

  // Real-time: any insert/update/delete on the tasks table is pushed to us
  // live via Postgres logical replication. RLS still applies to realtime, so
  // this channel only ever delivers rows this user can select — it can't
  // leak another user's tasks.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tasks-owner-${userId}`)
      .on<Task>(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `owner_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<Task>;
            setTasks((prev) => prev.filter((t) => t.id !== oldRow.id));
            return;
          }
          const row = payload.new as Task;
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              if (prev.some((t) => t.id === row.id)) return prev;
              return [row, ...prev];
            }
            return prev.map((t) => (t.id === row.id ? row : t));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const list = map.get(task.project_id) ?? [];
      list.push(task);
      map.set(task.project_id, list);
    }
    return map;
  }, [tasks]);

  async function addProject(data: { name: string; description?: string; color: string }) {
    if (!userId) return;
    const project = await api.createProject(userId, data);
    setProjects((prev) => [project, ...prev]);
    setSelectedProjectId(project.id);
  }

  async function removeProject(projectId: string) {
    await api.deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setTasks((prev) => prev.filter((t) => t.project_id !== projectId));
    setSelectedProjectId((current) => (current === projectId ? null : current));
  }

  async function addTask(data: {
    projectId: string;
    title: string;
    priority: TaskPriority;
    description?: string;
  }) {
    if (!userId) return;
    const task = await api.createTask(userId, data);
    setTasks((prev) => [task, ...prev]);
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    await api.updateTaskStatus(taskId, status);
  }

  async function removeTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await api.deleteTask(taskId);
  }

  return {
    projects,
    tasks,
    tasksByProject,
    loading,
    selectedProjectId,
    setSelectedProjectId,
    addProject,
    removeProject,
    addTask,
    moveTask,
    removeTask,
  };
}
