import { PaymentPanel } from "@/components/payments/PaymentPanel";
import { PaymentSetupForm } from "@/components/payments/PaymentSetupForm";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { Card } from "@/components/ui/Card";
import { formatMinorCompact } from "@/lib/payments/money";
import type { ParticipantPaymentView } from "@/lib/payments/service";

export interface ParticipantPaymentRow {
  id: string;
  name: string;
  isOrganizer: boolean;
  totalAmountPaid: number;
  remainingBalance: number;
  status: string;
}

/**
 * The Payments area of a confirmed trip: the organizer's settings, everyone's
 * position at a glance, and the signed-in participant's own payment panel.
 */
export function PaymentsSection({
  tripId,
  currency,
  isOrganizer,
  view,
  participants,
  paymentsAvailable,
  termsSet,
  initialAmountLocked,
  setupValues,
}: {
  tripId: string;
  currency: string;
  isOrganizer: boolean;
  view: ParticipantPaymentView;
  participants: ParticipantPaymentRow[];
  paymentsAvailable: boolean;
  termsSet: boolean;
  initialAmountLocked: boolean;
  setupValues: {
    totalAmountPerPerson: string;
    initialPaymentAmount: string;
    paymentDeadline: string;
    finalPaymentDeadline: string;
  };
}) {
  const collected = participants.reduce((total, row) => total + row.totalAmountPaid, 0);
  const outstanding = participants.reduce((total, row) => total + row.remainingBalance, 0);

  return (
    <section id="payments" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-medium text-teal-950">💳 Payments</h2>
        <p className="text-sm text-teal-950/60">
          {termsSet
            ? "Everyone pays the same deposit to secure their place, then whatever they like towards the rest."
            : "The organizer sets the trip cost and the deposit everyone pays."}
        </p>
      </div>

      {isOrganizer ? (
        <Card className="flex flex-col gap-3">
          <h3 className="font-medium text-teal-950">Payment settings</h3>
          <PaymentSetupForm
            tripId={tripId}
            currency={currency}
            platformFeeMinor={view.platformFeeMinor}
            initialValues={setupValues}
            locked={initialAmountLocked}
          />
        </Card>
      ) : null}

      {termsSet ? (
        <PaymentPanel tripId={tripId} view={view} paymentsAvailable={paymentsAvailable} />
      ) : null}

      {termsSet ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-medium text-teal-950">Everyone&apos;s payments</h3>
            <p className="text-sm text-teal-950/60">
              {formatMinorCompact(collected, currency)} in ·{" "}
              {formatMinorCompact(outstanding, currency)} to go
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-teal-950">
                  {participant.name}
                  {participant.isOrganizer ? (
                    <span className="text-teal-950/50"> · Organizer</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-teal-950/60">
                  {formatMinorCompact(participant.totalAmountPaid, currency)}
                </span>
                <PaymentStatusBadge status={participant.status} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
