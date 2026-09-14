import Link from "next/link";

import { PaymentProgress } from "@/components/payments/PaymentProgress";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMinor, formatMinorCompact } from "@/lib/payments/money";
import type { ParticipantPaymentView } from "@/lib/payments/service";

function formatDeadline(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The participant's money, summarised on the trip dashboard.
 *
 * Read-only on purpose: paying happens on /pay, which is a focused flow that
 * hands off to Stripe. This is the glance, not the checkout.
 */
export function PaymentPanel({
  tripId,
  view,
  paymentsAvailable,
}: {
  tripId: string;
  view: ParticipantPaymentView;
  /** False when the trip has no settlement account configured yet. */
  paymentsAvailable: boolean;
}) {
  const inFlight = view.payments.some(
    (payment) => payment.status === "PENDING" || payment.status === "PROCESSING",
  );
  const firstDeadline = formatDeadline(view.paymentDeadline);
  const finalDeadline = formatDeadline(view.finalPaymentDeadline);

  if (view.totalTripAmount === 0) {
    return (
      <Card className="flex flex-col gap-2">
        <h3 className="font-medium text-teal-950">Your payments</h3>
        <p className="text-sm text-teal-950/60">
          The organizer hasn&apos;t set the trip cost yet. Nothing to pay for now.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-teal-950">Your payments</h3>
        <PaymentStatusBadge status={view.status} />
      </div>

      <PaymentProgress
        totalAmountPaid={view.totalAmountPaid}
        totalTripAmount={view.totalTripAmount}
        currency={view.currency}
      />

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-teal-950/60">Still to pay</dt>
          <dd className="font-medium text-teal-950">
            {formatMinorCompact(view.remainingBalance, view.currency)}
          </dd>
        </div>
        {!view.initialPaymentPaid ? (
          <div className="flex justify-between gap-2">
            <dt className="text-teal-950/60">Required deposit</dt>
            <dd className="font-medium text-teal-950">
              {formatMinorCompact(view.requiredInitialPayment, view.currency)}
            </dd>
          </div>
        ) : null}
        {firstDeadline ? (
          <div className="flex justify-between gap-2">
            <dt className="text-teal-950/60">Deposit due by</dt>
            <dd className="text-teal-950">{firstDeadline}</dd>
          </div>
        ) : null}
        {finalDeadline ? (
          <div className="flex justify-between gap-2">
            <dt className="text-teal-950/60">Balance due by</dt>
            <dd className="text-teal-950">{finalDeadline}</dd>
          </div>
        ) : null}
      </dl>

      {!paymentsAvailable ? (
        <p className="text-sm text-teal-950/60">
          Payments aren&apos;t switched on for this trip yet, so nothing can be charged.
        </p>
      ) : view.remainingBalance === 0 ? (
        <p className="text-sm font-medium text-emerald-700">
          You&apos;re all paid up for this trip. 🎉
        </p>
      ) : (
        <Link href={`/trips/${tripId}/pay`}>
          <Button className="w-full">
            {inFlight
              ? "Finish your payment"
              : view.initialPaymentPaid
                ? "Make a payment"
                : `Pay ${formatMinorCompact(view.requiredInitialPayment, view.currency)} deposit`}
          </Button>
        </Link>
      )}

      {view.payments.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-teal-100 pt-3">
          <h4 className="text-sm font-medium text-teal-950">History</h4>
          <ul className="flex flex-col gap-1.5 text-sm">
            {view.payments.map((payment) => (
              <li key={payment.id} className="flex items-baseline justify-between gap-2">
                <span className="text-teal-950/70">
                  {new Date(payment.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                  {payment.platformFee > 0 && payment.status === "SUCCEEDED"
                    ? ` · incl. ${formatMinor(payment.platformFee, view.currency)} fee`
                    : ""}
                  {payment.refundedAmount > 0
                    ? ` · ${formatMinor(payment.refundedAmount, view.currency)} refunded`
                    : ""}
                </span>
                <span
                  className={
                    payment.status === "SUCCEEDED"
                      ? "font-medium text-teal-950"
                      : "text-teal-950/50"
                  }
                >
                  {formatMinor(payment.amount, view.currency)}
                  {payment.status === "SUCCEEDED" ? "" : ` (${payment.status.toLowerCase()})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
