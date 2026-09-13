import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  calculateParticipantBalance,
  type LedgerPayment,
  type ParticipantBalance,
} from "@/lib/payments/balance";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { planCharge, PaymentRuleError, validatePaymentTerms } from "@/lib/payments/rules";
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
export async function createPayment(
  {
    tripId,
    userId,
    requestedAmount,
  }: { tripId: string; userId: string; requestedAmount?: number },
  gateway: PaymentGateway = stripeGateway,
  now: Date = new Date(),
): Promise<{
  paymentId: string;
  clientSecret: string | null;
  charge: { amount: number; platformFee: number; totalCharged: number; kind: "INITIAL" | "ADDITIONAL" };
}> {
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

  const destinationAccountId =
    trip.settlementMode === "CONNECTED_ACCOUNT" ? trip.settlementAccountId ?? undefined : undefined;

  // Already have a payment in flight? Hand back that same attempt rather than
  // starting a second one. Re-sending the original idempotency key makes
  // Stripe return the original intent, so a double-click, a refresh or a
  // retried request all land on one charge — and the participant can simply
  // finish the payment they started.
  const inFlight = participant.payments.find(
    (payment) => payment.status === "PENDING" || payment.status === "PROCESSING",
  );
  if (inFlight) {
    const intent = await gateway.createPaymentIntent({
      totalCharged: inFlight.totalCharged,
      applicationFee: inFlight.platformFee,
      currency: inFlight.currency,
      idempotencyKey: inFlight.idempotencyKey,
      destinationAccountId,
      metadata: { tripId, userId, participantId: participant.id, paymentId: inFlight.id },
    });

    if (!inFlight.stripePaymentIntentId) {
      await prisma.payment.update({
        where: { id: inFlight.id },
        data: { stripePaymentIntentId: intent.id },
      });
    }

    return {
      paymentId: inFlight.id,
      clientSecret: intent.clientSecret,
      charge: {
        amount: inFlight.amount,
        platformFee: inFlight.platformFee,
        totalCharged: inFlight.totalCharged,
        kind: inFlight.kind as "INITIAL" | "ADDITIONAL",
      },
    };
  }

  const terms = termsFor(participant);
  const balance = calculateParticipantBalance(toLedger(participant.payments), terms, now);

  // A fee row already existing is the authoritative answer to "have we
  // charged this person our fee for this trip", because that table's unique
  // constraint is what enforces the rule.
  const existingFee = await prisma.platformFee.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });

  let charge;
  try {
    charge = planCharge({
      balance,
      requestedAmount,
      feeAlreadyCharged: Boolean(existingFee),
    });
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
    const intent = await gateway.createPaymentIntent({
      totalCharged: charge.totalCharged,
      applicationFee: charge.platformFee,
      currency: trip.currency,
      idempotencyKey,
      destinationAccountId,
      metadata: { tripId, userId, participantId: participant.id, paymentId: payment.id },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: intent.id },
    });

    // The fee is reserved the moment the charge that carries it is created,
    // so a concurrent second attempt hits the unique constraint instead of
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

    return { paymentId: payment.id, clientSecret: intent.clientSecret, charge };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureCode: "INTENT_CREATE_FAILED",
        failureMessage: error instanceof Error ? error.message : "Unknown error",
        events: {
          create: { fromStatus: "PENDING", toStatus: "FAILED", detail: "Intent creation failed" },
        },
      },
    });
    throw error instanceof Error
      ? new PaymentError("INTENT_CREATE_FAILED", error.message)
      : new PaymentError("INTENT_CREATE_FAILED", "Couldn't start that payment.");
  }
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
