# Group Trip

Group holiday planning MVP. Covers accounts, a premium mobile-first
onboarding flow that creates a trip and collects the organizer's own dates,
budget and travel preferences, inviting/joining a trip via a shareable link,
a standalone Group Match engine that scores destinations against everyone's
combined constraints and preferences, and a destination discovery
experience with filtering, sorting, a detail view and voting. Locking in a
final destination is a later phase and isn't implemented yet.

## Onboarding flow

`/onboarding` is the primary way to create a trip: Welcome → sign in →
trip name → who's going → invite friends → trip length → available months →
budget → travel preferences → done. It's a single client-side wizard (no
page reloads between steps) with a progress bar, big tap targets, and
minimal typing — trip name suggestions and preset chips replace free-text
entry everywhere except the trip name itself. The organizer's answers are
saved as real `AvailabilityWindow`/`Preference` rows against their
`TripParticipant`, the same schema future participants will fill in from
the invite link. `/trips/new` redirects here; the plain `/sign-in` and
`/join/[code]` pages still exist as the entry point for invited friends who
aren't going through onboarding themselves.

## Group Match engine

`src/lib/matching/` is a standalone, framework- and database-agnostic
module (no Prisma or Next.js imports) that scores every seeded destination
against a group's combined hard constraints and soft preferences:

- **Hard constraints** (pass/fail per participant): blackout dates, an
  explicit max budget, an explicit max flight time, and destination
  exclusions.
- **Soft preferences** (influence the 0-100 score, never disqualify):
  budget headroom vs. target, trip length fit, climate, an activity-vibe
  match (beach/nightlife/food/luxury/culture/adventure), flight time,
  wanting a specific destination, and how many people vetoed one.

The entry point is `matchDestinations(participants, destinations?, options?)`
in `src/lib/matching/engine.ts` — pure and deterministic, so the same
inputs always produce the same output. It finds the best-overlapping
availability window for the group, scores every destination against it,
and returns one ranked result per destination with a full score breakdown
plus human-readable "key matching factors" and "compromises". `~50`
realistic destinations are seeded in `src/lib/matching/destinations.ts`
with flight times from Manchester, London, Birmingham and Edinburgh — no
live travel API is called.

`src/lib/matching-adapter.ts` (pure) and `src/lib/matching-service.ts`
(talks to Prisma) map real trip data onto the engine's input shape. Several
inputs the engine supports — preferred climate, an explicit budget/flight
cap, destination exclusions/preferences, blackout dates — aren't collected
by onboarding yet, so they default to neutral until a future preferences
screen asks for them; the `Preference` and `BlackoutWindow` schema is
already in place for when it does.

## Destination discovery

`/trips/[tripId]/discover` is the main destination-browsing experience:
one card per real engine result (destination, country, match %, dates,
cost, flight time, how many of the group can actually attend, and the
positives/compromises behind the score), a horizontally-scrollable sort
bar (match score, budget, flight time, trip length, or a specific vibe —
beach/nightlife/luxury/culture), and budget/flight-time filters. Nothing
here is invented: sorting and filtering only ever reorder or narrow the
engine's actual output. "View destination" opens a full detail page with
the complete score breakdown, the destination's own ratings, and who in
the group can attend; "Vote" records the signed-in user's vote against a
fresh server-computed snapshot of that match (never trusting a client-sent
score) via `src/lib/votes.ts`, backed by the `DestinationSuggestion`/`Vote`
tables. Destinations are seeded in code, not the database, so
`DestinationSuggestion.destinationId` is a plain string matching
`src/lib/matching/destinations.ts`'s ids rather than a foreign key. The
route has its own `loading.tsx` (skeleton cards), `error.tsx`, and empty
states for "nobody's submitted yet" and "no matches clear the filters".

## Stack

- Next.js (App Router) + TypeScript, Tailwind CSS
- PostgreSQL + Prisma
- Auth.js (NextAuth v5) — passwordless email ("magic link") sign-in
- Vitest + React Testing Library

## Prerequisites

- Node.js 20+
- A local PostgreSQL server

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local env file and fill in real values:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — point this at a local Postgres database.
   - `AUTH_SECRET` — generate one with `openssl rand -base64 32`.
   - The `EMAIL_SERVER_*` / `EMAIL_FROM` variables are optional. If you leave
     them blank, sign-in links are printed to the terminal running `npm run
     dev` instead of being emailed — this is enough to use the app locally
     without setting up real SMTP credentials.

3. Create the database migrations:

   ```bash
   npm run db:migrate
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. To sign in, enter any email address — since
   SMTP isn't configured by default, watch the terminal for a line like:

   ```
   [dev] Sign-in link for you@example.com:
   http://localhost:3000/api/auth/callback/nodemailer?...
   ```

   Open that link in your browser to complete sign-in.

## Scripts

| Command                | Purpose                                      |
| ----------------------- | --------------------------------------------- |
| `npm run dev`            | Start the dev server                          |
| `npm run build`          | Production build                              |
| `npm run start`          | Run a production build                        |
| `npm run lint`           | ESLint                                        |
| `npm run typecheck`      | TypeScript, no emit                           |
| `npm run test`           | Run the test suite once                       |
| `npm run test:watch`     | Run tests in watch mode                       |
| `npm run db:migrate`     | Create/apply a Prisma migration in dev        |
| `npm run db:deploy`      | Apply existing migrations (CI/production)     |
| `npm run db:studio`      | Open Prisma Studio to inspect the database    |

## Project layout

```
prisma/schema.prisma        Database schema (full product model; locking a
                             trip in isn't wired up to the UI yet)
src/lib/matching/            The standalone Group Match engine (pure, tested
                             in isolation — no Prisma or Next.js imports)
src/lib/matching-adapter.ts  Pure mapping from DB rows to the engine's input
src/lib/matching-service.ts  Loads a trip's participants and runs the engine
src/lib/votes.ts             Vote persistence, snapshotting a fresh match
src/lib/format.ts            Pure display formatting for dates/cost/flight time
src/auth.ts                  Auth.js configuration
src/lib/                     Env validation, Prisma client, business logic,
                              validation schemas, onboarding option constants
src/components/ui/           Reusable, accessible UI primitives
src/components/auth/         Sign-in / sign-out forms
src/components/trips/        Trip-specific components (invite link, join form)
src/components/onboarding/   The onboarding wizard shell, steps, and options UI
src/components/discover/     Destination discovery UI (cards, sort/filter,
                              skeletons, rating bars, vote button)
src/app/(app)/                Dashboard, sign-in, trip, join and discover
                              pages (behind the site header)
src/app/onboarding/           The onboarding flow (its own full-bleed layout,
                              no site header)
```
