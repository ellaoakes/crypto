import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { PaymentGateway } from "@/lib/payments/gateway";
import { PaymentError, refreshParticipantProjection } from "@/lib/payments/service";
import { stripeGateway } from "@/lib/payments/stripeGateway";

/**
 * Refunds and cancellations.
 *
 * The whole point of this module is that trip money and our platform fee are
 * two different things. A refund always states how much of each is coming
 * back, and that decision is recorded in the ledger rather than inferred from
 * the total.
 */

export async function refundPayment(
  {
    paymentId,
    organizerId,
    tripAmount,
    refundPlatformFee = false,
    reason,
  }: {
    paymentId: string;
    /** The user asking. Must be the trip's organizer. */
    organizerId: string;
    /** Trip money to return. Defaults to everything still unrefunded. */
    tripAmount?: number;
    /** Whether our fee comes back too. Defaults to no — it's a separate call. */
    refundPlatformFee?: boolean;
    reason?: string;
  },
  gateway: PaymentGateway = stripeGateway,
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { trip: { select: { organizerId: true } }, refunds: true },
  });

  if (!payment) {
    throw new PaymentError("PAYMENT_NOT_FOUND", "That payment doesn't exist.");
  }
  if (payment.trip.organizerId !== organizerId) {
    throw new PaymentError("NOT_ORGANIZER", "Only the trip organizer can issue refunds.");
  }
  if (payment.status !== "SUCCEEDED") {
    throw new PaymentError(
      "PAYMENT_NOT_REFUNDABLE",
      "Only a successful payment can be refunded.",
    );
  }
  if (!payment.stripePaymentIntentId) {
    throw new PaymentError("PAYMENT_NOT_REFUNDABLE", "That payment has no Stripe charge.");
  }

  const alreadyRefunded = payment.refunds
    .filter((refund) => refund.status !== "FAILED")
    .reduce((total, refund) => total + refund.tripAmount, 0);
  const refundable = payment.amount - alreadyRefunded;

  if (refundable <= 0) {
    throw new PaymentError("ALREADY_REFUNDED", "That payment has already been refunded.");
  }

  const amount = tripAmount ?? refundable;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new PaymentError("INVALID_AMOUNT", "Enter a refund amount greater than zero.");
  }
  if (amount > refundable) {
    throw new PaymentError(
      "EXCEEDS_REFUNDABLE",
      "That's more than the trip money left on this payment.",
    );
  }

  // Our fee can only come back if it went out on this payment, and only once.
  const feeAlreadyReturned = payment.refunds.some(
    (refund) => refund.status !== "FAILED" && refund.platformFeeAmount > 0,
  );
  const platformFeeAmount =
    refundPlatformFee && payment.platformFee > 0 && !feeAlreadyReturned ? payment.platformFee : 0;

  const idempotencyKey = createHash("sha256")
    .update([paymentId, amount, platformFeeAmount, alreadyRefunded].join(":"))
    .digest("hex")
    .slice(0, 48);

  const refund = await prisma.refund.create({
    data: {
      paymentId,
      tripAmount: amount,
      platformFeeAmount,
      currency: payment.currency,
      status: "PENDING",
      reason,
    },
  });

  try {
    const created = await gateway.createRefund({
      paymentIntentId: payment.stripePaymentIntentId,
      // Stripe is told the total coming off the charge; our ledger keeps the
      // split so the trip balance and our revenue stay distinguishable.
      amount: amount + platformFeeAmount,
      refundPlatformFee: platformFeeAmount > 0,
      idempotencyKey,
      reason,
    });

    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        // Stays PENDING whatever the API response says. Even a refund Stripe
        // reports as succeeded on the spot is only settled in our ledger once
        // a signature-verified webhook says so — the same rule as payments.
        stripeRefundId: created.id,
      },
    });

    await refreshParticipantProjection(payment.tripId, payment.userId);
    return { refundId: refund.id, tripAmount: amount, platformFeeAmount };
  } catch (error) {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED" } });
    throw error instanceof Error
      ? new PaymentError("REFUND_FAILED", error.message)
      : new PaymentError("REFUND_FAILED", "Couldn't refund that payment.");
  }
}

/**
 * Cancels a payment the participant started but never completed. Only the
 * person who started it can cancel it, and only while it's still in flight.
 */
export async function cancelPayment(
  { paymentId, userId }: { paymentId: string; userId: string },
  gateway: PaymentGateway = stripeGateway,
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  if (!payment) {
    throw new PaymentError("PAYMENT_NOT_FOUND", "That payment doesn't exist.");
  }
  if (payment.userId !== userId) {
    throw new PaymentError("NOT_YOUR_PAYMENT", "That isn't your payment.");
  }
  if (payment.status === "SUCCEEDED") {
    throw new PaymentError(
      "ALREADY_SUCCEEDED",
      "That payment already went through — it needs a refund, not a cancellation.",
    );
  }
  if (payment.status !== "PENDING" && payment.status !== "PROCESSING") {
    throw new PaymentError("NOT_CANCELLABLE", "That payment isn't in progress.");
  }

  if (payment.stripePaymentIntentId) {
    await gateway.cancelPaymentIntent(payment.stripePaymentIntentId);
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "CANCELLED",
        events: {
          create: {
            fromStatus: payment.status,
            toStatus: "CANCELLED",
            detail: "Cancelled by the participant",
          },
        },
      },
    }),
    // Release the fee reservation so their next attempt can take it.
    prisma.platformFee.deleteMany({ where: { paymentId, status: "PENDING" } }),
  ]);

  return refreshParticipantProjection(payment.tripId, payment.userId);
}
