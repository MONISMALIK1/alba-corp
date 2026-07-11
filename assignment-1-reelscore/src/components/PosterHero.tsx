"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import type { MovieDetail } from "@/lib/types";

export function PosterHero({ movie }: { movie: MovieDetail }) {
  const poster = posterUrl(movie.posterPath, "w500");

  return (
    <motion.div
      layoutId={`poster-${movie.id}`}
      className="relative aspect-[2/3] w-full max-w-xs shrink-0 overflow-hidden rounded-xl bg-zinc-900"
    >
      {poster ? (
        <Image
          src={poster}
          alt={movie.title}
          fill
          sizes="(min-width: 640px) 320px, 90vw"
          priority
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-zinc-500">
          {movie.title}
        </div>
      )}
    </motion.div>
  );
}
