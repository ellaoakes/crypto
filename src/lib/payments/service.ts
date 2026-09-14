import { createHash } from "node:crypto";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  calculateParticipantBalance,
  type LedgerPayment,
  type ParticipantBalance,
} from "@/lib/payments/balance";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { planCharge, PaymentRuleError, validatePaymentTerms } from "@/lib/payments/rules";
import {
  buildParticipantRow,
  summariseTripPayments,
  type ParticipantPaymentRow,
  type TripPaymentTotals,
} from "@/lib/payments/summary";
import { stripeGateway } from "@/lib/payments/stripeGateway";

export class PaymentError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
  }
}

/** What the participant-facing payment surface needs to render itself. */
export interface ParticipantPaymentView extends ParticipantBalance {
  currency: string;
  paymentDeadline: Date | null;
  finalPaymentDeadline: Date | null;
  platformFeeMinor: number;
  payments: {
    id: string;
    amount: number;
    platformFee: number;
    totalCharged: number;
    status: string;
    kind: string;
    createdAt: Date;
    refundedAmount: number;
  }[];
}

const paymentWithRefunds = {
  refunds: { select: { tripAmount: true, platformFeeAmount: true, status: true } },
} as const;

function toLedger(payments: {
  amount: number;
  platformFee: number;
  status: string;
  kind: string;
  createdAt: Date;
  refunds: { tripAmount: number; platformFeeAmount: number; status: string }[];
}[]): LedgerPayment[] {
  return payments.map((payment) => ({
    amount: payment.amount,
    platformFee: payment.platformFee,
    status: payment.status as LedgerPayment["status"],
    kind: payment.kind as LedgerPayment["kind"],
    createdAt: payment.createdAt,
    refunds: payment.refunds.map((refund) => ({
      tripAmount: refund.tripAmount,
      platformFeeAmount: refund.platformFeeAmount,
      status: refund.status as "PENDING" | "SUCCEEDED" | "FAILED",
    })),
  }));
}

/**
 * Loads a participant and their trip, refusing anyone who isn't actually on
 * the trip. Every payment entry point starts here — authorisation is never
 * inferred from what the client sent.
 */
async function requireParticipant(tripId: string, userId: string) {
  const participant = await prisma.tripParticipant.findUnique({
    where: { tripId_userId: { tripId, userId } },
    include: {
      trip: true,
      user: { select: { email: true } },
      payments: { include: paymentWithRefunds, orderBy: { createdAt: "asc" } },
    },
  });

  if (!participant) {
    throw new PaymentError("NOT_A_PARTICIPANT", "You're not part of this trip.");
  }
  return participant;
}

function termsFor(participant: Awaited<ReturnType<typeof requireParticipant>>) {
  // The participant's own snapshot wins over the trip's current settings:
  // what someone owes is fixed when payments open, not re-read later.
  const totalTripAmount = participant.totalTripAmount ?? participant.trip.totalAmountPerPerson ?? 0;
  const requiredInitialPayment =
    participant.requiredInitialPayment ?? participant.trip.initialPaymentAmount ?? 0;

  return {
    totalTripAmount,
    requiredInitialPayment,
    paymentDeadline: participant.trip.paymentDeadline,
    finalPaymentDeadline: participant.trip.finalPaymentDeadline,
  };
}

export async function getParticipantPaymentView(
  tripId: string,
  userId: string,
  now: Date = new Date(),
): Promise<ParticipantPaymentView> {
  const participant = await requireParticipant(tripId, userId);
  const terms = termsFor(participant);
  const balance = calculateParticipantBalance(toLedger(participant.payments), terms, now);

  return {
    ...balance,
    currency: participant.trip.currency,
    paymentDeadline: participant.trip.paymentDeadline,
    finalPaymentDeadline: participant.trip.finalPaymentDeadline,
    platformFeeMinor: participant.payments.find((p) => p.platformFee > 0)?.platformFee ?? 500,
    payments: participant.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      platformFee: payment.platformFee,
      totalCharged: payment.totalCharged,
      status: payment.status,
      kind: payment.kind,
      createdAt: payment.createdAt,
      refundedAmount: payment.refunds
        .filter((refund) => refund.status === "SUCCEEDED")
        .reduce((total, refund) => total + refund.tripAmount, 0),
    })),
  };
}

