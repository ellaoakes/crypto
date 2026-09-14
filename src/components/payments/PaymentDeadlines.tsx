import { cn } from "@/lib/cn";

function format(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysUntil(date: Date, now: Date): number {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(
    new Date(date).getUTCFullYear(),
    new Date(date).getUTCMonth(),
    new Date(date).getUTCDate(),
  );
  return Math.round((end - start) / 86_400_000);
}

function Deadline({
  label,
  date,
  met,
  now,
}: {
  label: string;
  date: Date;
  /** True when the obligation this deadline covers is already satisfied. */
  met: boolean;
  now: Date;
}) {
  const days = daysUntil(date, now);
  const overdue = days < 0 && !met;
  const soon = days >= 0 && days <= 7 && !met;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-teal-950/60">{label}</dt>
      <dd
        className={cn(
          "text-sm",
          overdue ? "font-medium text-red-700" : soon ? "font-medium text-amber-800" : "text-teal-950",
        )}
      >
        {format(date)}
        {met ? null : overdue ? (
          <span> · {Math.abs(days)} {Math.abs(days) === 1 ? "day" : "days"} ago</span>
        ) : days === 0 ? (
          <span> · today</span>
        ) : soon ? (
          <span> · in {days} {days === 1 ? "day" : "days"}</span>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * When money is due. Shown to organizer and participant alike — a deadline is
 * a fact about the trip, not private financial information.
 */
export function PaymentDeadlines({
  paymentDeadline,
  finalPaymentDeadline,
  initialPaymentPaid,
  fullyPaid,
  now = new Date(),
}: {
  paymentDeadline: Date | null;
  finalPaymentDeadline: Date | null;
  /** Used only to stop nagging about a deadline that's already been met. */
  initialPaymentPaid?: boolean;
  fullyPaid?: boolean;
  now?: Date;
}) {
  if (!paymentDeadline && !finalPaymentDeadline) return null;

  return (
    <dl className="flex flex-col gap-1">
      {paymentDeadline ? (
        <Deadline
          label="Initial payment due"
          date={paymentDeadline}
          met={Boolean(initialPaymentPaid)}
          now={now}
        />
      ) : null}
      {finalPaymentDeadline ? (
        <Deadline
          label="Balance due"
          date={finalPaymentDeadline}
          met={Boolean(fullyPaid)}
          now={now}
        />
      ) : null}
    </dl>
  );
}
