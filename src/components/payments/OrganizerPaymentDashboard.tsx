import { PaymentDeadlines } from "@/components/payments/PaymentDeadlines";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { Card } from "@/components/ui/Card";
import { formatMinorCompact } from "@/lib/payments/money";
import type { ParticipantPaymentRow, TripPaymentTotals } from "@/lib/payments/summary";

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-teal-950/60">{label}</dt>
      <dd
        className={
          emphasis ? "text-2xl font-bold text-teal-950" : "text-xl font-semibold text-teal-950"
        }
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * What the organizer needs to run the trip: how much is in, how much is still
 * out, and who hasn't paid yet.
 *
 * What it deliberately doesn't show: anyone's payment history, when they
 * paid, what they paid with, or the platform fee. Managing a trip needs to
 * know whether someone has paid — not to audit their wallet.
 */
export function OrganizerPaymentDashboard({
  currency,
  totals,
  participants,
  paymentDeadline,
  finalPaymentDeadline,
}: {
  currency: string;
  totals: TripPaymentTotals;
  participants: ParticipantPaymentRow[];
  paymentDeadline: Date | null;
  finalPaymentDeadline: Date | null;
}) {
  const depositPercent =
    totals.requiredInitialTotal === 0
      ? 0
      : Math.round((totals.initialCollected / totals.requiredInitialTotal) * 100);

  return (
    <Card className="flex flex-col gap-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-950/50">
        Trip payments
      </h3>

      <dl className="flex flex-col gap-4">
        <Figure label="Total trip cost" value={formatMinorCompact(totals.totalTripCost, currency)} />
        <Figure
          label="Required initial payments"
          value={formatMinorCompact(totals.requiredInitialTotal, currency)}
        />
        <Figure
          label="Initial payments collected"
          value={formatMinorCompact(totals.initialCollected, currency)}
          emphasis
        />
      </dl>

      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-valuenow={depositPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Initial payments collected"
          className="h-2 overflow-hidden rounded-full bg-teal-100"
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
            style={{ width: `${depositPercent}%` }}
          />
        </div>
        <p className="text-sm text-teal-950/70">
          {totals.initialCompleteCount} of {totals.participantCount} participants have completed
          their initial payment.
        </p>
        {totals.overdueCount > 0 ? (
          <p className="text-sm font-medium text-amber-800">
            {totals.overdueCount} {totals.overdueCount === 1 ? "person is" : "people are"} overdue.
          </p>
        ) : null}
      </div>

      {paymentDeadline || finalPaymentDeadline ? (
        <div className="border-t border-teal-100 pt-4">
          <PaymentDeadlines
            paymentDeadline={paymentDeadline}
            finalPaymentDeadline={finalPaymentDeadline}
            initialPaymentPaid={totals.initialCompleteCount === totals.participantCount}
            fullyPaid={totals.totalOutstanding === 0}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-teal-100 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="font-medium text-teal-950">Participants</h4>
          <p className="text-sm text-teal-950/60">
            {formatMinorCompact(totals.totalCollected, currency)} in ·{" "}
            {formatMinorCompact(totals.totalOutstanding, currency)} to go
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {participants.map((participant) => (
            <li key={participant.participantId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate font-medium text-teal-950">
                  {participant.name}
                  {participant.isOrganizer ? (
                    <span className="font-normal text-teal-950/50"> · Organizer</span>
                  ) : null}
                </span>
                <PaymentStatusBadge status={participant.status} />
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span
                  className={
                    participant.initialPaymentPaid ? "text-emerald-700" : "text-teal-950/60"
                  }
                >
                  {participant.initialPaymentPaid ? (
                    <>
                      <span aria-hidden="true">✓</span> Initial payment complete
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">⏳</span> Initial payment pending
                    </>
                  )}
                </span>
                <span className="text-teal-950/70">
                  {formatMinorCompact(participant.totalAmountPaid, currency)} /{" "}
                  {formatMinorCompact(participant.totalTripAmount, currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
