import { OrganizerPaymentDashboard } from "@/components/payments/OrganizerPaymentDashboard";
import { PaymentSetupForm } from "@/components/payments/PaymentSetupForm";
import { YourPaymentSummary } from "@/components/payments/YourPaymentSummary";
import { Card } from "@/components/ui/Card";
import type { TripPaymentDashboard } from "@/lib/payments/service";

/**
 * The Payments area of a confirmed trip.
 *
 * Two audiences, two views. Everyone sees their own balance and the group's
 * progress as a count; only the organizer sees who has paid what, and only
 * because `dashboard.participants` is null for anyone else — the boundary is
 * the server's, not this component's.
 */
export function PaymentsSection({
  tripId,
  dashboard,
  platformFeeMinor,
  paymentsAvailable,
  initialAmountLocked,
  setupValues,
}: {
  tripId: string;
  dashboard: TripPaymentDashboard;
  platformFeeMinor: number;
  paymentsAvailable: boolean;
  initialAmountLocked: boolean;
  setupValues: {
    totalAmountPerPerson: string;
    initialPaymentAmount: string;
    paymentDeadline: string;
    finalPaymentDeadline: string;
  };
}) {
  const { viewerIsOrganizer, termsSet, currency, totals, you, participants } = dashboard;

  return (
    <section id="payments" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-medium text-teal-950">💳 Payments</h2>
        <p className="text-sm text-teal-950/60">
          {termsSet
            ? "Everyone pays the same initial payment to secure their place, then whatever they like towards the rest."
            : "The organizer sets the trip cost and the initial payment everyone makes."}
        </p>
      </div>

      {viewerIsOrganizer ? (
        <Card className="flex flex-col gap-3">
          <h3 className="font-medium text-teal-950">Payment settings</h3>
          <PaymentSetupForm
            tripId={tripId}
            currency={currency}
            platformFeeMinor={platformFeeMinor}
            initialValues={setupValues}
            locked={initialAmountLocked}
          />
        </Card>
      ) : null}

      {termsSet ? (
        <YourPaymentSummary
          tripId={tripId}
          currency={currency}
          you={you}
          paymentDeadline={dashboard.paymentDeadline}
          finalPaymentDeadline={dashboard.finalPaymentDeadline}
          groupProgress={{
            initialCompleteCount: totals.initialCompleteCount,
            participantCount: totals.participantCount,
          }}
          paymentsAvailable={paymentsAvailable}
        />
      ) : null}

      {termsSet && participants ? (
        <OrganizerPaymentDashboard
          currency={currency}
          totals={totals}
          participants={participants}
          paymentDeadline={dashboard.paymentDeadline}
          finalPaymentDeadline={dashboard.finalPaymentDeadline}
        />
      ) : null}
    </section>
  );
}
