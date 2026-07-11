import { z } from "zod";
import { fetchWithBackoff } from "./fetch-with-backoff";
import type { Soundtrack } from "./types";

const DEEZER_BASE = "https://api.deezer.com";

const trackSchema = z.object({
  id: z.number(),
  title: z.string(),
  duration: z.number(),
  preview: z.string(),
  artist: z.object({ name: z.string() }),
  album: z.object({
    title: z.string(),
    cover_medium: z.string().optional(),
  }),
});

const searchResponseSchema = z.object({
  data: z.array(trackSchema),
});

/**
 * Deezer has no auth and no official "soundtrack by movie" endpoint, so we
 * search its public track index with a heuristic query and group whatever
 * comes back by album — good enough to surface a plausible soundtrack for
 * most well-known films without needing Spotify's OAuth flow.
 */
export async function findSoundtrack(movieTitle: string): Promise<Soundtrack | null> {
  const query = `${movieTitle} soundtrack`;
  const url = new URL(`${DEEZER_BASE}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "25");

  const res = await fetchWithBackoff(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) {
    throw new Error(`Deezer search failed: ${res.status}`);
  }
  const parsed = searchResponseSchema.parse(await res.json());
  if (parsed.data.length === 0) return null;

  // Group by album, pick the album with the most matching tracks — a simple
  // but effective heuristic for "which of these results is the actual OST."
  const byAlbum = new Map<string, typeof parsed.data>();
  for (const track of parsed.data) {
    const key = track.album.title;
    const list = byAlbum.get(key) ?? [];
    list.push(track);
    byAlbum.set(key, list);
  }
  const [albumTitle, tracks] = [...byAlbum.entries()].sort((a, b) => b[1].length - a[1].length)[0];

  return {
    albumTitle,
    albumCover: tracks[0].album.cover_medium ?? null,
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist.name,
      previewUrl: t.preview || null,
      durationSeconds: t.duration,
    })),
  };
}
