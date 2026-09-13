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
engine's actual output. Destinations are seeded in code, not the database,
so `DestinationSuggestion.destinationId` is a plain string matching
`src/lib/matching/destinations.ts`'s ids rather than a foreign key. The
route has its own `loading.tsx` (skeleton cards), `error.tsx`, and empty
states for "nobody's submitted yet" and "no matches clear the filters".

"View destination" opens `/trips/[tripId]/discover/[destinationId]` — the
full explanation of why that destination was recommended, built entirely
from the engine's structured output (never invented by the UI): a
placeholder hero banner (a climate-derived gradient plus an emoji picked
from the destination's own highest real rating — never a fabricated photo),
the destination's own activity ratings and the full 8-factor score
breakdown as bars, who in the group can actually attend, a **"Why your
group matches"** section (the match % plus every ✓ key factor), and a
**"Things to consider"** section (every ⚠ compromise, or an honest note
when there genuinely aren't any). "Vote for this destination" records the
signed-in user's vote against a fresh server-computed snapshot of that
match (never trusting a client-sent score) via `src/lib/votes.ts`, backed
by the `DestinationSuggestion`/`Vote` tables; "Back to recommendations"
returns to the list. The route has its own `loading.tsx` skeleton and
`error.tsx`, and an unknown destination id or trip you're not part of
renders the shared not-found page rather than leaking any data.

## Group voting and locking

`/trips/[tripId]/vote` is the group's ballot. Every participant gets one
vote for the whole trip, not one per destination: `Vote.participantId` is
`@unique`, so "you can't vote twice" is a database guarantee rather than an
application check two concurrent requests could race past. Changing your
mind updates that same row in place, and tapping your current pick again
withdraws it. Voting is only possible while the trip is unlocked.

Every number on the screen is computed server-side by `src/lib/votes.ts` —
the tally, how many of the group have voted, the progress bar and the
current leader (ties broken by the higher snapshotted match score, then by
destination id, so the leader is deterministic). The client never counts
anything: it replaces its state wholesale with the `VotingState` each
server action returns. When the last participant votes, the board shows
**"Everyone has voted 🎉"** — and nothing else happens automatically.

Locking is the organizer's decision alone. Only they see **"Lock this
trip"**, and `lockTrip` re-checks that server-side rather than trusting
the absent button; the lock itself is a conditional `updateMany` against
`status != LOCKED`, so two simultaneous locks can't both succeed. Locking
confirms the winning destination *and* the dates (recomputed server-side at
lock time and stored on the trip, so the confirmed plan stays fixed even if
someone's preferences change afterwards), flips the status to `LOCKED`, and
closes voting everywhere — the vote board, the discovery list and the trip
home all switch to the confirmed state. A confirmation modal explains
exactly what will be confirmed before anything is written. Only the
organizer can reopen the trip, which clears the confirmed destination and
dates and lets everyone vote again; existing votes are kept.

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
prisma/schema.prisma         Database schema for the full product model
src/lib/matching/            The standalone Group Match engine (pure, tested
                             in isolation — no Prisma or Next.js imports)
src/lib/matching-adapter.ts  Pure mapping from DB rows to the engine's input
src/lib/matching-service.ts  Loads a trip's participants and runs the engine
src/lib/votes.ts             Vote persistence and server-side tallies,
                              snapshotting a fresh server-computed match
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
src/components/voting/       The ballot, the confirmed-trip state, and the
                              organizer's lock/reopen controls
src/app/(app)/               Dashboard, sign-in, trip, join, discover and
                              vote pages (behind the site header)
src/app/onboarding/          The onboarding flow (its own full-bleed layout,
                              no site header)
```
