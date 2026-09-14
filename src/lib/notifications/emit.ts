import { prisma } from "@/lib/prisma";
import { dispatchPaymentEvent } from "@/lib/notifications/dispatch";
import type { PaymentEvent, PaymentEventContext } from "@/lib/notifications/events";
import { calculateParticipantBalance } from "@/lib/payments/balance";

/**
 * The bridge between the payment ledger and the notification system.
 *
 * Everything here reads the ledger and emits; nothing here writes to it. A
 * notification is a consequence of money moving, never a cause of it.
 */

/** Loads the context an event needs. Null when the trip or participant is gone. */
export async function loadEventContext(
  tripId: string,
  userId: string,
): Promise<PaymentEventContext | null> {
  const participant = await prisma.tripParticipant.findUnique({
    where: { tripId_userId: { tripId, userId } },
    include: {
      trip: { select: { name: true, currency: true, organizerId: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!participant) return null;

  return {
    tripId,
    tripName: participant.trip.name,
    currency: participant.trip.currency,
    participant: {
      userId,
      name: participant.user.name ?? participant.user.email,
    },
    organizerUserId: participant.trip.organizerId,
  };
}

/**
 * Emits the right event for a payment that just settled.
 *
 * Which event it is depends on the participant's position *after* the
 * payment, which is read back from the ledger rather than inferred from the
 * payment alone: the same £200 is an initial payment for one person and a
 * top-up for another.
 */
export async function emitPaymentSucceeded({
  tripId,
  userId,
  paymentId,
  now = new Date(),
}: {
  tripId: string;
  userId: string;
  paymentId: string;
  now?: Date;
}): Promise<void> {
  const context = await loadEventContext(tripId, userId);
  if (!context) return;

  const participant = await prisma.tripParticipant.findUnique({
    where: { tripId_userId: { tripId, userId } },
    include: {
      trip: { select: { totalAmountPerPerson: true, initialPaymentAmount: true, paymentDeadline: true, finalPaymentDeadline: true } },
      payments: { include: { refunds: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!participant) return;

  const payment = participant.payments.find((candidate) => candidate.id === paymentId);
  if (!payment) return;

  const balance = calculateParticipantBalance(
    participant.payments.map((row) => ({
      amount: row.amount,
      platformFee: row.platformFee,
      status: row.status as never,
      kind: row.kind as never,
      createdAt: row.createdAt,
      refunds: row.refunds.map((refund) => ({
        tripAmount: refund.tripAmount,
        platformFeeAmount: refund.platformFeeAmount,
        status: refund.status as never,
      })),
    })),
    {
      totalTripAmount: participant.totalTripAmount ?? participant.trip.totalAmountPerPerson ?? 0,
      requiredInitialPayment:
        participant.requiredInitialPayment ?? participant.trip.initialPaymentAmount ?? 0,
      paymentDeadline: participant.trip.paymentDeadline,
      finalPaymentDeadline: participant.trip.finalPaymentDeadline,
    },
    now,
  );

  // Paid off entirely: that's the news, and it supersedes the receipt for
  // whichever payment happened to be the last one.
  if (balance.remainingBalance === 0) {
    await dispatchPaymentEvent(
      { ...context, type: "TRIP_BALANCE_FULLY_PAID", totalPaid: balance.totalAmountPaid },
      now,
    );
    return;
  }

  await dispatchPaymentEvent(
    payment.kind === "INITIAL"
      ? {
          ...context,
          type: "INITIAL_PAYMENT_COMPLETED",
          amount: payment.amount,
          remainingBalance: balance.remainingBalance,
        }
      : {
          ...context,
          type: "ADDITIONAL_PAYMENT_COMPLETED",
          amount: payment.amount,
          remainingBalance: balance.remainingBalance,
        },
    now,
  );
}

export async function emitPaymentFailed({
  tripId,
  userId,
  amount,
  reason,
  now = new Date(),
}: {
  tripId: string;
  userId: string;
  amount: number;
  reason?: string;
  now?: Date;
}): Promise<void> {
  const context = await loadEventContext(tripId, userId);
  if (!context) return;

  await dispatchPaymentEvent({ ...context, type: "PAYMENT_FAILED", amount, reason }, now);
}

/**
 * Emitting is best-effort: a notification failing must never fail the thing
 * that caused it. A webhook that settled a payment has done its job even if
 * nobody gets told, and Stripe must not be asked to retry over it.
 */
export async function emitQuietly(work: () => Promise<void>, label: string): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error(`Failed to emit ${label} notification`, error);
  }
}

export type { PaymentEvent };