/**
 * A deterministic idempotency key for one payment attempt.
 *
 * It deliberately includes the amount and the participant's current position,
 * so two identical requests collapse into one Stripe charge, while a genuine
 * later payment of the same amount gets its own key.
 */
export function buildIdempotencyKey({
  participantId,
  amount,
  platformFee,
  attemptSeed,
}: {
  participantId: string;
  amount: number;
  platformFee: number;
  attemptSeed: string;
}): string {
  return createHash("sha256")
    .update([participantId, amount, platformFee, attemptSeed].join(":"))
    .digest("hex")
    .slice(0, 48);
}

/**
 * Starts a payment: validates it server-side, records a PENDING row so the
 * attempt is auditable, and asks Stripe for an intent. It never marks
 * anything paid — only a verified webhook does that.
 */
export interface StartedPayment {
  paymentId: string;
  /** Stripe's hosted payment page. The participant is redirected here. */
  checkoutUrl: string | null;
  charge: { amount: number; platformFee: number; totalCharged: number; kind: "INITIAL" | "ADDITIONAL" };
  /** True when this resumed an attempt that was already open. */
  resumed: boolean;
}

export async function createPayment(
  {
    tripId,
    userId,
    requestedAmount,
    returnUrlBase,
  }: { tripId: string; userId: string; requestedAmount?: number; returnUrlBase?: string },
  gateway: PaymentGateway = stripeGateway,
  now: Date = new Date(),
): Promise<StartedPayment> {
  const participant = await requireParticipant(tripId, userId);
  const trip = participant.trip;

  if (trip.status !== "CONFIRMED") {
    throw new PaymentError("TRIP_NOT_CONFIRMED", "This trip isn't confirmed yet.");
  }
  if (trip.settlementMode === "UNCONFIGURED") {
    throw new PaymentError(
      "SETTLEMENT_NOT_CONFIGURED",
      "Payments aren't available for this trip yet.",
    );
  }

  // Already have a payment in flight? Send them back to the same Stripe page
  // rather than starting a second one. This is what makes a double-click, a
  // refresh mid-payment, or coming back tomorrow all land on one charge.
  const inFlight = participant.payments.find(
    (payment) => payment.status === "PENDING" || payment.status === "PROCESSING",
  );
  if (inFlight) {
    let checkoutUrl = inFlight.checkoutUrl;

    // The stored page may have expired. Re-creating with the original
    // idempotency key returns Stripe's original session, so this resumes
    // rather than duplicates.
    if (!checkoutUrl) {
      const session = await gateway.createCheckoutSession(
        checkoutArgsFor({
          trip,
          participantId: participant.id,
          paymentId: inFlight.id,
          userId,
          email: participant.user?.email,
          platformFee: inFlight.platformFee,
          totalCharged: inFlight.totalCharged,
          kind: inFlight.kind as "INITIAL" | "ADDITIONAL",
          idempotencyKey: inFlight.idempotencyKey,
          returnUrlBase,
        }),
      );
      checkoutUrl = session.url;
      await prisma.payment.update({
        where: { id: inFlight.id },
        data: {
          checkoutUrl: session.url,
          stripeCheckoutSessionId: inFlight.stripeCheckoutSessionId ?? session.id,
          stripePaymentIntentId: inFlight.stripePaymentIntentId ?? session.paymentIntentId,
        },
      });
    }

    return {
      paymentId: inFlight.id,
      checkoutUrl,
      charge: {
        amount: inFlight.amount,
        platformFee: inFlight.platformFee,
        totalCharged: inFlight.totalCharged,
        kind: inFlight.kind as "INITIAL" | "ADDITIONAL",
      },
      resumed: true,
    };
  }

  const terms = termsFor(participant);
  const balance = calculateParticipantBalance(toLedger(participant.payments), terms, now);

  // A fee row already existing is the authoritative answer to "have we charged
  // this person our fee for this trip", because that table's unique constraint
  // is what enforces the rule.
  const existingFee = await prisma.platformFee.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });

  let charge;
  try {
    charge = planCharge({ balance, requestedAmount, feeAlreadyCharged: Boolean(existingFee) });
  } catch (error) {
    if (error instanceof PaymentRuleError) {
      throw new PaymentError(error.code, error.message);
    }
    throw error;
  }

  const idempotencyKey = buildIdempotencyKey({
    participantId: participant.id,
    amount: charge.amount,
    platformFee: charge.platformFee,
    attemptSeed: `${balance.totalAmountPaid}:${participant.payments.length}`,
  });

  // The attempt is recorded before Stripe is asked for anything, so a payment
  // someone started is always auditable — even one that never completes.
  const payment = await prisma.payment.create({
    data: {
      tripId,
      userId,
      participantId: participant.id,
      amount: charge.amount,
      platformFee: charge.platformFee,
      totalCharged: charge.totalCharged,
      currency: trip.currency,
      kind: charge.kind,
      status: "PENDING",
      idempotencyKey,
      events: { create: { toStatus: "PENDING", detail: "Payment attempt created" } },
    },
  });

  try {
    const session = await gateway.createCheckoutSession(
      checkoutArgsFor({
        trip,
        participantId: participant.id,
        paymentId: payment.id,
        userId,
        email: participant.user?.email,
        platformFee: charge.platformFee,
        totalCharged: charge.totalCharged,
        kind: charge.kind,
        idempotencyKey,
        returnUrlBase,
      }),
    );

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.paymentIntentId,
        checkoutUrl: session.url,
      },
    });

    // The fee is reserved the moment the charge that carries it is created, so
    // a concurrent second attempt hits the unique constraint instead of
    // planning another fee.
    if (charge.platformFee > 0) {
      await prisma.platformFee.create({
        data: {
          tripId,
          userId,
          amount: charge.platformFee,
          currency: trip.currency,
          paymentId: payment.id,
          status: "PENDING",
        },
      });
    }

    return { paymentId: payment.id, checkoutUrl: session.url, charge, resumed: false };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureCode: "CHECKOUT_CREATE_FAILED",
        failureMessage: error instanceof Error ? error.message : "Unknown error",
        events: {
          create: { fromStatus: "PENDING", toStatus: "FAILED", detail: "Checkout creation failed" },
        },
      },
    });
    throw error instanceof Error
      ? new PaymentError("CHECKOUT_CREATE_FAILED", error.message)
      : new PaymentError("CHECKOUT_CREATE_FAILED", "Couldn't start that payment.");
  }
}

