import { describe, expect, it } from "vitest";

import { selectDueReminders, withoutAlreadySent, type DueReminder } from "@/lib/payments/reminders";
import type { ParticipantPaymentRow } from "@/lib/payments/summary";

const TOTAL = 120_000;
const INITIAL = 20_000;
const NOW = new Date("2027-01-01T00:00:00Z");

function participant(
  name: string,
  overrides: Partial<ParticipantPaymentRow> = {},
): ParticipantPaymentRow {
  return {
    participantId: `p-${name}`,
    userId: `u-${name}`,
    name,
    isOrganizer: false,
    totalTripAmount: TOTAL,
    requiredInitialPayment: INITIAL,
    totalAmountPaid: 0,
    remainingBalance: TOTAL,
    initialPaymentPaid: false,
    status: "NO_PAYMENT",
    ...overrides,
  };
}

const soon = new Date("2027-01-05T00:00:00Z"); // 4 days away
const distant = new Date("2027-03-01T00:00:00Z");
const past = new Date("2026-12-01T00:00:00Z");

describe("selectDueReminders", () => {
  it("reminds someone whose deposit is due soon", () => {
    const due = selectDueReminders({
      participants: [participant("Amy")],
      paymentDeadline: soon,
      finalPaymentDeadline: null,
      now: NOW,
    });

    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      userId: "u-Amy",
      reason: "INITIAL_DUE_SOON",
      dueAt: soon,
      amountOutstanding: TOTAL,
    });
  });

  it("says nothing while a deadline is still far off", () => {
    expect(
      selectDueReminders({
        participants: [participant("Amy")],
        paymentDeadline: distant,
        finalPaymentDeadline: null,
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("escalates to overdue once the deadline has passed", () => {
    const due = selectDueReminders({
      participants: [participant("Amy")],
      paymentDeadline: past,
      finalPaymentDeadline: null,
      now: NOW,
    });

    expect(due[0].reason).toBe("INITIAL_OVERDUE");
  });

  it("leaves alone anyone who has already paid their deposit", () => {
    expect(
      selectDueReminders({
        participants: [
          participant("Ella", { initialPaymentPaid: true, totalAmountPaid: INITIAL, remainingBalance: 100_000 }),
        ],
        paymentDeadline: past,
        finalPaymentDeadline: null,
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("never chases someone who owes nothing", () => {
    expect(
      selectDueReminders({
        participants: [
          participant("Paid", {
            initialPaymentPaid: true,
            totalAmountPaid: TOTAL,
            remainingBalance: 0,
            status: "FULLY_PAID",
          }),
        ],
        paymentDeadline: past,
        finalPaymentDeadline: past,
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("chases the balance once the deposit is settled", () => {
    const due = selectDueReminders({
      participants: [
        participant("Ella", { initialPaymentPaid: true, totalAmountPaid: INITIAL, remainingBalance: 100_000 }),
      ],
      paymentDeadline: past,
      finalPaymentDeadline: soon,
      now: NOW,
    });

    expect(due[0]).toMatchObject({ reason: "BALANCE_DUE_SOON", amountOutstanding: 100_000 });
  });

  it("sends one reminder per person, not one per deadline", () => {
    // Overdue on the deposit *and* the balance is coming up. The deposit is
    // the more pressing thing; nobody needs two messages.
    const due = selectDueReminders({
      participants: [participant("Amy")],
      paymentDeadline: past,
      finalPaymentDeadline: soon,
      now: NOW,
    });

    expect(due).toHaveLength(1);
    expect(due[0].reason).toBe("INITIAL_OVERDUE");
  });

  it("says nothing when the trip has no deadlines", () => {
    expect(
      selectDueReminders({
        participants: [participant("Amy")],
        paymentDeadline: null,
        finalPaymentDeadline: null,
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("honours a different reminder window", () => {
    const args = {
      participants: [participant("Amy")],
      paymentDeadline: new Date("2027-01-20T00:00:00Z"), // 19 days away
      finalPaymentDeadline: null,
      now: NOW,
    };

    expect(selectDueReminders(args)).toEqual([]);
    expect(selectDueReminders({ ...args, window: { daysBefore: 30 } })).toHaveLength(1);
  });

  it("picks out only the people who need chasing", () => {
    const due = selectDueReminders({
      participants: [
        participant("Amy"),
        participant("Ella", { initialPaymentPaid: true, totalAmountPaid: INITIAL, remainingBalance: 100_000 }),
        participant("Lucy"),
      ],
      paymentDeadline: soon,
      finalPaymentDeadline: null,
      now: NOW,
    });

    expect(due.map((reminder) => reminder.userId)).toEqual(["u-Amy", "u-Lucy"]);
  });
});

describe("withoutAlreadySent", () => {
  const reminder: DueReminder = {
    userId: "u-Amy",
    participantId: "p-Amy",
    reason: "INITIAL_DUE_SOON",
    dueAt: soon,
    amountOutstanding: TOTAL,
  };

  it("drops a reminder already sent for that deadline", () => {
    expect(
      withoutAlreadySent(
        [reminder],
        [{ participantId: "p-Amy", reason: "INITIAL_DUE_SOON", dueAt: soon }],
      ),
    ).toEqual([]);
  });

  it("keeps a different reason for the same person", () => {
    expect(
      withoutAlreadySent(
        [reminder],
        [{ participantId: "p-Amy", reason: "INITIAL_OVERDUE", dueAt: soon }],
      ),
    ).toHaveLength(1);
  });

  it("keeps the same reason when the deadline has moved", () => {
    expect(
      withoutAlreadySent(
        [reminder],
        [{ participantId: "p-Amy", reason: "INITIAL_DUE_SOON", dueAt: distant }],
      ),
    ).toHaveLength(1);
  });

  it("keeps a reminder for a different person", () => {
    expect(
      withoutAlreadySent(
        [reminder],
        [{ participantId: "p-Lucy", reason: "INITIAL_DUE_SOON", dueAt: soon }],
      ),
    ).toHaveLength(1);
  });

  it("passes everything through when nothing has been sent", () => {
    expect(withoutAlreadySent([reminder], [])).toEqual([reminder]);
  });
});
