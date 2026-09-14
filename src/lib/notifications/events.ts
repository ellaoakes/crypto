/**
 * The payment events this application notifies people about, and the pure
 * rules turning each one into notifications for the right recipients.
 *
 * Pure on purpose: no Prisma, no transports, no clock. "Who hears about
 * what, and what does it say" is the part that's easy to get subtly wrong,
 * so it's decided here where it can be tested exhaustively — separately from
 * how anything is delivered. See NOTIFICATIONS.md.
 */
import { formatMinorCompact } from "@/lib/payments/money";

export type NotificationCategory =
  | "PAYMENT_RECEIPT"
  | "PAYMENT_PROBLEM"
  | "PAYMENT_REMINDER"
  | "TRIP_PAYMENT_ACTIVITY";

export type PaymentEventType =
  | "INITIAL_PAYMENT_COMPLETED"
  | "INITIAL_PAYMENT_OUTSTANDING"
  | "PAYMENT_DEADLINE_APPROACHING"
  | "PAYMENT_DEADLINE_PASSED"
  | "ADDITIONAL_PAYMENT_COMPLETED"
  | "TRIP_BALANCE_FULLY_PAID"
  | "PAYMENT_FAILED";

/** Everything an event needs to describe itself. Amounts are minor units. */
export interface PaymentEventContext {
  tripId: string;
  tripName: string;
  currency: string;
  /** The participant the event is about. */
  participant: { userId: string; name: string };
  /** The trip's organizer, so they can be told about activity on their trip. */
  organizerUserId: string;
}

export type PaymentEvent =
  | ({ type: "INITIAL_PAYMENT_COMPLETED"; amount: number; remainingBalance: number } & PaymentEventContext)
  | ({ type: "ADDITIONAL_PAYMENT_COMPLETED"; amount: number; remainingBalance: number } & PaymentEventContext)
  | ({ type: "TRIP_BALANCE_FULLY_PAID"; totalPaid: number } & PaymentEventContext)
  | ({ type: "PAYMENT_FAILED"; amount: number; reason?: string } & PaymentEventContext)
  | ({ type: "INITIAL_PAYMENT_OUTSTANDING"; amountDue: number; nudgedByOrganizer: boolean } & PaymentEventContext)
  | ({
      type: "PAYMENT_DEADLINE_APPROACHING";
      amountDue: number;
      deadline: Date;
      /** Which obligation the deadline covers. */
      scope: "INITIAL" | "BALANCE";
    } & PaymentEventContext)
  | ({
      type: "PAYMENT_DEADLINE_PASSED";
      amountDue: number;
      deadline: Date;
      scope: "INITIAL" | "BALANCE";
    } & PaymentEventContext);

/** One notification, for one person, ready to be stored and dispatched. */
export interface PlannedNotification {
  userId: string;
  tripId: string;
  type: PaymentEventType;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  data: Record<string, string | number | boolean>;
  /**
   * Deterministic. Two identical events produce the same key, so the
   * database's unique constraint collapses them into one notification.
   */
  dedupeKey: string;
}