/** Builds the Checkout Session arguments for one attempt. */
function checkoutArgsFor({
  trip,
  participantId,
  paymentId,
  userId,
  email,
  platformFee,
  totalCharged,
  kind,
  idempotencyKey,
  returnUrlBase,
}: {
  trip: { id: string; name: string; currency: string; settlementMode: string; settlementAccountId: string | null };
  participantId: string;
  paymentId: string;
  userId: string;
  email?: string;
  platformFee: number;
  totalCharged: number;
  kind: "INITIAL" | "ADDITIONAL";
  idempotencyKey: string;
  returnUrlBase?: string;
}) {
  const base = returnUrlBase ?? `${env.APP_URL}/trips/${trip.id}/pay`;

  return {
    totalCharged,
    applicationFee: platformFee,
    currency: trip.currency,
    idempotencyKey,
    destinationAccountId:
      trip.settlementMode === "CONNECTED_ACCOUNT" ? trip.settlementAccountId ?? undefined : undefined,
    lineItemName: kind === "INITIAL" ? `${trip.name} — initial payment` : `${trip.name} — payment`,
    lineItemDescription:
      platformFee > 0
        ? `Trip payment plus a one-time platform fee`
        : "Trip payment",
    // Stripe appends its own session id; ours identifies the attempt so the
    // return page can report on it without trusting anything Stripe sends back.
    successUrl: `${base}?status=returned&payment=${paymentId}`,
    cancelUrl: `${base}?status=cancelled&payment=${paymentId}`,
    customerEmail: email,
    metadata: { tripId: trip.id, userId, participantId, paymentId },
  };
}

