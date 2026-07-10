"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Copy <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">.env.example</code>{" "}
          to <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">.env.local</code>, fill
          in your Supabase URL and anon key, then restart the dev server. See README.md for the
          full setup-from-zero steps.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
