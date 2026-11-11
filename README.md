# CineSphere

A 3D, liquid-glass movie recommendation website covering films from the silent era to upcoming releases, in every genre and language. Built with Next.js 14 (App Router), TypeScript, Tailwind, React Query, Zustand, react-three-fiber and framer-motion, on top of the TMDB API.

## Features

- **Home**: trending (today/this week), now playing in India, upcoming (next 60 days), top rated, hidden gems, genre rows, and "continue from your watchlist".
- **Discover**: every filter syncs to the URL. Include/exclude genres with AND/OR, year slider and decade chips, rating, vote floor, runtime, language (Indian languages pinned), country, streaming service + monetization, certification by region, cast/crew/keyword/company autocomplete, release status, sort, "hide seen", saved presets, infinite scroll with a "Load more" fallback.
- **Movie / person / collection pages** with trailer, where to watch (JustWatch), cast and crew, keywords, franchise banner, similar, recommended and "more from this director". Each page has SEO metadata and JSON-LD.
- **Recommendation tools**: For You, Mood picker, Because You Liked (taste blender), Swipe mode, Time fit, Watch together, Hidden gems, Decade time machine, Surprise me, Marathon planner, Upcoming calendar.
- **Library**: watchlist, seen, rated, not interested, custom lists, sort/filter, JSON export/import, and stats (hours watched, top genres/decades/directors). Everything is stored in `localStorage`, with every read and write wrapped in try/catch.
- **Design: the Atlas.** There are no pages to scroll between. The whole site is one chart drawn like a printed sea map, and each tool is an island on it.
  - **Travel, not navigation.** Every URL still works and can be shared, but moving between places flies a camera across the chart. It pulls back mid-flight so you see the sea you cross, then lands and the place fades in over its island. `M` opens the whole chart, `Shift + arrows` sail to the neighbouring island, and the bottom navigator shows where you are.
  - **Projection room.** A film, person or franchise opens on top like a camera iris from the point you clicked, with the lights down (night theme). Inside, content is split into chapters (Story / Cast / Watch / Facts / More, keys 1–5) instead of one long page. Walking film → actor → film builds a trail you can step back along, and `Esc` returns you to the exact island you left, filters intact.
  - **Pocket.** Drag any poster onto the Pocket (or press its backpack button) to carry films between places, then pour them into the Blender or Together. Posters can also be dropped straight onto those pickers.
  - **Tonight (home).** A single-screen "needle" browser: pick a channel (trending, in cinemas, coming soon, all-time, hidden gems, your list), run along the reel with ← → or the mouse wheel, and the sphere shows the film under the needle.
  - **Spyglass.** Search is a lens laid over wherever you are (`/` or Ctrl/⌘+K).
  - Warm paper chart with ink hairlines and one vermilion accent (Big Shoulders Display, Instrument Sans/Serif, JetBrains Mono), plus a night chart. Places load lazily the first time you land on them and stay mounted after, so their state survives.
  - The previous UI is kept in `_legacy_ui_2026-11-11/` for reference. It is excluded from builds and can be deleted.

## Setup

Requires Node 18.18+.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Put your TMDB key in `.env.local`. You can get one at <https://www.themoviedb.org/settings/api>. Either the v3 API key or the v4 read-access token works.

```bash
npm run dev
```

Open <http://localhost:3000>.

| Variable | Required | Purpose |
| --- | --- | --- |
| `TMDB_API_KEY` | yes | TMDB credential. **Server-only.** Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Public URL, used for canonical links, sitemap and Open Graph. |

### If themoviedb.org won't open (Jio and some other ISPs)

Some Indian providers block TMDB at the DNS level: the site and API time out, but TMDB itself is fine.

- **To get your key**, open themoviedb.org with a public DNS. The quickest way is in your browser: Chrome/Edge → Settings → Privacy and security → Security → *Use secure DNS* → choose **Cloudflare (1.1.1.1)**. You can also set Windows DNS to `1.1.1.1` / `8.8.8.8`, or use mobile data from a different provider.
- **For the app**, nothing to do. When running locally, the server resolves TMDB hostnames through `1.1.1.1` / `8.8.8.8` (`lib/tmdb/dns.ts`), so API calls work even on a blocking network. Poster images come from `image.tmdb.org`, which isn't blocked. On Vercel the normal DNS is used. Override with `TMDB_DNS_SERVERS` (see `.env.example`).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Vitest unit tests (scoring engine, filters, parsing) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel. The framework is detected automatically.
2. In **Project → Settings → Environment Variables**, add `TMDB_API_KEY` (and `NEXT_PUBLIC_SITE_URL`) for Production and Preview.
3. Deploy. Lists revalidate hourly and movie, person and collection details daily (ISR).

Set the key before the first build. Pages built without it show the setup screen until they revalidate.

## How the API key stays secret

The browser never talks to TMDB directly:

- Server components call `lib/tmdb/server.ts`, which is marked `server-only`.
- Client components call `/api/tmdb/*` (`app/api/tmdb/[...path]/route.ts`). That route forwards only an allowlist of read-only endpoints, caps query size, forces `include_adult=false`, adds the key on the server, and sets CDN cache headers.
- 429 and 5xx responses are retried with exponential backoff, honouring `Retry-After`. Errors become friendly messages (`lib/tmdb/errors.ts`).

