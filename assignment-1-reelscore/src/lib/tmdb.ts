import { z } from "zod";
import { fetchWithBackoff } from "./fetch-with-backoff";
import type { MovieDetail, MovieSearchResult, MovieSummary } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error(
      "Missing TMDB_API_KEY. Copy .env.example to .env.local and set it (see README.md)."
    );
  }
  return key;
}

export function posterUrl(path: string | null, size: "w185" | "w342" | "w500" = "w342") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size: "w780" | "original" = "w780") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

// --- Response shapes we actually consume, validated before we trust them. ---
// TMDB's real payloads have many more fields; we only assert the ones this
// app reads, and everything else is ignored rather than rejected.

const movieSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  poster_path: z.string().nullable(),
  backdrop_path: z.string().nullable(),
  release_date: z.string().nullable().optional(),
  vote_average: z.number().nullable().optional(),
});

const searchResponseSchema = z.object({
  page: z.number(),
  total_pages: z.number(),
  results: z.array(movieSummarySchema),
});

const castMemberSchema = z.object({
  id: z.number(),
  name: z.string(),
  character: z.string().optional().default(""),
  profile_path: z.string().nullable(),
  order: z.number().optional(),
});

const videoSchema = z.object({
  key: z.string(),
  site: z.string(),
  type: z.string(),
  official: z.boolean().optional(),
});

const providerSchema = z.object({
  provider_id: z.number(),
  provider_name: z.string(),
  logo_path: z.string(),
});

const watchProvidersRegionSchema = z.object({
  link: z.string().optional(),
  flatrate: z.array(providerSchema).optional(),
  rent: z.array(providerSchema).optional(),
  buy: z.array(providerSchema).optional(),
});

const movieDetailSchema = movieSummarySchema.extend({
  overview: z.string().optional().default(""),
  runtime: z.number().nullable().optional(),
  genres: z.array(z.object({ id: z.number(), name: z.string() })).optional().default([]),
  credits: z
    .object({ cast: z.array(castMemberSchema).optional().default([]) })
    .optional(),
  videos: z.object({ results: z.array(videoSchema).optional().default([]) }).optional(),
});

function toSummary(raw: z.infer<typeof movieSummarySchema>): MovieSummary {
  return {
    id: raw.id,
    title: raw.title,
    posterPath: raw.poster_path,
    backdropPath: raw.backdrop_path,
    releaseYear: raw.release_date ? raw.release_date.slice(0, 4) : null,
    voteAverage: raw.vote_average ?? 0,
  };
}

async function tmdbFetch(path: string, params: Record<string, string> = {}, revalidate: number) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetchWithBackoff(url.toString(), { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`TMDB ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function searchMovies(query: string, page = 1): Promise<MovieSearchResult> {
  const raw = await tmdbFetch("/search/movie", { query, page: String(page) }, 60);
  const parsed = searchResponseSchema.parse(raw);
  return {
    results: parsed.results.map(toSummary),
    page: parsed.page,
    totalPages: parsed.total_pages,
  };
}

export async function popularMovies(page = 1): Promise<MovieSearchResult> {
  const raw = await tmdbFetch("/movie/popular", { page: String(page) }, 60);
  const parsed = searchResponseSchema.parse(raw);
  return {
    results: parsed.results.map(toSummary),
    page: parsed.page,
    totalPages: parsed.total_pages,
  };
}

export async function movieDetail(id: string, region = "US"): Promise<MovieDetail> {
  const raw = await tmdbFetch(
    `/movie/${id}`,
    { append_to_response: "credits,videos,watch/providers" },
    21600
  );
  const parsed = movieDetailSchema.parse(raw);

  const trailer = (parsed.videos?.results ?? []).find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );

  const watchProvidersRaw = raw as {
    "watch/providers"?: { results?: Record<string, unknown> };
  };
  const regionProviders = watchProvidersRegionSchema
    .optional()
    .parse(watchProvidersRaw["watch/providers"]?.results?.[region]);

  return {
    ...toSummary(parsed),
    overview: parsed.overview,
    runtime: parsed.runtime ?? null,
    genres: parsed.genres.map((g) => g.name),
    cast: (parsed.credits?.cast ?? [])
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path,
      })),
    trailerKey: trailer?.key ?? null,
    providers: regionProviders
      ? {
          link: regionProviders.link ?? null,
          flatrate: (regionProviders.flatrate ?? []).map((p) => ({
            id: p.provider_id,
            name: p.provider_name,
            logoPath: p.logo_path,
          })),
          rent: (regionProviders.rent ?? []).map((p) => ({
            id: p.provider_id,
            name: p.provider_name,
            logoPath: p.logo_path,
          })),
          buy: (regionProviders.buy ?? []).map((p) => ({
            id: p.provider_id,
            name: p.provider_name,
            logoPath: p.logo_path,
          })),
        }
      : null,
  };
}
