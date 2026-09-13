/**
 * The payment ledger's arithmetic and state machine.
 *
 * Pure and deterministic: it takes a participant's payment rows and the
 * trip's payment settings, and returns what they owe and where they stand.
 * No Prisma, no Stripe, no clock of its own — `now` is always passed in, so
 * deadline behaviour is testable rather than dependent on when the suite runs.
 *
 * The single most important rule here: **the platform fee is not trip money**.
 * It rides along with the first charge, but it never appears in a balance.
 * See PAYMENTS.md.
 */

export type ParticipantPaymentState =
  | "NO_PAYMENT"
  | "INITIAL_PAYMENT_PENDING"
  | "INITIAL_PAYMENT_PAID"
  | "PARTIALLY_PAID"
  | "FULLY_PAID"
  | "PAYMENT_FAILED"
  | "PAYMENT_OVERDUE"
  | "REFUND_PENDING"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type LedgerPaymentStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type LedgerRefundStatus = "PENDING" | "SUCCEEDED" | "FAILED";

export interface LedgerRefund {
  tripAmount: number;
  platformFeeAmount: number;
  status: LedgerRefundStatus;
}

export interface LedgerPayment {
  /** Trip money — the only thing that moves a balance. */
  amount: number;
  /** Our fee. Recorded, reconciled, and deliberately excluded from balances. */
  platformFee: number;
  status: LedgerPaymentStatus;
  kind: "INITIAL" | "ADDITIONAL";
  createdAt: Date;
  refunds?: LedgerRefund[];
}

export interface PaymentTerms {
  /** What this participant owes in total, in minor units. */
  totalTripAmount: number;
  /** The one-time required initial payment, identical for every participant. */
  requiredInitialPayment: number;
  paymentDeadline?: Date | null;
  finalPaymentDeadline?: Date | null;
}

export interface ParticipantBalance {
  totalTripAmount: number;
  requiredInitialPayment: number;
  /** Successful trip money, net of settled refunds. Never includes the fee. */
  totalAmountPaid: number;
  /** What's left to pay. Never reduced by the platform fee. */
  remainingBalance: number;
  initialPaymentPaid: boolean;
  platformFeePaid: boolean;
  /** Trip money currently in flight (created but not yet confirmed by Stripe). */
  pendingAmount: number;
  /** Trip money returned by settled refunds. */
  refundedAmount: number;
  /** The largest additional payment we'd accept right now. */
  maxAdditionalPayment: number;
  status: ParticipantPaymentState;
}

const SUCCEEDED: LedgerPaymentStatus = "SUCCEEDED";
const IN_FLIGHT: LedgerPaymentStatus[] = ["PENDING", "PROCESSING"];

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function settledRefundedTripMoney(payment: LedgerPayment): number {
  return sum(
    (payment.refunds ?? [])
      .filter((refund) => refund.status === "SUCCEEDED")
      .map((refund) => refund.tripAmount),
  );
}

function hasPendingRefund(payments: LedgerPayment[]): boolean {
  return payments.some((payment) =>
    (payment.refunds ?? []).some((refund) => refund.status === "PENDING"),
  );
}

/**
 * Works out where a participant stands. `now` decides deadline questions.
 */
