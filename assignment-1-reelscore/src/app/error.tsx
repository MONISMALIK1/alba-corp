"use client";

import { ErrorState } from "@/components/ErrorState";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6">
      <ErrorState
        message={error.message || "Something went wrong. Please try again."}
        onRetry={reset}
      />
    </main>
  );
}
