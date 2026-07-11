# CLAUDE.md — ReelScore (Assignment 1)

Guidance for Claude Code when working in this repo. This project is a submission for the
"portfolio-quality API app" assignment — see [Assignment brief](#assignment-brief) below.

## What this is

**ReelScore**: a movie discovery app whose detail page blends two things no single API gives you
together — a film's TMDB metadata (cast, trailer, where to stream it) and its soundtrack, sourced
from Deezer. Browse or search a poster grid; click through to a detail page where the clicked
poster animates into the hero image (no page-flash), streaming providers and cast load in, and
the soundtrack panel plays 30-second previews inline.

Single-purpose, no accounts, no auth — the whole build budget goes into API integration quality,
a real backend-for-frontend, one genuinely advanced animation, and polish (typography, motion,
loading/empty/error states), per the brief.

## API choice — TMDB + Deezer, and why

- **TMDB (The Movie Database)**: search, movie detail, credits, trailer (via `videos`), and —
  critically — `watch/providers` (JustWatch-sourced "where to stream/rent/buy," region-aware).
  One free API key covers all of it, and the images are the visual backbone of the whole UI.
- **Deezer**: public track/album search, used to find and play the film's soundtrack. No API key
  at all — but Deezer's endpoints don't send browser CORS headers, so every call **must** be
  proxied through our own backend regardless. That's a real, non-contrived reason to build the
  BFF, not just an exercise.
- **Considered and rejected**: Spotify Web API for the soundtrack — better catalog metadata, but
  the Client Credentials OAuth flow adds real complexity (token fetch/refresh, an extra secret,
  more rate-limit surface) for marginal gain over Deezer's free public search within this
  time-box. Considered OMDb as a TMDB alternative — OMDb has no watch-providers equivalent, and
  "where to stream it" is central to the blend this app is built around, so TMDB wins outright.

## Architecture — where the client/server line sits, where caching lives

- Next.js App Router. **Every third-party call (TMDB, Deezer) happens server-side only**, inside
  Route Handlers under `src/app/api/*` — the browser never talks to TMDB or Deezer directly. This
  is the backend-for-frontend: it hides `TMDB_API_KEY`, works around Deezer's CORS gap, and gives
  one place to cache and retry.
- **Caching**: Route Handlers call `fetch(url, { next: { revalidate: N } })` so Next.js's built-in
  Data Cache does the work — no separate Redis/KV needed at this scale.
  - Search/discover results: `revalidate: 60` (seconds) — changes if TMDB re-ranks popularity.
  - Movie detail + credits (rarely changes): `revalidate: 21600` (6h).
  - Watch providers (JustWatch catalog shifts occasionally): `revalidate: 21600` (6h).
  - Soundtrack search: `revalidate: 86400` (24h) — album/track matches don't change.
- **Rate limits & graceful failure**: a small `fetchWithBackoff` helper (exponential backoff +
  jitter, up to 3 retries, respects `Retry-After` if TMDB sends one) wraps every upstream call.
  On persistent upstream failure, the route handler returns a typed `{ error: string }` body with
  a real HTTP status — never a silently-empty `200`. The detail page renders **per-section**
  error states: if Deezer is down, the soundtrack panel shows its own retry state while cast,
  trailer, and providers still render normally from TMDB. One upstream's failure never blanks the
  whole page.
- **Client vs server fetch**: anything that needs client-side interactivity (search-as-you-type,
  filters) calls our own `/api/*` routes from a client component. Everything else — the initial
  grid, the detail page's TMDB data — is fetched server-side directly in the page component (a
  React Server Component), so there's no client-side fetch waterfall for the first paint.

## Data blended per view

The movie detail page is one view built from data no single API provides alone:
1. **TMDB**: title, overview, release year, top 6 cast (photo + character), poster/backdrop,
   trailer (YouTube key from the `videos` endpoint).
