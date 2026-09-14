/**
 * Working out who needs chasing about a payment, and why.
 *
 * **Nothing here sends anything.** No email, no push, no SMS. This is the
 * decision half of reminders, deliberately built first and deliberately pure:
 * given each participant's position and the trip's deadlines, it returns the
 * reminders that are due right now. A future sender consumes that list and is
 * the only thing that needs to know about transports.
 *
 * Keeping the decision pure means the awkward part — who, why, and not
 * twice — is testable today, without a queue, a template or an inbox.
 */
import type { ParticipantPaymentRow } from "@/lib/payments/summary";

export type ReminderReason =
  /** Their deposit is due soon and they haven't paid it. */
  | "INITIAL_DUE_SOON"
  /** The deposit deadline has passed and they still haven't paid it. */
  | "INITIAL_OVERDUE"
  /** The balance is due soon and they still owe some of it. */
  | "BALANCE_DUE_SOON"
  /** The final deadline has passed and they still owe some of it. */
  | "BALANCE_OVERDUE";

export interface DueReminder {
  userId: string;
  participantId: string;
  reason: ReminderReason;
  /** The deadline this reminder is about. */
  dueAt: Date;
  /** What they still owe, in minor units — for the eventual message. */
  amountOutstanding: number;
}

export interface ReminderWindow {
  /** How far ahead of a deadline to start reminding. */
  daysBefore: number;
}

const DEFAULT_WINDOW: ReminderWindow = { daysBefore: 7 };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The reminders that are due right now.
 *
 * One per participant at most: someone who is overdue on their deposit does
 * not also need telling their balance is coming up. The most pressing thing
 * wins, in the order the reasons are listed above.
 */
export function selectDueReminders({
  participants,
  paymentDeadline,
  finalPaymentDeadline,
  window = DEFAULT_WINDOW,
  now = new Date(),
}: {
  participants: ParticipantPaymentRow[];
  paymentDeadline: Date | null;
  finalPaymentDeadline: Date | null;
  window?: ReminderWindow;
  now?: Date;
}): DueReminder[] {
  const reminders: DueReminder[] = [];

  for (const participant of participants) {
    // Nothing owed, nothing to chase.
    if (participant.remainingBalance <= 0) continue;

    const reminder =
      depositReminder(participant, paymentDeadline, window, now) ??
      balanceReminder(participant, finalPaymentDeadline, window, now);

    if (reminder) reminders.push(reminder);
  }

  return reminders;
}

function depositReminder(
  participant: ParticipantPaymentRow,
  deadline: Date | null,
  window: ReminderWindow,
  now: Date,
): DueReminder | null {
  if (!deadline || participant.initialPaymentPaid) return null;

  if (now > deadline) {
    return build(participant, "INITIAL_OVERDUE", deadline);
  }
  if (withinWindow(deadline, window, now)) {
    return build(participant, "INITIAL_DUE_SOON", deadline);
  }
  return null;
}

function balanceReminder(
  participant: ParticipantPaymentRow,
  deadline: Date | null,
  window: ReminderWindow,
  now: Date,
): DueReminder | null {
  if (!deadline) return null;

  if (now > deadline) {
    return build(participant, "BALANCE_OVERDUE", deadline);
  }
  if (withinWindow(deadline, window, now)) {
    return build(participant, "BALANCE_DUE_SOON", deadline);
  }
  return null;
}

function withinWindow(deadline: Date, window: ReminderWindow, now: Date): boolean {
  return deadline.getTime() - now.getTime() <= window.daysBefore * DAY_MS;
}

function build(
  participant: ParticipantPaymentRow,
  reason: ReminderReason,
  dueAt: Date,
): DueReminder {
  return {
    userId: participant.userId,
    participantId: participant.participantId,
    reason,
    dueAt,
    amountOutstanding: participant.remainingBalance,
  };
}

/**
 * Filters out reminders already sent for the same deadline.
 *
 * A sender calls this against the PaymentReminder rows it has recorded, so a
 * job that runs hourly doesn't chase the same person hourly. Pure, so the
 * "don't nag" rule is testable without a scheduler.
 */
export function withoutAlreadySent(
  due: DueReminder[],
  alreadySent: { participantId: string; reason: string; dueAt: Date }[],
): DueReminder[] {
  const seen = new Set(
    alreadySent.map((sent) => `${sent.participantId}:${sent.reason}:${sent.dueAt.getTime()}`),
  );

  return due.filter(
    (reminder) =>
      !seen.has(`${reminder.participantId}:${reminder.reason}:${reminder.dueAt.getTime()}`),
  );
}
