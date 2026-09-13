/**
 * What we will and won't accept as a payment, decided before any money moves.
 *
 * Pure, so every rule here is unit-testable without Stripe or a database.
 * The service layer calls this and refuses anything that doesn't come back
 * clean — the client is never trusted to have applied these itself.
 */
import { PLATFORM_FEE_MINOR } from "@/lib/payments/money";
import type { ParticipantBalance } from "@/lib/payments/balance";

export class PaymentRuleError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PaymentRuleError";
    this.code = code;
  }
}

export interface PlannedCharge {
  /** Trip money. */
  amount: number;
  /** Our fee — PLATFORM_FEE_MINOR on the first payment, 0 after that. */
  platformFee: number;
  /** What the card is charged. */
  totalCharged: number;
  kind: "INITIAL" | "ADDITIONAL";
}

/**
 * Works out the charge for a requested payment, or explains why we won't
 * take it.
 *
 * `requestedAmount` is trip money and is ignored for the initial payment:
 * every participant pays exactly the same required initial amount, so there
 * is nothing for the client to choose.
 */
export function planCharge({
  balance,
  requestedAmount,
  feeAlreadyCharged,
}: {
  balance: ParticipantBalance;
  /** Trip money the participant asked to pay. Only used after the initial. */
  requestedAmount?: number;
  /** True if a PlatformFee row already exists for this participant+trip. */
  feeAlreadyCharged: boolean;
}): PlannedCharge {
  if (balance.totalTripAmount <= 0) {
    throw new PaymentRuleError(
      "PAYMENTS_NOT_SET_UP",
      "The organizer hasn't set the trip cost yet.",
    );
  }

  if (!balance.initialPaymentPaid) {
    if (balance.pendingAmount > 0) {
      throw new PaymentRuleError(
        "PAYMENT_IN_PROGRESS",
        "You already have a payment in progress. Finish or cancel it first.",
      );
    }

    // The fee rides with the first successful payment. If a previous attempt
    // already banked the fee (a refunded initial, say), we never charge it
    // again — the fee is once per participant per trip, full stop.
    const platformFee = feeAlreadyCharged ? 0 : PLATFORM_FEE_MINOR;
    const amount = balance.requiredInitialPayment;

    return { amount, platformFee, totalCharged: amount + platformFee, kind: "INITIAL" };
  }

  if (balance.remainingBalance <= 0) {
    throw new PaymentRuleError("ALREADY_PAID", "You've paid this trip off in full.");
  }

  if (requestedAmount === undefined) {
    throw new PaymentRuleError("AMOUNT_REQUIRED", "Choose how much you'd like to pay.");
  }
  if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
    throw new PaymentRuleError("INVALID_AMOUNT", "Enter an amount greater than zero.");
  }
  // Overpayment prevention: the balance is trip money only, so the fee can
  // never make room for a payment that overshoots it.
  if (requestedAmount > balance.remainingBalance) {
    throw new PaymentRuleError(
      "EXCEEDS_BALANCE",
      "That's more than you have left to pay on this trip.",
    );
  }
  if (requestedAmount + balance.pendingAmount > balance.remainingBalance) {
    throw new PaymentRuleError(
      "EXCEEDS_BALANCE_WITH_PENDING",
      "You have a payment in progress that would take you over your balance.",
    );
  }

  return {
    amount: requestedAmount,
    platformFee: 0,
    totalCharged: requestedAmount,
    kind: "ADDITIONAL",
  };
}

/**
 * Validates what an organizer is trying to set as a trip's payment terms.
 * Amounts arrive in minor units.
 */
export function validatePaymentTerms({
  totalAmountPerPerson,
  initialPaymentAmount,
  paymentDeadline,
  finalPaymentDeadline,
  now = new Date(),
}: {
  totalAmountPerPerson: number;
  initialPaymentAmount: number;
  paymentDeadline?: Date | null;
  finalPaymentDeadline?: Date | null;
  now?: Date;
}): void {
  if (!Number.isInteger(totalAmountPerPerson) || totalAmountPerPerson <= 0) {
    throw new PaymentRuleError("INVALID_TOTAL", "Enter a trip cost greater than zero.");
  }
  if (!Number.isInteger(initialPaymentAmount) || initialPaymentAmount <= 0) {
    throw new PaymentRuleError(
      "INVALID_INITIAL",
      "Enter an initial payment greater than zero.",
    );
  }
  if (initialPaymentAmount > totalAmountPerPerson) {
    throw new PaymentRuleError(
      "INITIAL_EXCEEDS_TOTAL",
      "The initial payment can't be more than the total trip cost.",
    );
  }
  if (paymentDeadline && paymentDeadline <= now) {
    throw new PaymentRuleError("DEADLINE_IN_PAST", "The payment deadline must be in the future.");
  }
  if (finalPaymentDeadline && finalPaymentDeadline <= now) {
    throw new PaymentRuleError(
      "FINAL_DEADLINE_IN_PAST",
      "The final payment deadline must be in the future.",
    );
  }
  if (paymentDeadline && finalPaymentDeadline && finalPaymentDeadline < paymentDeadline) {
    throw new PaymentRuleError(
      "FINAL_DEADLINE_BEFORE_FIRST",
      "The final deadline can't be before the first payment deadline.",
    );
  }
}
