# Payment architecture

How money moves through Group Trip, why the Stripe Connect integration is
shaped the way it is, and the rules the code enforces.

## The money flow

A participant's **first** payment for a trip is a single card charge that
carries two distinct amounts:

```
Trip payment      £200.00     goes to the trip's settlement account
Platform fee        £5.00     goes to us
────────────────────────
Total charged     £205.00     one card charge
```

Every **subsequent** payment towards the same trip carries trip money only:

```
Trip payment      £300.00     goes to the trip's settlement account
Platform fee        £0.00     already charged, never charged again
────────────────────────
Total charged     £300.00
```

The £5 fee is charged **once per participant per trip**. That is enforced by
a unique constraint on `PlatformFee(tripId, userId)`, not by application
logic alone — a retry, a double-click or two concurrent requests cannot
produce a second fee row.

### The platform fee is never part of the trip balance

A participant's remaining balance is computed from **trip money only**:

```
Trip cost           £1,200
Trip payments         £300
Platform fees           £5     ← not part of this calculation
────────────────────────
Remaining balance     £900     (not £895)
```

`Payment.amount` (trip money) and `Payment.platformFee` are separate
columns; `totalCharged` is their sum and exists only so the charge can be
reconciled against Stripe. Every balance calculation sums `amount`.

## Which Connect architecture, and why

Stripe Connect offers three charge shapes. The choice decides who is the
merchant of record, where the money lands, and who carries the liability.

| | Direct charges | **Destination charges** | Separate charges & transfers |
|---|---|---|---|
| Merchant of record | Connected account | Platform (or the connected account via `on_behalf_of`) | Platform |
| Where funds settle | Straight to the connected account, never touching our balance | Our balance, with the destination's share moved immediately by Stripe | Our balance, until *we* decide to transfer |
| Our cut | `application_fee_amount` | `application_fee_amount` | Whatever we don't transfer |
| Chargeback liability | Connected account | Platform | Platform |
| Do we hold customer money? | No | Only in passing | **Yes, indefinitely** |

**We use destination charges with `on_behalf_of`.**

*Separate charges and transfers* is rejected as the default precisely
because it means customer travel money accumulates in our Stripe balance
until we choose to move it. For a group of friends paying months ahead of a
trip that hasn't been booked, that is client money, and holding it invites
safeguarding, licensing and (in the UK, for package travel) insolvency
protection obligations that this product has not yet taken on. Stripe's own
guidance is to pay out to connected accounts as soon as they are identified
rather than holding funds without a clear purpose.

*Direct charges* avoid our balance entirely and are attractive for exactly
that reason, but they make the connected account the merchant of record,
put our name off the customer's statement, and hand refunds and disputes to
that account. We need to orchestrate refunds at the group level and to
split each refund between trip money and our own fee, so we keep that
control.

*Destination charges* give us one charge per payment, money that moves
through to the settlement account in the same operation rather than
resting with us, an `application_fee_amount` that is exactly our fee, and a
refund API that can reverse the trip money while treating our fee
separately. We accept that this leaves the platform liable for chargebacks
and Stripe's processing fees — a real cost, taken knowingly in exchange for
control of the money flow.

### The settlement account is deliberately not decided here

Who the destination account actually *is* — a ring-fenced client-money
account, a bonded travel entity, the eventual operating company, or the
suppliers themselves once booking exists — is a legal and business
question this codebase does not presume to answer. So it is configuration,
not code:

```
Trip.settlementMode      UNCONFIGURED | CONNECTED_ACCOUNT | PLATFORM_BALANCE
Trip.settlementAccountId the Stripe connected account id, when applicable
```

- `UNCONFIGURED` (the default) — **payments cannot be taken at all.** The
  organiser sees that payments aren't available yet. This is the honest
  default: we do not quietly take custody of money before the structure
  that holds it exists.
- `CONNECTED_ACCOUNT` — a destination charge to that account. The intended
  production shape.
- `PLATFORM_BALANCE` — funds rest with us. Supported because a genuine
  hold-until-booked flow may later need it, but it is an explicit, named
  choice rather than something you get by accident, and it is the mode that
  carries the safeguarding obligations above.

Switching modes changes the arguments passed to `paymentIntents.create`.
Nothing else in the ledger, the balances or the UI depends on the choice.

## Security posture

- **Card details never reach us.** The client confirms the payment against
  Stripe directly with a client secret; no card data touches our servers or
  our database.
- **Secret keys are server-only.** `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET` are read through the validated server env loader
  and are never imported into a client component. Only the publishable key
  is exposed.
- **The frontend never determines success.** Creating a payment writes a
  `PENDING` row so the attempt is auditable, and nothing else. A payment
  only becomes `SUCCEEDED` when a signature-verified webhook says so.
- **Webhooks are the source of truth**, verified with
  `stripe.webhooks.constructEvent` against the raw request body. An
  unverified body is rejected before it is parsed.
- **Duplicate webhooks are inert.** Every event id is inserted into
  `WebhookEvent` first; the unique constraint makes redelivery a no-op
  rather than a second state transition.
- **Duplicate charges are prevented by idempotency.** Each attempt derives a
  deterministic idempotency key, and an open PaymentIntent for a
  participant is reused rather than replaced.
- **The ledger is append-only.** Money columns are never rewritten after a
  row is created. Status changes are recorded as `PaymentEvent` rows
  carrying the Stripe event id that caused them, so every transition can be
  traced back to its source.
- **Refunds distinguish the two kinds of money.** A `Refund` row records
  `tripAmount` and `platformFeeAmount` separately, so refunding someone's
  trip money without returning our fee — or returning both — is an explicit
  decision recorded in the ledger rather than an accident of arithmetic.

## Participant payment states

Derived from the ledger, never stored as the primary truth. Precedence runs
top to bottom; the first matching rule wins:

| State | When |
|---|---|
| `REFUNDED` | Every penny of trip money they paid has been refunded |
| `PARTIALLY_REFUNDED` | Some, but not all, of their trip money is refunded |
| `REFUND_PENDING` | A refund has been requested and hasn't settled |
| `FULLY_PAID` | Successful trip payments ≥ their total trip cost |
| `PAYMENT_OVERDUE` | A deadline has passed with the matching obligation unmet |
| `INITIAL_PAYMENT_PENDING` | An initial payment is in flight |
| `PARTIALLY_PAID` | Paid more than the initial requirement, less than the total |
| `INITIAL_PAYMENT_PAID` | Successful trip payments ≥ the required initial payment |
| `PAYMENT_FAILED` | Their most recent attempt failed and nothing has succeeded |
| `NO_PAYMENT` | Nothing attempted |

## What this is not

The initial payment is a **one-time required payment followed by optional
manual payments** — not an instalment plan. There is no Stripe
Subscription, no Schedule, no recurring mandate and nothing that charges a
saved card without the participant initiating it.
