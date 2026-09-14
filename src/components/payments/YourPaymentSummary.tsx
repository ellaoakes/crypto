import Link from "next/link";

import { PaymentDeadlines } from "@/components/payments/PaymentDeadlines";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMinorCompact } from "@/lib/payments/money";
import type { ParticipantPaymentRow } from "@/lib/payments/summary";

function Line({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-teal-950/60">{label}</dt>
      <dd
        className={
          emphasis ? "text-xl font-bold text-teal-950" : "text-sm font-medium text-teal-950"
        }
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * A participant's own position — and only their own.
 *
 * Nobody but the organizer sees who else has paid what. What everyone does
 * see is how far the group has got as a count, which is what makes the trip
 * feel shared without putting anyone's finances on display.
 */
export function YourPaymentSummary({
  tripId,
  currency,
  you,
  paymentDeadline,
  finalPaymentDeadline,
  groupProgress,
  paymentsAvailable,
}: {
  tripId: string;
  currency: string;
  you: ParticipantPaymentRow;
  paymentDeadline: Date | null;
  finalPaymentDeadline: Date | null;
  /** Counts only — never who, never how much. */
  groupProgress: { initialCompleteCount: number; participantCount: number };
  paymentsAvailable: boolean;
}) {
  const fullyPaid = you.remainingBalance === 0;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-950/50">
          Your trip
        </h3>
        <PaymentStatusBadge status={you.status} />
      </div>

      <dl className="flex flex-col gap-2">
        <Line label="Total" value={formatMinorCompact(you.totalTripAmount, currency)} />
        <Line
          label="Initial payment"
          value={formatMinorCompact(you.requiredInitialPayment, currency)}
        />
        <Line label="Paid" value={formatMinorCompact(you.totalAmountPaid, currency)} />
        <div className="border-t border-teal-100 pt-2">
          <Line
            label="Remaining"
            value={formatMinorCompact(you.remainingBalance, currency)}
            emphasis
          />
        </div>
      </dl>

      <p
        className={
          you.initialPaymentPaid
            ? "text-sm font-medium text-emerald-700"
            : "text-sm text-teal-950/70"
        }
      >
        {you.initialPaymentPaid ? (
          <>
            <span aria-hidden="true">✓</span> Initial payment complete
          </>
        ) : (
          <>
            <span aria-hidden="true">⏳</span> Initial payment pending
          </>
        )}
      </p>

      {paymentDeadline || finalPaymentDeadline ? (
        <div className="border-t border-teal-100 pt-4">
          <PaymentDeadlines
            paymentDeadline={paymentDeadline}
            finalPaymentDeadline={finalPaymentDeadline}
            initialPaymentPaid={you.initialPaymentPaid}
            fullyPaid={fullyPaid}
          />
        </div>
      ) : null}

      {fullyPaid ? (
        <p className="text-sm font-medium text-emerald-700">
          You&apos;re all paid up for this trip. 🎉
        </p>
      ) : paymentsAvailable ? (
        <Link href={`/trips/${tripId}/pay`}>
          <Button className="w-full">
            {you.initialPaymentPaid
              ? "Make another payment"
              : `Pay ${formatMinorCompact(you.requiredInitialPayment, currency)} initial payment`}
          </Button>
        </Link>
      ) : (
        <p className="text-sm text-teal-950/60">
          Payments aren&apos;t switched on for this trip yet, so nothing can be charged.
        </p>
      )}

      <p className="border-t border-teal-100 pt-3 text-sm text-teal-950/60">
        {groupProgress.initialCompleteCount} of {groupProgress.participantCount} on this trip have
        made their initial payment.
      </p>
    </Card>
  );
}
