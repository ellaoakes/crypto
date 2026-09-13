import { describe, expect, it } from "vitest";

import { calculateParticipantBalance, type LedgerPayment } from "@/lib/payments/balance";
import { PLATFORM_FEE_MINOR } from "@/lib/payments/money";
import { planCharge, validatePaymentTerms } from "@/lib/payments/rules";

const TOTAL = 120_000;
const INITIAL = 20_000;
const terms = { totalTripAmount: TOTAL, requiredInitialPayment: INITIAL };
const NOW = new Date("2027-01-01T00:00:00Z");

function balanceFor(payments: LedgerPayment[]) {
  return calculateParticipantBalance(payments, terms, NOW);
}

const succeededInitial: LedgerPayment = {
  amount: INITIAL,
  platformFee: PLATFORM_FEE_MINOR,
  status: "SUCCEEDED",
  kind: "INITIAL",
  createdAt: new Date("2026-10-01"),
};

describe("planCharge — the initial payment", () => {
  it("charges exactly the required initial amount plus the one-time fee", () => {
    const charge = planCharge({ balance: balanceFor([]), feeAlreadyCharged: false });

    expect(charge).toEqual({
      amount: INITIAL,
      platformFee: PLATFORM_FEE_MINOR,
      totalCharged: INITIAL + PLATFORM_FEE_MINOR,
      kind: "INITIAL",
    });
  });

  it("ignores whatever amount the client asked for", () => {
    const charge = planCharge({
      balance: balanceFor([]),
      requestedAmount: 5_000,
      feeAlreadyCharged: false,
    });

    expect(charge.amount).toBe(INITIAL);
  });

  it("never charges the fee twice, even if the first payment was refunded", () => {
    const refunded: LedgerPayment = {
      ...succeededInitial,
      refunds: [{ tripAmount: INITIAL, platformFeeAmount: 0, status: "SUCCEEDED" }],
    };

    const charge = planCharge({ balance: balanceFor([refunded]), feeAlreadyCharged: true });

    expect(charge.platformFee).toBe(0);
    expect(charge.totalCharged).toBe(INITIAL);
  });

  it("refuses a second attempt while one is already in flight", () => {
    const pending: LedgerPayment = { ...succeededInitial, status: "PENDING" };

    expect(() => planCharge({ balance: balanceFor([pending]), feeAlreadyCharged: false }))
      .toThrowError(expect.objectContaining({ code: "PAYMENT_IN_PROGRESS" }));
  });

  it("refuses when the organizer hasn't set a trip cost", () => {
    const balance = calculateParticipantBalance(
      [],
      { totalTripAmount: 0, requiredInitialPayment: 0 },
      NOW,
    );

    expect(() => planCharge({ balance, feeAlreadyCharged: false }))
      .toThrowError(expect.objectContaining({ code: "PAYMENTS_NOT_SET_UP" }));
  });

  it("lets a failed attempt be retried", () => {
    const failed: LedgerPayment = { ...succeededInitial, status: "FAILED" };
    const charge = planCharge({ balance: balanceFor([failed]), feeAlreadyCharged: false });

    expect(charge.kind).toBe("INITIAL");
    expect(charge.platformFee).toBe(PLATFORM_FEE_MINOR);
  });
});