/** Sets a trip's payment terms. Organizer only, and locked once anyone pays. */
export async function setPaymentTerms({
  tripId,
  userId,
  totalAmountPerPerson,
  initialPaymentAmount,
  currency = "GBP",
  paymentDeadline,
  finalPaymentDeadline,
  now = new Date(),
}: {
  tripId: string;
  userId: string;
  totalAmountPerPerson: number;
  initialPaymentAmount: number;
  currency?: string;
  paymentDeadline?: Date | null;
  finalPaymentDeadline?: Date | null;
  now?: Date;
}) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { organizerId: true, status: true },
  });

  if (!trip) {
    throw new PaymentError("TRIP_NOT_FOUND", "That trip doesn't exist.");
  }
  if (trip.organizerId !== userId) {
    throw new PaymentError(
      "NOT_ORGANIZER",
      "Only the trip organizer can set up payments.",
    );
  }
  if (trip.status !== "CONFIRMED") {
    throw new PaymentError(
      "TRIP_NOT_CONFIRMED",
      "Confirm the trip before setting up payments.",
    );
  }

  try {
    validatePaymentTerms({
      totalAmountPerPerson,
      initialPaymentAmount,
      paymentDeadline,
      finalPaymentDeadline,
      now,
    });
  } catch (error) {
    if (error instanceof PaymentRuleError) {
      throw new PaymentError(error.code, error.message);
    }
    throw error;
  }

  // Once anyone has paid, the initial amount is fixed: every participant has
  // to be held to the same figure, and someone who already paid £200 can't be
  // retrospectively told it should have been £300.
  const paidCount = await prisma.payment.count({
    where: { tripId, status: { in: ["PENDING", "PROCESSING", "SUCCEEDED"] } },
  });
  if (paidCount > 0) {
    const current = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { initialPaymentAmount: true, currency: true },
    });
    if (current?.initialPaymentAmount !== initialPaymentAmount) {
      throw new PaymentError(
        "INITIAL_LOCKED",
        "Someone has already paid, so the initial payment amount can't change.",
      );
    }
    if (current?.currency !== currency) {
      throw new PaymentError(
        "CURRENCY_LOCKED",
        "Someone has already paid, so the currency can't change.",
      );
    }
  }

  await prisma.$transaction([
    prisma.trip.update({
      where: { id: tripId },
      data: {
        totalAmountPerPerson,
        initialPaymentAmount,
        currency,
        paymentDeadline: paymentDeadline ?? null,
        finalPaymentDeadline: finalPaymentDeadline ?? null,
      },
    }),
    // Snapshot onto every participant. This is what makes "everyone pays the
    // same initial amount" true by construction rather than by convention.
    prisma.tripParticipant.updateMany({
      where: { tripId },
      data: {
        totalTripAmount: totalAmountPerPerson,
        requiredInitialPayment: initialPaymentAmount,
        remainingBalance: totalAmountPerPerson,
      },
    }),
  ]);

  // Participants who already paid something need their projection rebuilt
  // against the new total.
  const participants = await prisma.tripParticipant.findMany({
    where: { tripId },
    select: { userId: true },
  });
  for (const participant of participants) {
    await refreshParticipantProjection(tripId, participant.userId, now);
  }
}

/**
 * Recomputes the participant's cached payment columns from the ledger in
 * full. Never increments anything — the ledger stays the only source of
 * truth and this is a projection of it.
 */
