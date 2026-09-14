# Notification architecture

How the payment domain tells people things, and why it's built in this order.

## The shape

```
payment ledger ──emit──▶ event ──plan──▶ notifications ──dispatch──▶ channels
                                    │                            ├── in-app   (implemented)
                                    │                            ├── email    (pluggable)
                                    └── preferences ─────────────┴── push     (pluggable)
```

Four pieces, deliberately separated so the hard parts are testable without a
provider, a queue or an inbox:

| | What it decides | Pure? |
|---|---|---|
| `events.ts` | Which notifications an event warrants, for whom, saying what | Yes |
| `preferences.ts` | Whether a category on a channel is on for someone | Yes |
| `channels.ts` | How a notification physically reaches someone | Per transport |
| `dispatch.ts` | Storing, deduplicating, and attempting each channel | No (database) |

The two files that decide *who hears what* are pure functions. That's the
part that's easy to get subtly wrong and expensive to get wrong quietly, so
it's decided where it can be tested exhaustively and separately from how
anything is delivered.

## The seven events

Emitted by the payment domain when money moves, and by a scheduled scan when
time passes:

| Event | Emitted by | Who hears |
|---|---|---|
| `INITIAL_PAYMENT_COMPLETED` | Webhook settling a deposit | Payer (receipt) + organizer |
| `ADDITIONAL_PAYMENT_COMPLETED` | Webhook settling a top-up | Payer only |
| `TRIP_BALANCE_FULLY_PAID` | Webhook clearing a balance | Payer + organizer |
| `PAYMENT_FAILED` | Webhook, or a failed checkout | Payer only |
| `INITIAL_PAYMENT_OUTSTANDING` | Organizer's nudge | That participant |
| `PAYMENT_DEADLINE_APPROACHING` | Scheduled scan | Participants who still owe |
| `PAYMENT_DEADLINE_PASSED` | Scheduled scan | Participants who still owe |

## Not sending unnecessary notifications

Noise is how people end up muting the messages that matter, so restraint is
designed in rather than left to judgement later:

- **The organizer hears about deposits, not top-ups.** A deposit is the thing
  they chase; six people making voluntary payments would bury them.
- **An organizer paying their own deposit gets a receipt, not a receipt *and*
  an "activity on your trip" notification.**
- **A failed card is between the payer and their bank.** Nobody else is told.
- **Nobody is told what they can already see.** The organizer is never
  notified that somebody hasn't paid — that's what the dashboard is for.
- **Paid off in full supersedes the receipt** for whichever payment happened
  to be the last one, rather than sending both.
- **Deadline reminders only reach people who still owe money**, and stop the
  moment they don't.
- **Every notification is deduplicated** by a deterministic key with a unique
  constraint behind it. A replayed webhook, a scan that runs hourly, or an
  organizer leaning on the reminder button all produce nothing the second
  time. Deadline reminders are keyed on the *deadline*, so moving it can
  legitimately re-notify; nudges are keyed on the day.

## Preferences

Per category, per channel, stored only when someone changes something — the
absence of a row means the default applies.

| Category | In-app | Email | Push |
|---|---|---|---|
| Your payments | on | off | off |
| Payment problems | on | **on** | off |
| Payment reminders | on | **on** | off |
| Activity on trips you organise | on | off | off |

In-app is on for everything: it's a list people choose to look at, so it
costs them nothing. Email is reserved for what needs acting on — a failed
payment, money owed — because routine receipts would otherwise be most of the
mail. Push is off everywhere until someone asks; an app that starts buzzing
on install is an app people mute.

A channel someone has switched off is never attempted, so an unconfigured
provider can't leak past a preference.

## Channels

A channel is anything that can take a notification and try to deliver it. The
dispatcher doesn't know which.

- **In-app** is implemented. The notification row *is* the delivery.
- **Email** and **push** are registered but unconfigured. They report
  themselves unavailable and the attempt is recorded as `UNAVAILABLE` with a
  reason — so the pipeline is complete and observable before any provider is
  chosen, and nothing silently pretends to have sent.

Adding a provider means writing one `send` and flipping `isAvailable`.
Nothing else changes. No provider is named anywhere in this codebase.

Every attempt is recorded, including the ones that sent nothing, so "why
didn't I get that?" has an answer: turned off, no provider, or failed — and
if it failed, why.

## Order of operations

Plan → store → attempt. Storing before delivering means a transport falling
over never loses the fact that we decided to tell someone something. And
emitting is best-effort: a notification failing must never fail the thing
that caused it, so a webhook that settled a payment has done its job even if
nobody gets told, and Stripe is never asked to retry over it.

## The organizer's reminder

The organizer can nudge participants who haven't made their initial payment.
Two properties matter, and both are structural rather than a matter of care:

**It cannot change what anyone owes.** `organizerReminders.ts` reads the
ledger and writes notifications. It never touches `Payment`, `PlatformFee`,
`Refund` or any payment column on `TripParticipant`, so an organizer cannot
mark someone as paid, waive a balance or move a deadline by sending a
reminder. Who owes what stays a consequence of money actually moving. A test
snapshots every payment table before and after a nudge and asserts they are
identical.

**It cannot become harassment.** Reminders are rate limited to once per
participant per 24 hours, and the notification's dedupe key is day-stamped,
so pressing the button repeatedly produces nothing.

## What isn't built

No email is sent. No push is sent. No provider is chosen, no templates
exist, no unsubscribe flow, no device tokens, and the deadline scan has no
scheduler attached — `scanAllTripsForReminders` is the function a cron would
call. Those are deliberate omissions, not oversights: the architecture is
here so that adding any of them is a contained change.
