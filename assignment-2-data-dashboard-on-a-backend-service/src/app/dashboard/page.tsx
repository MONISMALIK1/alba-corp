"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AuthGuard } from "@/components/AuthGuard";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth-context";
import { TASK_STATUSES } from "@/lib/types";
import { useBoardData } from "@/lib/use-board-data";

const STATUS_COLORS: Record<string, string> = {
  todo: "#a1a1aa",
  in_progress: "#f59e0b",
  done: "#10b981",
};

function DashboardContent() {
  const { user } = useAuth();
  const { projects, tasks, loading } = useBoardData(user?.id);

  const statusData = useMemo(
    () =>
      TASK_STATUSES.map((s) => ({
        status: s.label,
        key: s.id,
        count: tasks.filter((t) => t.status === s.id).length,
      })),
    [tasks]
  );

  const perProjectData = useMemo(
    () =>
      projects.map((p) => ({
        name: p.name,
        tasks: tasks.filter((t) => t.project_id === p.id).length,
      })),
    [projects, tasks]
  );

  const completionTrend = useMemo(() => {
    const days: { date: string; completed: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key.slice(5), completed: 0 });
    }
    const byDay = new Map(days.map((d) => [d.date, d]));
    for (const task of tasks) {
      if (task.status !== "done") continue;
      const key = task.updated_at.slice(5, 10);
      const entry = byDay.get(key);
      if (entry) entry.completed += 1;
    }
    return days;
  }, [tasks]);

  if (loading) {
    return <p className="p-6 text-sm text-zinc-500">Loading dashboard...</p>;
  }

  if (tasks.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-zinc-500">
          No data yet. Create a project and a few tasks on the Board page, or run{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">npm run seed</code>.
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {tasks.length} tasks across {projects.length} projects — your data only.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-2 text-sm font-semibold">Status breakdown</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="status"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {statusData.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-2 text-sm font-semibold">Tasks per project</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={perProjectData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="tasks" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-zinc-200 p-4 md:col-span-2 dark:border-zinc-800">
          <h2 className="mb-2 text-sm font-semibold">Tasks completed, last 14 days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={completionTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Nav />
      <DashboardContent />
    </AuthGuard>
  );
}
