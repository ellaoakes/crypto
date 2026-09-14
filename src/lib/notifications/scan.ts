import { prisma } from "@/lib/prisma";
import { dispatchPaymentEvent } from "@/lib/notifications/dispatch";
import { loadEventContext } from "@/lib/notifications/emit";
import { selectDueReminders } from "@/lib/payments/reminders";
import { getTripPaymentDashboard } from "@/lib/payments/service";

/**
 * The scheduled half of reminders: nobody's payment changed, but time passed.
 *
 * A deadline approaching or slipping by isn't something the payment domain
 * can notice on its own — there's no event to hang it on — so this is meant
 * to be run periodically (a daily cron, eventually). It reads the ledger,
 * asks the pure selector who is due a reminder, and emits. It writes nothing
 * to any payment record.
 *
 * Running it twice in a day is harmless: the notifications it produces are
 * keyed on the deadline, so the second run creates nothing.
 */

export interface ScanResult {
  tripsScanned: number;
  remindersEmitted: number;
}

export async function scanTripForReminders(
  tripId: string,
  now: Date = new Date(),
): Promise<number> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      organizerId: true,
      paymentDeadline: true,
      finalPaymentDeadline: true,
      totalAmountPerPerson: true,
    },
  });

  // Only a confirmed trip with payment terms has anything to chase.
  if (!trip || trip.status !== "CONFIRMED" || !trip.totalAmountPerPerson) return 0;
  if (!trip.paymentDeadline && !trip.finalPaymentDeadline) return 0;

  // Read through the organizer's view to get every participant's position.
  const dashboard = await getTripPaymentDashboard(trip.id, trip.organizerId, now);
  if (!dashboard.participants) return 0;

  const due = selectDueReminders({
    participants: dashboard.participants,
    paymentDeadline: trip.paymentDeadline,
    finalPaymentDeadline: trip.finalPaymentDeadline,
    now,
  });

  let emitted = 0;

  for (const reminder of due) {
    const context = await loadEventContext(trip.id, reminder.userId);
    if (!context) continue;

    const scope = reminder.reason.startsWith("INITIAL") ? "INITIAL" : "BALANCE";
    const overdue = reminder.reason.endsWith("OVERDUE");

    const result = await dispatchPaymentEvent(
      overdue
        ? {
            ...context,
            type: "PAYMENT_DEADLINE_PASSED",
            amountDue: reminder.amountOutstanding,
            deadline: reminder.dueAt,
            scope,
          }
        : {
            ...context,
            type: "PAYMENT_DEADLINE_APPROACHING",
            amountDue: reminder.amountOutstanding,
            deadline: reminder.dueAt,
            scope,
          },
      now,
    );

    emitted += result.created;
  }

  return emitted;
}

/** Sweeps every confirmed trip. The entry point a scheduled job would call. */
export async function scanAllTripsForReminders(now: Date = new Date()): Promise<ScanResult> {
  const trips = await prisma.trip.findMany({
    where: {
      status: "CONFIRMED",
      totalAmountPerPerson: { not: null },
      OR: [{ paymentDeadline: { not: null } }, { finalPaymentDeadline: { not: null } }],
    },
    select: { id: true },
  });

  let remindersEmitted = 0;
  for (const trip of trips) {
    remindersEmitted += await scanTripForReminders(trip.id, now);
  }

  return { tripsScanned: trips.length, remindersEmitted };
}
