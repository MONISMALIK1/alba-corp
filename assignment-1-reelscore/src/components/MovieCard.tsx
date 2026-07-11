"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import type { MovieSummary } from "@/lib/types";

export function MovieCard({ movie, index }: { movie: MovieSummary; index: number }) {
  const poster = posterUrl(movie.posterPath, "w342");

  return (
    <Link
      href={`/movie/${movie.id}`}
      className="group flex flex-col gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <motion.div
        layoutId={`poster-${movie.id}`}
        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.02 }}
      >
        {poster ? (
          <Image
            src={poster}
            alt={movie.title}
            fill
            sizes="(min-width: 1024px) 18vw, (min-width: 640px) 25vw, 45vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-sm text-zinc-500">
            {movie.title}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="text-xs font-medium text-amber-400">
            {movie.voteAverage > 0 ? movie.voteAverage.toFixed(1) : "—"}
          </span>
        </div>
      </motion.div>
      <div>
        <p className="line-clamp-1 text-sm font-medium text-zinc-100">{movie.title}</p>
        <p className="text-xs text-zinc-500">{movie.releaseYear ?? "Unknown"}</p>
      </div>
    </Link>
  );
}
