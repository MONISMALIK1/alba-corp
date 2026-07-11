"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MovieCard } from "./MovieCard";
import { MovieCardSkeleton, MovieGridSkeleton } from "./Skeletons";
import { EmptyState, ErrorState } from "./ErrorState";
import type { MovieSearchResult, MovieSummary } from "@/lib/types";

export function MovieExplorer({
  initialResult,
  initialQuery,
  initialError,
}: {
  initialResult: MovieSearchResult;
  initialQuery: string;
  initialError?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputValue, setInputValue] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [movies, setMovies] = useState<MovieSummary[]>(initialResult.results);
  const [page, setPage] = useState(initialResult.page);
  const [totalPages, setTotalPages] = useState(initialResult.totalPages);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Every in-flight fetch is tagged with the query it belongs to and the
  // "generation" that was current when it was kicked off. If a newer search
  // starts before an older fetch (search or pagination) resolves, the old
  // one's result is discarded instead of corrupting state with results for
  // the wrong query — this is what was letting popular-movies pagination
  // pages land in the middle of a search result set.
  const generationRef = useRef(0);

  // Kept in sync after every render so the infinite-scroll observer (created
  // once, not on every state change) always reads current values instead of
  // a stale closure.
  const stateRef = useRef({ query, page, totalPages, loading, loadingMore });
  useEffect(() => {
    stateRef.current = { query, page, totalPages, loading, loadingMore };
  });

  const fetchMovies = useCallback(async (q: string, pageNum: number, replace: boolean) => {
    const generation = ++generationRef.current;
    if (replace) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const url = new URL("/api/movies", window.location.origin);
      if (q) url.searchParams.set("q", q);
      url.searchParams.set("page", String(pageNum));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("bad response");
      const data: MovieSearchResult = await res.json();
      if (generation !== generationRef.current) return; // superseded by a newer request
      setMovies((prev) => (replace ? data.results : [...prev, ...data.results]));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      if (generation !== generationRef.current) return;
      setError("Couldn't load movies. Check your connection and try again.");
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Debounced, URL-synced search-as-you-type: every search is a shareable link.
  useEffect(() => {
    if (inputValue === query) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(inputValue);
      const params = new URLSearchParams(searchParams.toString());
      if (inputValue) params.set("q", inputValue);
      else params.delete("q");
      router.replace(params.size > 0 ? `/?${params.toString()}` : "/", { scroll: false });
      fetchMovies(inputValue, 1, true);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  // Infinite scroll: created once and reads live state via stateRef, so it
  // never reconnects (and re-fires) on every loading/page state change.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const { query: q, page: p, totalPages: tp, loading: l, loadingMore: lm } = stateRef.current;
        if (entries[0].isIntersecting && !l && !lm && p < tp) {
          fetchMovies(q, p + 1, false);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchMovies]);

  return (
    <div className="flex flex-col gap-6">
      <input
        type="search"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Search movies..."
        aria-label="Search movies"
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-400"
      />

      {error && <ErrorState message={error} onRetry={() => fetchMovies(query, 1, true)} />}

      {!error && loading && movies.length === 0 && <MovieGridSkeleton />}

      {!error && !loading && movies.length === 0 && (
        <EmptyState
          title={query ? `No movies found for "${query}"` : "No movies to show"}
          hint={query ? "Try a different title or check the spelling." : undefined}
        />
      )}

      {movies.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {movies.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} />
            ))}
            {loadingMore &&
              Array.from({ length: 5 }).map((_, i) => <MovieCardSkeleton key={`more-${i}`} />)}
          </div>
          <div ref={sentinelRef} className="h-1" />
        </>
      )}
    </div>
  );
}
