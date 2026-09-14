import { PayButton } from "@/components/payments/PayButton";
import { Card } from "@/components/ui/Card";
import { formatDateRangeWithYear } from "@/lib/format";
import type { DateRange } from "@/lib/matching";
import { formatMinor } from "@/lib/payments/money";

function Row({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-sm text-teal-950/60" : "text-sm text-teal-950/70"}>{label}</dt>
      <dd className={muted ? "text-sm text-teal-950/60" : "text-sm font-medium text-teal-950"}>
        {value}
      </dd>
    </div>
  );
}

/**
 * What a participant sees before they've paid anything.
 *
 * The initial payment is shown, not chosen: everyone on the trip owes the
 * same amount and there is no field to reduce it. The fee line is what the
 * server will charge, and the server recalculates it before taking anything.
 */
export function InitialPaymentSummary({
  tripId,
  destinationName,
  dates,
  currency,
  totalTripAmount,
  requiredInitialPayment,
  platformFee,
  paymentsAvailable,
}: {
  tripId: string;
  destinationName: string;
  dates: DateRange;
  currency: string;
  totalTripAmount: number;
  requiredInitialPayment: number;
  /** Zero if this participant's fee was already taken on an earlier attempt. */
  platformFee: number;
  paymentsAvailable: boolean;
}) {
  const totalToday = requiredInitialPayment + platformFee;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-950/50">
            Your trip
          </p>
          <h2 className="text-2xl font-bold text-teal-950">{destinationName}</h2>
          <p className="text-sm text-teal-950/70">{formatDateRangeWithYear(dates)}</p>
        </div>

        <dl className="flex flex-col gap-2 border-t border-teal-100 pt-4">
          <Row label="Total trip cost" value={formatMinor(totalTripAmount, currency)} />
          <Row
            label="Initial payment required"
            value={formatMinor(requiredInitialPayment, currency)}
          />
          <Row
            label={platformFee > 0 ? "One-time platform fee" : "One-time platform fee (already paid)"}
            value={formatMinor(platformFee, currency)}
            muted={platformFee === 0}
          />
        </dl>

        <div className="flex items-baseline justify-between gap-3 border-t-2 border-teal-200 pt-3">
          <span className="text-sm font-bold uppercase tracking-wide text-teal-950">
            Total today
          </span>
          <span className="text-2xl font-bold text-teal-950">
            {formatMinor(totalToday, currency)}
          </span>
        </div>
      </Card>

      {paymentsAvailable ? (
        <PayButton tripId={tripId} label={`Pay ${formatMinor(totalToday, currency)}`} />
      ) : (
        <Card>
          <p className="text-sm text-teal-950/70">
            Payments aren&apos;t switched on for this trip yet, so nothing can be charged.
          </p>
        </Card>
      )}
    </div>
  );
}