export function calculateParticipantBalance(
  payments: LedgerPayment[],
  terms: PaymentTerms,
  now: Date = new Date(),
): ParticipantBalance {
  const succeeded = payments.filter((payment) => payment.status === SUCCEEDED);

  // Gross trip money that succeeded, before refunds — this is what decides
  // whether the initial payment obligation was ever met.
  const grossPaid = sum(succeeded.map((payment) => payment.amount));
  const refundedAmount = sum(succeeded.map(settledRefundedTripMoney));
  const totalAmountPaid = grossPaid - refundedAmount;

  const pendingAmount = sum(
    payments.filter((p) => IN_FLIGHT.includes(p.status)).map((payment) => payment.amount),
  );

  // The fee is charged once. It's "paid" if any succeeded payment carried it.
  const platformFeePaid = succeeded.some((payment) => payment.platformFee > 0);

  const remainingBalance = Math.max(terms.totalTripAmount - totalAmountPaid, 0);
  // Net, not gross: someone whose initial payment was refunded owes it again.
  // The fee is deliberately *not* symmetrical — see platformFeePaid above,
  // which stays true so we never charge it a second time.
  const initialPaymentPaid = totalAmountPaid >= terms.requiredInitialPayment && totalAmountPaid > 0;

  return {
    totalTripAmount: terms.totalTripAmount,
    requiredInitialPayment: terms.requiredInitialPayment,
    totalAmountPaid,
    remainingBalance,
    initialPaymentPaid,
    platformFeePaid,
    pendingAmount,
    refundedAmount,
    maxAdditionalPayment: remainingBalance,
    status: deriveStatus({
      payments,
      terms,
      now,
      grossPaid,
      totalAmountPaid,
      refundedAmount,
      pendingAmount,
    }),
  };
}

/**
 * The state machine. Precedence runs top to bottom and the first match wins;
 * the ordering is the interesting part, so it's spelled out rather than
 * collapsed into cleverness.
 */
function deriveStatus({
  payments,
  terms,
  now,
  grossPaid,
  totalAmountPaid,
  refundedAmount,
  pendingAmount,
}: {
  payments: LedgerPayment[];
  terms: PaymentTerms;
  now: Date;
  grossPaid: number;
  totalAmountPaid: number;
  refundedAmount: number;
  pendingAmount: number;
}): ParticipantPaymentState {
  // 1. Refunds describe the participant's position more usefully than
  //    anything else, so they come first.
  if (refundedAmount > 0) {
    return refundedAmount >= grossPaid ? "REFUNDED" : "PARTIALLY_REFUNDED";
  }
  if (hasPendingRefund(payments)) {
    return "REFUND_PENDING";
  }

  // 2. Paid in full — no deadline can make someone who owes nothing overdue.
  if (totalAmountPaid >= terms.totalTripAmount && terms.totalTripAmount > 0) {
    return "FULLY_PAID";
  }

  // 3. Overdue outranks the partial-payment states: someone who paid their
  //    initial but owes the balance past the final deadline is overdue, and
  //    saying "initial payment paid" would bury that.
  if (isOverdue({ terms, now, grossPaid, totalAmountPaid })) {
    return "PAYMENT_OVERDUE";
  }

  // 4. An attempt in flight, while the initial obligation is still unmet.
  const initialMet = grossPaid >= terms.requiredInitialPayment && grossPaid > 0;
  if (!initialMet && pendingAmount > 0) {
    return "INITIAL_PAYMENT_PENDING";
  }

  // 5. Paid something, but not everything.
  if (initialMet) {
    return grossPaid > terms.requiredInitialPayment ? "PARTIALLY_PAID" : "INITIAL_PAYMENT_PAID";
  }
  if (totalAmountPaid > 0) {
    return "PARTIALLY_PAID";
  }

  // 6. Nothing succeeded and nothing is in flight — did the last try fail?
  const lastAttempt = [...payments].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
  if (lastAttempt?.status === "FAILED") {
    return "PAYMENT_FAILED";
  }

  return "NO_PAYMENT";
}

function isOverdue({
  terms,
  now,
  grossPaid,
  totalAmountPaid,
}: {
  terms: PaymentTerms;
  now: Date;
  grossPaid: number;
  totalAmountPaid: number;
}): boolean {
  // The final deadline covers the whole balance...
  if (
    terms.finalPaymentDeadline &&
    now > terms.finalPaymentDeadline &&
    totalAmountPaid < terms.totalTripAmount
  ) {
    return true;
  }
  // ...and the first deadline covers only the required initial payment.
  if (
    terms.paymentDeadline &&
    now > terms.paymentDeadline &&
    grossPaid < terms.requiredInitialPayment
  ) {
    return true;
  }
  return false;
}
