import { MovieExplorer } from "@/components/MovieExplorer";
import { popularMovies, searchMovies } from "@/lib/tmdb";
import type { MovieSearchResult } from "@/lib/types";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let initialResult: MovieSearchResult = { results: [], page: 1, totalPages: 1 };
  let initialError: string | undefined;
  try {
    initialResult = query ? await searchMovies(query) : await popularMovies();
  } catch (err) {
    console.error("Initial movie load failed:", err);
    initialError = "Couldn't reach the movie database. Please try again.";
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl italic tracking-tight text-zinc-50">
          ReelScore
        </h1>
        <p className="text-sm text-zinc-500">
          Movies, their soundtracks, and where to stream them.
        </p>
      </header>
      <MovieExplorer
        initialResult={initialResult}
        initialQuery={query}
        initialError={initialError}
      />
    </main>
  );
}
