# ReelScore

Assignment 1 in [alba-corp](../README.md). A movie discovery app whose detail page blends two
data sources neither gives you alone: TMDB's movie metadata (cast, trailer, where to stream it)
and Deezer's soundtrack search — with a shared-element poster transition connecting the grid to
the detail view. See [CLAUDE.md](./CLAUDE.md) for the full design spec and
[BUILD_LOG.md](./BUILD_LOG.md) for the process journal.

## What this assignment asked for

The brief (reproduced in full in [CLAUDE.md](./CLAUDE.md#assignment-brief)) asked for a
portfolio-quality web app, built around a public API, that:

- Is a **polished, single-purpose app** on a topic worth caring about — not just "it works," but
  something worth putting in a portfolio: real typography, a coherent look, motion that means
  something, fast perceived loading, and graceful empty/error/loading states.
- Uses a **third-party API** with **good practices**: proper documentation, a distinctive UI,
  smooth animation and performance.
- For the "big bonus": **its own backend** — a Next.js backend-for-frontend that keeps API keys
  server-side, adds a caching layer, handles rate limits with retry/backoff, and fails gracefully
  when the upstream does.
- Picks at least one of these "advanced feature" options to actually demonstrate depth on:
  **blending two or more data sources** into one view neither gives alone (the brief's own
  example: "a film plus its soundtrack plus where to stream it"); **high-performance lists**
  (windowed infinite scroll); **shareable, URL-synced search state**; or **a signature animation**
  (shared-element/FLIP, scroll-driven, or physics-based) that holds 60fps.
- Documents four things specifically: **API choice** (which and why), **architecture** (where the
  client/server line sits, where caching lives), **the advanced feature** (how it works), and
  **how it was tested** (what was clicked through, edge cases, any automated checks) — numbered
  01–04 in this README to match the brief's own numbering.

ReelScore's answer: TMDB + Deezer blended on the movie detail page (the brief's own suggested
combo), a real Next.js BFF (not optional here — Deezer's lack of CORS support makes it load-
bearing), and a genuine cross-route FLIP transition as the signature animation, with URL-synced
search as a secondary feature. See "03 — Advanced feature" below for exactly how that's built.

## Features

- **Browse & search**: a poster grid of popular movies, or debounced (350ms) search-as-you-type
  against TMDB — the current query is reflected in the URL (`?q=...`), so any search is a
  shareable link, and reloading the page restores the same results server-side.
- **Infinite scroll**: more pages load automatically as you approach the bottom of the grid, with
  skeleton placeholders while a page is in flight.
- **Movie detail**, opened either as a shared-element modal (clicking a poster) or as a full
  standalone page (direct URL) with identical content either way:
  - Title, overview, genres, runtime, and poster/backdrop art from TMDB.
  - Top 6 billed **cast**, with photos.
  - A **trailer** link (YouTube), when TMDB has one.
  - **Where to watch**: stream/rent/buy providers with real service logos, region-aware
    (defaults to US).
  - **Soundtrack**: the film's soundtrack album, found via Deezer, with a full track list and
    inline 30-second preview playback (play/pause per track).
- **The signature animation**: click a poster and it visibly grows into the detail view's hero
  image instead of the page just swapping — see "03" below for how.
- **Resilient by design**: every section (grid, providers, soundtrack, cast) has its own loading
  skeleton, empty state, and error-with-retry state, so one upstream failing never blanks the
  whole page. Root-level `error.tsx`/`not-found.tsx` catch anything those miss.

## 01 — API choice

- **[TMDB](https://www.themoviedb.org/documentation/api)** (The Movie Database): search, movie
  detail, credits, trailer, and — the key one — `watch/providers` (JustWatch-sourced "where to
  stream/rent/buy," region-aware). One free API key covers all of it, and its images are the
  visual backbone of the whole UI.
- **[Deezer](https://developers.deezer.com/api)**: public track/album search, used to find and
  play the film's soundtrack. No API key or auth at all — but Deezer sends no CORS headers, so
  every call has to go through our own backend regardless, which is the real reason this app has
  a proper BFF rather than a decorative one.
- **Considered and rejected**: Spotify Web API for the soundtrack (richer catalog, but its
  Client Credentials OAuth flow — token fetch, refresh, an extra secret — is real added
  complexity for marginal gain over Deezer's free public search at this scope). Considered OMDb
  as a TMDB alternative — it has no watch-providers equivalent, and "where to stream it" is
  central to this app, so TMDB won outright.

## 02 — Architecture

- Next.js App Router. **Every TMDB and Deezer call happens server-side only**, inside Route
  Handlers under `src/app/api/*` ([`src/lib/tmdb.ts`](./src/lib/tmdb.ts),
  [`src/lib/deezer.ts`](./src/lib/deezer.ts)) — the browser never talks to either API directly.
  This is the backend-for-frontend: it keeps `TMDB_API_KEY` server-only, works around Deezer's
  CORS gap, and gives one place to cache and retry.
- **Caching** lives in Next.js's built-in Data Cache, via `fetch(url, { next: { revalidate: N } })`
  on every upstream call — no separate Redis/KV needed at this scale:
  - Search/popular results: `revalidate: 60`
  - Movie detail + credits + providers: `revalidate: 21600` (6h)
  - Soundtrack search: `revalidate: 86400` (24h)
- **Rate limits & graceful failure**: [`src/lib/fetch-with-backoff.ts`](./src/lib/fetch-with-backoff.ts)
  wraps every upstream call with exponential backoff + jitter (up to 3 retries), honoring
  `Retry-After` when TMDB sends one. Route handlers always return a typed `{ error }` body with a
  real HTTP status on failure — never a silently-empty `200`. The movie detail page renders
  **per-section** error states: if Deezer is down, only the soundtrack panel shows its retry
  state — cast, trailer, and providers still render normally from TMDB. One upstream's failure
  never blanks the whole page.
- **Client vs server fetch**: the initial grid and the detail page's TMDB data are fetched
  server-side directly in the page component (React Server Components) — no client fetch
  waterfall on first paint. Search-as-you-type and infinite scroll call our own `/api/movies`
  route from the client; the soundtrack panel calls `/api/soundtrack/[id]` from the client since
  it loads after the rest of the page.
- **Validation**: TMDB and Deezer responses are parsed with `zod` schemas
  ([`src/lib/tmdb.ts`](./src/lib/tmdb.ts), [`src/lib/deezer.ts`](./src/lib/deezer.ts)) before the
  UI trusts them — third-party APIs add/rename/omit fields without warning, and this app only
  asserts the shape of what it actually reads.

## 03 — Advanced feature: shared-element (FLIP) poster transition

Clicking a poster in the grid animates that exact image into the detail view's hero poster — it
grows and repositions in place instead of the page just swapping, so the poster reads as one
continuous object across the navigation.

**How it's wired**: the detail view opens as a modal via a Next.js **intercepted parallel route**
(`src/app/@modal/(.)movie/[id]/page.tsx`) — clicking a poster keeps the grid mounted underneath
and layers the detail view on top, while a direct visit or refresh at `/movie/[id]`
(`src/app/movie/[id]/page.tsx`) renders the same content as a full standalone page — so every
detail view is still a real, shareable, directly-loadable URL, not something that only works via
client-side navigation.

Because the grid stays mounted while the modal opens, the grid's `<motion.img layoutId={`poster-${id}`}>`
(`src/components/MovieCard.tsx`) and the modal's `<motion.img layoutId={`poster-${id}`}>`
(`src/components/PosterHero.tsx`) are both present in the same Framer Motion layout tree at the
moment of transition. Framer Motion's FLIP engine computes the position/size delta between the
two and animates it using only `transform`/`opacity` on the compositor — off the main thread —
so it holds 60fps independent of the rest of the page's render cost. The remaining detail content
(cast, providers, soundtrack) is deliberately *not* part of the shared transition — it's plain
content that appears once the modal mounts, so the poster is never competing with a dozen other
elements animating at once.

## 04 — How I tested this

- **Manual pass**: searched for well-known titles (exact match, partial match, typos), clicked
  through to detail pages via the grid (verifying the FLIP transition) and via direct URL
  (verifying the non-modal fallback page renders identically), used browser back/Escape/backdrop
  click to close the modal, scrolled the grid to trigger infinite scroll past the first page,
  and played/paused soundtrack preview tracks.
- **Real bug this caught**: searching then clicking a poster occasionally opened a completely
  different movie than the one clicked. Traced to a stale-closure race in the infinite-scroll
  observer that let it fire an unrelated popular-movies page fetch mid-search and silently
  append it into the search results array, shifting what was actually behind each grid position.
  See BUILD_LOG.md "Hard parts / dead ends" for the fix — this is exactly the kind of bug that
  only shows up by actually clicking through the app, not from reading the code.
- **Edge cases checked**:
  - A movie with no matching Deezer soundtrack → soundtrack panel shows the empty state, not an
    error or an infinite spinner.
  - A search query with zero results → grid shows the empty state with a hint, not a blank page.
  - A movie with no streaming providers in the US region → providers panel says so explicitly
    instead of rendering an empty section.
  - A movie with no trailer, no overview, or a poster-less title → each renders its fallback
    (title-text placeholder for the poster, no trailer button, "No overview available.").
  - Killing network access mid-session → grid and soundtrack panel show their error states with a
    working retry button; the movie detail *page* (server-rendered) shows its own error state
    instead of crashing when the initial server fetch fails.
  - Typing quickly in the search box → confirmed only the debounced (350ms) trailing request
    actually fires, not one request per keystroke; confirmed the URL (`?q=...`) updates to match,
    making the current search state a shareable link.
- **What I'd add with more time**: a Playwright test driving the FLIP transition + modal
  open/close/back-navigation and asserting the URL and DOM state at each step; a mocked-upstream
  test for `fetchWithBackoff`'s retry/backoff behavior instead of only verifying it by reading the
  code and triggering real rate limits informally.

## Setup from zero

1. Get a free TMDB API key: [themoviedb.org](https://www.themoviedb.org) → account settings →
   API → request a key (v3 auth).
2. Copy `.env.example` → `.env.local`, set `TMDB_API_KEY` (server-only, no `NEXT_PUBLIC_` prefix).
   Deezer needs no key.
3. `npm install && npm run dev`.
4. Open http://localhost:3000 — no accounts, no seed data, it's a public read-only app.

## Known limitations

- Streaming providers default to the US region; there's no region picker yet.
- The soundtrack match is a heuristic (`"<title> soundtrack"` search against Deezer's public
  index grouped by album) — it's right for most well-known films but can occasionally surface an
  unrelated album for obscure titles or ones with no official soundtrack release.
- The grid uses plain infinite scroll, not a virtualized/windowed list — fine at hundreds of
  items, but would need `@tanstack/react-virtual` to stay smooth at many thousands (documented as
  a stretch goal in CLAUDE.md, not implemented in this pass).

## Deploying

Set `TMDB_API_KEY` in your host's environment variables (Vercel, Railway, etc.) — nothing else is
required. No database, no other secrets.
