import { PosterHero } from "./PosterHero";
import { CastRow } from "./CastRow";
import { ProvidersPanel } from "./ProvidersPanel";
import { SoundtrackPanel } from "./SoundtrackPanel";
import type { MovieDetail } from "@/lib/types";

export function MovieDetailContent({ movie }: { movie: MovieDetail }) {
  const meta = [
    movie.releaseYear,
    movie.runtime ? `${movie.runtime} min` : null,
    movie.genres.length > 0 ? movie.genres.join(", ") : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-8 sm:flex-row">
        <PosterHero movie={movie} />
        <div className="flex-1">
          <h1 className="font-[family-name:var(--font-display)] text-3xl italic tracking-tight text-zinc-50 sm:text-4xl">
            {movie.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">{meta.join(" · ")}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300">
            {movie.overview || "No overview available."}
          </p>
          {movie.trailerKey && (
            <a
              href={`https://www.youtube.com/watch?v=${movie.trailerKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
            >
              Watch trailer
            </a>
          )}
        </div>
      </div>

      <CastRow cast={movie.cast} />
      <ProvidersPanel providers={movie.providers} />
      <SoundtrackPanel movieId={movie.id} movieTitle={movie.title} />
    </div>
  );
}