describe("planCharge — subsequent payments", () => {
  const paid = balanceFor([succeededInitial]);

  it("carries no platform fee", () => {
    const charge = planCharge({ balance: paid, requestedAmount: 30_000, feeAlreadyCharged: true });

    expect(charge).toEqual({
      amount: 30_000,
      platformFee: 0,
      totalCharged: 30_000,
      kind: "ADDITIONAL",
    });
  });

  it("allows paying the balance off exactly", () => {
    const charge = planCharge({
      balance: paid,
      requestedAmount: paid.remainingBalance,
      feeAlreadyCharged: true,
    });

    expect(charge.amount).toBe(100_000);
  });

  it("prevents overpaying the balance", () => {
    expect(() =>
      planCharge({ balance: paid, requestedAmount: paid.remainingBalance + 1, feeAlreadyCharged: true }),
    ).toThrowError(expect.objectContaining({ code: "EXCEEDS_BALANCE" }));
  });

  it("counts in-flight payments towards the overpayment check", () => {
    const withPending = balanceFor([
      succeededInitial,
      { ...succeededInitial, kind: "ADDITIONAL", platformFee: 0, status: "PENDING", amount: 90_000 },
    ]);

    expect(() => planCharge({ balance: withPending, requestedAmount: 20_000, feeAlreadyCharged: true }))
      .toThrowError(expect.objectContaining({ code: "EXCEEDS_BALANCE_WITH_PENDING" }));
  });

  it("refuses once the trip is paid off", () => {
    const settled = balanceFor([succeededInitial, { ...succeededInitial, amount: 100_000, platformFee: 0 }]);

    expect(() => planCharge({ balance: settled, requestedAmount: 1_000, feeAlreadyCharged: true }))
      .toThrowError(expect.objectContaining({ code: "ALREADY_PAID" }));
  });

  it("rejects zero, negative and fractional amounts", () => {
    for (const requestedAmount of [0, -100, 10.5]) {
      expect(() => planCharge({ balance: paid, requestedAmount, feeAlreadyCharged: true }))
        .toThrowError(expect.objectContaining({ code: "INVALID_AMOUNT" }));
    }
  });

  it("requires an amount", () => {
    expect(() => planCharge({ balance: paid, feeAlreadyCharged: true }))
      .toThrowError(expect.objectContaining({ code: "AMOUNT_REQUIRED" }));
  });
});

describe("validatePaymentTerms", () => {
  const future = new Date("2027-06-01T00:00:00Z");
  const laterStill = new Date("2027-07-01T00:00:00Z");

  it("accepts sensible terms", () => {
    expect(() =>
      validatePaymentTerms({
        totalAmountPerPerson: TOTAL,
        initialPaymentAmount: INITIAL,
        paymentDeadline: future,
        finalPaymentDeadline: laterStill,
        now: NOW,
      }),
    ).not.toThrow();
  });

  it("accepts terms with no deadlines at all", () => {
    expect(() =>
      validatePaymentTerms({ totalAmountPerPerson: TOTAL, initialPaymentAmount: INITIAL, now: NOW }),
    ).not.toThrow();
  });

  it("refuses an initial payment larger than the trip", () => {
    expect(() =>
      validatePaymentTerms({ totalAmountPerPerson: INITIAL, initialPaymentAmount: TOTAL, now: NOW }),
    ).toThrowError(expect.objectContaining({ code: "INITIAL_EXCEEDS_TOTAL" }));
  });

  it("refuses zero or negative amounts", () => {
    expect(() =>
      validatePaymentTerms({ totalAmountPerPerson: 0, initialPaymentAmount: INITIAL, now: NOW }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TOTAL" }));
    expect(() =>
      validatePaymentTerms({ totalAmountPerPerson: TOTAL, initialPaymentAmount: 0, now: NOW }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INITIAL" }));
  });

  it("refuses deadlines in the past", () => {
    expect(() =>
      validatePaymentTerms({
        totalAmountPerPerson: TOTAL,
        initialPaymentAmount: INITIAL,
        paymentDeadline: new Date("2026-01-01"),
        now: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: "DEADLINE_IN_PAST" }));
  });

  it("refuses a final deadline before the first", () => {
    expect(() =>
      validatePaymentTerms({
        totalAmountPerPerson: TOTAL,
        initialPaymentAmount: INITIAL,
        paymentDeadline: laterStill,
        finalPaymentDeadline: future,
        now: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: "FINAL_DEADLINE_BEFORE_FIRST" }));
  });
});
