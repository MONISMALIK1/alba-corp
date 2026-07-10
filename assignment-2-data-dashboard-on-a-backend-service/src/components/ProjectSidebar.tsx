"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";

const COLORS = ["#6366f1", "#f97316", "#10b981", "#ec4899", "#0ea5e9"];

export function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelect,
  onAdd,
  onDelete,
  taskCounts,
}: {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  onAdd: (data: { name: string; color: string }) => Promise<void>;
  onDelete: (id: string) => void;
  taskCounts: Map<string, number>;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const color = COLORS[projects.length % COLORS.length];
      await onAdd({ name: name.trim(), color });
      setName("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 border-r border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Projects
      </h2>

      <ul className="flex flex-col gap-1">
        {projects.map((project) => (
          <li key={project.id} className="group flex items-center gap-1">
            <button
              onClick={() => onSelect(project.id)}
              className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                selectedProjectId === project.id
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="flex-1 truncate">{project.name}</span>
              <span className="text-xs opacity-60">{taskCounts.get(project.id) ?? 0}</span>
            </button>
            <button
              onClick={() => onDelete(project.id)}
              aria-label="Delete project"
              className="shrink-0 px-1 text-xs text-zinc-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
        {projects.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            No projects yet.
          </p>
        )}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="New project name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Add project
        </button>
      </form>
    </aside>
  );
}
