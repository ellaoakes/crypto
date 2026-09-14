/**
 * Aggregating a trip's payment position.
 *
 * Pure: it takes each participant's already-derived balance and rolls it up.
 * No Prisma, no clock of its own. The figures it produces are only ever as
 * good as the balances passed in, and those come from the ledger — never from
 * anything a browser reported.
 */
import type { ParticipantBalance, ParticipantPaymentState } from "@/lib/payments/balance";

export interface ParticipantPaymentRow {
  participantId: string;
  userId: string;
  name: string;
  isOrganizer: boolean;
  totalTripAmount: number;
  requiredInitialPayment: number;
  totalAmountPaid: number;
  remainingBalance: number;
  initialPaymentPaid: boolean;
  status: ParticipantPaymentState;
}

export interface TripPaymentTotals {
  participantCount: number;
  /** Every participant's trip cost added together. */
  totalTripCost: number;
  /** Every participant's required initial payment added together. */
  requiredInitialTotal: number;
  /**
   * How much of those required initial payments is actually in.
   *
   * Capped per person: someone who paid £400 against a £200 deposit has
   * contributed £200 towards the deposits and £200 towards their balance.
   * Without the cap, one keen payer would mask someone who hasn't paid at all.
   */
  initialCollected: number;
  /** All trip money collected, deposits and voluntary payments alike. */
  totalCollected: number;
  totalOutstanding: number;
  initialCompleteCount: number;
  fullyPaidCount: number;
  overdueCount: number;
}

export function buildParticipantRow({
  participantId,
  userId,
  name,
  isOrganizer,
  balance,
}: {
  participantId: string;
  userId: string;
  name: string;
  isOrganizer: boolean;
  balance: ParticipantBalance;
}): ParticipantPaymentRow {
  return {
    participantId,
    userId,
    name,
    isOrganizer,
    totalTripAmount: balance.totalTripAmount,
    requiredInitialPayment: balance.requiredInitialPayment,
    totalAmountPaid: balance.totalAmountPaid,
    remainingBalance: balance.remainingBalance,
    initialPaymentPaid: balance.initialPaymentPaid,
    status: balance.status,
  };
}

export function summariseTripPayments(rows: ParticipantPaymentRow[]): TripPaymentTotals {
  return {
    participantCount: rows.length,
    totalTripCost: sum(rows, (row) => row.totalTripAmount),
    requiredInitialTotal: sum(rows, (row) => row.requiredInitialPayment),
    initialCollected: sum(rows, (row) =>
      Math.min(row.totalAmountPaid, row.requiredInitialPayment),
    ),
    totalCollected: sum(rows, (row) => row.totalAmountPaid),
    totalOutstanding: sum(rows, (row) => row.remainingBalance),
    initialCompleteCount: rows.filter((row) => row.initialPaymentPaid).length,
    fullyPaidCount: rows.filter((row) => row.status === "FULLY_PAID").length,
    overdueCount: rows.filter((row) => row.status === "PAYMENT_OVERDUE").length,
  };
}

function sum(rows: ParticipantPaymentRow[], pick: (row: ParticipantPaymentRow) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}
