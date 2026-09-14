import { prisma } from "@/lib/prisma";
import { dispatchPaymentEvent } from "@/lib/notifications/dispatch";
import { loadEventContext } from "@/lib/notifications/emit";
import { getTripPaymentDashboard, PaymentError } from "@/lib/payments/service";

/**
 * The organizer nudging people who haven't made their initial payment.
 *
 * Two properties matter more than anything else here, and both are structural
 * rather than a matter of care:
 *
 * 1. **It cannot change what anyone owes.** This module reads the ledger and
 *    writes notifications. It never touches Payment, PlatformFee, Refund or
 *    any payment column on TripParticipant, so an organizer cannot mark
 *    someone as paid, waive a balance, or alter a deadline by sending a
 *    reminder. Who owes what stays a consequence of money actually moving.
 *
 * 2. **It cannot become harassment.** Reminders are rate limited per
 *    participant, and the notification's dedupe key is day-stamped, so
 *    pressing the button repeatedly produces nothing after the first.
 */

/** How long an organizer must wait before nudging the same person again. */
export const REMINDER_COOLDOWN_HOURS = 24;

export interface ReminderOutcome {
  /** People who were sent a reminder just now. */
  reminded: { userId: string; name: string }[];
  /** People skipped because they were nudged too recently. */
  skippedRecentlyReminded: { userId: string; name: string }[];
  /** Nobody owes an initial payment. */
  nobodyOutstanding: boolean;
}

export async function remindOutstandingInitialPayments({
  tripId,
  organizerId,
  now = new Date(),
}: {
  tripId: string;
  organizerId: string;
  now?: Date;
}): Promise<ReminderOutcome> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { organizerId: true, status: true, totalAmountPerPerson: true },
  });

  if (!trip) {
    throw new PaymentError("TRIP_NOT_FOUND", "That trip doesn't exist.");
  }
  if (trip.organizerId !== organizerId) {
    throw new PaymentError(
      "NOT_ORGANIZER",
      "Only the trip organizer can send payment reminders.",
    );
  }
  if (trip.status !== "CONFIRMED" || !trip.totalAmountPerPerson) {
    throw new PaymentError(
      "PAYMENTS_NOT_SET_UP",
      "Set up the trip's payments before sending reminders.",
    );
  }

  // Read-only: the dashboard derives everything from the ledger.
  const dashboard = await getTripPaymentDashboard(tripId, organizerId, now);
  if (!dashboard.participants) {
    throw new PaymentError("NOT_ORGANIZER", "Only the trip organizer can send reminders.");
  }

  const outstanding = dashboard.participants.filter(
    (participant) => !participant.initialPaymentPaid && participant.remainingBalance > 0,
  );

  const outcome: ReminderOutcome = {
    reminded: [],
    skippedRecentlyReminded: [],
    nobodyOutstanding: outstanding.length === 0,
  };

  const cooldownStart = new Date(now.getTime() - REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);

  for (const participant of outstanding) {
    const recent = await prisma.notification.findFirst({
      where: {
        userId: participant.userId,
        tripId,
        type: "INITIAL_PAYMENT_OUTSTANDING",
        createdAt: { gte: cooldownStart },
      },
    });

    if (recent) {
      outcome.skippedRecentlyReminded.push({
        userId: participant.userId,
        name: participant.name,
      });
      continue;
    }

    const context = await loadEventContext(tripId, participant.userId);
    if (!context) continue;

    const result = await dispatchPaymentEvent(
      {
        ...context,
        type: "INITIAL_PAYMENT_OUTSTANDING",
        amountDue: participant.requiredInitialPayment,
        nudgedByOrganizer: true,
      },
      now,
    );

    if (result.created > 0) {
      outcome.reminded.push({ userId: participant.userId, name: participant.name });
    } else {
      outcome.skippedRecentlyReminded.push({
        userId: participant.userId,
        name: participant.name,
      });
    }
  }

  return outcome;
}