Images load directly from `image.tmdb.org` through a custom `next/image` loader. It picks TMDB's own sized renditions (w342 for cards, w780/w1280 for backdrops), so no Vercel image-optimisation quota is used.

## Project structure

```
app/[[...slug]]     one catch-all route: metadata + JSON-LD only
  layout.tsx         mounts the persistent <Atlas /> stage
  api/tmdb/[...path] secure TMDB proxy
components/atlas/    chart, camera, navigator, pocket, spyglass, routing
components/rooms/    one component per place (island)
components/capsule/  film / person / franchise projection room
components/ui/       kit (images, states, controls) and posters
config/              moods.ts, genres, pinned languages, regions, site
lib/tmdb/            typed client, server API, discover filter model
lib/recommend/       pure, unit-tested scoring engine + browser pipeline
store/               Zustand stores (library, pocket/theme, session)
types/               TMDB response types
```

## The recommendation scoring algorithm

All scoring is in pure functions under `lib/recommend/`, covered by tests in `lib/recommend/__tests__`.

1. **Features** (`features.ts`). Each movie becomes genres, keywords, directors, top-5 billed cast, decade, original language, rating, vote count and collection.
2. **Taste profile** (`profile.ts`). Seed movies are folded into weighted bags of each feature. Weights can be negative: a 1–2★ rating, "not interested" or a left swipe pushes the profile away. Top-billed cast counts more than lower-billed cast. Each entry remembers which seed titles produced it, which powers the "why" text. Before scoring, every dimension is normalised so its strongest signal is ±1, which makes a 3-film profile comparable to a 300-film one.
3. **Candidates** (`candidates.ts`, `pipeline.ts`). Candidates come from the union of TMDB's `recommendations` and `similar` lists for every seed, plus `/discover` queries built from the profile's top genres, keywords, directors and dominant language. Seeds, seen and not-interested films are excluded. Each candidate records how many seed lists contained it (`sourceHits`), which is a collaborative signal.
4. **Score** (`score.ts`):

   | Signal | Weight | How it's computed |
   | --- | --- | --- |
   | Genre overlap | 0.26 | ½·mean + ½·max of the profile's genre weights |
   | Keyword overlap | 0.22 | Saturating sum `1 − e^(−1.2·Σw)` of shared keywords |
   | Same director | 0.12 | Sum of shared director weights, clamped to ±1 |
   | Shared cast | 0.08 | Saturating sum |
   | Decade / language | 0.05 / 0.09 | Profile weight of the candidate's decade and language |
   | Quality | 0.12 | Bayesian rating `(v/(v+150))·R + (150/(v+150))·6.4`, scaled to 0..1 |
   | Vote confidence | 0.06 | `log10(votes)/4.5` |
   | Source bonus | +0.10 | `1 − e^(−0.6·hits)` |

   This runs twice. A cheap pass on list summaries ranks everything, then the top ~36 candidates get keywords and credits fetched and are re-scored.
5. **Diversity** (`diversify.ts`). Greedy Maximal Marginal Relevance picks results one at a time to maximise `score − 0.12 × max similarity to items already picked`. Similarity counts genre Jaccard, same franchise and same director, so five sequels don't crowd out everything else. Duplicate ids are dropped.
6. **Why recommended**. Reasons come from the strongest shared signals, for example *"Same director as Inception (Christopher Nolan)"*, *"Shares 'time travel' and 'heist' keywords with Inception"*, *"TMDB recommends it for 3 of your picks"* and *"Loved by audiences — 8.4★ from 34,000 votes"*.

How each tool uses the engine:

- **For You** (`feed.ts`) turns the library into one weight per film: watchlist +0.6, seen +0.4, 5★ +1.5, 4★ +1, 3★ +0.2, 2★ −0.6, 1★ −1, like-swipe +0.8, skip −0.15, not interested −0.8. A star rating overrides the implicit "seen" weight. The strongest 12 positive and 6 negative signals seed the profile.
- **Swipe mode** rebuilds the profile from the session's swipes after every card and re-ranks the remaining deck. Liked cards pull their TMDB recommendations into the deck. Undo pops the last swipe and reverts only what that swipe changed.
- **Watch together** (`together.ts`) builds one profile per person. Each candidate's combined score is ½·mean + ½·min of their scores ("least misery"), so one person's favourite can't win if someone else would hate it. Films where everyone's match is ≥ 40% rank first, and each person's score is shown as a percentage.

## Accessibility and performance

- Skip link, visible focus rings, ARIA labels on icon buttons, combobox/listbox semantics with arrow/enter/escape in every autocomplete, and radio-group star ratings.
- Poster alt text reads "Poster of {title} ({year})". Colours are tuned for WCAG AA on the dark palette.
- Server components render initial data. The WebGL bundle loads only after the browser is idle; a CSS planet holds its place until then, and also stands in when WebGL is unavailable.
- Skeleton loaders for lists and detail pages. Movie details are prefetched on card hover. Trailers are click-to-load (no YouTube JavaScript until clicked).

---

Made by Smit Chavda.

This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data is provided by JustWatch.
