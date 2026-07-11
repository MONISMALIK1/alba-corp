# Build Log: ReelScore (Assignment 1)

## Goal & scope decision
Built a movie discovery app centered on one real data blend (TMDB movie metadata + Deezer
soundtrack + TMDB streaming providers) and one genuinely advanced feature (a shared-element FLIP
poster transition implemented via a Next.js intercepted parallel route, not a shallow CSS
animation). Deliberately left out: virtualized/windowed list rendering (infinite scroll alone is
enough at the scale this app actually hits — hundreds, not tens of thousands, of results), a
region picker for streaming providers, and user accounts (out of scope for this brief).

## Stack & tooling
Next.js (App Router, TypeScript, Tailwind) for the frontend and the entire backend-for-frontend
(Route Handlers, no separate API service); Framer Motion for the shared-element transition; zod
for validating upstream API responses before trusting their shape.

## Key decisions & trade-offs
- **Deezer over Spotify for the soundtrack** — because Deezer needs zero auth and its lack of
  CORS support gives the BFF a real, non-contrived reason to exist, versus Spotify's Client
  Credentials OAuth flow, which is more setup for a marginal catalog improvement at this scope.
- **Intercepted parallel route (modal) over a client-only overlay** — Next.js App Router
  navigations normally unmount the previous route entirely, which would make a true Framer Motion
  shared-`layoutId` transition impossible (both elements need to be mounted in the same tree at
  once). An intercepted route (`@modal/(.)movie/[id]`) keeps the grid mounted underneath while
  layering the detail view on top via a parallel slot, and falls back to a real full-page route
  (`movie/[id]/page.tsx`) for direct/shared links — solving both "true FLIP transition" and
  "every view is a shareable URL" at once, rather than picking one.
- **Next.js Data Cache over a separate Redis/KV layer** — `revalidate` on each `fetch` call gives
  per-route, per-argument caching for free at this app's scale (a handful of read-only, public
  endpoints); a dedicated cache store would add infrastructure without a workload that needs it.
- **zod validation over `as` type assertions** — third-party APIs change shape without warning;
  parsing with zod means a malformed upstream response surfaces as a caught, typed error (handled
  by the per-section error states) instead of a runtime crash somewhere deep in a component.

## Hard parts / dead ends
- Getting the shared-element transition to actually work across a real navigation (not just
  within one already-mounted component tree) was the hard part. The first instinct — plain
  Framer Motion `layoutId` between two components on two different routes — doesn't work in the
  App Router, because navigating away unmounts the origin component before the destination one
  ever mounts, so there's no overlap for Framer Motion's FLIP engine to interpolate between.
  Solved by using an intercepted parallel route so the grid never unmounts when the detail view
  opens — both `layoutId`-tagged elements coexist in the tree at the moment of transition, which
  is what the animation actually needs.
- Next.js's route-type generator (`next typegen` / `.next/types`) didn't know about the new
  `@modal` parallel slot until regenerated — `tsc --noEmit` failed against a stale
  `.next/types/validator.ts` complaining the root layout's props didn't match, even though the
  layout code was correct. Fixed by running `next typegen` (or a build) after adding the slot,
  before typechecking.
- `eslint-plugin-react-hooks`'s `set-state-in-effect` rule flagged the soundtrack panel's
  fetch-on-mount effect and the movie grid's initial-load effect — both are the standard,
  React-docs-sanctioned "sync external data on mount" pattern. Suppressed with a scoped
  `eslint-disable-next-line` and a comment explaining why, rather than restructuring working code
  to satisfy an overly strict lint rule.
- **Real bug found in browser testing**: searching, then clicking a poster, sometimes opened the
  wrong movie entirely. Root cause was a stale-closure race in the infinite-scroll
  `IntersectionObserver`: it re-subscribed on every `loading`/`page`/`totalPages` change, and
  because search results are short (the sentinel is immediately in view), each fresh subscription
  fired instantly — sometimes with a `query` value captured *before* a just-started search's
  `setQuery` had committed. That fired an unrelated `/api/movies?page=N` (popular movies, not the
  search) and appended its results into the same array the search results were in, silently
  shifting what was actually behind each grid position. Fixed two ways: (1) the observer is now
  created once and reads current `query`/`page`/`totalPages`/`loading` from a ref kept in sync
  every render, instead of closing over state and re-subscribing constantly; (2) every fetch is
  tagged with a request "generation" number, and a response is only applied if it's still the
  current generation — so even a genuinely late-resolving fetch can no longer clobber newer state.
  Also tightened the observer's `rootMargin` from 600px to 200px, since 600px was eagerly
  triggering 3-4 pages of pagination on initial mount before the user ever scrolled.
- **Second bug found post-deploy**: verifying the live Vercel deployment, `audio.play()` in the
  soundtrack panel is a promise that can reject (autoplay blocked, network hiccup, preview URL
  expired) — and the code called `setPlayingId(track.id)` unconditionally right after calling it,
  without awaiting or catching. On a rejection, the UI would flip to showing the pause icon for a
  track that was never actually playing. Fixed by moving `setPlayingId` before `.play()` (so the
  UI responds instantly on the success path) and adding a `.catch()` that reverts `playingId` back
  to `null` — but only if it's still pointing at that same track, so a rejection from a stale
  play() call can't stomp on a track the user has since switched to.

## How I verified it works
See README.md "04 — How I tested this" for the full list — manual pass through search, grid
navigation (both FLIP-modal and direct-URL paths), infinite scroll, soundtrack playback, and the
specific edge cases (no soundtrack match, zero search results, no streaming providers, missing
trailer/overview/poster, offline retry, debounced search with URL sync).

## Known limitations
See README.md "Known limitations" — US-only streaming providers, heuristic soundtrack matching,
and no list virtualization yet.

## Time spent
- Scaffold + server-only lib layer (TMDB/Deezer clients, backoff, types, zod schemas): ~45 min
- BFF route handlers: ~15 min
- Grid + debounced URL-synced search + infinite scroll: ~40 min
- Detail page + intercepted-route modal + FLIP transition wiring: ~30 min
- Polish (next/image conversion, loading/error/not-found states, typography): ~30 min
- Browser verification + found/fixed the infinite-scroll race condition: ~30 min

