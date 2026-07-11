export function MovieCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-[2/3] animate-pulse rounded-lg bg-zinc-800" />
      <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-800" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-800" />
    </div>
  );
}

export function MovieGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <MovieCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="aspect-[2/3] w-full max-w-xs animate-pulse rounded-xl bg-zinc-800" />
        <div className="flex flex-1 flex-col gap-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-800" />
          <div className="h-24 w-full animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

export function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-zinc-800" />
      ))}
    </div>
  );
}
