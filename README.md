# Gatherwise Planner MVP

Gatherwise is a Next.js MVP for agentic social planning. It collects group, category-based occasion/activity intent, location, date/time, budget, dietary, cuisine, and vibe constraints; generates ranked restaurant/activity plans; lets the user approve or reject plans; then handles booking through a safe handoff flow.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgracezrx%2Fgatherwise&project-name=gatherwise&repository-name=gatherwise&env=GOOGLE_PLACES_API_KEY,NEXT_PUBLIC_GATHERWISE_CANONICAL_URL,KV_REST_API_URL,KV_REST_API_TOKEN&envDescription=Google%20Places%20stays%20private%20on%20the%20server.%20KV%2FUpstash%20keeps%20planning%20sessions%20and%20dashboard%20places%20durable.&envLink=https%3A%2F%2Fgithub.com%2Fgracezrx%2Fgatherwise%23share-or-deploy)

When a Google Places API key is configured, restaurant and activity discovery uses live Google Places Text Search results around the user's resolved location. The app can resolve global cities, neighborhoods, landmarks, and addresses, and asks the user to choose when a location name is ambiguous. Reservations use a safe handoff flow: Gatherwise resolves the exact restaurant location, checks reservation sources, and opens the best external link for the user to finish manually.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

To enable live place discovery, set a server-side environment variable:

```bash
GOOGLE_PLACES_API_KEY=your_key npm run dev
```

This local workspace can also read a key from `work/provider-config.json`, which is ignored by git. The visible UI does not display the key. Shared deployments should use the private server environment variable only.

If the dev watcher hits an `EMFILE: too many open files` limit on your machine, use the production path:

```bash
npm run build
npm run start
```

Useful checks:

```bash
npm test
npm run typecheck
npm run build
```

## Share Or Deploy

For a shareable deployment, use a real Next.js host such as Vercel, Render, or Railway.

Required production settings:

- `GOOGLE_PLACES_API_KEY`: private server-side environment variable.
- `NEXT_PUBLIC_GATHERWISE_CANONICAL_URL`: public app URL, for example `https://gracezrx.gatherwise.com`.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`: hosted persistence for Vercel KV or Upstash Redis. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` also work.

Important deployment notes:

- Do not commit files in `work/`; they can contain local sessions, cached locations, and private provider settings.
- The `/api/provider-config` write shortcut is local-only. On a shared website, API keys must be configured in the hosting provider's environment settings.
- Local persistence uses `work/social-planner-db.json`. Vercel deployments without Redis/KV use temporary server storage so the app can run, but shared deployments should set the Redis/KV env vars above so planning sessions and dashboards survive cold starts and serverless function changes.
- Custom domains require DNS control. `gracezrx.gatherwise.com` can only work if you control `gatherwise.com` and point that subdomain to the deployed app.

## Public Readiness Checklist

- Create a GitHub repo for this app.
- Add production environment variables in the hosting provider.
- Add hosted persistence with Vercel KV or Upstash Redis REST credentials.
- Deploy the Next.js app.
- Add the custom domain after DNS is available.
- Link the deployed app from the portfolio site.

## What Is Implemented

- Multi-step intake form with client and server validation.
- Category-based intake for food & drink, arts/culture/learning, entertainment/nightlife, active outdoors, games/interactive, exploration/shopping, and home/low-key plans.
- Google Places-powered restaurant/activity discovery when a key is configured.
- Global location resolution with Google Places, including formatted address, coordinates, region/country, and timezone when available.
- Ambiguous location handling with a short user-choice list.
- Google-derived restaurant metadata: rating, review count, price level, address, distance, meal tags, cuisine tags when confidently inferred, phone, website, Maps URL, and opening-hour fit.
- Restaurant and plan deduplication so the ranked list avoids repeated restaurants when enough valid results exist.
- Palo Alto-centered mock marketplace with 20 restaurants and 20 activities as a fallback.
- Ranked recommendations with score breakdowns for occasion fit, group fit, capacity, distance, budget, dietary match, vibe match, and availability probability.
- Plan cards with restaurant, optional before/after activity, estimated cost, travel notes, availability status, confidence score, recommendations, and tradeoffs.
- Explicit approval/rejection before booking.
- Booking fallback: approved plans are tried in ranked order until one succeeds or all fail.
- Reservation discovery for real Google Places plans:
  - resolves a canonical restaurant name before searching booking providers
  - searches by restaurant name only and uses location bias to choose the closest branch
  - checks restaurant website links, Google reservable status, OpenTable handoff search, Resy handoff search, Maps, and phone
  - labels walk-in-friendly dessert/cafe spots as no booking needed
- Booking status page with attempt history and checked reservation sources.
- Mock confirmation page for successful bookings.
- Simple local JSON DB in `work/social-planner-db.json`, with optional Vercel KV/Upstash Redis REST storage for shared deployments.

## Provider Architecture

Provider interfaces live in `lib/providers/interfaces.ts`:

- `RestaurantSearchProvider`
- `ActivitySearchProvider`
- `AvailabilityProvider`
- `RestaurantIdentityResolver`
- `ReservationDiscoveryProvider`
- `BookingProvider`

Mock providers live in `lib/providers/mockProviders.ts`.

The Google Places adapter lives in `lib/providers/googlePlacesProvider.ts`. It uses the official Places Text Search API from the server, maps results into the ranking model, deduplicates Google results, and does not expose the API key to the browser UI. Global location resolution lives in `lib/services/locationResolution.ts`.

Restaurant matching and reservation discovery live in `lib/services/restaurantIdentity.ts` and `lib/services/reservationDiscovery.ts`. These services intentionally avoid scraping third-party booking pages. They use official/structured data when available, inspect only restaurant-owned website links for obvious reservation URLs, and otherwise prepare manual handoff links.

Placeholder adapters live in `lib/providers/futureAdapters.ts` for:

- Resy
- OpenTable
- Yelp
- Ticketmaster
- Eventbrite

These placeholders intentionally do not scrape or automate third-party websites. They should be replaced with official API integrations and credential handling when moving beyond mock mode.

## Booking State Machine

Booking states:

- `pending_review`
- `approved`
- `checking_availability`
- `booking_attempted`
- `booked`
- `unavailable`
- `failed`
- `needs_user_action`

The state machine is in `lib/services/stateMachine.ts`. Booking orchestration and idempotent fallback behavior are in `lib/services/booking.ts`.

## Ranking Logic

Ranking is separate from UI in `lib/services/ranking.ts`. It scores candidate restaurant-only and restaurant-plus-activity plans, filters weak matches, ranks the top 3-7, and generates transparent explanation tags such as closest to host, best for large groups, strong dietary fit, target-neighborhood match, and highest availability.

## Limitations

- If Google Places is not configured or fails, venue and activity discovery falls back to mock data.
- Availability and booking are deterministic mock decisions, not live inventory.
- Live reservation times are shown only when they come from safe official/structured sources. OpenTable, Resy, and Google booking pages are not scraped or automated.
- Gatherwise cannot log in, pay deposits, or complete reservations on third-party sites. It can prepare the right link and let the user mark the booking as completed.
- Local persistence is a simple JSON file. Vercel can run with temporary JSON storage for demos, but configure Vercel KV or Upstash Redis for durable shared deployments.
- No emails, payments, deposits, calendar invites, or account auth are included.
- Future official API adapters need provider-specific compliance review and API credentials.
