import Link from "next/link";
import { MovieDetailContent } from "@/components/MovieDetailContent";
import { ErrorState } from "@/components/ErrorState";
import { movieDetail } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/types";

export default async function MoviePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let movie: MovieDetail | null = null;
  try {
    movie = await movieDetail(id);
  } catch (err) {
    console.error(`Movie detail page failed for id=${id}:`, err);
  }

  if (!movie) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <ErrorState message="Couldn't load this movie. It may not exist, or the movie database is unreachable." />
        <Link href="/" className="mt-4 inline-block text-sm text-amber-400 hover:underline">
          ← Back to movies
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-5xl px-6 pt-6">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back to movies
        </Link>
      </div>
      <MovieDetailContent movie={movie} />
    </div>
  );
}
