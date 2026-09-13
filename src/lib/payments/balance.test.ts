import { describe, expect, it } from "vitest";

import { calculateParticipantBalance, type LedgerPayment, type PaymentTerms } from "@/lib/payments/balance";
import { PLATFORM_FEE_MINOR } from "@/lib/payments/money";

const TOTAL = 120_000; // £1,200
const INITIAL = 20_000; // £200

const terms: PaymentTerms = { totalTripAmount: TOTAL, requiredInitialPayment: INITIAL };
const NOW = new Date("2027-01-01T00:00:00Z");

function payment(overrides: Partial<LedgerPayment> = {}): LedgerPayment {
  return {
    amount: INITIAL,
    platformFee: 0,
    status: "SUCCEEDED",
    kind: "ADDITIONAL",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

const initialPayment = payment({ kind: "INITIAL", platformFee: PLATFORM_FEE_MINOR });

describe("calculateParticipantBalance", () => {
  it("treats nobody who has paid nothing as owing everything", () => {
    const balance = calculateParticipantBalance([], terms, NOW);

    expect(balance.totalAmountPaid).toBe(0);
    expect(balance.remainingBalance).toBe(TOTAL);
    expect(balance.initialPaymentPaid).toBe(false);
    expect(balance.platformFeePaid).toBe(false);
    expect(balance.status).toBe("NO_PAYMENT");
  });

  it("excludes the platform fee from the trip balance", () => {
    // The brief's worked example: £1,200 trip, £300 of trip payments and a
    // £5 fee leaves £900 — not £895.
    const balance = calculateParticipantBalance(
      [payment({ amount: 30_000, kind: "INITIAL", platformFee: PLATFORM_FEE_MINOR })],
      terms,
      NOW,
    );

    expect(balance.totalAmountPaid).toBe(30_000);
    expect(balance.remainingBalance).toBe(90_000);
  });

  it("counts the fee as paid without letting it touch the amounts", () => {
    const balance = calculateParticipantBalance([initialPayment], terms, NOW);

    expect(balance.platformFeePaid).toBe(true);
    expect(balance.totalAmountPaid).toBe(INITIAL);
    expect(balance.remainingBalance).toBe(TOTAL - INITIAL);
  });

  it("ignores a fee that rode with a payment that never succeeded", () => {
    const balance = calculateParticipantBalance(
      [payment({ status: "FAILED", platformFee: PLATFORM_FEE_MINOR, kind: "INITIAL" })],
      terms,
      NOW,
    );

    expect(balance.platformFeePaid).toBe(false);
    expect(balance.totalAmountPaid).toBe(0);
  });

  it("reproduces the brief's three participants exactly", () => {
    const a = calculateParticipantBalance(
      [initialPayment, payment({ amount: 30_000 }), payment({ amount: 20_000 })],
      terms,
      NOW,
    );
    const b = calculateParticipantBalance(
      [initialPayment, payment({ amount: 10_000 })],
      terms,
      NOW,
    );
    const c = calculateParticipantBalance(
      [initialPayment, payment({ amount: 70_000 })],
      terms,
      NOW,
    );

    expect(a.remainingBalance).toBe(50_000); // £500
    expect(b.remainingBalance).toBe(90_000); // £900
    expect(c.remainingBalance).toBe(30_000); // £300
  });

  it("never reports a negative balance", () => {
    const balance = calculateParticipantBalance(
      [payment({ amount: TOTAL + 5_000 })],
      terms,
      NOW,
    );

    expect(balance.remainingBalance).toBe(0);
  });

  it("counts only trip money that is actually in flight as pending", () => {
    const balance = calculateParticipantBalance(
      [payment({ status: "PENDING", amount: INITIAL, platformFee: PLATFORM_FEE_MINOR })],
      terms,
      NOW,
    );

    expect(balance.pendingAmount).toBe(INITIAL);
    expect(balance.totalAmountPaid).toBe(0);
  });
});

describe("participant payment states", () => {
  it("is INITIAL_PAYMENT_PENDING while the first attempt is in flight", () => {
    expect(
      calculateParticipantBalance([payment({ status: "PENDING", kind: "INITIAL" })], terms, NOW)
        .status,
    ).toBe("INITIAL_PAYMENT_PENDING");
  });

  it("is INITIAL_PAYMENT_PAID once the required amount has succeeded", () => {
    expect(calculateParticipantBalance([initialPayment], terms, NOW).status).toBe(
      "INITIAL_PAYMENT_PAID",
    );
  });

  it("is PARTIALLY_PAID once they've paid more than the initial", () => {
    expect(
      calculateParticipantBalance([initialPayment, payment({ amount: 10_000 })], terms, NOW).status,
    ).toBe("PARTIALLY_PAID");
  });

  it("is FULLY_PAID when trip payments reach the total", () => {
    expect(
      calculateParticipantBalance(
        [initialPayment, payment({ amount: TOTAL - INITIAL })],
        terms,
        NOW,
      ).status,
    ).toBe("FULLY_PAID");
  });

  it("is PAYMENT_FAILED when the most recent attempt failed and nothing succeeded", () => {
    expect(
      calculateParticipantBalance([payment({ status: "FAILED", kind: "INITIAL" })], terms, NOW)
        .status,
    ).toBe("PAYMENT_FAILED");
  });

  it("is not PAYMENT_FAILED once a later attempt succeeded", () => {
    expect(
      calculateParticipantBalance(
        [
          payment({ status: "FAILED", kind: "INITIAL", createdAt: new Date("2026-09-01") }),
          payment({ ...initialPayment, createdAt: new Date("2026-09-02") }),
        ],
        terms,
        NOW,
      ).status,
    ).toBe("INITIAL_PAYMENT_PAID");
  });

  it("is PAYMENT_OVERDUE when the first deadline passes with the initial unpaid", () => {
    expect(
      calculateParticipantBalance(
        [],
        { ...terms, paymentDeadline: new Date("2026-12-01T00:00:00Z") },
        NOW,
      ).status,
    ).toBe("PAYMENT_OVERDUE");
  });

  it("is not overdue before the deadline", () => {
    expect(
      calculateParticipantBalance(
        [],
        { ...terms, paymentDeadline: new Date("2027-06-01T00:00:00Z") },
        NOW,
      ).status,
    ).toBe("NO_PAYMENT");
  });

  it("is not overdue on the first deadline once the initial is paid", () => {
    expect(
      calculateParticipantBalance(
        [initialPayment],
        { ...terms, paymentDeadline: new Date("2026-12-01T00:00:00Z") },
        NOW,
      ).status,
    ).toBe("INITIAL_PAYMENT_PAID");
  });

  it("is PAYMENT_OVERDUE when the final deadline passes with a balance outstanding", () => {
    expect(
      calculateParticipantBalance(
        [initialPayment],
        { ...terms, finalPaymentDeadline: new Date("2026-12-01T00:00:00Z") },
        NOW,
      ).status,
    ).toBe("PAYMENT_OVERDUE");
  });

  it("is never overdue once fully paid, whatever the deadlines", () => {
    expect(
      calculateParticipantBalance(
        [payment({ amount: TOTAL })],
        {
          ...terms,
          paymentDeadline: new Date("2026-01-01T00:00:00Z"),
          finalPaymentDeadline: new Date("2026-02-01T00:00:00Z"),
        },
        NOW,
      ).status,
    ).toBe("FULLY_PAID");
  });

  it("is REFUND_PENDING while a refund hasn't settled", () => {
    expect(
      calculateParticipantBalance(
        [{ ...initialPayment, refunds: [{ tripAmount: INITIAL, platformFeeAmount: 0, status: "PENDING" }] }],
        terms,
        NOW,
      ).status,
    ).toBe("REFUND_PENDING");
  });

  it("is PARTIALLY_REFUNDED when some trip money came back", () => {
    const balance = calculateParticipantBalance(
      [
        {
          ...initialPayment,
          amount: 50_000,
          refunds: [{ tripAmount: 20_000, platformFeeAmount: 0, status: "SUCCEEDED" }],
        },
      ],
      terms,
      NOW,
    );

    expect(balance.status).toBe("PARTIALLY_REFUNDED");
    expect(balance.totalAmountPaid).toBe(30_000);
    expect(balance.remainingBalance).toBe(90_000);
  });

  it("is REFUNDED when all their trip money came back", () => {
    const balance = calculateParticipantBalance(
      [
        {
          ...initialPayment,
          refunds: [{ tripAmount: INITIAL, platformFeeAmount: 0, status: "SUCCEEDED" }],
        },
      ],
      terms,
      NOW,
    );

    expect(balance.status).toBe("REFUNDED");
    expect(balance.totalAmountPaid).toBe(0);
    expect(balance.remainingBalance).toBe(TOTAL);
  });

  it("keeps the fee marked paid after a trip-money refund, so it's never re-charged", () => {
    const balance = calculateParticipantBalance(
      [
        {
          ...initialPayment,
          refunds: [{ tripAmount: INITIAL, platformFeeAmount: 0, status: "SUCCEEDED" }],
        },
      ],
      terms,
      NOW,
    );

    expect(balance.platformFeePaid).toBe(true);
  });

  it("ignores a failed refund", () => {
    expect(
      calculateParticipantBalance(
        [{ ...initialPayment, refunds: [{ tripAmount: INITIAL, platformFeeAmount: 0, status: "FAILED" }] }],
        terms,
        NOW,
      ).status,
    ).toBe("INITIAL_PAYMENT_PAID");
  });
});

describe("refunds and the initial payment obligation", () => {
  it("puts a fully refunded participant back to owing the initial payment", () => {
    const balance = calculateParticipantBalance(
      [
        {
          ...initialPayment,
          refunds: [{ tripAmount: INITIAL, platformFeeAmount: 0, status: "SUCCEEDED" }],
        },
      ],
      terms,
      NOW,
    );

    // Their trip money is back to zero, so the requirement is unmet again...
    expect(balance.initialPaymentPaid).toBe(false);
    // ...but our fee stays charged, so it can never be taken twice.
    expect(balance.platformFeePaid).toBe(true);
  });

  it("keeps the initial satisfied when a refund leaves enough behind", () => {
    const balance = calculateParticipantBalance(
      [
        {
          ...initialPayment,
          amount: 50_000,
          refunds: [{ tripAmount: 10_000, platformFeeAmount: 0, status: "SUCCEEDED" }],
        },
      ],
      terms,
      NOW,
    );

    expect(balance.totalAmountPaid).toBe(40_000);
    expect(balance.initialPaymentPaid).toBe(true);
  });
});
