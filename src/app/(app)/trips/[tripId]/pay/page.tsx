import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { InitialPaymentComplete } from "@/components/payments/InitialPaymentComplete";
import { InitialPaymentSummary } from "@/components/payments/InitialPaymentSummary";
import { PaymentOutcomePanel } from "@/components/payments/PaymentOutcomePanel";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { toConfirmedTrip } from "@/lib/confirmedTrip";
import { PLATFORM_FEE_MINOR } from "@/lib/payments/money";
import { getParticipantPaymentView, getPaymentAttemptStatus } from "@/lib/payments/service";
import { getTripForParticipant } from "@/lib/trips";

/**
 * The participant's payment experience.
 *
 * Three states share this route: the summary before they've paid anything,
 * the confirmation after their initial payment has settled, and the outcome
 * screen they land on coming back from Stripe.
 */
export default async function PayPage({
  params,
  searchParams,
}: PageProps<"/trips/[tripId]/pay">) {
  const { tripId } = await params;
  const { status: returnStatus, payment: paymentId } = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/trips/${tripId}/pay`);
  }

  const trip = await getTripForParticipant({ tripId, userId: session.user.id });
  if (!trip) {
    notFound();
  }

  const header = (
    <div className="flex flex-col gap-1">
      <Link href={`/trips/${tripId}`} className="text-sm text-teal-700 hover:underline">
        ← Back to {trip.name}
      </Link>
      <h1 className="text-xl font-semibold text-teal-950">Payments</h1>
    </div>
  );

  // Coming back from Stripe. Report on that specific attempt rather than the
  // overall position, and never claim success from the URL alone.
  const isReturn =
    typeof paymentId === "string" && (returnStatus === "returned" || returnStatus === "cancelled");

  let returnedAttempt = null;
  if (isReturn) {
    try {
      returnedAttempt = await getPaymentAttemptStatus({
        tripId,
        userId: session.user.id,
        paymentId,
      });
    } catch {
      // An unknown id, or one belonging to someone else: fall through to the
      // normal view rather than confirming that the id exists.
    }
  }

  if (returnedAttempt) {
    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <PaymentOutcomePanel
          tripId={tripId}
          initialStatus={returnedAttempt}
          returnKind={returnStatus === "cancelled" ? "cancelled" : "returned"}
        />
      </Container>
    );
  }

  const confirmed = toConfirmedTrip(trip);
  if (!confirmed) {
    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <EmptyState
          title="Nothing to pay for yet"
          description="Once the group confirms a destination, you'll be able to pay for your place here."
        />
      </Container>
    );
  }

  const view = await getParticipantPaymentView(tripId, session.user.id);

  if (view.totalTripAmount === 0) {
    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <EmptyState
          title="Waiting on the organizer"
          description="The organizer hasn't set the trip cost yet, so there's nothing to pay."
        />
      </Container>
    );
  }

  const paymentsAvailable = trip.settlementMode !== "UNCONFIGURED";

  // A payment they started but never finished. Offer to resume it rather than
  // silently starting a second one.
  const inFlight = view.payments.find(
    (payment) => payment.status === "PENDING" || payment.status === "PROCESSING",
  );
  if (inFlight) {
    const attempt = await getPaymentAttemptStatus({
      tripId,
      userId: session.user.id,
      paymentId: inFlight.id,
    });

    return (
      <Container className="flex flex-1 flex-col gap-4">
        {header}
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold text-teal-950">You have a payment in progress</h2>
          <p className="text-sm text-teal-950/70">
            We started a payment but haven&apos;t had confirmation yet. Picking up where you left
            off won&apos;t charge you twice.
          </p>
        </Card>
        <PaymentOutcomePanel tripId={tripId} initialStatus={attempt} returnKind="returned" />
      </Container>
    );
  }

  return (
    <Container className="flex flex-1 flex-col gap-4">
      {header}
      {view.initialPaymentPaid ? (
        <InitialPaymentComplete
          tripId={tripId}
          currency={view.currency}
          paidTowardsTrip={view.totalAmountPaid}
          platformFeePaid={view.platformFeePaid}
          platformFeeAmount={view.platformFeeMinor}
          remainingBalance={view.remainingBalance}
          paymentsAvailable={paymentsAvailable}
        />
      ) : (
        <InitialPaymentSummary
          tripId={tripId}
          destinationName={confirmed.destination.name}
          dates={confirmed.dates}
          currency={view.currency}
          totalTripAmount={view.totalTripAmount}
          requiredInitialPayment={view.requiredInitialPayment}
          platformFee={view.platformFeePaid ? 0 : PLATFORM_FEE_MINOR}
          paymentsAvailable={paymentsAvailable}
        />
      )}
    </Container>
  );
}
