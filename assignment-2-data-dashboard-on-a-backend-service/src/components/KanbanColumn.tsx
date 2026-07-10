"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Task, TaskStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";

export function KanbanColumn({
  status,
  label,
  tasks,
  onDeleteTask,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onDeleteTask: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-zinc-100 dark:bg-zinc-900/60">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-40 flex-1 flex-col gap-2 rounded-lg p-2 transition-colors ${
          isOver ? "bg-indigo-100/60 dark:bg-indigo-900/20" : ""
        }`}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onDelete={onDeleteTask} />
        ))}
      </div>
    </div>
  );
}
