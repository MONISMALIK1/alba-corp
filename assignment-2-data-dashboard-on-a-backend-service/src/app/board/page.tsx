"use client";

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { AuthGuard } from "@/components/AuthGuard";
import { KanbanColumn } from "@/components/KanbanColumn";
import { Nav } from "@/components/Nav";
import { NewTaskForm } from "@/components/NewTaskForm";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { useAuth } from "@/lib/auth-context";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";
import { useBoardData } from "@/lib/use-board-data";

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.some((s) => s.id === value);
}

function BoardContent() {
  const { user } = useAuth();
  const {
    projects,
    tasksByProject,
    loading,
    selectedProjectId,
    setSelectedProjectId,
    addProject,
    removeProject,
    addTask,
    moveTask,
    removeTask,
  } = useBoardData(user?.id);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const selectedTasks = selectedProjectId ? tasksByProject.get(selectedProjectId) ?? [] : [];
  const taskCounts = new Map(
    projects.map((p) => [p.id, (tasksByProject.get(p.id) ?? []).length])
  );

  function handleDragEnd(event: DragEndEvent) {
    const status = event.over?.id;
    if (typeof status !== "string" || !isTaskStatus(status)) return;
    moveTask(String(event.active.id), status);
  }

  return (
    <div className="flex flex-1">
      <ProjectSidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelect={setSelectedProjectId}
        onAdd={addProject}
        onDelete={removeProject}
        taskCounts={taskCounts}
      />

      <main className="flex flex-1 flex-col gap-4 overflow-x-auto p-6">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading board...</p>
        ) : !selectedProjectId ? (
          <p className="text-sm text-zinc-500">Create a project to get started.</p>
        ) : (
          <>
            <NewTaskForm
              onAdd={(data) => addTask({ ...data, projectId: selectedProjectId })}
            />
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="flex flex-1 gap-4">
                {TASK_STATUSES.map((s) => (
                  <KanbanColumn
                    key={s.id}
                    status={s.id}
                    label={s.label}
                    tasks={selectedTasks.filter((t) => t.status === s.id)}
                    onDeleteTask={removeTask}
                  />
                ))}
              </div>
            </DndContext>
          </>
        )}
      </main>
    </div>
  );
}

export default function BoardPage() {
  return (
    <AuthGuard>
      <Nav />
      <BoardContent />
    </AuthGuard>
  );
}