2. **TMDB `watch/providers`**: where to stream/rent/buy, region-aware (defaults to `US` in v1 —
   no region picker yet, see Known limitations).
3. **Deezer**: best-match soundtrack album (searched as `"<title> soundtrack"` /
   `"<title> original motion picture soundtrack"`) with its track list and inline 30-second
   preview playback.

## Advanced feature — shared-element (FLIP) transition

Clicking a poster in the grid animates that exact image into the detail page's hero poster — it
grows/repositions in place instead of the page just swapping, so the poster reads as one
continuous object across the navigation. Implemented with Framer Motion's `layoutId` shared
between the grid `<motion.img layoutId={`poster-${id}`}>` and the detail hero's
`<motion.img layoutId={`poster-${id}`}>`; Framer Motion's FLIP engine computes the size/position
delta and animates it on the compositor (`transform`/`opacity` only) so it holds 60fps
independent of the rest of the page's layout cost. The rest of the detail content (cast row,
providers, soundtrack panel) staggers in with a short fade/slide once the hero transition settles,
so the poster is never competing with a dozen other elements animating at once.

**Stretch, if time remains** (not core commitments — don't let these block the above):
- URL-synced search + filters (`?q=&genre=&year=&sort=`), debounced, so any view is a shareable link.
- Windowed/virtualized infinite-scroll grid (`@tanstack/react-virtual`) for smooth scrolling
  through thousands of results with skeleton placeholders ahead of the viewport.

## Good practices

- API keys (`TMDB_API_KEY`) live only in `.env.local` / host env vars, read only inside server-side
  route handlers — **never** a `NEXT_PUBLIC_` variable. Deezer needs no key.
- Upstream response shapes are validated (zod schema or explicit narrowing) before the UI trusts
  them — third-party APIs add/omit/rename fields without warning.
- Every async boundary has a designed state, not a default spinner: grid skeleton (shimmer cards
  matching the real card layout), detail skeleton, empty state for zero search results (with a
  suggestion, not just "no results"), and a network-error state with a retry action — per section
  on the detail page, not just page-level.
- Motion means something: the FLIP transition communicates "this poster is the thing you clicked,"
  not decoration. No animation that exists only to look busy.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind
- Framer Motion — shared-element FLIP transition, micro-interactions
- `@tanstack/react-virtual` — windowed grid (stretch goal)
- Deploy target: decide at deploy time (Vercel is the Next.js-native default; Railway is also
  fine and keeps deployment consistent with Assignment 2 — no strong reason to pick one over the
  other for a keyless-mostly, no-database app like this)

## Project structure (target)

```
assignment-1-reelscore/
  README.md              # API choice, architecture, advanced feature, how tested, setup from zero
  BUILD_LOG.md            # process journal, see template below
  CLAUDE.md               # this file
  .env.example
  src/
    app/
      page.tsx                       # movie grid / search (RSC)
      movie/[id]/page.tsx             # detail page (RSC, blends TMDB + Deezer)
      api/movies/route.ts             # TMDB search/discover proxy (client-called, for live search)
      api/movies/[id]/route.ts        # TMDB detail + credits + videos + watch/providers proxy
      api/soundtrack/[id]/route.ts    # Deezer soundtrack search proxy
    components/
      MovieGrid.tsx, MovieCard.tsx, SearchBar.tsx, DetailHero.tsx,
      CastRow.tsx, ProvidersPanel.tsx, SoundtrackPanel.tsx, Skeletons.tsx, ErrorState.tsx
    lib/
      tmdb.ts               # typed TMDB client (server-only)
      deezer.ts              # typed Deezer client (server-only)
      fetch-with-backoff.ts  # retry/backoff wrapper used by both clients
      types.ts
```

## Setup from zero

1. Get a free TMDB API key: themoviedb.org → account settings → API → request a key (v3 auth).
2. Copy `.env.example` → `.env.local`, set `TMDB_API_KEY` (server-only, no `NEXT_PUBLIC_` prefix).
   Deezer needs no key or setup.
3. `npm install && npm run dev`.
4. No seed data or demo credentials needed — this is a public, read-only app with no accounts.

## Deliverables checklist (map to assignment)

- [ ] API choice documented, with reasoning (this file, "API choice" above → mirrored in README.md)
- [ ] Architecture documented: client/server line, where caching lives (this file, "Architecture" → README.md)
- [ ] Advanced feature documented: how it works (this file, "Advanced feature" → README.md)
- [ ] "How I tested this": what was clicked through, edge cases, any automated checks (BUILD_LOG.md)
- [ ] Own backend / BFF: route handlers hiding the TMDB key, proxying Deezer, caching, backoff
- [ ] Blended data sources: TMDB + Deezer combined in one detail view
- [ ] Signature animation: FLIP shared-element transition, verified smooth (not just "present")
- [ ] Loading / empty / error states designed for every async boundary, not left as defaults
- [ ] README.md (API choice, architecture, advanced feature, how tested, setup from zero, live URL)
- [ ] BUILD_LOG.md (see template)
- [ ] Live URL

## Conventions

- No emojis in README/BUILD_LOG/UI copy.
- No user accounts or auth — out of scope for this brief, and already demonstrated in
  Assignment 2; keep this build's effort on API integration, performance, and animation.
- Never call TMDB or Deezer directly from a client component — always through our own `/api/*`
  route handlers. This isn't a style preference: it's the only way the TMDB key stays hidden and
  Deezer's CORS gap gets solved.
- Don't add a database. Nothing here needs to persist across requests; Next.js's Data Cache is
  the only "storage" this app needs.

---

## Assignment brief

A beautiful, fast web app that pulls in one or more external APIs, follows good practices, and
shows off one genuinely advanced feature.

Pick a topic you actually find interesting and build a polished, single-purpose app around a
public API. The bar isn't "it works." It's "I'd happily put this in my portfolio." Think real
typography, a coherent look, motion that means something, fast perceived loading, and graceful
empty, error, and loading states.

Should include: third-party API, creative and distinctive UI, smooth animation and performance,
proper states, good practices, docs.

**Your own backend (big bonus)** — A Next.js backend (route handlers, server actions, or a
separate API) that works as a backend-for-frontend: keeps API keys server-side, adds a caching
layer (ISR, edge cache, or a small KV/Redis), handles rate limits with retry and backoff, and
fails gracefully when the upstream does.

**Blend two or more sources** into one view that neither gives you alone (a film plus its
soundtrack plus where to stream it; a country plus its weather plus its currency).

**High-performance lists** — Infinite scroll with windowing, prefetching, and skeletons that
stays smooth at thousands of items.

**Shareable, URL-synced state** — Debounced, server-backed search with filters encoded in the
URL, so any view is a link you can share.

**A signature animation** — A non-trivial motion system (shared-element/FLIP transitions,
scroll-driven animation, or something physics-based) that holds 60fps.

Documentation must cover:
1. **API choice** — Which API(s) you used and why.
2. **Architecture** — Where the client/server line sits, where caching lives.
3. **Advanced feature** — How the advanced feature works.
4. **How I tested this** — What you clicked through, edge cases, any automated checks.

### BUILD_LOG.md template (copy into that file)

```markdown
# Build Log: [Assignment Name]

## Goal & scope decision
- What I chose to build and why. What I deliberately left out to fit the time-box.

## Stack & tooling
- Frameworks, libraries, BaaS, AI tools I used and why.

## Key decisions & trade-offs
- Decision: ... because ... (alternative considered: ...)
- (repeat for each meaningful fork in the road)

## Hard parts / dead ends
- What fought back, and how I got past it (or worked around it).

## How I verified it works
- What I tested, edge cases checked, anything automated, what I'd add with more time.

## Known limitations
- Honest list of bugs, shortcuts, or things I'd do differently.

## Time spent
- Rough breakdown by phase.
```
