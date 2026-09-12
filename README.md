# Kitty

A working app for the group-trip coordination business described in the
business plan (working name: "Kitty" — a placeholder, easy to change).
Organiser creates a trip and shares one link; friends join with just a
name, answer three private questions (availability, budget, destination),
an AI reconciles the answers into 2–3 concrete options, the group picks
one, and everyone pays their share plus a flat £5 fee — with a live
percentage-collected view and one-click reminders for stragglers.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma** + **SQLite** — zero external database to set up
- **Claude (Anthropic API)**, optional — reconciles constraints into trip
  options and drafts reminder messages; falls back to a deterministic
  rule-based version of both when no API key is configured, so the app is
  fully usable out of the box

## Getting started

```bash
npm install
cp .env.example .env      # SQLite by default, no edits needed to run locally
npm run db:migrate         # creates prisma/dev.db and applies the schema
npm run dev
```

Open http://localhost:3000, click **Create a trip**, and follow the flow —
or open the invite link it gives you in a second browser/incognito window
to join as a friend.

### Optional: real AI

Add an Anthropic API key to `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

With it set, "Generate suggestions" and "Send reminder" call Claude
directly (see `lib/ai.ts`). Without it, both features still work via a
deterministic heuristic (`lib/ai.ts`'s `generateHeuristic` /
`draftReminderMessage`'s template fallback) — useful for demos or CI
without needing a key.

## How the pieces map to the business plan

| Product spec (business plan §3) | Where it lives |
|---|---|
| Link-in, no signup for participants | `app/t/[slug]/join`, `Participant.token` — a bearer link, no accounts |
| Private 3-question form | `app/p/[token]`, `components/ResponseForm.tsx` — answers are never shown to other participants or on the organiser dashboard, only fed into the AI step |
| 2–3 proposed options | `lib/ai.ts` `generateSuggestions` — every option is capped at the group's lowest stated budget so nobody is silently priced out |
| Vote / deadline with a default | `Trip.responseDeadline`; the organiser locks in one option for the group (v1 — see below) |
| Deposit pot + automated nudges | `app/api/trips/[slug]/choose`, `.../remind`, `lib/notifications.ts` |
| £5 processing fee, charged to participants | `lib/payments.ts` `PROCESSING_FEE_PENCE`, added on top of each `Payment.contributionPence` |
| % of pot collected | `lib/trip-helpers.ts` `computeProgress`, shown on both the organiser dashboard and each participant's own page |

### Deliberately out of scope / simplified for v1

- **Voting.** The plan calls for the whole group to vote by a deadline
  with a default outcome. This build has the organiser choose the option
  on the group's behalf once suggestions are in — the data model
  (`Suggestion.optionsJson`, `Trip.chosenOptionIndex`) supports adding a
  real per-participant vote later without a schema rework.
- **Payments.** `lib/payments.ts` is a `PaymentProvider` interface with a
  `MockPaymentProvider` that simulates a successful open banking
  confirmation — clearly labelled "test mode" in the UI. The business plan
  is explicit that real money needs a regulated UK open banking partner
  (TrueLayer / GoCardless / Yapily) and specialist legal advice on holding
  client funds before going live; swap the mock for a real implementation
  of the same interface once that's in place.
- **Notifications.** `lib/notifications.ts` defaults to logging reminders
  to the server console and an in-app `Notification` table (visible as the
  "Sent:" message on the organiser dashboard) rather than sending real
  email/SMS, which needs its own provider and credentials.
- **Itineraries, booking, native app, chat, maps** — explicitly out of
  scope for v1 in the plan itself.

## Project structure

```
app/
  page.tsx                        Marketing home page
  trip/new/                       Create-a-trip form
  t/[slug]/join/                  Participant join-by-name page
  t/[slug]/admin/[adminToken]/    Organiser dashboard
  p/[token]/                      Participant's personal page (answer → wait → pay)
  api/                            Route handlers (mutations only — reads happen
                                   directly in server components via Prisma)
components/                       Client components (forms, buttons) used by the pages above
lib/
  ai.ts                           Claude-backed suggestion/reminder generation + heuristic fallback
  payments.ts                     Payment provider abstraction (mock, test-mode)
  notifications.ts                Notification channel abstraction (console/in-app log)
  trip-helpers.ts                 Shared progress/chosen-option calculations
  db.ts, tokens.ts, money.ts, types.ts
prisma/schema.prisma              Trip, Participant, Response, Suggestion, Payment, Notification
```

## Things to do before this goes live

- Swap the brand name ("Kitty") throughout once one is chosen.
- Replace `MockPaymentProvider` with a real open banking integration —
  after the legal/regulatory review the business plan calls for.
- Replace `ConsoleNotificationChannel` with real email/SMS delivery.
- Move off SQLite to a hosted database for anything beyond local dev/demo.
- Add real authentication/rate-limiting on the token-based links if this
  goes beyond a small pilot.
