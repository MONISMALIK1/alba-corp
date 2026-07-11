import { MovieDetailContent } from "@/components/MovieDetailContent";
import { MovieModal } from "@/components/MovieModal";
import { ErrorState } from "@/components/ErrorState";
import { movieDetail } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/types";

export default async function InterceptedMoviePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let movie: MovieDetail | null = null;
  try {
    movie = await movieDetail(id);
  } catch (err) {
    console.error(`Movie modal failed for id=${id}:`, err);
  }

  return (
    <MovieModal>
      {movie ? (
        <MovieDetailContent movie={movie} />
      ) : (
        <div className="p-10">
          <ErrorState message="Couldn't load this movie. It may not exist, or the movie database is unreachable." />
        </div>
      )}
    </MovieModal>
  );
}
