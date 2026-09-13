# Group Trip

Group holiday planning MVP, from an empty group chat to a confirmed trip:
accounts, a premium mobile-first onboarding flow that creates a trip and
collects the organizer's own dates, budget and travel preferences,
inviting/joining via a shareable link, a standalone Group Match engine that
scores destinations against everyone's combined constraints and
preferences, a destination discovery experience with filtering, sorting and
a detail view, a server-authoritative group vote, and a confirmed-trip
dashboard the organizer locks the group's decision into, and a Stripe-backed
payment ledger the group pays through. Booking — flights, accommodation,
activities, restaurants and the itinerary — is a later phase; those sections
exist as placeholders.

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
trip"**, and `lockTrip` re-checks that server-side rather than trusting the
absent button; the lock itself is a conditional `updateMany` against
`status != CONFIRMED`, so two simultaneous locks can't both succeed. A
confirmation modal explains exactly what will be confirmed before anything
is written.

## The confirmed trip

Locking takes the trip from planning (`DRAFT` → `COLLECTING` →
`RECOMMENDING`) to **`CONFIRMED`**, and `/trips/[tripId]` stops being a
planning screen and becomes the trip's dashboard — the surface every later
feature hangs off. It opens on the payoff: a full-bleed **"🎉 It's
happening"** hero with the destination, the country, the confirmed dates,
and the headcount, nights and estimated cost per person.

Everything on that screen comes from a snapshot written at lock time —
destination, dates, cost range and the ids of the participants whose
availability actually covered those dates — so the confirmed plan keeps
showing what the group agreed even if someone edits their preferences
afterwards. `src/lib/confirmedTrip.ts` turns that row into the view model
and returns null if any part of it is missing, so the UI shows the planning
experience rather than a half-filled celebration, and never recomputes or
invents a price, a date or a headcount.

Below the hero: everyone on the trip, with the ones whose dates don't work
marked honestly rather than quietly dropped, then a placeholder section per
planning area still to come — ✈️ Flights, 🏨 Accommodation, 🍸 Activities,
🍝 Restaurants, 🗓 Itinerary, 💳 Payments. Nothing is bookable yet and each
card says so.

Voting closes everywhere once a trip is confirmed: the ballot redirects to
the dashboard, the discovery list drops its vote buttons, and the trips
list leads with the destination and dates instead of a workflow status.
Only the organizer can reopen the trip — behind its own confirmation step —
which clears the snapshot and returns it to planning with everyone's votes
intact.

## Payments

Full architecture and the reasoning behind it: **[PAYMENTS.md](PAYMENTS.md)**.

The organizer sets a total trip cost per person and a required initial
payment that **every participant pays identically** — there is no per-person
field, and the server refuses to change the amount once anyone has paid. The
first payment carries a one-time £5 platform fee (£200 trip + £5 fee = £205
charged); every payment after it is trip money only.

The fee is charged **once per participant per trip**, guaranteed by a unique
constraint on `PlatformFee(tripId, userId)` rather than by application logic
a retry could race past. And it is never trip money: £1,200 owed, £300 paid
and a £5 fee leaves **£900** outstanding, not £895. `Payment.amount` and
`Payment.platformFee` are separate columns and only the former ever reaches
a balance.

Money moves by **Stripe destination charge** with `on_behalf_of`, so trip
money passes through to the trip's settlement account instead of resting in
our balance, while `application_fee_amount` brings us exactly our fee. Who
that settlement account is stays configuration (`Trip.settlementMode`), and
the default — `UNCONFIGURED` — means no payment can be taken at all, rather
than the platform quietly taking custody of customer travel money before the
structure that should hold it exists.

Security, in short: card details never reach this app, secret keys are
server-only, and **the frontend never decides a payment succeeded**. Creating
a payment writes a `PENDING` row and nothing more; only a signature-verified
webhook settles it. Stripe event ids are claimed in `WebhookEvent`, so a
redelivery is a no-op; charges carry deterministic idempotency keys, so a
double-click can't double-charge; money columns are never rewritten after
they're written, with every status change recorded in `PaymentEvent`; and a
refund records the trip money and the platform fee it returns as two separate
figures.

The initial payment is a one-time required payment followed by optional
manual ones — there is no subscription, schedule or recurring mandate
anywhere in this code.

## Stack

- Next.js (App Router) + TypeScript, Tailwind CSS
- PostgreSQL + Prisma
- Auth.js (NextAuth v5) — passwordless email ("magic link") sign-in
- Stripe (Connect destination charges) for payments
- Vitest + React Testing Library

## Prerequisites

- Node.js 20+
- A local PostgreSQL server (the payment tests run against it)

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
   - The `STRIPE_*` variables are optional too. Without all three, the
     payment surface reports itself unavailable rather than half-working. To
     try payments locally, use **test-mode** keys from the Stripe dashboard
     and run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
     for the webhook signing secret. Never commit real keys.

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
src/lib/confirmedTrip.ts     The confirmed trip's view model, built only from
                              the snapshot taken at lock time
src/lib/payments/            The payment ledger: pure money maths and state
                              machine, the payment rules, the Stripe gateway,
                              the service, refunds and the webhook processor
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
src/components/voting/       The ballot
src/components/confirmed/    The confirmed-trip dashboard (hero, participants,
                              placeholder sections, organizer reopen)
src/components/payments/     Payment setup, the participant's payment panel,
                              progress and status badges
src/app/(app)/               Dashboard, sign-in, trip, join, discover and
                              vote pages (behind the site header)
src/app/api/webhooks/stripe/ The Stripe webhook — the only thing that decides
                              a payment succeeded
src/app/onboarding/          The onboarding flow (its own full-bleed layout,
                              no site header)
```