export async function refreshParticipantProjection(
  tripId: string,
  userId: string,
  now: Date = new Date(),
) {
  const participant = await requireParticipant(tripId, userId);
  const terms = termsFor(participant);
  const balance = calculateParticipantBalance(toLedger(participant.payments), terms, now);

  await prisma.tripParticipant.update({
    where: { id: participant.id },
    data: {
      initialPaymentPaid: balance.initialPaymentPaid,
      totalAmountPaid: balance.totalAmountPaid,
      remainingBalance: balance.remainingBalance,
      platformFeePaid: balance.platformFeePaid,
      paymentStatus: balance.status,
    },
  });

  return balance;
}

/**
 * What the return-from-Stripe page shows one payment attempt.
 *
 * Deliberately narrow: it reports the ledger's view, which only a verified
 * webhook can move to SUCCEEDED. Coming back from Stripe with a success URL
 * proves the participant finished the form, not that the money moved.
 */
export type PaymentOutcome =
  | "succeeded"
  | "failed"
  | "cancelled"
  /** Stripe took it, we haven't had the webhook yet. Keep waiting. */
  | "awaiting_confirmation";

export interface PaymentAttemptStatus {
  paymentId: string;
  outcome: PaymentOutcome;
  amount: number;
  platformFee: number;
  totalCharged: number;
  currency: string;
  kind: string;
  failureMessage: string | null;
  checkoutUrl: string | null;
}

export async function getPaymentAttemptStatus({
  tripId,
  userId,
  paymentId,
}: {
  tripId: string;
  userId: string;
  paymentId: string;
}): Promise<PaymentAttemptStatus> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  // Scoped to the signed-in user and this trip: a payment id in a URL tells
  // nobody anything about someone else's money.
  if (!payment || payment.userId !== userId || payment.tripId !== tripId) {
    throw new PaymentError("PAYMENT_NOT_FOUND", "We couldn't find that payment.");
  }

  const outcome: PaymentOutcome =
    payment.status === "SUCCEEDED"
      ? "succeeded"
      : payment.status === "FAILED"
        ? "failed"
        : payment.status === "CANCELLED"
          ? "cancelled"
          : "awaiting_confirmation";

  return {
    paymentId: payment.id,
    outcome,
    amount: payment.amount,
    platformFee: payment.platformFee,
    totalCharged: payment.totalCharged,
    currency: payment.currency,
    kind: payment.kind,
    failureMessage: payment.failureMessage,
    checkoutUrl: payment.checkoutUrl,
  };
}

/**
 * Asks Stripe directly what happened to an attempt.
 *
 * A safety net for the case where a webhook is slow or lost: the participant
 * is back on our page, we still show "confirming", and this reconciles from
 * the authoritative source rather than leaving them stuck. It still never
 * trusts the browser — the answer comes from Stripe's API, server-side.
 */
export async function reconcilePaymentWithStripe(
  { tripId, userId, paymentId }: { tripId: string; userId: string; paymentId: string },
  gateway: PaymentGateway = stripeGateway,
): Promise<PaymentAttemptStatus> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.userId !== userId || payment.tripId !== tripId) {
    throw new PaymentError("PAYMENT_NOT_FOUND", "We couldn't find that payment.");
  }

  if (payment.status !== "PENDING" && payment.status !== "PROCESSING") {
    return getPaymentAttemptStatus({ tripId, userId, paymentId });
  }
  if (!payment.stripeCheckoutSessionId) {
    return getPaymentAttemptStatus({ tripId, userId, paymentId });
  }

  const session = await gateway.retrieveCheckoutSession(payment.stripeCheckoutSessionId);

  if (session.paymentStatus === "paid") {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCEEDED",
          stripePaymentIntentId: payment.stripePaymentIntentId ?? session.paymentIntentId,
          events: {
            create: {
              fromStatus: payment.status,
              toStatus: "SUCCEEDED",
              detail: "Reconciled from Stripe after a delayed webhook",
            },
          },
        },
      }),
      prisma.platformFee.updateMany({
        where: { paymentId: payment.id, status: "PENDING" },
        data: { status: "CHARGED" },
      }),
    ]);
    await refreshParticipantProjection(payment.tripId, payment.userId);
  } else if (session.status === "expired") {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "CANCELLED",
          events: {
            create: {
              fromStatus: payment.status,
              toStatus: "CANCELLED",
              detail: "Checkout session expired",
            },
          },
        },
      }),
      prisma.platformFee.deleteMany({ where: { paymentId: payment.id, status: "PENDING" } }),
    ]);
    await refreshParticipantProjection(payment.tripId, payment.userId);
  }

  return getPaymentAttemptStatus({ tripId, userId, paymentId });
}

