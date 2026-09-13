import { formatMinorCompact } from "@/lib/payments/money";

/**
 * How much of a participant's trip cost is paid. The platform fee is never
 * part of this — it isn't trip money and doesn't move the bar.
 */
export function PaymentProgress({
  totalAmountPaid,
  totalTripAmount,
  currency,
}: {
  totalAmountPaid: number;
  totalTripAmount: number;
  currency: string;
}) {
  const percent =
    totalTripAmount === 0
      ? 0
      : Math.min(Math.round((totalAmountPaid / totalTripAmount) * 100), 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-teal-950">
          {formatMinorCompact(totalAmountPaid, currency)} paid
        </span>
        <span className="text-teal-950/60">
          of {formatMinorCompact(totalTripAmount, currency)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Trip payment progress"
        className="h-2 overflow-hidden rounded-full bg-teal-100"
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
