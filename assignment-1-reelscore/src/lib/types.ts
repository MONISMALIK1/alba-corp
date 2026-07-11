export interface MovieSummary {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseYear: string | null;
  voteAverage: number;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface WatchProvider {
  id: number;
  name: string;
  logoPath: string;
}

export interface WatchProviders {
  link: string | null;
  flatrate: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

export interface MovieDetail extends MovieSummary {
  overview: string;
  genres: string[];
  runtime: number | null;
  cast: CastMember[];
  trailerKey: string | null;
  providers: WatchProviders | null;
}

export interface SoundtrackTrack {
  id: number;
  title: string;
  artist: string;
  previewUrl: string | null;
  durationSeconds: number;
}

export interface Soundtrack {
  albumTitle: string;
  albumCover: string | null;
  tracks: SoundtrackTrack[];
}

export interface MovieSearchResult {
  results: MovieSummary[];
  page: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: string;
}
