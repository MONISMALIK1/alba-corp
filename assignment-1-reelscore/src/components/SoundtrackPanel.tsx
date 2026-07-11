"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ErrorState } from "./ErrorState";
import { PanelSkeleton } from "./Skeletons";
import type { Soundtrack, SoundtrackTrack } from "@/lib/types";

type PanelState = "loading" | "ready" | "empty" | "error";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function SoundtrackPanel({
  movieId,
  movieTitle,
}: {
  movieId: number;
  movieTitle: string;
}) {
  const [state, setState] = useState<PanelState>("loading");
  const [soundtrack, setSoundtrack] = useState<Soundtrack | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const url = `/api/soundtrack/${movieId}?title=${encodeURIComponent(movieTitle)}`;
      const res = await fetch(url);
      if (res.status === 404) {
        setState("empty");
        return;
      }
      if (!res.ok) throw new Error("bad response");
      const data: Soundtrack = await res.json();
      setSoundtrack(data);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [movieId, movieTitle]);

  useEffect(() => {
    // Fetching the soundtrack on mount/movie-change is exactly what this
    // effect is for; setState happens inside `load`'s async body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function togglePlay(track: SoundtrackTrack) {
    if (!track.previewUrl || !audioRef.current) return;
    if (playingId === track.id) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current.src = track.previewUrl;
    setPlayingId(track.id);
    audioRef.current.play().catch(() => {
      // Autoplay blocked or preview failed to load — don't leave the UI
      // showing "playing" for audio that never actually started.
      setPlayingId((current) => (current === track.id ? null : current));
    });
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Soundtrack</h2>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />

      {state === "loading" && (
        <div className="mt-3">
          <PanelSkeleton lines={4} />
        </div>
      )}

      {state === "error" && (
        <div className="mt-3">
          <ErrorState message="Couldn't load the soundtrack." onRetry={load} />
        </div>
      )}

      {state === "empty" && (
        <p className="mt-2 text-sm text-zinc-500">No soundtrack found for this title.</p>
      )}

      {state === "ready" && soundtrack && (
        <div className="mt-3 flex flex-col gap-1">
          <div className="mb-2 flex items-center gap-3">
            {soundtrack.albumCover && (
              <Image
                src={soundtrack.albumCover}
                alt={soundtrack.albumTitle}
                width={48}
                height={48}
                className="rounded-md"
              />
            )}
            <p className="text-sm font-medium text-zinc-200">{soundtrack.albumTitle}</p>
          </div>
          {soundtrack.tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => togglePlay(track)}
              disabled={!track.previewUrl}
              className="flex items-center justify-between rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-4 shrink-0 text-amber-400">
                  {playingId === track.id ? "⏸" : "▶"}
                </span>
                <span className="line-clamp-1">
                  {track.title} <span className="text-zinc-500">— {track.artist}</span>
                </span>
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {formatDuration(track.durationSeconds)}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