function formatDeadline(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A stable day stamp, so a daily scan doesn't notify the same thing hourly. */
function dayStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Turns one event into the notifications it warrants.
 *
 * The restraint here is deliberate. An event that tells someone something
 * they already know, or that they can't act on, is noise — and noise is how
 * people end up muting the messages that matter. So:
 *
 * - Nobody is told about their own routine activity twice over.
 * - The organizer hears about deposits landing, because that's the thing they
 *   chase. They are not told about every voluntary top-up.
 * - An organizer paying their own deposit doesn't get a receipt *and* an
 *   "activity on your trip" notification for the same payment.
 * - Deadline notifications are only produced for people who still owe money,
 *   which is the caller's job to establish before emitting.
 */
export function planNotifications(event: PaymentEvent, now: Date = new Date()): PlannedNotification[] {
  const tripHref = `/trips/${event.tripId}`;
  const payHref = `${tripHref}/pay`;
  const base = {
    tripId: event.tripId,
    type: event.type,
    data: { tripName: event.tripName, participantName: event.participant.name },
  };

  switch (event.type) {
    case "INITIAL_PAYMENT_COMPLETED": {
      const notifications: PlannedNotification[] = [
        {
          ...base,
          userId: event.participant.userId,
          category: "PAYMENT_RECEIPT",
          title: "Initial payment complete",
          body: `Your ${formatMinorCompact(event.amount, event.currency)} initial payment for ${event.tripName} went through. ${formatMinorCompact(event.remainingBalance, event.currency)} left to pay.`,
          href: payHref,
          data: { ...base.data, amount: event.amount, remainingBalance: event.remainingBalance },
          dedupeKey: key(event.type, event.tripId, event.participant.userId, "receipt"),
        },
      ];

      // The organizer chases deposits, so they hear about them — unless they
      // are the one who just paid, in which case the receipt is enough.
      if (event.organizerUserId !== event.participant.userId) {
        notifications.push({
          ...base,
          userId: event.organizerUserId,
          category: "TRIP_PAYMENT_ACTIVITY",
          title: `${event.participant.name} paid their initial payment`,
          body: `${event.participant.name} has completed their ${formatMinorCompact(event.amount, event.currency)} initial payment for ${event.tripName}.`,
          href: tripHref,
          data: { ...base.data, amount: event.amount },
          dedupeKey: key(event.type, event.tripId, event.participant.userId, "organizer"),
        });
      }

      return notifications;
    }

    case "ADDITIONAL_PAYMENT_COMPLETED":
      // Receipt only. A trip of six people making voluntary payments would
      // bury the organizer in notifications they don't act on.
      return [
        {
          ...base,
          userId: event.participant.userId,
          category: "PAYMENT_RECEIPT",
          title: "Payment received",
          body: `Your ${formatMinorCompact(event.amount, event.currency)} payment for ${event.tripName} went through. ${formatMinorCompact(event.remainingBalance, event.currency)} left to pay.`,
          href: payHref,
          data: { ...base.data, amount: event.amount, remainingBalance: event.remainingBalance },
          dedupeKey: key(event.type, event.tripId, event.participant.userId, `${event.amount}:${dayStamp(now)}`),
        },
      ];

    case "TRIP_BALANCE_FULLY_PAID": {
      const notifications: PlannedNotification[] = [
        {
          ...base,
          userId: event.participant.userId,
          category: "PAYMENT_RECEIPT",
          title: "You're all paid up 🎉",
          body: `You've paid your ${formatMinorCompact(event.totalPaid, event.currency)} in full for ${event.tripName}. Nothing left to pay.`,
          href: payHref,
          data: { ...base.data, totalPaid: event.totalPaid },
          dedupeKey: key(event.type, event.tripId, event.participant.userId, "receipt"),
        },
      ];

      if (event.organizerUserId !== event.participant.userId) {
        notifications.push({
          ...base,
          userId: event.organizerUserId,
          category: "TRIP_PAYMENT_ACTIVITY",
          title: `${event.participant.name} has paid in full`,
          body: `${event.participant.name} has paid their share of ${event.tripName} in full.`,
          href: tripHref,
          data: { ...base.data, totalPaid: event.totalPaid },
          dedupeKey: key(event.type, event.tripId, event.participant.userId, "organizer"),
        });
      }

      return notifications;
    }

    case "PAYMENT_FAILED":
      // The person who tried to pay, and nobody else. A failed card is
      // between them and their bank.
      return [
        {
          ...base,
          userId: event.participant.userId,
          category: "PAYMENT_PROBLEM",
          title: "Your payment didn't go through",
          body: `Your ${formatMinorCompact(event.amount, event.currency)} payment for ${event.tripName} failed${event.reason ? `: ${event.reason}` : ""}. Nothing was charged — you can try again whenever you're ready.`,
          href: payHref,
          data: { ...base.data, amount: event.amount },
          dedupeKey: key(event.type, event.tripId, event.participant.userId, `${event.amount}:${dayStamp(now)}`),
        },
      ];

    case "INITIAL_PAYMENT_OUTSTANDING":
      return [
        {
          ...base,
          userId: event.participant.userId,
          category: "PAYMENT_REMINDER",
          title: event.nudgedByOrganizer
            ? `A reminder about ${event.tripName}`
            : "Your initial payment is still outstanding",
          body: `${formatMinorCompact(event.amountDue, event.currency)} is needed to secure your place on ${event.tripName}.`,
          href: payHref,
          data: { ...base.data, amountDue: event.amountDue, nudgedByOrganizer: event.nudgedByOrganizer },
          // Day-stamped: a nudge today and a nudge tomorrow are different
          // notifications, but two nudges today are the same one.
          dedupeKey: key(event.type, event.tripId, event.participant.userId, dayStamp(now)),
        },
      ];

    case "PAYMENT_DEADLINE_APPROACHING":
      return [
        {
          ...base,
          userId: event.participant.userId,
          category: "PAYMENT_REMINDER",
          title:
            event.scope === "INITIAL"
              ? "Your initial payment is due soon"
              : "Your trip balance is due soon",
          body: `${formatMinorCompact(event.amountDue, event.currency)} for ${event.tripName} is due by ${formatDeadline(event.deadline)}.`,
          href: payHref,
          data: { ...base.data, amountDue: event.amountDue, scope: event.scope },
          // Keyed on the deadline, so moving the deadline can re-notify but
          // a scan that runs every hour cannot.
          dedupeKey: key(
            event.type,
            event.tripId,
            event.participant.userId,
            `${event.scope}:${dayStamp(event.deadline)}`,
          ),
        },
      ];

    case "PAYMENT_DEADLINE_PASSED":
      return [
        {
          ...base,
          userId: event.participant.userId,
          category: "PAYMENT_REMINDER",
          title:
            event.scope === "INITIAL"
              ? "Your initial payment is overdue"
              : "Your trip balance is overdue",
          body: `${formatMinorCompact(event.amountDue, event.currency)} for ${event.tripName} was due on ${formatDeadline(event.deadline)}.`,
          href: payHref,
          data: { ...base.data, amountDue: event.amountDue, scope: event.scope },
          dedupeKey: key(
            event.type,
            event.tripId,
            event.participant.userId,
            `${event.scope}:${dayStamp(event.deadline)}`,
          ),
        },
      ];
  }
}

function key(...parts: string[]): string {
  return parts.join("|");
}
