# Group Trip

Group holiday planning MVP. Covers accounts, a premium mobile-first
onboarding flow that creates a trip and collects the organizer's own dates,
budget and travel preferences, and inviting/joining a trip via a shareable
link. Destination matching, voting, and locking a trip are later phases and
are not implemented yet.

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
prisma/schema.prisma       Database schema (full product model; only the
                            auth + Trip/TripParticipant/AvailabilityWindow/
                            Preference tables are wired up to the UI so far)
src/auth.ts                 Auth.js configuration
src/lib/                    Env validation, Prisma client, business logic,
                             validation schemas, onboarding option constants
src/components/ui/          Reusable, accessible UI primitives
src/components/auth/        Sign-in / sign-out forms
src/components/trips/       Trip-specific components (invite link, join form)
src/components/onboarding/  The onboarding wizard shell, steps, and options UI
src/app/(app)/               Dashboard, sign-in, trip and join pages (behind
                             the site header)
src/app/onboarding/          The onboarding flow (its own full-bleed layout,
                             no site header)
```
