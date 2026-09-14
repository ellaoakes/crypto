import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMinor } from "@/lib/payments/money";

/**
 * The state after the required initial payment has settled. Everything from
 * here is optional and participant-initiated — there is no schedule, no
 * standing mandate and nothing charged without them asking for it.
 */
export function InitialPaymentComplete({
  tripId,
  currency,
  paidTowardsTrip,
  platformFeePaid,
  platformFeeAmount,
  remainingBalance,
  paymentsAvailable,
}: {
  tripId: string;
  currency: string;
  paidTowardsTrip: number;
  platformFeePaid: boolean;
  platformFeeAmount: number;
  remainingBalance: number;
  paymentsAvailable: boolean;
}) {
  const settled = remainingBalance === 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-semibold text-emerald-700">
            <span aria-hidden="true">✓</span> Initial payment complete
          </p>
          <p className="text-sm text-teal-950">
            {formatMinor(paidTowardsTrip, currency)} paid towards your trip
          </p>
          {platformFeePaid ? (
            <p className="flex items-center gap-2 text-sm text-teal-950/70">
              <span aria-hidden="true">✓</span>
              {formatMinor(platformFeeAmount, currency)} platform fee paid
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-0.5 border-t border-teal-100 pt-4">
          <p className="text-sm text-teal-950/60">Remaining trip balance</p>
          <p className="text-3xl font-bold text-teal-950">
            {formatMinor(remainingBalance, currency)}
          </p>
        </div>

        <p className="text-sm text-teal-950/70">
          {settled
            ? "You're all paid up for this trip. 🎉"
            : "You can make additional payments whenever you choose."}
        </p>
      </Card>

      {!settled && paymentsAvailable ? (
        <Link href={`/trips/${tripId}/pay/amount`}>
          <Button className="w-full">Make a payment</Button>
        </Link>
      ) : null}

      <Link href={`/trips/${tripId}`} className="text-center text-sm text-teal-700 hover:underline">
        Back to the trip
      </Link>
    </div>
  );
}