/**
 * A trip's payment position, scoped to who is asking.
 *
 * Everything here is computed from the ledger — the Payment and Refund rows a
 * verified webhook wrote — rather than read from the cached projection
 * columns, so the dashboard can never show a figure the ledger doesn't
 * support.
 *
 * The organizer gets the per-participant breakdown they need to run the trip.
 * Everyone else gets their own figures and the group's progress as counts,
 * because who has paid what is not theirs to see.
 */
export interface TripPaymentDashboard {
  currency: string;
  paymentDeadline: Date | null;
  finalPaymentDeadline: Date | null;
  termsSet: boolean;
  totals: TripPaymentTotals;
  /** The signed-in participant's own position. Always present. */
  you: ParticipantPaymentRow;
  /**
   * Every participant's figures — organizer only. Null for everyone else, so
   * the privacy boundary is enforced by what the server returns rather than
   * by what the UI happens to render.
   */
  participants: ParticipantPaymentRow[] | null;
  viewerIsOrganizer: boolean;
}

export async function getTripPaymentDashboard(
  tripId: string,
  userId: string,
  now: Date = new Date(),
): Promise<TripPaymentDashboard> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      participants: {
        include: {
          user: { select: { name: true, email: true } },
          payments: { include: paymentWithRefunds, orderBy: { createdAt: "asc" } },
        },
        // Participants added in one batch share a createdAt to the
        // millisecond, so the id breaks the tie and the organizer's list
        // doesn't reshuffle itself between page loads.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!trip) {
    throw new PaymentError("TRIP_NOT_FOUND", "That trip doesn't exist.");
  }

  const viewer = trip.participants.find((participant) => participant.userId === userId);
  if (!viewer) {
    throw new PaymentError("NOT_A_PARTICIPANT", "You're not part of this trip.");
  }

  const rows = trip.participants.map((participant) => {
    const balance = calculateParticipantBalance(
      toLedger(participant.payments),
      {
        totalTripAmount: participant.totalTripAmount ?? trip.totalAmountPerPerson ?? 0,
        requiredInitialPayment:
          participant.requiredInitialPayment ?? trip.initialPaymentAmount ?? 0,
        paymentDeadline: trip.paymentDeadline,
        finalPaymentDeadline: trip.finalPaymentDeadline,
      },
      now,
    );

    return buildParticipantRow({
      participantId: participant.id,
      userId: participant.userId,
      name: participant.user.name ?? participant.user.email,
      isOrganizer: participant.userId === trip.organizerId,
      balance,
    });
  });

  const viewerIsOrganizer = trip.organizerId === userId;
  const you = rows.find((row) => row.userId === userId);
  if (!you) {
    throw new PaymentError("NOT_A_PARTICIPANT", "You're not part of this trip.");
  }

  return {
    currency: trip.currency,
    paymentDeadline: trip.paymentDeadline,
    finalPaymentDeadline: trip.finalPaymentDeadline,
    termsSet: Boolean(trip.totalAmountPerPerson && trip.initialPaymentAmount),
    totals: summariseTripPayments(rows),
    you,
    participants: viewerIsOrganizer ? rows : null,
    viewerIsOrganizer,
  };
}
