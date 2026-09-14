import { describe, expect, it } from "vitest";

import type { ParticipantBalance } from "@/lib/payments/balance";
import {
  buildParticipantRow,
  summariseTripPayments,
  type ParticipantPaymentRow,
} from "@/lib/payments/summary";

const TOTAL = 120_000; // £1,200 each
const INITIAL = 20_000; // £200 each

function row(
  name: string,
  totalAmountPaid: number,
  overrides: Partial<ParticipantPaymentRow> = {},
): ParticipantPaymentRow {
  return {
    participantId: `p-${name}`,
    userId: `u-${name}`,
    name,
    isOrganizer: false,
    totalTripAmount: TOTAL,
    requiredInitialPayment: INITIAL,
    totalAmountPaid,
    remainingBalance: TOTAL - totalAmountPaid,
    initialPaymentPaid: totalAmountPaid >= INITIAL,
    status: totalAmountPaid >= INITIAL ? "INITIAL_PAYMENT_PAID" : "NO_PAYMENT",
    ...overrides,
  };
}

// The brief's worked example: six people, four have paid their deposit and
// one of those paid double.
const brief = [
  row("Ella", 20_000),
  row("Sophie", 40_000),
  row("Charlotte", 20_000),
  row("Millie", 20_000),
  row("Amy", 0),
  row("Lucy", 0),
];

describe("summariseTripPayments", () => {
  it("reproduces the brief's worked example", () => {
    const totals = summariseTripPayments(brief);

    expect(totals.participantCount).toBe(6);
    expect(totals.totalTripCost).toBe(720_000); // £7,200
    expect(totals.requiredInitialTotal).toBe(120_000); // £1,200
    expect(totals.initialCollected).toBe(80_000); // £800
    expect(totals.initialCompleteCount).toBe(4);
  });

  it("caps each person's contribution to the deposits at their own deposit", () => {
    // Sophie paid £400 against a £200 deposit. The extra £200 is balance, not
    // deposit — otherwise one keen payer would hide someone who hasn't paid.
    const totals = summariseTripPayments(brief);

    expect(totals.totalCollected).toBe(100_000); // £1,000 actually collected
    expect(totals.initialCollected).toBe(80_000); // of which £800 is deposits
  });

  it("adds up what's still outstanding", () => {
    expect(summariseTripPayments(brief).totalOutstanding).toBe(620_000); // £6,200
  });

  it("counts who is fully paid and who is overdue", () => {
    const totals = summariseTripPayments([
      row("Paid", TOTAL, { status: "FULLY_PAID", remainingBalance: 0 }),
      row("Late", 0, { status: "PAYMENT_OVERDUE" }),
      row("Late too", 0, { status: "PAYMENT_OVERDUE" }),
      row("Fine", INITIAL),
    ]);

    expect(totals.fullyPaidCount).toBe(1);
    expect(totals.overdueCount).toBe(2);
  });

  it("handles a trip nobody has paid for yet", () => {
    const totals = summariseTripPayments([row("A", 0), row("B", 0)]);

    expect(totals.initialCollected).toBe(0);
    expect(totals.totalCollected).toBe(0);
    expect(totals.initialCompleteCount).toBe(0);
    expect(totals.totalOutstanding).toBe(240_000);
  });

  it("handles a trip with no participants without dividing by anything", () => {
    const totals = summariseTripPayments([]);

    expect(totals.participantCount).toBe(0);
    expect(totals.totalTripCost).toBe(0);
    expect(totals.initialCollected).toBe(0);
  });

  it("copes with participants on different terms", () => {
    // Terms are snapshotted per participant, so someone who joined before a
    // change can legitimately owe a different total.
    const totals = summariseTripPayments([
      row("Old", 20_000, { totalTripAmount: 100_000, remainingBalance: 80_000 }),
      row("New", 20_000, { totalTripAmount: 120_000, remainingBalance: 100_000 }),
    ]);

    expect(totals.totalTripCost).toBe(220_000);
    expect(totals.totalOutstanding).toBe(180_000);
  });
});

describe("buildParticipantRow", () => {
  const balance: ParticipantBalance = {
    totalTripAmount: TOTAL,
    requiredInitialPayment: INITIAL,
    totalAmountPaid: 40_000,
    remainingBalance: 80_000,
    initialPaymentPaid: true,
    platformFeePaid: true,
    pendingAmount: 0,
    refundedAmount: 0,
    maxAdditionalPayment: 80_000,
    status: "PARTIALLY_PAID",
  };

  it("carries the balance's figures through unchanged", () => {
    const built = buildParticipantRow({
      participantId: "p1",
      userId: "u1",
      name: "Sophie",
      isOrganizer: false,
      balance,
    });

    expect(built).toEqual({
      participantId: "p1",
      userId: "u1",
      name: "Sophie",
      isOrganizer: false,
      totalTripAmount: TOTAL,
      requiredInitialPayment: INITIAL,
      totalAmountPaid: 40_000,
      remainingBalance: 80_000,
      initialPaymentPaid: true,
      status: "PARTIALLY_PAID",
    });
  });

  it("carries nothing about how they paid", () => {
    const built = buildParticipantRow({
      participantId: "p1",
      userId: "u1",
      name: "Sophie",
      isOrganizer: false,
      balance,
    }) as unknown as Record<string, unknown>;

    // No payment history, no card details, no Stripe ids, no platform fee.
    // The organizer needs to manage the trip, not audit anyone's wallet.
    for (const leaked of ["payments", "platformFeePaid", "stripeCustomerId", "email"]) {
      expect(built[leaked]).toBeUndefined();
    }
  });
});
